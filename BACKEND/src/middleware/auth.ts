import { verifyToken } from '@clerk/backend';
import { RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { getDb, users } from '../db';
import { UserRole, USER_ROLES, ROLE_PERMISSIONS } from '../config/constants';
import { mockUserRoles } from './rbac';

export async function verifySession(token: string): Promise<{ userId: string; role?: UserRole; email?: string }> {
  if (!env.CLERK_SECRET_KEY) {
    throw new Error('Clerk not configured');
  }
  const claims = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
  if (!claims?.sub) {
    throw new Error('Invalid session');
  }
  const meta = ((claims as Record<string, unknown>).metadata || (claims as Record<string, unknown>).public_metadata || {}) as Record<string, unknown>;
  const role = (meta.role || (claims as Record<string, unknown>).role) as UserRole | undefined;
  const email = (claims as Record<string, unknown>).email as string | undefined;
  return { userId: claims.sub, role, email };
}

export const userEmailCache = new Map<string, string>();

export async function resolveUserEmail(userId: string, claimEmail?: string): Promise<string | undefined> {
  if (claimEmail) {
    userEmailCache.set(userId, claimEmail);
    return claimEmail;
  }
  if (userEmailCache.has(userId)) {
    return userEmailCache.get(userId);
  }
  if (!env.CLERK_SECRET_KEY) return undefined;

  try {
    const { createClerkClient } = await import('@clerk/backend');
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
    const user = await clerk.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress;
    if (email) {
      userEmailCache.set(userId, email);
      return email;
    }
  } catch {
    /* non-blocking */
  }
  return undefined;
}

export const authMiddleware: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const tokenHeader = req.headers['x-session-token'];
  const sessionToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

  if (!sessionToken && !req.userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  try {
    let userId = req.userId;
    let claimRole = req.userRole;
    let email = req.userEmail;

    if (sessionToken) {
      if (!env.isProd() && sessionToken.startsWith('test_')) {
        userId = userId || sessionToken;
      } else {
        const session = await verifySession(sessionToken);
        userId = session.userId;
        claimRole = session.role;
        email = session.email;
      }
    }

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    req.userId = userId;
    const userEmail = await resolveUserEmail(userId, email);
    req.userEmail = userEmail;

    // Resolve user role and check suspension
    let resolvedRole: UserRole = 'USER';
    let isSuspended = false;

    // Check Super Admin and Admin email overrides
    const superAdminEmails = (env.SUPER_ADMIN_EMAILS || 'surajdona2005@gmail.com')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const adminEmails = (env.ADMIN_EMAILS || 'surajdona2005@gmail.com')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const adminUserIds = env.ADMIN_USER_IDS
      ? env.ADMIN_USER_IDS.split(',').map((id) => id.trim()).filter(Boolean)
      : [];

    if (userEmail && superAdminEmails.includes(userEmail.toLowerCase())) {
      resolvedRole = 'SUPER_ADMIN';
    } else if (adminUserIds.includes(userId) || (userEmail && adminEmails.includes(userEmail.toLowerCase()))) {
      resolvedRole = 'ADMIN';
    } else if (claimRole && USER_ROLES.includes(claimRole)) {
      resolvedRole = claimRole;
    }

    // Check database or mock
    const db = getDb();
    if (db) {
      try {
        const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (userRows.length > 0) {
          const u = userRows[0];
          if (u.isSuspended) isSuspended = true;
          if (u.email && superAdminEmails.includes(u.email.toLowerCase())) {
            resolvedRole = 'SUPER_ADMIN';
          } else if (u.role && USER_ROLES.includes(u.role as UserRole) && resolvedRole === 'USER') {
            resolvedRole = u.role as UserRole;
          }
        }
      } catch {
        /* db lookup error shouldn't crash auth */
      }
    } else {
      const mock = mockUserRoles.get(userId);
      if (mock) {
        if (mock.isSuspended) isSuspended = true;
        if (mock.email && superAdminEmails.includes(mock.email.toLowerCase())) {
          resolvedRole = 'SUPER_ADMIN';
        } else if (mock.role && resolvedRole === 'USER') {
          resolvedRole = mock.role;
        }
      }
    }

    // In non-production testing, allow test role override if passed via header
    if (!env.isProd() && req.headers['x-test-role']) {
      const testRole = String(req.headers['x-test-role']) as UserRole;
      if (USER_ROLES.includes(testRole)) resolvedRole = testRole;
    }

    if (isSuspended) {
      res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact support.',
        code: 'USER_SUSPENDED',
      });
      return;
    }

    req.userRole = resolvedRole;
    req.userPermissions = ROLE_PERMISSIONS[resolvedRole] || [];

    // Day 14 Task 8 — authenticated responses carry personal study data and must
    // never be cached by a shared proxy/CDN.
    res.set('Cache-Control', 'no-store');
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
};