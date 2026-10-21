// Contact form rules, shared by the browser (src/scripts/contact.ts) and the
// server (functions/api/contact.ts). The server is the one that counts:
// the browser checks are only there to give quick feedback.

export const SERVICES = {
  starter: 'Starter Website',
  business: 'Business Website',
  custom: 'Custom tool',
  care: 'Care plan',
  unsure: 'Not sure',
} as const;
export type ServiceId = keyof typeof SERVICES;

export const LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  business: 120,
  message: 4000,
  messageMin: 10,
} as const;

export interface ContactInput {
  name: string;
  email: string;
  phone: string;
  business: string;
  service: ServiceId;
  message: string;
}

export type FieldErrors = Partial<Record<keyof ContactInput, string>>;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const PHONE_RE = /^[0-9+().\-\s]{7,30}$/;

/** Removes HTML tags, control characters, and extra whitespace. */
export function clean(value: unknown, { multiline = false } = {}): string {
  if (typeof value !== 'string') return '';
  let v = value.normalize('NFC').replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
  v = multiline
    ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n')
    : v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ');
  return v.trim();
}

/** Cleans and checks every field. Returns the clean values and any errors. */
export function validateContact(raw: Record<string, unknown>): { data: ContactInput; errors: FieldErrors } {
  const data: ContactInput = {
    name: clean(raw.name),
    email: clean(raw.email).toLowerCase(),
    phone: clean(raw.phone),
    business: clean(raw.business),
    service: (typeof raw.service === 'string' && raw.service in SERVICES ? raw.service : '') as ServiceId,
    message: clean(raw.message, { multiline: true }),
  };
  const errors: FieldErrors = {};

  if (!data.name) errors.name = 'Please enter your name.';
  else if (data.name.length > LIMITS.name) errors.name = `Please keep your name under ${LIMITS.name} characters.`;

  if (!data.email) errors.email = 'Please enter your email.';
  else if (data.email.length > LIMITS.email || !EMAIL_RE.test(data.email)) errors.email = 'Please enter a valid email, like name@example.com.';

  if (data.phone && !PHONE_RE.test(data.phone)) errors.phone = 'Please enter a valid phone number, or leave it blank.';
  else if (data.phone && data.phone.replace(/\D/g, '').length < 7) errors.phone = 'Please enter a valid phone number, or leave it blank.';

  if (data.business.length > LIMITS.business) errors.business = `Please keep this under ${LIMITS.business} characters.`;

  if (!data.service) errors.service = 'Please choose what you need.';

  if (data.message.length < LIMITS.messageMin) errors.message = 'Please tell me a little about what you need (at least a sentence).';
  else if (data.message.length > LIMITS.message) errors.message = `Please keep your message under ${LIMITS.message} characters.`;

  return { data, errors };
}
