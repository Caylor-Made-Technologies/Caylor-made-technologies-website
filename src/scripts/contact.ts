// Contact form: quick checks in the browser, then sends to /api/contact.
import { validateContact, SERVICES, type FieldErrors } from '../lib/contact-rules';

declare global {
  interface Window { turnstile?: { reset: (widget?: string) => void } }
}

const form = document.querySelector<HTMLFormElement>('#contact-form');
const success = document.querySelector<HTMLElement>('#form-success');
const banner = document.querySelector<HTMLElement>('#form-error');

const FIELDS = ['name', 'email', 'phone', 'business', 'service', 'message'] as const;
const FALLBACK = 'Something went wrong sending your message. Please try again, or email me directly.';

function showFieldErrors(f: HTMLFormElement, errors: FieldErrors) {
  for (const name of FIELDS) {
    const input = f.elements.namedItem(name) as HTMLInputElement | null;
    const slot = document.getElementById(`${name}-error`);
    const msg = errors[name] ?? '';
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (slot) slot.textContent = msg;
  }
}

function showBanner(message: string) {
  if (!banner) return;
  banner.textContent = message;
  banner.hidden = false;
  banner.focus();
}

function setBusy(f: HTMLFormElement, busy: boolean) {
  const btn = f.querySelector<HTMLButtonElement>('button[type="submit"]');
  const label = f.querySelector<HTMLElement>('.submit__label');
  if (btn) btn.disabled = busy;
  if (label) label.textContent = busy ? 'Sending…' : 'Send Message';
  f.setAttribute('aria-busy', String(busy));
}

if (form) {
  // Preselect the service when arriving from a pricing card (?service=business).
  const pre = new URLSearchParams(location.search).get('service');
  const select = form.elements.namedItem('service') as HTMLSelectElement | null;
  if (pre && select && pre in SERVICES) select.value = pre;

  // Clear a field's error as soon as it's fixed (while typing, so the layout
  // doesn't shift under the visitor's finger when they tap Send).
  const recheck = (e: Event) => {
    const el = e.target as HTMLInputElement;
    if (el.getAttribute('aria-invalid') !== 'true') return;
    const { errors } = validateContact(Object.fromEntries(new FormData(form)));
    const slot = document.getElementById(`${el.name}-error`);
    const msg = errors[el.name as keyof FieldErrors] ?? '';
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (slot) slot.textContent = msg;
  };
  form.addEventListener('input', recheck);
  form.addEventListener('change', recheck);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (banner) banner.hidden = true;

    const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const { errors } = validateContact(values);
    showFieldErrors(form, errors);
    const firstBad = FIELDS.find((n) => errors[n]);
    if (firstBad) {
      (form.elements.namedItem(firstBad) as HTMLElement | null)?.focus();
      return;
    }
    if (!values['cf-turnstile-response']) {
      showBanner('Please wait a moment for the spam check to finish, then press Send again.');
      return;
    }

    setBusy(form, true);
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; fields?: FieldErrors };
      if (res.ok && body.ok) {
        form.reset();
        form.hidden = true;
        if (success) { success.hidden = false; success.focus(); }
        return;
      }
      if (body.fields) showFieldErrors(form, body.fields);
      showBanner(body.error || FALLBACK);
    } catch {
      showBanner('You appear to be offline. Check your connection and try again.');
    } finally {
      setBusy(form, false);
      window.turnstile?.reset();
    }
  });
}
