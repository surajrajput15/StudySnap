import 'dotenv/config';
import express from 'express';
import { securityMiddleware, corsMiddleware } from './middleware/security';
import { apiLimiter } from './middleware/rateLimiter';
import { env, validateProductionEnv } from './config/env';
import { JSON_BODY_LIMIT } from './config/constants';

console.log(`[server] Starting with NODE_ENV=${env.NODE_ENV}`);

// Day 8 Task 3 (Phase C) — production fail-fast. Validate the environment BEFORE
// mounting routes / listening, so a misconfigured production box never boots
// into a half-working mock mode.
try {
  validateProductionEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

import notesRouter from './routes/notes';
import voiceNotesRouter from './routes/voice-notes';
import aiRouter from './routes/ai';
import revisionRouter from './routes/revision';
import webhooksRouter from './routes/webhooks';

const app = express();

app.set('trust proxy', 1);

app.use(securityMiddleware);
app.use(corsMiddleware);
app.use('/api/webhooks', webhooksRouter);
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', apiLimiter);

app.get('/favicon.ico', (_req, res) => res.status(204).end());

app.get('/api/health', (req, res) => {
  const origin = req.headers.origin || req.headers.host || 'unknown';
  console.log(`[health] from origin="${origin}"`);
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

app.use('/api/notes', notesRouter);
app.use('/api/voice-notes', voiceNotesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/revision', revisionRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Day 10 Task 3 — respect body-parser / framework error statuses so a
  // malformed JSON body (400 SyntaxError) or an oversized payload (413
  // PayloadTooLargeError) is reported with the CORRECT status instead of being
  // collapsed into a misleading 500 that the frontend classifies as a server
  // outage. Anything without a meaningful status stays a 500.
  const status = (err as { status?: number; statusCode?: number }).status
    ?? (err as { statusCode?: number }).statusCode
    ?? 500;
  const clientStatus = Number.isInteger(status) && status >= 400 && status < 600 ? status : 500;
  if (clientStatus >= 500) {
    console.error('Unhandled error:', err?.message || err);
  }
  const message =
    clientStatus === 400
      ? 'Malformed request body'
      : clientStatus === 413
        ? 'Request body too large'
        : 'Internal server error';
  res.status(clientStatus).json({ success: false, error: message });
});

app.listen(env.PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║     StudySnap - Backend Server             ║
║     Port: ${env.PORT.toString().padEnd(5)}                     ║
║     Mode: ${env.NODE_ENV.padEnd(10)}                      ║
║     DB: ${env.DATABASE_URL ? 'Connected' : 'Mock Mode'.padEnd(13)}            ║
║     AI: ${env.GROQ_API_KEY ? 'Groq Ready' : 'Mock Mode'.padEnd(13)}            ║
╚════════════════════════════════════════════╝
  `);
});

export default app;