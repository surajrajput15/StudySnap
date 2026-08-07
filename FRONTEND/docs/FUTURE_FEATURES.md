# Future Features & Roadmap

This document tracks features that are planned but not yet implemented. The associated code was
removed from the active tree during the Sprint 2 Day 1 cleanup but is recoverable from git history
(`git show <commit>:<path>`). It is listed here to be re-implemented against the live dependencies
(Frontend API or Backend routes) at the scheduled sprints.

> The three backend services below belong to the **confirmed future roadmap**. They are not dead
> code — they were never wired into any route yet. Their dependencies are intentionally kept in
> `BACKEND/package.json` until the corresponding sprint.

---

## Backend Services (confirmed roadmap)

### 1. Email Service — `src/services/email.ts`
- **Purpose:** Transact transactional email via Brevo SMTP (`nodemailer`) — e.g. verification,
  streak reminders, and digest notifications.
- **Planned for:** Sprint 5 (Notifications & Engagement). Requires deciding which events trigger
  email, and adding the user's notification preferences.
- **Dependencies to re-enable:** `nodemailer`, `@types/nodemailer`.

### 2. Queue Service — `src/services/queue.ts`
- **Purpose:** Background job queue using `bullmq` + Redis for deferrable work (email dispatch,
  revision reminders, nightly aggregation).
- **Planned for:** Sprint 5/6 together with Email Service, when async jobs first become necessary.
- **Dependencies to re-enable:** `bullmq`, `ioredis`, `@upstash/redis` (already kept in `package.json`).

### 3. Storage Service — `src/services/storage.ts`
- **Purpose:** File uploads (voice notes, attachments, PDFs) with MIME + magic-byte validation via
  `cloudinary` and `multer`.
- **Planned for:** Sprint 3 (Voice Notes persistence). Required before voice notes can be synced
  across devices; currently voice notes only live in the local Zustand store.
- **Dependencies to re-enable:** `cloudinary`, `multer`, `@types/multer`.

---

## Removed Frontend Components (do not restore)

- `AiHelper.tsx` — superseded by `AiTutor.tsx`. **Do not restore.**
- `StudyMap.tsx` — Leaflet "study zones" map, never integrated into navigation. **Do not restore.**