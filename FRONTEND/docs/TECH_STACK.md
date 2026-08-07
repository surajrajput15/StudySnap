# Technology Stack - StudySnap

This document details the software architecture, libraries, APIs, and frameworks selected for the **StudySnap** web application.

## Core Technologies

```mermaid
graph TD
    A[Frontend: Next.js 16 / React 19] -->|State Management| B[Zustand Persistent Store]
    A -->|UI Design System| C[Material Design 3 CSS Tokens]
    A -->|Document Export| E[jsPDF Generator]
    A -->|AI Chat Rendering| M[react-markdown + KaTeX]

    A -->|REST API Calls| F[Express Backend API]
    F -->|Identity Management| G[Clerk Auth]
    F -->|Database Controller| H[Drizzle ORM]
    F -->|Large Language Models| I[Groq Llama API]
    F -->|Data Caching| J[Upstash Redis]

    H -->|Cloud SQL Storage| K[Neon PostgreSQL Serverless]
```

---

### 1. Framework & Core UI
- **Framework:** Next.js 16 (using App Router, TypeScript `@types/node` and `@types/react` integration)
- **Library:** React 19
- **Design System:** Material Design 3 (standardized via root-level custom CSS variables in `globals.css`)
- **Icons:** `lucide-react` library

### 2. State & Caching (Offline Compatibility)
- **Global State Store:** Zustand (with persistent middleware targeting browser `localStorage` for offline support)
- **Local Database:** HTML5 Web Storage API
- **Cloud Caching:** Upstash Redis (backend, `@upstash/redis`)

### 3. Database Layer
- **DB Hosting:** Neon PostgreSQL (Serverless instance)
- **ORM Schema Client:** Drizzle ORM (`drizzle-orm` + `drizzle-kit` command utilities)
- **Database Driver:** `@neondatabase/serverless`

### 4. Integration APIs & Services
- **Authentication:** Clerk Identity (`@clerk/nextjs` auth routing)
- **AI Core:** Groq API SDK (`groq-sdk`), exposed through the backend `ai` service
- **PDF Core:** `jspdf` (Client-side vector document rendering)
- **Math & Markdown:** `katex`, `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`
- **Notifications & Streaks:** Canvas-Confetti effects (`canvas-confetti`)
- **Backend Services (Express):** Drizzle ORM, Redis cache, Groq AI, Clerk `@clerk/backend`
