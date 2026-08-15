# Changelog

All notable changes to StudySnap are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] — 2026-08-15 — PRODUCTION READY

### Added
- **Resilient sync engine** — event-driven, single-flight `SyncEngine` with 429 Retry-After backoff, periodic 60s catch-up, cross-tab BroadcastChannel wake-up
- **Offline-first persistence** — IndexedDB-backed browser storage for notes, voice memos, and settings; offline edit/create with automatic re-sync
- **Delete undo window** — time-boxed undo with superseded-delete handling and folder-cascade coordination
- **Voice notes** — Cloudinary-backed recording/playback/rename/delete, transcript truncation (50k cap), magic-byte signature validation, 50MB upload cap skip
- **AI context integration** — real note content + PDF/Text attachments fed to AI; chat history trimmed to last 16 messages, user request capped at 20k chars, PDF capped at 100 pages
- **Error boundaries & observability** — per-tab `ErrorBoundary`, `error/global-error/not-found` pages, client crash logging, metric-only backend `requestLogger`, unified `ErrorToast` (replaces all native `alert()`)
- **Accessibility** — `useDialogFocus` focus-trap hook, ARIA roles/labels, `role="status"` live regions, keyboard-operable controls, 40px touch targets
- **Security hardening** — strict zod input validation (1M char cap, bounded tags/webhooks), per-route rate limiters (AI/voice/webhook), `Permissions-Policy` + `Cache-Control: no-store` headers, CSP with Cloudflare challenge + paste-image support, production fail-fast env validation
- **DB/API optimization** — 4 missing table indexes + migration, update-first upsert, optional paginated note listing, stripped cache payloads (pin hashes never cached), voice-notes GET caching with invalidation

### Fixed
- NoteEditor autosave — title/tags/pin/fav/lock/category/folder edits now autosave (iOS tab-kill data-loss)
- VoiceNotes mic race — resolved `getUserMedia` discarded if component unmounted
- Guest migration — guest key removed only after account write confirmed on disk (quota-full data loss)
- Rate-limiter double-count — `req.baseUrl + req.path` skip logic for AI/voice under the global limiter
- Standalone voice memo 400 (`noteId: ''` → null via `z.preprocess`)
- AI stream interval leak on unmount/new-chat
- Weekly-challenge stale across Monday rollover + empty Sunday chart
- Second delete-undo silently cancelling the first
- Note delete now destroys linked Cloudinary audio (no orphans)
- Code-block copy button, search-specific empty state, mobile drawer focus-trap re-renders
- 0 frontend vulnerabilities (npm audit clean); removed unused `nodemailer`, `bullmq`, `ioredis` and the mock `/api/revision` router

### Removed
- Mock `/api/revision` router (never wired to DB)

### Tests
- Frontend: 222/222 · Backend: 67/67 (new: critical flow, note CRUD, folder/category, voice lifecycle, observability, request logger, injection guard, rate-limit coverage)
- Production builds verified clean (Next.js + tsc), live smoke tests pass on deployed FE/BE

[1.1.0]: https://github.com/surajrajput999/StudySnap/releases/tag/v1.1.0