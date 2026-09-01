# StudySnap — Software Architecture (Hinglish Guide)

> Is document me StudySnap ka modular structure, runtime data flow, aur component hierarchy ka detail hai. Team ke internal use ke liye Hinglish me.

## System Topology Diagram

```mermaid
graph TD
    subgraph Client Application (PWA standalone)
        UI[Main Screen Layout: page.tsx]
        HS[HomeScreen View]
        NE[NoteEditor View]
        VN[VoiceNotes View]
        RC[RevisionCalendar View]
        AH[AiTutor View]
        PV[ProfileView View]

        UI --> HS
        UI --> NE
        UI --> VN
        UI --> RC
        UI --> AH
        UI --> PV

        ZSD[(Zustand Store: Local Cache)]
        HS & NE & VN & RC & AH & PV <-->|Read/Write State| ZSD
        ZSD <-->|Sync LocalStorage| LS[(Browser LocalStorage)]
    end

    subgraph Backend (Render)
        API[Express API]
        CLK[Clerk Auth Middleware]
        DRI[Drizzle ORM Engine]

        API --> CLK
        API --> DRI
    end

    subgraph Distributed Servers
        NEO[(Neon Serverless PostgreSQL)]
        RED[(Upstash Redis Cache)]
        GRQ[Groq AI Llama 3 Engine]
        CLD[(Cloudinary Audio Storage)]

        DRI --> NEO
        API --> RED
        API --> GRQ
        API --> CLD
    end

    ZSD <-->|Background Sync via fetch| API
```

---

## 1. Directory Blueprint (Folder Structure)

### Frontend (`FRONTEND/`)
- `app/` — Next.js App Router root layout, styles, pages.
  - `layout.tsx` — App envelope: PWA scripts + ClerkProvider register.
  - `page.tsx` — Single Page app tab controller (Home/Notes/Voice/Revision/AiTutor/Profile).
  - `sign-in/[[...rest]]/` aur `sign-up/[[...rest]]/` — Clerk OAuth completion routes (catch-all).
  - `sitemap.ts` — Dynamic sitemap generation (SEO).
- `components/` — Isolated client view widgets (Material Design 3 tokens).
  - `HomeScreen.tsx`, `NoteEditor.tsx`, `VoiceNotes.tsx`, `AiTutor.tsx`, `RevisionCalendar.tsx`, `PwaRegister.tsx`, `ThemeSync.tsx`, `SessionExpiredModal.tsx`, `ErrorToast.tsx`
- `lib/` — Constants, config, security (CSP), hooks.
- `public/` — Static assets: `robots.txt`, `sitemap.xml`, `llms.txt`, `manifest.json`, `sw.js`, SVGs.
- `tests/` — Frontend unit tests.
- `docs/` — English documentation (dev reference).

### Backend (`BACKEND/`)
- `src/index.ts` — Express app bootstrap, middleware chain, health route, error handler.
- `src/config/` — `env.ts` (env validation/fail-fast), `constants.ts`.
- `src/db/` — `index.ts` (Drizzle client + getDb), `schema.ts` (tables + indexes), `drizzle/` migrations.
- `src/middleware/` — `auth.ts` (Clerk), `rateLimiter.ts`, `security.ts` (CORS/CSP), `validate.ts` (Zod), `requestLogger.ts`.
- `src/routes/` — `notes.ts`, `voice-notes.ts`, `ai.ts`, `webhooks.ts`.
- `src/services/` — `ai.ts` (Groq), `cache.ts` (Redis), `storage.ts` (Cloudinary).
- `src/utils/` — `delta.ts`, `pin.ts`, `helpers.ts`, `noteOwnership.ts`, `aiLogging.ts`.
- `tests/` — Backend unit/integration tests.

---

## 2. Runtime Data Flow

1. **Client boot:** `layout.tsx` ClerkProvider + PWA register karta hai. Zustand store localStorage se rehydrate hota hai.
2. **Login:** Clerk OAuth popup → `sign-in` catch-all route → session token.
3. **Data:** Client `fetch` se `/api/*` hit karta hai (Authorization header ke saath).
4. **Backend:** Express → authMiddleware (Clerk JWT verify) → route handler → (Redis cache / Drizzle DB / Groq / Cloudinary).
5. **Sync:** Client background sync aane par local changes push karta hai.

---

## 3. Offline-First / Sync Policy
1. **Local Mutations:** Har user transaction (note add, revise, folder rename) turant Zustand store par execute hota hai.
2. **Persistence:** Zustand poora state tree `localStorage` me serialize karta hai turant — offline ya close par data safe.
3. **Optimistic Cloud Sync:** Client network change listen karta hai (PwaRegister). Online hone par debounced fetch operations local changes `/api/*` par push karte hain Neon me.
4. **Resiliency:** API sync fail hone par client silently fail hota hai — study session offline continue ho sakta hai.

---

## 4. Security & Hardening
- **Production fail-fast:** `DATABASE_URL` ya `CLERK_SECRET_KEY` missing par boot abort.
- **CSP:** Production me Content-Security-Policy (exact resources allowed: self, backend origin, Clerk, Cloudinary).
- **HSTS**, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
- **Permissions-Policy:** sirf `microphone=(self)` allowed (audio record ke liye), baaki (camera, geolocation, payment, usb...) denied.
- **Voice upload:** MIME allowlist + magic-byte signature verification.
- **rate limiting:** `/api/*` par apiLimiter, `/api/ai/*` par aiLimiter, PIN par pinLimiter.
