import 'dotenv/config';
import express from 'express';
import { securityMiddleware, corsMiddleware } from './middleware/security';
import { apiLimiter } from './middleware/rateLimiter';
import { env } from './config/env';

console.log(`[server] Starting with NODE_ENV=${env.NODE_ENV}`);

import notesRouter from './routes/notes';
import voiceNotesRouter from './routes/voiceNotes';
import aiRouter from './routes/ai';
import revisionRouter from './routes/revision';
import webhooksRouter from './routes/webhooks';

const app = express();

app.use(securityMiddleware);
app.use(corsMiddleware);
app.use('/api/webhooks', webhooksRouter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', apiLimiter);

app.get('/favicon.ico', (_req, res) => res.status(204).end());

app.get('/api/health', (_req, res) => {
  const origin = _req.headers.origin || _req.headers.host || 'unknown';
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
app.use('/api/webhooks', webhooksRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err?.message || err);
  res.status(500).json({ success: false, error: 'Internal server error' });
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
