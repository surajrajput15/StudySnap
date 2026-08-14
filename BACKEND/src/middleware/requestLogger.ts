import { Request, Response, NextFunction } from 'express';

// Day 15 Tasks 3/6 — one structured request log line per API call.
//
// Production visibility is stdout (Vercel captures it). Every request emits a
// single greppable line: method, path, status, duration, and — when the auth
// middleware has run — the scoped userId. NO body content, headers, or
// query strings are ever logged.
//
// The AI routes already log their own detailed timings via aiRequestLogMeta;
// this middleware deliberately stays metric-only so it never duplicates or
// competes with the AI-specific breadcrumbs.

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  req._startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - (req._startTime ?? Date.now());
    const userId = req.userId;
    const status = res.statusCode;
    if (status >= 500) {
      console.error(`[api] ✗ ${req.method} ${req.originalUrl} → ${status} ${duration}ms${userId ? ` userId=${userId}` : ''}`);
    } else if (status >= 400) {
      console.warn(`[api] ⚠ ${req.method} ${req.originalUrl} → ${status} ${duration}ms${userId ? ` userId=${userId}` : ''}`);
    } else {
      console.log(`[api] ✓ ${req.method} ${req.originalUrl} → ${status} ${duration}ms${userId ? ` userId=${userId}` : ''}`);
    }
  });

  next();
}