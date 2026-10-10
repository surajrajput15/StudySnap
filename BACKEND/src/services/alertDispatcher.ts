import { enqueueTelegramAlert, maskUserRef, TelegramAlert, userEmailCache } from './telegram';
import { env } from '../config/env';

interface StudyActivityCounts {
  notesCreated: number;
  notesUpdated: number;
  notesDeleted: number;
  voiceUploaded: number;
  quizzesCompleted: number;
  revisionsLogged: number;
  uniqueUsers: Set<string>;
  windowStart: number;
}

let studyActivityBuffer: StudyActivityCounts = {
  notesCreated: 0,
  notesUpdated: 0,
  notesDeleted: 0,
  voiceUploaded: 0,
  quizzesCompleted: 0,
  revisionsLogged: 0,
  uniqueUsers: new Set<string>(),
  windowStart: Date.now(),
};

let digestTimer: ReturnType<typeof setInterval> | null = null;
const recentLoginAlerts = new Map<string, number>();
const LOGIN_ALERT_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Initializes the study tools periodic aggregation timer.
 */
export function initAlertDispatcher(): void {
  if (digestTimer) return;
  const intervalMs = Math.max(env.TELEGRAM_DIGEST_INTERVAL_MINUTES, 1) * 60 * 1000;

  digestTimer = setInterval(() => {
    flushStudyToolsDigest();
  }, intervalMs);

  // Unref timer so it doesn't hold open test runs
  if (typeof digestTimer.unref === 'function') {
    digestTimer.unref();
  }
}

/**
 * Stops periodic digest timer (useful in tests).
 */
export function stopAlertDispatcher(): void {
  if (digestTimer) {
    clearInterval(digestTimer);
    digestTimer = null;
  }
}

/**
 * 🟢 NEW STUDENT Alert
 */
export function dispatchNewStudentAlert(params: {
  userId?: string;
  email?: string;
  method?: string;
  emailDomain?: string;
}): void {
  const userRef = maskUserRef(params.userId);
  const method = params.method || 'Clerk authentication';
  const resolvedEmail = params.email || (params.userId ? userEmailCache.get(params.userId) : undefined);

  const fields = [
    { label: 'Event', value: 'Registration successful' },
  ];

  if (resolvedEmail) {
    fields.push({ label: 'User email', value: resolvedEmail });
  }

  fields.push(
    { label: 'User reference', value: userRef },
    { label: 'Method', value: method },
  );

  const alert: TelegramAlert = {
    badge: '🟢',
    title: 'NEW STUDENT',
    priority: 'high',
    fields,
    footer: `Timestamp: ${new Date().toISOString()}`,
  };

  enqueueTelegramAlert(alert);
}

/**
 * 🔐 STUDENT LOGIN Alert
 */
export function dispatchLoginAlert(params: {
  userId?: string;
  email?: string;
  method?: string;
  ip?: string;
  force?: boolean;
}): void {
  if (params.userId && !params.force) {
    const lastAlert = recentLoginAlerts.get(params.userId);
    const now = Date.now();
    if (lastAlert && now - lastAlert < LOGIN_ALERT_DEBOUNCE_MS) {
      return;
    }
    recentLoginAlerts.set(params.userId, now);
  }

  const userRef = maskUserRef(params.userId);
  const method = params.method || 'Clerk authentication';
  const resolvedEmail = params.email || (params.userId ? userEmailCache.get(params.userId) : undefined);

  const fields = [
    { label: 'Event', value: 'Login successful' },
  ];

  if (resolvedEmail) {
    fields.push({ label: 'User email', value: resolvedEmail });
  }

  fields.push(
    { label: 'User reference', value: userRef },
    { label: 'Method', value: method },
  );

  const alert: TelegramAlert = {
    badge: '🔐',
    title: 'STUDENT LOGIN',
    priority: 'high',
    fields,
    footer: `Timestamp: ${new Date().toISOString()}`,
  };

  enqueueTelegramAlert(alert);
}

/**
 * 🤖 AI OPERATION SUCCESS Alert
 */
export function dispatchAiSuccessAlert(params: {
  feature: string;
  durationMs: number;
  provider?: string;
  model?: string;
  tokens?: number;
  userId?: string;
  userEmail?: string;
  isPdf?: boolean;
}): void {
  const durationSec = (params.durationMs / 1000).toFixed(1);
  const provider = params.provider || 'Groq Cloud LPU';
  const model = params.model || 'llama-3.3-70b-versatile';

  const featureTitle = params.isPdf
    ? `PDF ${params.feature}`
    : params.feature.replace(/^ai_/, '').replace(/_/g, ' ');

  const fields = [
    { label: 'Feature', value: featureTitle },
  ];

  const resolvedEmail = params.userEmail || (params.userId ? userEmailCache.get(params.userId) : undefined);
  if (resolvedEmail) {
    fields.push({ label: 'User email', value: resolvedEmail });
  }

  fields.push(
    { label: 'Result', value: 'Success' },
    { label: 'Duration', value: `${durationSec} seconds` },
    { label: 'Provider', value: `${provider} (${model})` },
  );

  if (params.tokens) {
    fields.push({ label: 'Tokens', value: String(params.tokens) });
  }

  const alert: TelegramAlert = {
    badge: '🤖',
    title: `AI ${featureTitle.toUpperCase()} GENERATED`,
    priority: 'normal',
    fields,
  };

  enqueueTelegramAlert(alert);
}

/**
 * 🚨 AI SERVICE ERROR Alert
 */
export function dispatchAiErrorAlert(params: {
  feature: string;
  error: string;
  action?: string;
  statusCode?: number;
  userId?: string;
  userEmail?: string;
  isPdf?: boolean;
}): void {
  const featureTitle = params.isPdf
    ? `PDF ${params.feature}`
    : params.feature.replace(/^ai_/, '').replace(/_/g, ' ');

  const fields = [
    { label: 'Feature', value: featureTitle },
  ];

  const resolvedEmail = params.userEmail || (params.userId ? userEmailCache.get(params.userId) : undefined);
  if (resolvedEmail) {
    fields.push({ label: 'User email', value: resolvedEmail });
  }

  fields.push(
    { label: 'Error', value: params.error },
    { label: 'Action', value: params.action || 'Retry with backoff' },
  );

  const alert: TelegramAlert = {
    badge: '🚨',
    title: 'AI SERVICE ERROR',
    priority: 'high',
    fields,
    footer: `Status Code: ${params.statusCode || 500} | ${new Date().toISOString()}`,
  };

  enqueueTelegramAlert(alert);
}

/**
 * 🛡️ SECURITY ALERT
 */
export function dispatchSecurityAlert(params: {
  issue: string;
  userRef?: string;
  userId?: string;
  userEmail?: string;
  endpoint?: string;
  action?: string;
  details?: string;
}): void {
  const fields = [
    { label: 'Issue', value: params.issue },
  ];

  const resolvedEmail = params.userEmail || (params.userId ? userEmailCache.get(params.userId) : undefined);
  if (resolvedEmail) {
    fields.push({ label: 'User email', value: resolvedEmail });
  }
  const userRef = params.userRef || (params.userId ? maskUserRef(params.userId) : undefined);
  if (userRef) {
    fields.push({ label: 'User reference', value: userRef });
  }
  if (params.endpoint) {
    fields.push({ label: 'Endpoint', value: params.endpoint });
  }
  if (params.action) {
    fields.push({ label: 'Action', value: params.action });
  }
  if (params.details) {
    fields.push({ label: 'Details', value: params.details });
  }

  const alert: TelegramAlert = {
    badge: '🛡️',
    title: 'SECURITY ALERT',
    priority: 'high',
    fields,
    footer: `Time: ${new Date().toISOString()}`,
  };

  enqueueTelegramAlert(alert);
}


/**
 * 🔴 BACKEND HEALTH ALERT
 */
export function dispatchHealthAlert(params: {
  service?: string;
  issue: string;
  timestamp?: string;
}): void {
  const alert: TelegramAlert = {
    badge: '🔴',
    title: 'BACKEND HEALTH ALERT',
    priority: 'high',
    fields: [
      { label: 'Service', value: params.service || 'StudySnap backend' },
      { label: 'Issue', value: params.issue },
      { label: 'Time', value: params.timestamp || new Date().toISOString() },
    ],
  };

  enqueueTelegramAlert(alert);
}

/**
 * 🟢 BACKEND HEALTH RECOVERED Alert
 */
export function dispatchHealthRecoveredAlert(params: {
  service?: string;
  status?: string;
  timestamp?: string;
}): void {
  const alert: TelegramAlert = {
    badge: '🟢',
    title: 'BACKEND HEALTH RECOVERED',
    priority: 'high',
    fields: [
      { label: 'Service', value: params.service || 'StudySnap backend' },
      { label: 'Status', value: params.status || 'All services operational' },
      { label: 'Time', value: params.timestamp || new Date().toISOString() },
    ],
  };

  enqueueTelegramAlert(alert);
}

/**
 * Buffers routine study actions to prevent Telegram notification spam.
 */
export function recordStudyToolAction(
  type:
    | 'note_created'
    | 'note_updated'
    | 'note_deleted'
    | 'voice_uploaded'
    | 'quiz_completed'
    | 'revision_logged',
  userId?: string
): void {
  if (userId) studyActivityBuffer.uniqueUsers.add(userId);

  switch (type) {
    case 'note_created':
      studyActivityBuffer.notesCreated += 1;
      break;
    case 'note_updated':
      studyActivityBuffer.notesUpdated += 1;
      break;
    case 'note_deleted':
      studyActivityBuffer.notesDeleted += 1;
      break;
    case 'voice_uploaded':
      studyActivityBuffer.voiceUploaded += 1;
      break;
    case 'quiz_completed':
      studyActivityBuffer.quizzesCompleted += 1;
      break;
    case 'revision_logged':
      studyActivityBuffer.revisionsLogged += 1;
      break;
  }
}

/**
 * Flushes buffered study tool actions into a consolidated Telegram Digest card.
 */
export function flushStudyToolsDigest(): boolean {
  const total =
    studyActivityBuffer.notesCreated +
    studyActivityBuffer.notesUpdated +
    studyActivityBuffer.notesDeleted +
    studyActivityBuffer.voiceUploaded +
    studyActivityBuffer.quizzesCompleted +
    studyActivityBuffer.revisionsLogged;

  if (total === 0) return false;

  const durationMins = Math.round((Date.now() - studyActivityBuffer.windowStart) / (60 * 1000));
  const windowLabel = durationMins > 0 ? `Past ${durationMins} minutes` : 'Recent activity';

  const fields = [
    { label: 'Window', value: windowLabel },
    {
      label: 'Notes',
      value: `${studyActivityBuffer.notesCreated} created, ${studyActivityBuffer.notesUpdated} updated, ${studyActivityBuffer.notesDeleted} deleted`,
    },
    { label: 'Voice Notes', value: `${studyActivityBuffer.voiceUploaded} uploaded` },
    { label: 'Quizzes', value: `${studyActivityBuffer.quizzesCompleted} completed` },
    { label: 'Revision Logs', value: `${studyActivityBuffer.revisionsLogged} recorded` },
    { label: 'Active Students', value: String(studyActivityBuffer.uniqueUsers.size || 1) },
  ];

  const activeEmails: string[] = [];
  for (const uid of studyActivityBuffer.uniqueUsers) {
    const cached = userEmailCache.get(uid);
    if (cached && !activeEmails.includes(cached)) activeEmails.push(cached);
  }
  if (activeEmails.length > 0) {
    fields.push({ label: 'Student emails', value: activeEmails.slice(0, 5).join(', ') });
  }

  fields.push({ label: 'Total Actions', value: String(total) });

  const alert: TelegramAlert = {
    badge: '📊',
    title: 'STUDY TOOLS DIGEST',
    priority: 'low',
    fields,
  };

  // Reset buffer
  studyActivityBuffer = {
    notesCreated: 0,
    notesUpdated: 0,
    notesDeleted: 0,
    voiceUploaded: 0,
    quizzesCompleted: 0,
    revisionsLogged: 0,
    uniqueUsers: new Set<string>(),
    windowStart: Date.now(),
  };

  enqueueTelegramAlert(alert);
  return true;
}

/**
 * Test helper to inspect current buffer state.
 */
export function getStudyActivityBufferState(): Readonly<StudyActivityCounts> {
  return { ...studyActivityBuffer };
}

export function resetStudyActivityBuffer(): void {
  studyActivityBuffer = {
    notesCreated: 0,
    notesUpdated: 0,
    notesDeleted: 0,
    voiceUploaded: 0,
    quizzesCompleted: 0,
    revisionsLogged: 0,
    uniqueUsers: new Set<string>(),
    windowStart: Date.now(),
  };
}
