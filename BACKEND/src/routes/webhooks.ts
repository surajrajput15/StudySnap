import { Router, raw, Request, Response } from 'express';
import { Webhook, WebhookVerificationError } from 'svix';
import { authLimiter } from '../middleware/rateLimiter';
import { env } from '../config/env';

const router = Router();

router.use(authLimiter);

router.post('/clerk', raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  if (!env.CLERK_WEBHOOK_SECRET) {
    console.error('[Webhook] ⚠️ CLERK_WEBHOOK_SECRET is not set. Rejecting webhook.');
    return res.status(500).json({ success: false, error: 'Webhook secret not configured' });
  }

  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
  const headers = {
    'svix-id': req.headers['svix-id'] as string,
    'svix-timestamp': req.headers['svix-timestamp'] as string,
    'svix-signature': req.headers['svix-signature'] as string,
  };

  if (!headers['svix-id'] || !headers['svix-timestamp'] || !headers['svix-signature']) {
    return res.status(400).json({ success: false, error: 'Missing Svix signature headers' });
  }

  let event: any;
  try {
    event = wh.verify(req.body, headers);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      console.warn('[Webhook] ❌ Invalid signature:', (error as any)?.message);
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }
    console.error('[Webhook] ❌ Verification error:', (error as any)?.message);
    return res.status(400).json({ success: false, error: 'Malformed webhook payload' });
  }

  try {
    if (!event?.type) {
      return res.status(400).json({ success: false, error: 'Malformed webhook event' });
    }

    console.log('[Webhook] Clerk event:', event.type);

    switch (event.type) {
      case 'user.created':
      case 'user.updated':
        break;
      case 'session.created':
        break;
      default:
        break;
    }

    res.json({ success: true, received: true });
  } catch (error: any) {
    console.error('[Webhook] Error:', error?.message);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

export default router;
