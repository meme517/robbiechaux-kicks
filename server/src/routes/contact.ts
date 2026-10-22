import { Router } from 'express';
import { z } from 'zod';
import { config, hasContactProvider } from '../config/env.js';
import { contactMessagesCollection } from '../db/mongo.js';
import { ApiError } from '../middleware/errors.js';

export const contactRouter = Router();

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(10).max(5000),
});

/**
 * GET /api/contact/status — tells the UI whether the form can actually send.
 * When no provider is configured the UI hides the form and offers phone/WhatsApp.
 */
contactRouter.get('/status', (_req, res) => {
  res.json({
    data: {
      available: hasContactProvider(),
      message: hasContactProvider()
        ? 'The contact form is configured and can deliver messages.'
        : 'No email provider is configured. The contact form is unavailable; please use phone or WhatsApp.',
    },
  });
});

/**
 * POST /api/contact — only reports success when the configured provider
 * actually accepts the message. Without a provider this returns 503 so the UI
 * can never display a false "Message sent".
 */
contactRouter.post('/', async (req, res, next) => {
  try {
    if (!hasContactProvider()) {
      throw new ApiError(
        'The contact form is not configured. Please call or WhatsApp the store instead.',
        503,
        'contact_unavailable',
      );
    }
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        `Invalid message: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
        400,
        'invalid_message',
      );
    }

    // Persist locally first so nothing is silently lost. Best-effort: a
    // database hiccup must not block a message the provider can still deliver.
    let storedId: unknown = null;
    try {
      const inserted = await contactMessagesCollection().insertOne({
        ...parsed.data,
        createdAt: new Date().toISOString(),
        forwarded: false,
      });
      storedId = inserted.insertedId;
    } catch (err) {
      console.error('[api] contact message not persisted:', err instanceof Error ? err.message : err);
    }

    const endpoint = config.contact.endpoint as string;
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(config.contact.apiKey ? { Authorization: `Bearer ${config.contact.apiKey}` } : {}),
      },
      body: JSON.stringify({
        ...parsed.data,
        to: config.contact.toEmail ?? undefined,
      }),
    });

    if (!upstream.ok) {
      throw new ApiError(
        'The message could not be delivered by the configured provider.',
        502,
        'delivery_failed',
      );
    }

    if (storedId) {
      try {
        await contactMessagesCollection().updateOne({ _id: storedId } as never, { $set: { forwarded: true } });
      } catch (err) {
        console.error('[api] contact forward flag not updated:', err instanceof Error ? err.message : err);
      }
    }

    res.json({ data: { ok: true, message: 'Message sent.' } });
  } catch (err) {
    next(err);
  }
});
