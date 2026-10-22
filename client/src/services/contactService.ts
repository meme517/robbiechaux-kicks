/**
 * Contact service (client). The form's true availability is reported by our
 * API (GET /api/contact/status). The client NEVER reports "Message sent"
 * unless POST /api/contact returns success from a configured provider.
 */
import { storeConfig } from '../config/storeConfig';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export interface ContactStatus {
  available: boolean;
  message: string;
}

const UNAVAILABLE: ContactStatus = {
  available: false,
  message:
    'No email provider is configured. The contact form is unavailable; please use phone or WhatsApp.',
};

export async function fetchContactStatus(): Promise<ContactStatus> {
  if (storeConfig.catalog.mode === 'demo') return UNAVAILABLE;
  try {
    const res = await fetch(`${API_BASE}/api/contact/status`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return UNAVAILABLE;
    const body = (await res.json()) as { data?: ContactStatus };
    return body.data ?? UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
}

export async function sendContactMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<{ ok: true }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error('Could not reach the store server. Please use WhatsApp or phone instead.');
  }
  if (!res.ok) {
    let message = 'Your message could not be sent right now. Please try WhatsApp instead.';
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return { ok: true };
}
