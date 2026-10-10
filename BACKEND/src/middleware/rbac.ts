import { RequestHandler, Request, Response, NextFunction } from 'express';
import { getDb, auditLogs, featureFlags, aiRequestLogs, users } from '../db';
import { eq } from 'drizzle-orm';
import {
  UserRole,
  USER_ROLES,
  Permission,
  ROLE_PERMISSIONS,
  AI_FEATURE_KEYS,
  AiFeatureKey,
} from '../config/constants';
import { generateId } from '../utils/helpers';
import { dispatchAiSuccessAlert, dispatchAiErrorAlert, dispatchSecurityAlert } from '../services/alertDispatcher';
import { maskUserRef } from '../services/telegram';

export interface AuditLogEntry {
  actorId: string;
  actorEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown> | string;
  ipAddress?: string;
}

export interface AiRequestLogEntry {
  userId?: string;
  feature: string;
  model: string;
  durationMs: number;
  inputChars?: number;
  outputChars?: number;
  success: boolean;
  statusCode?: number;
  errorMessage?: string;
  isPdf?: boolean;
  tokens?: number;
}

// In-memory fallback stores for test and development mode when DATABASE_URL is unset.
export const mockUserRoles = new Map<string, { role: UserRole; isSuspended: boolean; email?: string }>();
export const mockFeatureFlags = new Map<string, { status: 'enabled' | 'maintenance' | 'disabled'; name: string; description?: string }>();
export const mockAuditLogs: Array<{
  id: string;
  actorId: string;
  actorEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}> = [];

export const mockAiRequestLogs: Array<{
  id: string;
  userId?: string;
  feature: string;
  model: string;
  durationMs: number;
  inputChars: number;
  outputChars: number;
  success: boolean;
  statusCode: number;
  errorMessage?: string;
  createdAt: string;
}> = [];

// Initialize default feature flags
for (const key of AI_FEATURE_KEYS) {
  mockFeatureFlags.set(key, {
    status: 'enabled',
    name: key.replace(/_/g, ' ').toUpperCase(),
    description: `Core feature flag for ${key}`,
  });
}

/** Check if a role possesses the necessary tier */
export function hasRole(userRole: UserRole | undefined, allowedRoles: readonly UserRole[]): boolean {
  if (!userRole) return false;
  if (userRole === 'SUPER_ADMIN') return true;
  return allowedRoles.includes(userRole);
}

/** Check if a role has the required permission */
export function hasPermission(userRole: UserRole | undefined, permission: Permission): boolean {
  if (!userRole) return false;
  if (userRole === 'SUPER_ADMIN') return true;
  const perms = ROLE_PERMISSIONS[userRole] || [];
  return perms.includes(permission);
}

/** RBAC Middleware: Enforces that the user has at least one of the specified roles */
export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.userRole;
    if (!role || !hasRole(role, allowedRoles)) {
      dispatchSecurityAlert({
        issue: 'Unauthorized Admin route access attempt',
        userRef: maskUserRef(req.userId),
        endpoint: req.originalUrl,
        action: 'Blocked (403 Forbidden)',
        details: `Role '${role || 'NONE'}' denied access to [${allowedRoles.join(', ')}]`,
      });
      res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to access this resource.',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return;
    }
    next();
  };
}

/** Permission Middleware: Enforces that the user has a specific permission */
export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.userRole;
    if (!role) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Authentication required.',
        code: 'AUTH_REQUIRED',
      });
      return;
    }
    const hasAll = permissions.every((perm) => hasPermission(role, perm));
    if (!hasAll) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Insufficient privileges for this action.',
        code: 'PERMISSION_DENIED',
      });
      return;
    }
    next();
  };
}

let dbHasFeatureFlagsTable: boolean | null = null;
let dbHasAuditLogsTable: boolean | null = null;
let dbHasAiRequestLogsTable: boolean | null = null;

function isTableMissingError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const code = (err as { code?: string })?.code;
  return code === '42P01' || msg.includes('does not exist') || msg.includes('relation');
}

/** Record an administrative or security audit event */
export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  const detailsStr = typeof entry.details === 'object' ? JSON.stringify(entry.details) : (entry.details || null);
  const now = new Date();

  if (dbHasAuditLogsTable !== false) {
    try {
      const db = getDb();
      if (db) {
        await db.insert(auditLogs).values({
          actorId: entry.actorId,
          actorEmail: entry.actorEmail || null,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId || null,
          details: detailsStr,
          ipAddress: entry.ipAddress || null,
          createdAt: now,
        });
        dbHasAuditLogsTable = true;
        return;
      }
    } catch (err) {
      if (isTableMissingError(err)) {
        dbHasAuditLogsTable = false;
      }
    }
  }

  // Fallback to in-memory store
  mockAuditLogs.unshift({
    id: generateId(),
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    details: detailsStr || undefined,
    ipAddress: entry.ipAddress,
    createdAt: now.toISOString(),
  });
  if (mockAuditLogs.length > 500) mockAuditLogs.length = 500;
}

/** Record operational telemetry for an AI request */
export async function recordAiTelemetry(entry: AiRequestLogEntry): Promise<void> {
  const now = new Date();
  if (dbHasAiRequestLogsTable !== false) {
    try {
      const db = getDb();
      if (db) {
        await db.insert(aiRequestLogs).values({
          userId: entry.userId || null,
          feature: entry.feature,
          model: entry.model,
          durationMs: entry.durationMs,
          inputChars: entry.inputChars || 0,
          outputChars: entry.outputChars || 0,
          success: entry.success,
          statusCode: entry.statusCode || (entry.success ? 200 : 500),
          errorMessage: entry.errorMessage || null,
          createdAt: now,
        });
        dbHasAiRequestLogsTable = true;
        return;
      }
    } catch (err) {
      if (isTableMissingError(err)) {
        dbHasAiRequestLogsTable = false;
      }
    }
  }

  mockAiRequestLogs.unshift({
    id: generateId(),
    userId: entry.userId,
    feature: entry.feature,
    model: entry.model,
    durationMs: entry.durationMs,
    inputChars: entry.inputChars || 0,
    outputChars: entry.outputChars || 0,
    success: entry.success,
    statusCode: entry.statusCode || (entry.success ? 200 : 500),
    errorMessage: entry.errorMessage,
    createdAt: now.toISOString(),
  });
  if (mockAiRequestLogs.length > 500) mockAiRequestLogs.length = 500;

  // Telegram AI monitoring hook
  if (entry.success) {
    dispatchAiSuccessAlert({
      feature: entry.feature,
      durationMs: entry.durationMs,
      model: entry.model,
      userId: entry.userId,
      isPdf: entry.isPdf,
      tokens: entry.tokens,
    });
  } else {
    dispatchAiErrorAlert({
      feature: entry.feature,
      error: entry.errorMessage || 'AI provider error',
      statusCode: entry.statusCode || 500,
      userId: entry.userId,
      isPdf: entry.isPdf,
    });
  }
}

/** Get the status of an AI feature flag */
export async function getFeatureFlagStatus(featureKey: string): Promise<'enabled' | 'maintenance' | 'disabled'> {
  if (dbHasFeatureFlagsTable !== false) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db.select().from(featureFlags).where(eq(featureFlags.featureKey, featureKey)).limit(1);
        dbHasFeatureFlagsTable = true;
        if (rows.length > 0) {
          return rows[0].status as 'enabled' | 'maintenance' | 'disabled';
        }
      }
    } catch (err) {
      if (isTableMissingError(err)) {
        dbHasFeatureFlagsTable = false;
      }
    }
  }

  const mock = mockFeatureFlags.get(featureKey);
  return mock ? mock.status : 'enabled';
}

/** Update an AI feature flag */
export async function updateFeatureFlag(
  featureKey: string,
  status: 'enabled' | 'maintenance' | 'disabled',
  updatedBy: string
): Promise<void> {
  const now = new Date();
  if (dbHasFeatureFlagsTable !== false) {
    try {
      const db = getDb();
      if (db) {
        const existing = await db.select().from(featureFlags).where(eq(featureFlags.featureKey, featureKey)).limit(1);
        dbHasFeatureFlagsTable = true;
        if (existing.length > 0) {
          await db
            .update(featureFlags)
            .set({ status, updatedBy, updatedAt: now })
            .where(eq(featureFlags.featureKey, featureKey));
        } else {
          await db.insert(featureFlags).values({
            featureKey,
            name: featureKey.replace(/_/g, ' ').toUpperCase(),
            status,
            updatedBy,
            updatedAt: now,
          });
        }
        return;
      }
    } catch (err) {
      if (isTableMissingError(err)) {
        dbHasFeatureFlagsTable = false;
      }
    }
  }

  const current = mockFeatureFlags.get(featureKey) || {
    name: featureKey.replace(/_/g, ' ').toUpperCase(),
    status: 'enabled',
  };
  mockFeatureFlags.set(featureKey, { ...current, status });
}

