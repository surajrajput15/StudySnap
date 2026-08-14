import { verifyToken } from '@clerk/backend';
import { RequestHandler } from 'express';
import { env } from '../config/env';

export async function verifySession(token: string): Promise<{ userId: string }> {
  if (!env.CLERK_SECRET_KEY) {
    throw new Error('Clerk not configured');
  }
  const claims = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
  if (!claims?.sub) {
    throw new Error('Invalid session');
  }
  return { userId: claims.sub };
}

export const authMiddleware: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const tokenHeader = req.headers['x-session-token'];
  const sessionToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

  if (!sessionToken) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  try {
    const { userId } = await verifySession(sessionToken);
    req.userId = userId;
    // Day 14 Task 8 — authenticated responses carry personal study data and must
    // never be cached by a shared proxy/CDN.
    res.set('Cache-Control', 'no-store');
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
};