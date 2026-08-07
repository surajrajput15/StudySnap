import { Router, raw } from 'express';
import { Webhook, WebhookVerificationError } from 'svix';
import { env } from '../config/env';

const router = Router();

router.post('/clerk', raw({ type: 'application/json' }), async (req, res) => {
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
    if (event === null || typeof event !== 'object' || !('type' in event)) {
      res.status(400).json({ success: false, error: 'Malformed webhook event' });
      return;
    }

    const eventType = (event as { type: string }).type;
    console.log('[Webhook] Clerk event:', eventType);

    res.json({ success: true, received: true });
  } catch (error) {
    console.error('[Webhook] Error:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

export default router;