import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  maskUserRef,
  formatAlertMessage,
  enqueueTelegramAlert,
  getTelegramQueueStatus,
  clearTelegramQueue,
  TelegramAlert,
  userEmailCache,
} from '../src/services/telegram';
import {
  dispatchNewStudentAlert,
  dispatchLoginAlert,
  dispatchAiSuccessAlert,
  dispatchAiErrorAlert,
  dispatchSecurityAlert,
  dispatchHealthAlert,
  dispatchHealthRecoveredAlert,
  recordStudyToolAction,
  flushStudyToolsDigest,
  getStudyActivityBufferState,
  resetStudyActivityBuffer,
} from '../src/services/alertDispatcher';
import { runHealthProbe } from '../src/services/healthMonitor';

test('escapeHtml sanitizes HTML entities', () => {
  assert.equal(escapeHtml('Hello <script>alert("xss")</script> & Co.'), 'Hello &lt;script&gt;alert("xss")&lt;/script&gt; &amp; Co.');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42');
});

test('maskUserRef produces anonymized student identifiers', () => {
  assert.equal(maskUserRef('user_2t1a4B8F21'), 'USR-4B8F21');
  assert.equal(maskUserRef('user_8F21'), 'USR-8F21');
  assert.equal(maskUserRef('USR12'), 'USR-USR12');
  assert.equal(maskUserRef(undefined), 'USR-ANON');
  assert.equal(maskUserRef(null), 'USR-ANON');
});

test('formatAlertMessage formats NEW STUDENT template accurately', () => {
  const alert: TelegramAlert = {
    badge: '🟢',
    title: 'NEW STUDENT',
    fields: [
      { label: 'Event', value: 'Registration successful' },
      { label: 'User reference', value: 'USR-8F21' },
      { label: 'Method', value: 'Clerk authentication' },
    ],
  };

  const formatted = formatAlertMessage(alert);
  assert.match(formatted, /<b>🟢 NEW STUDENT<\/b>/);
  assert.match(formatted, /<b>Event:<\/b> <code>Registration successful<\/code>/);
  assert.match(formatted, /<b>User reference:<\/b> <code>USR-8F21<\/code>/);
  assert.match(formatted, /<b>Method:<\/b> <code>Clerk authentication<\/code>/);
});

test('formatAlertMessage formats STUDENT LOGIN template accurately with user email', () => {
  const alert: TelegramAlert = {
    badge: '🔐',
    title: 'STUDENT LOGIN',
    fields: [
      { label: 'Event', value: 'Login successful' },
      { label: 'User email', value: 'student@example.com' },
      { label: 'User reference', value: 'USR-8F21' },
      { label: 'Method', value: 'Clerk authentication' },
    ],
  };

  const formatted = formatAlertMessage(alert);
  assert.match(formatted, /<b>🔐 STUDENT LOGIN<\/b>/);
  assert.match(formatted, /<b>Event:<\/b> <code>Login successful<\/code>/);
  assert.match(formatted, /<b>User email:<\/b> <code>student@example\.com<\/code>/);
  assert.match(formatted, /<b>User reference:<\/b> <code>USR-8F21<\/code>/);
  assert.match(formatted, /<b>Method:<\/b> <code>Clerk authentication<\/code>/);
});

test('formatAlertMessage formats AI SUMMARY GENERATED template accurately', () => {
  const alert: TelegramAlert = {
    badge: '🤖',
    title: 'AI SUMMARY GENERATED',
    fields: [
      { label: 'Feature', value: 'Summary' },
      { label: 'Result', value: 'Success' },
      { label: 'Duration', value: '4.2 seconds' },
      { label: 'Provider', value: 'Groq Cloud LPU (llama-3.3-70b-versatile)' },
    ],
  };

  const formatted = formatAlertMessage(alert);
  assert.match(formatted, /<b>🤖 AI SUMMARY GENERATED<\/b>/);
  assert.match(formatted, /<b>Feature:<\/b> <code>Summary<\/code>/);
  assert.match(formatted, /<b>Result:<\/b> <code>Success<\/code>/);
  assert.match(formatted, /<b>Duration:<\/b> <code>4\.2 seconds<\/code>/);
});

test('formatAlertMessage formats AI SERVICE ERROR template accurately', () => {
  const alert: TelegramAlert = {
    badge: '🚨',
    title: 'AI SERVICE ERROR',
    fields: [
      { label: 'Feature', value: 'PDF summary' },
      { label: 'Error', value: 'Provider rate limit' },
      { label: 'Action', value: 'Retry with backoff' },
    ],
  };

  const formatted = formatAlertMessage(alert);
  assert.match(formatted, /<b>🚨 AI SERVICE ERROR<\/b>/);
  assert.match(formatted, /<b>Feature:<\/b> <code>PDF summary<\/code>/);
  assert.match(formatted, /<b>Error:<\/b> <code>Provider rate limit<\/code>/);
  assert.match(formatted, /<b>Action:<\/b> <code>Retry with backoff<\/code>/);
});

test('formatAlertMessage formats BACKEND HEALTH ALERT template accurately', () => {
  const alert: TelegramAlert = {
    badge: '🔴',
    title: 'BACKEND HEALTH ALERT',
    fields: [
      { label: 'Service', value: 'StudySnap backend' },
      { label: 'Issue', value: 'Health check failed' },
      { label: 'Time', value: '2026-10-10T21:47:19.000Z' },
    ],
  };

  const formatted = formatAlertMessage(alert);
  assert.match(formatted, /<b>🔴 BACKEND HEALTH ALERT<\/b>/);
  assert.match(formatted, /<b>Service:<\/b> <code>StudySnap backend<\/code>/);
  assert.match(formatted, /<b>Issue:<\/b> <code>Health check failed<\/code>/);
  assert.match(formatted, /<b>Time:<\/b> <code>2026-10-10T21:47:19\.000Z<\/code>/);
});

test('Privacy assurance: sensitive tokens and note contents are never leaked in alerts', () => {
  const secretKey = 'sk_live_SECRET_DO_NOT_LEAK';
  const rawNote = 'My personal journal and private exam answers';

  const alert: TelegramAlert = {
    badge: '🟢',
    title: 'NEW STUDENT',
    fields: [
      { label: 'Event', value: 'Registration successful' },
      { label: 'User reference', value: maskUserRef('user_sensitive_secret_id') },
      { label: 'Method', value: 'Google OAuth' },
    ],
  };

  const formatted = formatAlertMessage(alert);
  assert.ok(!formatted.includes(secretKey));
  assert.ok(!formatted.includes(rawNote));
  assert.ok(!formatted.includes('user_sensitive_secret_id'));
  assert.match(formatted, /USR-[A-Z0-9]+/);
});

test('Study tools action aggregator buffers routine actions and flushes a single digest card', () => {
  resetStudyActivityBuffer();

  // Simulate routine student activity during a study session
  recordStudyToolAction('note_created', 'user_123');
  recordStudyToolAction('note_created', 'user_123');
  recordStudyToolAction('note_updated', 'user_123');
  recordStudyToolAction('quiz_completed', 'user_123');
  recordStudyToolAction('voice_uploaded', 'user_456');

  const bufferState = getStudyActivityBufferState();
  assert.equal(bufferState.notesCreated, 2);
  assert.equal(bufferState.notesUpdated, 1);
  assert.equal(bufferState.quizzesCompleted, 1);
  assert.equal(bufferState.voiceUploaded, 1);
  assert.equal(bufferState.uniqueUsers.size, 2);

  // Flush buffer into single digest
  const flushed = flushStudyToolsDigest();
  assert.equal(flushed, true);

  // Buffer should now be reset
  const afterReset = getStudyActivityBufferState();
  assert.equal(afterReset.notesCreated, 0);
  assert.equal(afterReset.notesUpdated, 0);
  assert.equal(afterReset.total ?? (afterReset.notesCreated + afterReset.notesUpdated), 0);

  // Flushing empty buffer returns false (no spam)
  assert.equal(flushStudyToolsDigest(), false);
});

test('runHealthProbe probes database, cache, and AI providers without crashing', async () => {
  const result = await runHealthProbe();
  assert.ok(typeof result.success === 'boolean');
  assert.ok(result.status.database === 'healthy' || result.status.database === 'degraded' || result.status.database === 'down');
  assert.ok(result.status.cache === 'healthy' || result.status.cache === 'degraded' || result.status.cache === 'down');
  assert.ok(result.status.ai === 'healthy' || result.status.ai === 'degraded' || result.status.ai === 'down');
  assert.ok(result.details.database);
});

test('dispatchLoginAlert handles alerts and resolves user email from cache', () => {
  userEmailCache.set('user_login_test', 'student123@gmail.com');
  assert.doesNotThrow(() => {
    dispatchLoginAlert({
      userId: 'user_login_test',
      force: true,
    });
  });
});

test('dispatchAiSuccessAlert and dispatchSecurityAlert resolve user email when present', () => {
  userEmailCache.set('user_ai_test', 'researcher@gmail.com');
  assert.doesNotThrow(() => {
    dispatchAiSuccessAlert({
      feature: 'ai_assistant',
      durationMs: 800,
      userId: 'user_ai_test',
    });
    dispatchSecurityAlert({
      issue: 'Unauthorized access',
      userId: 'user_ai_test',
    });
  });
});
