// POST /api/contact (Cloudflare Pages Function)
// The only server code on the site. Order of checks:
//   same-origin -> size limit -> JSON -> honeypot -> rate limit -> field validation
//   -> Turnstile (server-side) -> send email with Resend.
// Secrets come only from environment variables (see .env.example and README).
import { validateContact, SERVICES } from '../../src/lib/contact-rules.ts';

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export interface Env {
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_FROM_EMAIL?: string;
  /** KV namespace binding for per-IP rate limiting. */
  RATE_LIMIT?: KV;
}

interface Context {
  request: Request;
  env: Env;
}

export const MAX_BODY_BYTES = 16 * 1024;
export const RATE_LIMIT_MAX = 5; // messages per IP...
export const RATE_LIMIT_WINDOW = 60 * 60; // ...per hour (seconds)

const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RESEND_URL = 'https://api.resend.com/emails';

function json(status: number, body: Record<string, unknown>, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

const FAIL_MESSAGE = 'Sorry, your message could not be sent right now. Please email or call me instead.';

function sameHost(origin: string, url: string): boolean {
  try {
    return new URL(origin).host === new URL(url).host;
  } catch {
    return false; // e.g. Origin: null
  }
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Counts this request and reports whether the IP is over the limit. Stores only a hash of the IP. */
async function overRateLimit(kv: KV | undefined, ip: string): Promise<boolean> {
  if (!kv) {
    console.warn('[contact] RATE_LIMIT KV binding missing: rate limiting is OFF');
    return false;
  }
  const key = `rl:${await sha256(ip)}`;
  const count = Number((await kv.get(key)) ?? 0);
  if (count >= RATE_LIMIT_MAX) return true;
  await kv.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW });
  return false;
}

async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch(TURNSTILE_URL, { method: 'POST', body: form });
    const out = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (!out.success) console.warn('[contact] Turnstile rejected:', out['error-codes']?.join(','));
    return out.success === true;
  } catch (err) {
    console.error('[contact] Turnstile request failed', err);
    return false;
  }
}

export const onRequestPost = async ({ request, env }: Context): Promise<Response> => {
  // 1. Only accept posts from this site's own pages.
  const origin = request.headers.get('Origin');
  if (origin && !sameHost(origin, request.url)) {
    return json(403, { ok: false, error: 'This form can only be sent from the website.' });
  }

  // 2. Size limit and JSON only.
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) {
    return json(415, { ok: false, error: FAIL_MESSAGE });
  }
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > MAX_BODY_BYTES) return json(413, { ok: false, error: 'Your message is too long.' });
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'Your message is too long.' });

  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    raw = parsed as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: FAIL_MESSAGE });
  }

  // 3. Honeypot: bots fill the hidden field. Pretend it worked and send nothing.
  if (typeof raw.company_website === 'string' && raw.company_website.trim() !== '') {
    return json(200, { ok: true });
  }

  // 4. Rate limit per IP.
  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  if (await overRateLimit(env.RATE_LIMIT, ip || 'unknown')) {
    return json(429, { ok: false, error: 'Too many messages from your connection. Please try again in an hour, or email me directly.' }, { 'Retry-After': String(RATE_LIMIT_WINDOW) });
  }

  // 5. Validate every field on the server.
  const { data, errors } = validateContact(raw);
  if (Object.keys(errors).length > 0) {
    return json(400, { ok: false, error: 'Please fix the highlighted fields.', fields: errors });
  }

  // 6. Server configuration check (never reveal details to the visitor).
  const { TURNSTILE_SECRET_KEY, RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL } = env;
  if (!TURNSTILE_SECRET_KEY || !RESEND_API_KEY || !CONTACT_TO_EMAIL || !CONTACT_FROM_EMAIL) {
    console.error('[contact] Missing environment variables; see .env.example');
    return json(500, { ok: false, error: FAIL_MESSAGE });
  }

  // 7. Spam check, verified with Cloudflare (never trust the browser).
  const token = typeof raw['cf-turnstile-response'] === 'string' ? raw['cf-turnstile-response'] : '';
  if (!token || token.length > 2048 || !(await verifyTurnstile(TURNSTILE_SECRET_KEY, token, ip))) {
    return json(403, { ok: false, error: 'We couldn’t confirm you’re not a robot. Please refresh the page and try again.' });
  }

  // 8. Send as plain text (no HTML, so nothing in the message can be rendered as code).
  const lines = [
    `New message from the website contact form`,
    ``,
    `Name:      ${data.name}`,
    `Email:     ${data.email}`,
    `Phone:     ${data.phone || '(not given)'}`,
    `Business:  ${data.business || '(not given)'}`,
    `Needs:     ${SERVICES[data.service]}`,
    ``,
    `Message:`,
    data.message,
    ``,
    `Reply to this email to answer ${data.name} directly.`,
  ];
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: CONTACT_FROM_EMAIL,
        to: [CONTACT_TO_EMAIL],
        reply_to: data.email,
        subject: `New inquiry: ${SERVICES[data.service]} from ${data.name}`.slice(0, 200),
        text: lines.join('\n'),
      }),
    });
    if (!res.ok) {
      console.error('[contact] Resend error', res.status, await res.text().catch(() => ''));
      return json(502, { ok: false, error: FAIL_MESSAGE });
    }
  } catch (err) {
    console.error('[contact] Resend request failed', err);
    return json(502, { ok: false, error: FAIL_MESSAGE });
  }

  return json(200, { ok: true });
};
