# Software Architecture - StudySnap

This document details the modular folder structures, runtime data flow, and components hierarchy of the **StudySnap** application.

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

    subgraph Backend Routing (Vercel & Render)
        API[Next.js API Handler Endpoint]
        CLK[Clerk User Middleware]
        DRI[Drizzle ORM Engine]
        
        API --> CLK
        API --> DRI
    end

    subgraph Distributed Servers
        NEO[(Neon Serverless PostgreSQL)]
        RED[(Upstash Redis Cache)]
        GRQ[Groq AI Llama 3 Engine]
        
        DRI --> NEO
        API --> RED
        API --> GRQ
    end

    ZSD <-->|Background Sync via fetch| API
```

---

## 1. Directory Blueprint
- `app/` - Next.js App Router root layout, styles, global stylesheets, and API routes.
  - `api/` - Directory containing route handlers for database management and AI services.
  - `layout.tsx` - App envelope registering PWA scripts and Clerk authorization containers.
  - `page.tsx` - Single Page app tab controller.
- `components/` - Isolated client view widgets implementing Material Design 3 tokens.
  - `HomeScreen.tsx` - Note directory feeds, category tabs, and study streaks.
  - `NoteEditor.tsx` - Rich note canvas incorporating TTS/STT and PDF builders.
  - `VoiceNotes.tsx` - Media recorder capturing audio buffers alongside transcript summaries.
  - `AiTutor.tsx` - AI chat, summarize, MCQ, flashcards, translate, and tutor assistant.
  - `RevisionCalendar.tsx` - Repetition planner displaying revision histories.
  - `PwaRegister.tsx` - Bootstrapping scripts for offline service workers.
- `lib/` - Code constants, databases, auth utilities, and store handlers.
  - `db/` - Drizzle schemas and client initializers.
  - `store/` - Zustand global state persistent configurations.
  - `auth.ts` - Clerk ID resolution with mock-mode compatibility.
- `public/` - Public assets including manifests, service worker cache codes, and vectors.

---

## 2. Dynamic Offline Synchronization Policy
1. **Local Mutations:** Every user transaction (adding a note, completing a revision quiz, renaming folders) is executed instantaneously on the Zustand store.
2. **Persistence Guarantee:** Zustand serializes the entire state tree to `localStorage` immediately. If the student closes the web app or loses connection, data is preserved.
3. **Optimistic Cloud Sync:** The client continuously listens to network connection changes (via PwaRegister status triggers). If online, debounced fetch operations push local changes to the `/api/` endpoints to sync Neon Cloud PostgreSQL.
4. **Resiliency Fallback:** If API synchronization fails due to service timeouts or DB offline states, the client fails silently, allowing study sessions to proceed offline.
