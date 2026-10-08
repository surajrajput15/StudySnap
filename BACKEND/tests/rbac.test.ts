import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRole,
  hasPermission,
  requireRole,
  requirePermission,
  recordAuditLog,
  getFeatureFlagStatus,
  updateFeatureFlag,
  mockAuditLogs,
  mockFeatureFlags,
  mockUserRoles,
} from '../src/middleware/rbac';
import { UserRole, Permission, ROLE_PERMISSIONS } from '../src/config/constants';
import type { Request, Response } from 'express';

test('hasRole allows matching role and permits SUPER_ADMIN unconditionally', () => {
  assert.strictEqual(hasRole('USER', ['ADMIN']), false);
  assert.strictEqual(hasRole('ADMIN', ['ADMIN']), true);
  assert.strictEqual(hasRole('SUPER_ADMIN', ['ADMIN']), true);
  assert.strictEqual(hasRole('MODERATOR', ['ADMIN', 'SUPER_ADMIN']), false);
  assert.strictEqual(hasRole(undefined, ['ADMIN']), false);
});

test('hasPermission honors permission matrix and grants all to SUPER_ADMIN', () => {
  assert.strictEqual(hasPermission('USER', 'users.view'), false);
  assert.strictEqual(hasPermission('ADMIN', 'users.view'), true);
  assert.strictEqual(hasPermission('ADMIN', 'staff.manage'), false);
  assert.strictEqual(hasPermission('SUPER_ADMIN', 'staff.manage'), true);
  assert.strictEqual(hasPermission('ANALYST', 'ai.analytics.view'), true);
  assert.strictEqual(hasPermission('ANALYST', 'users.manage'), false);
});

test('requireRole blocks normal USER with 403 Forbidden', () => {
  const middleware = requireRole('ADMIN', 'SUPER_ADMIN');
  let statusSent = 0;
  let bodySent: any = null;
  let nextCalled = false;

  const req = { userRole: 'USER' } as Request;
  const res = {
    status(code: number) {
      statusSent = code;
      return this;
    },
    json(body: any) {
      bodySent = body;
      return this;
    },
  } as unknown as Response;
  const next = () => { nextCalled = true; };

  middleware(req, res, next);

  assert.strictEqual(statusSent, 403);
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(bodySent?.code, 'INSUFFICIENT_PERMISSIONS');
});

test('requireRole allows ADMIN and calls next()', () => {
  const middleware = requireRole('ADMIN');
  let nextCalled = false;

  const req = { userRole: 'ADMIN' } as Request;
  const res = {} as Response;
  const next = () => { nextCalled = true; };

  middleware(req, res, next);

  assert.strictEqual(nextCalled, true);
});

test('requirePermission allows authorized actions and denies unauthorized', () => {
  const middleware = requirePermission('users.manage');

  let nextCalled = false;
  middleware({ userRole: 'ADMIN' } as Request, {} as Response, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);

  let statusSent = 0;
  let nextCalledUser = false;
  const res = {
    status(code: number) {
      statusSent = code;
      return this;
    },
    json() { return this; },
  } as unknown as Response;

  middleware({ userRole: 'USER' } as Request, res, () => { nextCalledUser = true; });
  assert.strictEqual(statusSent, 403);
  assert.strictEqual(nextCalledUser, false);
});

test('feature flags can be read, disabled and re-enabled', async () => {
  const initial = await getFeatureFlagStatus('ai_summary');
  assert.strictEqual(initial, 'enabled');

  await updateFeatureFlag('ai_summary', 'disabled', 'admin_123');
  const disabled = await getFeatureFlagStatus('ai_summary');
  assert.strictEqual(disabled, 'disabled');

  await updateFeatureFlag('ai_summary', 'enabled', 'admin_123');
  const reEnabled = await getFeatureFlagStatus('ai_summary');
  assert.strictEqual(reEnabled, 'enabled');
});

test('recordAuditLog stores audit events in chronological order', async () => {
  mockAuditLogs.length = 0;
  await recordAuditLog({
    actorId: 'admin_test_1',
    actorEmail: 'admin@studysnap.ai',
    action: 'USER_SUSPEND',
    resourceType: 'user',
    resourceId: 'target_user_456',
    details: { reason: 'suspicious activity' },
  });

  assert.strictEqual(mockAuditLogs.length, 1);
  assert.strictEqual(mockAuditLogs[0].action, 'USER_SUSPEND');
  assert.strictEqual(mockAuditLogs[0].actorId, 'admin_test_1');
  assert.ok(mockAuditLogs[0].createdAt);
});
