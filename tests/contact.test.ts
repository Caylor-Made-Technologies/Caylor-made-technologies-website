// Tests for the contact form function. Run: npm test
// Turnstile and Resend are faked, so no network or keys are needed.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, RATE_LIMIT_MAX, type Env } from '../functions/api/contact.ts';

const SITE = 'https://caylormade.example';
type Sent = { url: string; body: any };
let sent: Sent[] = [];
let turnstilePasses = true;

class MemoryKV {
  store = new Map<string, string>();
  async get(k: string) { return this.store.get(k) ?? null; }
  async put(k: string, v: string) { this.store.set(k, v); }
}

function env(kv = new MemoryKV()): Env {
  return {
    TURNSTILE_SECRET_KEY: 'secret',
    RESEND_API_KEY: 're_test',
    CONTACT_TO_EMAIL: 'owner@example.com',
    CONTACT_FROM_EMAIL: 'Website <form@example.com>',
    RATE_LIMIT: kv,
  };
}

const good = {
  name: 'Pat Rancher',
  email: 'pat@example.com',
  phone: '(806) 555-0100',
  business: 'Pat’s Feed & Seed',
  service: 'business',
  message: 'I need a website with a quote form for my feed store.',
  company_website: '',
  'cf-turnstile-response': 'token-123',
};

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${SITE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE, 'CF-Connecting-IP': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  sent = [];
  turnstilePasses = true;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('turnstile')) {
      const form = init?.body as FormData;
      sent.push({ url: u, body: Object.fromEntries(form) });
      return Response.json({ success: turnstilePasses, 'error-codes': turnstilePasses ? [] : ['invalid-input-response'] });
    }
    if (u.includes('resend')) {
      sent.push({ url: u, body: JSON.parse(String(init?.body)) });
      return Response.json({ id: 'email_1' });
    }
    throw new Error(`unexpected fetch ${u}`);
  }) as typeof fetch;
});

test('valid message: verifies Turnstile and sends a plain-text email', async () => {
  const res = await onRequestPost({ request: req(good), env: env() });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const ts = sent.find((s) => s.url.includes('turnstile'))!;
  assert.equal(ts.body.secret, 'secret');
  assert.equal(ts.body.response, 'token-123');
  const mail = sent.find((s) => s.url.includes('resend'))!.body;
  assert.deepEqual(mail.to, ['owner@example.com']);
  assert.equal(mail.reply_to, 'pat@example.com');
  assert.match(mail.subject, /Business Website from Pat Rancher/);
  assert.equal(mail.html, undefined);
  assert.match(mail.text, /feed store/);
});

test('validation errors are returned per field and nothing is sent', async () => {
  const res = await onRequestPost({ request: req({ ...good, name: '', email: 'not-an-email', service: 'hack', message: 'hi' }), env: env() });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.deepEqual(Object.keys(body.fields).sort(), ['email', 'message', 'name', 'service']);
  assert.equal(sent.length, 0);
});

test('HTML is stripped and header-injection newlines are removed', async () => {
  const res = await onRequestPost({
    request: req({ ...good, name: 'Pat<script>alert(1)</script>\r\nBcc: x@evil.test', message: 'Hello <b>there</b>, I need a site <img src=x onerror=alert(1)>' }),
    env: env(),
  });
  assert.equal(res.status, 200);
  const mail = sent.find((s) => s.url.includes('resend'))!.body;
  assert.ok(!mail.subject.includes('\n') && !mail.subject.includes('<'));
  assert.ok(!mail.text.includes('<'));
  assert.match(mail.text, /Hello there, I need a site/);
});

test('honeypot filled: pretends success, sends nothing', async () => {
  const res = await onRequestPost({ request: req({ ...good, company_website: 'http://spam.example' }), env: env() });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 0);
});

test('Turnstile failure blocks the message', async () => {
  turnstilePasses = false;
  const res = await onRequestPost({ request: req(good), env: env() });
  assert.equal(res.status, 403);
  assert.equal(sent.filter((s) => s.url.includes('resend')).length, 0);
});

test('missing Turnstile token is rejected without calling Cloudflare', async () => {
  const res = await onRequestPost({ request: req({ ...good, 'cf-turnstile-response': '' }), env: env() });
  assert.equal(res.status, 403);
  assert.equal(sent.length, 0);
});

test(`rate limit: request ${RATE_LIMIT_MAX + 1} from one IP within an hour gets 429`, async () => {
  const kv = new MemoryKV();
  for (let i = 0; i < RATE_LIMIT_MAX; i++) {
    assert.equal((await onRequestPost({ request: req(good), env: env(kv) })).status, 200);
  }
  const res = await onRequestPost({ request: req(good), env: env(kv) });
  assert.equal(res.status, 429);
  assert.ok(res.headers.get('Retry-After'));
  // Only a hash of the IP is stored, never the IP itself.
  assert.ok([...kv.store.keys()].every((k) => !k.includes('203.0.113.7')));
  // A different IP is not affected.
  assert.equal((await onRequestPost({ request: req(good, { 'CF-Connecting-IP': '198.51.100.2' }), env: env(kv) })).status, 200);
});

test('cross-site posts are refused', async () => {
  const res = await onRequestPost({ request: req(good, { Origin: 'https://evil.example' }), env: env() });
  assert.equal(res.status, 403);
  assert.equal(sent.length, 0);
});

test('oversized bodies, bad JSON, and non-JSON are refused', async () => {
  const big = await onRequestPost({ request: req({ ...good, message: 'x'.repeat(20000) }), env: env() });
  assert.equal(big.status, 413);
  const bad = await onRequestPost({ request: req('{not json'), env: env() });
  assert.equal(bad.status, 400);
  const form = await onRequestPost({ request: req('name=a', { 'Content-Type': 'application/x-www-form-urlencoded' }), env: env() });
  assert.equal(form.status, 415);
  assert.equal(sent.length, 0);
});

test('missing server config fails safely without leaking details', async () => {
  const res = await onRequestPost({ request: req(good), env: { ...env(), RESEND_API_KEY: undefined } });
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.doesNotMatch(body.error, /RESEND|env|key/i);
});
