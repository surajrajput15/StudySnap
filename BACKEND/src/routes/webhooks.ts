import { Router, raw } from 'express';
import { Webhook, WebhookVerificationError } from 'svix';
import { env } from '../config/env';
import { getDb, users } from '../db';
import { webhookLimiter } from '../middleware/rateLimiter';
import { clerkEventSchema, clerkUserCreatedDataSchema } from '../middleware/validate';

const router = Router();

router.post('/clerk', webhookLimiter, raw({ type: 'application/json' }), async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!env.CLERK_WEBHOOK_SECRET) {
    console.error('[Webhook] ⚠️ CLERK_WEBHOOK_SECRET is not set. Rejecting webhook.');
    res.status(500).json({ success: false, error: 'Webhook secret not configured' });
    return;
  }

  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
  const headers = {
    'svix-id': req.headers['svix-id'] as string,
    'svix-timestamp': req.headers['svix-timestamp'] as string,
    'svix-signature': req.headers['svix-signature'] as string,
  };

  if (!headers['svix-id'] || !headers['svix-timestamp'] || !headers['svix-signature']) {
    res.status(400).json({ success: false, error: 'Missing Svix signature headers' });
    return;
  }

  let event: unknown;
  try {
    event = wh.verify(req.body, headers);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      console.warn('[Webhook] ❌ Invalid signature:', error.message);
      res.status(401).json({ success: false, error: 'Invalid webhook signature' });
      return;
    }
    console.error('[Webhook] ❌ Verification error:', error instanceof Error ? error.message : error);
    res.status(400).json({ success: false, error: 'Malformed webhook payload' });
    return;
  }

  try {
    const parsedEvent = clerkEventSchema.safeParse(event);
    if (!parsedEvent.success) {
      res.status(400).json({ success: false, error: 'Malformed webhook event' });
      return;
    }

    const eventType = parsedEvent.data.type;
    console.log('[Webhook] Clerk event:', eventType);

    if (eventType === 'user.created') {
      const userData = (event as { data?: unknown })?.data;
      const parsedUser = clerkUserCreatedDataSchema.safeParse(userData);
      if (parsedUser.success && parsedUser.data.id) {
        const { id, first_name, last_name } = parsedUser.data;
        const name = ([first_name, last_name].filter(Boolean).join(' ').trim().slice(0, 200) || 'Student');
        try {
          const db = getDb();
          if (db) {
            await db.insert(users).values({ id, name }).onConflictDoNothing({ target: users.id });
          }
        } catch (e) {
          console.error('[Webhook] user upsert failed:', e instanceof Error ? e.message : e);
        }
      }
    }

    res.json({ success: true, received: true });
  } catch (error) {
    console.error('[Webhook] Error:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

export default router;