/**
 * Turns what the learner types (a phone number or a username) into:
 * - a normalised value, so "+91 98765 43210" and "9876543210" are the same person;
 * - a short label to show on screen (phone numbers are masked);
 * - the file key in S3: a SHA-256 hash, so phone numbers never appear in URLs or file names.
 */
export type IdentityKind = 'phone' | 'username';

export interface Identity {
  kind: IdentityKind;
  /** "919876543210" or "asha_k" */
  value: string;
  /** "+91 ••••••3210" or "@asha_k" */
  label: string;
}

export type IdentityResult = { ok: true; identity: Identity } | { ok: false; error: string };

const USERNAME = /^[a-z][a-z0-9._-]{2,29}$/;

function phoneDigits(input: string): string | null {
  const compact = input.replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;
  let digits = compact.replace(/^\+/, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1); // 09876543210
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = `91${digits}`; // Indian mobile
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

function maskPhone(digits: string): string {
  const country = digits.startsWith('91') && digits.length === 12 ? '91' : '';
  const rest = digits.slice(country.length);
  return `${country ? '+91 ' : '+'}${'•'.repeat(Math.max(0, rest.length - 4))}${rest.slice(-4)}`;
}

export function parseIdentity(input: string): IdentityResult {
  const text = input.trim();
  if (text === '') return { ok: false, error: 'Enter your phone number or a username.' };

  if (/^[+\d\s().-]+$/.test(text)) {
    const digits = phoneDigits(text);
    return digits
      ? { ok: true, identity: { kind: 'phone', value: digits, label: maskPhone(digits) } }
      : {
          ok: false,
          error: 'That phone number looks incomplete. Use 10 digits, or add the country code.',
        };
  }

  const name = text.replace(/^@/, '').toLowerCase();
  return USERNAME.test(name)
    ? { ok: true, identity: { kind: 'username', value: name, label: `@${name}` } }
    : {
        ok: false,
        error:
          'A username is 3–30 characters: letters, numbers, dot, dash or underscore, starting with a letter.',
      };
}

/** 64 hex characters. The same identity always gives the same key, on every device. */
export async function identityKey(identity: Identity): Promise<string> {
  const bytes = new TextEncoder().encode(`devguru-progress-v1:${identity.kind}:${identity.value}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
