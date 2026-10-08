import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AddressInfo } from 'net';
import adminRouter from '../src/routes/admin';
import aiRouter from '../src/routes/ai';
import userToolsRouter from '../src/routes/user-tools';
import { updateFeatureFlag, mockUserRoles, mockAuditLogs } from '../src/middleware/rbac';
import { mockUserQuizzes } from '../src/routes/user-tools';
import type { Request, Response, NextFunction } from 'express';

let activeServer: import('http').Server | null = null;

async function startServer(role: 'USER' | 'ADMIN' | 'SUPER_ADMIN' = 'ADMIN', userId: string = 'test_user_admin') {
  const app = express();
  app.use(express.json());

  // Test auth middleware injecting session details
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.userId = userId;
    req.userEmail = `${userId}@example.com`;
    req.userRole = role;
    next();
  });

  app.use('/api/admin', adminRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/user', userToolsRouter);

  const srv = app.listen(0);
  await new Promise<void>((r) => srv.once('listening', r));
  const port = (srv.address() as AddressInfo).port;
  activeServer = srv;
  return { srv, base: `http://127.0.0.1:${port}` };
}

afterEach(() => {
  if (activeServer) {
    activeServer.close();
    activeServer = null;
  }
});

test('Admin overview denies normal USER with 403 Forbidden', async () => {
  const { base } = await startServer('USER', 'student_123');
  const res = await fetch(`${base}/api/admin/overview`);
  const body = await res.json() as any;

  assert.strictEqual(res.status, 403);
  assert.strictEqual(body?.code, 'INSUFFICIENT_PERMISSIONS');
});

test('Admin overview allows ADMIN with 200 and real platform metrics', async () => {
  const { base } = await startServer('ADMIN', 'admin_456');
  const res = await fetch(`${base}/api/admin/overview`);
  const body = await res.json() as any;

  assert.strictEqual(res.status, 200);
  assert.strictEqual(body?.success, true);
  assert.ok(body?.metrics);
  assert.ok(body?.systemStatus);
  assert.ok(Array.isArray(body?.actionRequired));
});

test('Admin user management allows searching and filtering users', async () => {
  const { base } = await startServer('ADMIN', 'admin_456');
  mockUserRoles.set('student_alpha', { role: 'USER', isSuspended: false, email: 'alpha@school.edu' });
  mockUserRoles.set('student_beta', { role: 'USER', isSuspended: true, email: 'beta@school.edu' });

  const res = await fetch(`${base}/api/admin/users?status=suspended`);
  const body = await res.json() as any;

  assert.strictEqual(res.status, 200);
  assert.strictEqual(body?.success, true);
  assert.ok(Array.isArray(body?.users));
  const suspended = body.users.find((u: any) => u.id === 'student_beta');
  assert.ok(suspended);
  assert.strictEqual(suspended.isSuspended, true);
});

test('Admin user suspension toggles status and records an audit log', async () => {
  const { base } = await startServer('ADMIN', 'admin_456');
  mockAuditLogs.length = 0;
  mockUserRoles.set('student_gamma', { role: 'USER', isSuspended: false, email: 'gamma@school.edu' });

  const res = await fetch(`${base}/api/admin/users/student_gamma/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ isSuspended: true, reason: 'Suspected cheating' }),
  });
  const body = await res.json() as any;

  assert.strictEqual(res.status, 200);
  assert.strictEqual(body?.isSuspended, true);

  const updated = mockUserRoles.get('student_gamma');
  assert.strictEqual(updated?.isSuspended, true);

  assert.strictEqual(mockAuditLogs.length, 1);
  assert.strictEqual(mockAuditLogs[0].action, 'USER_SUSPEND');
  assert.strictEqual(mockAuditLogs[0].resourceId, 'student_gamma');
});

test('Feature flag kill-switch disables AI tool and returns 503 Maintenance', async () => {
  const { base } = await startServer('USER', 'normal_student');

  await updateFeatureFlag('ai_summary', 'disabled', 'admin_tester');

  const res = await fetch(`${base}/api/ai/summarize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Physics', content: 'Newton laws of motion.' }),
  });
  const body = await res.json() as any;

  assert.strictEqual(res.status, 503);
  assert.strictEqual(body?.code, 'FEATURE_DISABLED');

  // Re-enable feature
  await updateFeatureFlag('ai_summary', 'enabled', 'admin_tester');
});

test('Student data isolation: User A quizzes are completely invisible to User B', async () => {
  mockUserQuizzes.length = 0;

  // Start server as User A
  const serverA = await startServer('USER', 'user_A');
  const postRes = await fetch(`${serverA.base}/api/user/quizzes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Biology Quiz A',
      questions: [{ question: 'Cell power?', options: ['Nucleus', 'Mitochondria'], correctIndex: 1 }],
    }),
  });
  assert.strictEqual(postRes.status, 200);
  serverA.srv.close();

  // Start server as User B -> list must be empty
  const serverB = await startServer('USER', 'user_B');
  const getResB = await fetch(`${serverB.base}/api/user/quizzes`);
  const bodyB = await getResB.json() as any;
  assert.strictEqual(getResB.status, 200);
  assert.strictEqual(bodyB.quizzes.length, 0);
  serverB.srv.close();

  // Start server as User A again -> sees their quiz
  const serverA2 = await startServer('USER', 'user_A');
  const getResA = await fetch(`${serverA2.base}/api/user/quizzes`);
  const bodyA = await getResA.json() as any;
  assert.strictEqual(getResA.status, 200);
  assert.strictEqual(bodyA.quizzes.length, 1);
  assert.strictEqual(bodyA.quizzes[0].title, 'Biology Quiz A');
  serverA2.srv.close();
});

test('Zero-data metrics: Returns null for aiSuccessRate and avgLatencyMs when requests = 0', async () => {
  const { base } = await startServer('ADMIN', 'admin_zerodata');
  const res = await fetch(`${base}/api/admin/overview`);
  const body = await res.json() as any;

  assert.strictEqual(res.status, 200);
  // When AI requests is 0, success rate and latency must be null (truthful, not fake 100% or 0ms)
  if (body.metrics.aiRequests === 0) {
    assert.strictEqual(body.metrics.aiSuccessRate, null);
    assert.strictEqual(body.metrics.avgLatencyMs, null);
  }
});

test('Super Admin Self-Protection: Admin cannot suspend their own account', async () => {
  const { base } = await startServer('SUPER_ADMIN', 'admin_self');
  const res = await fetch(`${base}/api/admin/users/admin_self/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ isSuspended: true }),
  });
  const body = await res.json() as any;

  assert.strictEqual(res.status, 400);
  assert.strictEqual(body.success, false);
  assert.match(body.error, /Cannot suspend your own admin account/i);
});

test('Super Admin Protection: Primary Super Admin account cannot be suspended or demoted', async () => {
  const { base } = await startServer('SUPER_ADMIN', 'admin_operator');
  mockUserRoles.set('suraj_primary', {
    role: 'SUPER_ADMIN',
    isSuspended: false,
    email: 'surajdona2005@gmail.com',
  });

  // Attempt suspend
  const suspendRes = await fetch(`${base}/api/admin/users/suraj_primary/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ isSuspended: true }),
  });
  const suspendBody = await suspendRes.json() as any;
  assert.strictEqual(suspendRes.status, 400);
  assert.strictEqual(suspendBody.success, false);

  // Attempt role downgrade
  const roleRes = await fetch(`${base}/api/admin/users/suraj_primary/role`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'USER' }),
  });
  const roleBody = await roleRes.json() as any;
  assert.strictEqual(roleRes.status, 400);
  assert.strictEqual(roleBody.success, false);
});

test('Emergency AI Killswitch All and Restore All works atomically and logs audit records', async () => {
  const { base } = await startServer('SUPER_ADMIN', 'admin_switch_op');
  mockAuditLogs.length = 0;

  // 1. Kill All
  const killRes = await fetch(`${base}/api/admin/ai/kill-all`, { method: 'POST' });
  const killBody = await killRes.json() as any;
  assert.strictEqual(killRes.status, 200);
  assert.strictEqual(killBody.success, true);

  // Verify audit log
  const killAudit = mockAuditLogs.find((l) => l.action === 'AI_KILL_SWITCH_ALL');
  assert.ok(killAudit, 'Must record AI_KILL_SWITCH_ALL audit log');

  // Verify feature flags in maintenance
  const featRes = await fetch(`${base}/api/admin/ai/features`);
  const featBody = await featRes.json() as any;
  assert.strictEqual(featRes.status, 200);
  for (const f of featBody.features) {
    assert.strictEqual(f.status, 'maintenance');
  }

  // 2. Restore All
  const restoreRes = await fetch(`${base}/api/admin/ai/restore-all`, { method: 'POST' });
  const restoreBody = await restoreRes.json() as any;
  assert.strictEqual(restoreRes.status, 200);
  assert.strictEqual(restoreBody.success, true);

  // Verify audit log
  const restoreAudit = mockAuditLogs.find((l) => l.action === 'AI_RESTORE_ALL');
  assert.ok(restoreAudit, 'Must record AI_RESTORE_ALL audit log');
});

test('Diagnostic probe endpoint returns normalized health probes and records audit', async () => {
  const { base } = await startServer('ADMIN', 'admin_probe_tester');
  mockAuditLogs.length = 0;

  const res = await fetch(`${base}/api/admin/system/health`);
  const body = await res.json() as any;

  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.success, true);
  assert.ok(body.health);
  assert.ok(body.health.database);
  assert.ok(body.health.groq);
  assert.ok(body.health.cloudinary);
  assert.ok(body.health.redis);

  // Probe run must be audited
  const probeAudit = mockAuditLogs.find((l) => l.action === 'DIAGNOSTIC_PROBE_RUN');
  assert.ok(probeAudit, 'Must record DIAGNOSTIC_PROBE_RUN audit log');
});
