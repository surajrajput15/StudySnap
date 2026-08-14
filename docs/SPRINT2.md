# STUDY-SNAP — SPRINT 2 STATUS & ROADMAP

> Single source of truth for what is complete and what comes next in Sprint 2.

---

## CURRENT STATUS

### SPRINT 1
✅ COMPLETE

### SPRINT 2
#### Day 1 → Day 7
✅ COMPLETE

#### Day 8
| Task | Status |
| --- | --- |
| Task 1 — Cloudinary / Voice Notes | ✅ COMPLETE |
| Task 2 — CORS Security + AI Log Redaction | ✅ COMPLETE |
| Task 3 — Resilient Sync Engine + Production Fail-Fast | ✅ COMPLETE |
| Task 4 — Frontend CSP + Rate-Limit Handling | ✅ COMPLETE |

#### Day 9
| Task | Status |
| --- | --- |
| D9-001 — AI ko real note content dena | ✅ COMPLETE |
| D9-002 — PDF/Text content AI ko dena | ✅ COMPLETE |
| D9-003 — Folder delete + data resurrection fix | ✅ COMPLETE |
| D9-004 — Voice recording navigation-loss fix | ✅ COMPLETE |
| D9-005 — Standalone voice memo rename | ✅ COMPLETE |
| D9-006 — Search-specific empty state | ✅ COMPLETE |
| D9-007 — AI tutor conversation persistence | ✅ COMPLETE |
| D9-008 — Mobile drawer real navigation | ✅ COMPLETE |
| D9-009 — Delete undo window | ✅ COMPLETE |
| D9-010 — Persistent browser storage | ✅ COMPLETE |
| D9-011 — Code-block Copy button fix | ✅ COMPLETE |
| D9-012 — Gamification/product-honesty fixes | ✅ COMPLETE |
| D9-013 — Streak abuse fix | ✅ COMPLETE |
| D9-014 — SSR/loading shell | ✅ COMPLETE |
| D9-015 — AI "Online" status accuracy | ✅ COMPLETE |
| D9-016 — Guest notes migration/notice | ✅ COMPLETE |
| D9-017 — SnapAI error messaging | ✅ COMPLETE |

#### Day 10
| Task | Status |
| --- | --- |
| D10-001 — Full production regression audit | ✅ COMPLETE |
| D10-002 — Auth/session edge-case audit | ✅ COMPLETE |
| D10-003 — API error-state consistency | ✅ COMPLETE |
| D10-004 — Offline/online transition testing | ✅ COMPLETE |
| D10-005 — Data persistence + hydration edge cases | ✅ COMPLETE |
| D10-006 — Multi-tab / refresh consistency | ✅ COMPLETE |
| D10-007 — Voice notes edge-case audit | ✅ COMPLETE |
| D10-008 — AI context / PDF edge-case audit | ✅ COMPLETE |

#### Day 10 Task 1 — Audit findings & fixes
| # | Severity | Area | Finding | Status |
| --- | --- | --- | --- | --- |
| 1 | CRITICAL | Voice upload | Standalone memo (`noteId: ''`) → 400; `.transform` was dead code after `.uuid()` | ✅ FIXED (`z.preprocess`) + tests |
| 2 | HIGH | AI streaming | Stream interval leaked on unmount / new-chat; answer lost | ✅ FIXED (streamCleanupRef/errorTimerRef) |
| 3 | HIGH | Delete undo | Second delete within window silently cancelled the first | ✅ FIXED (superseded delete performs) |
| 4 | HIGH | Sync engine | Layers swallowed errors → retry/backoff was dead code | ✅ FIXED (throw on fetch failure) |
| 5 | HIGH | CSP | Missing `NEXT_PUBLIC_BACKEND_URL` → every API call silently CSP-blocked | ✅ FIXED (build-time fail-fast) |
| 6 | MEDIUM | CORS | Vercel preview/staging origins blocked | ✅ FIXED (`*.vercel.app` suffix) |
| 7 | MEDIUM | NODE_ENV | staging/test served mock content + loose CORS | ✅ FIXED (`!== 'development'`) |
| 8 | MEDIUM | Note delete | Linked Cloudinary audio orphaned forever | ✅ FIXED (destroy before delete) |
| 9 | MEDIUM | AI badge | "Online" shown while requests fail (Wi-Fi w/o internet) | ✅ FIXED (request-outcome `reachable`) |
| 10 | MEDIUM | config.ts | Caller headers could clobber Auth/Content-Type | ✅ FIXED (merge order) |
| 11 | MEDIUM | config.ts | Non-JSON responses threw, masking real status | ✅ FIXED (JSON fallback `{}`) |
| 12 | LOW | Voice MIME | Real device codecs (`x-m4a`, `aac`, params) rejected | ✅ FIXED (normalize before check) |

**Deferred to later Day 10 tasks:** periodic/multi-tab sync → Task 6 · offline transitions → Task 4 ·
voice rename-during-upload + orphan-sweep race → Task 7 · seed/hydration + scope-merge normalization → Task 5 ·
auth/session → Task 2 · weekly-challenge week rollover + Sunday chart → note for gamification pass.

#### Day 10 Task 1 — second audit pass (post-8e937ae) — newly fixed
| # | Severity | Area | Finding | Status |
| --- | --- | --- | --- | --- |
| 13 | MEDIUM | CSP | `script-src` omitted `challenges.cloudflare.com` → Clerk Turnstile blocked | ✅ FIXED (`csp.ts`) + test |
| 14 | MEDIUM | CSP | `img-src` blocked pasted external images in the note editor | ✅ FIXED (`https:`/`http:` img-src only) + test |
| 15 | MEDIUM | Gamification | "This Week" chart empty on Sundays (inline boundary computed next Monday) | ✅ FIXED (shared `startOfWeek()`) |
| 16 | MEDIUM | Gamification | Weekly challenge stayed stale across Monday rollover (`weekStartIso` memoized once) | ✅ FIXED (reactive week key + visibility/hourly refresh) |
| 17 | MEDIUM | Mobile drawer | Focus-trap effect re-ran every parent render (`onClose` in deps) | ✅ FIXED (deps → `[open]`) |
| 18 | MEDIUM | Mobile drawer | Drawer closed even when recording-guard cancel kept the user on the voice tab | ✅ FIXED (`navigate` returns bool; close only on success) |
| 19 | MEDIUM | Delete undo | Note stayed interactive during undo window; opening it lost edits when delete fired | ✅ FIXED (`cancelPendingDeleteFor` keyed cancel on open) |
| 20 | MEDIUM | Delete undo | Folder cascade conflicted with a pending per-note undo | ✅ FIXED (cascade cancels pending deletes for affected ids) |
| 21 | MEDIUM | Sync seed | `seedLocalNotes` could roll back a concurrent newer edit (no superseded guard) | ✅ FIXED (live-edit guard mirrors merge path) |

#### Overall
- **Day 9:** ✅ 17/17 COMPLETE
- **Day 10:** ✅ 8/8 COMPLETE (audit + fixes landed across commits 8e937ae → 652b577)
- **Day 11:** ✅ 8/8 COMPLETE (perf audit + NoteCard memoization + KaTeX fonts)
- **Current HEAD:** `ed0afe4` (+ Day 11 working tree, to commit)
- **Tests:** ✅ Frontend 199/199 · ✅ Backend 39/39
- **Sprint 2 status:** Day 11 COMPLETE → **NEXT: Day 12 (Accessibility & Responsive QA)**

##### Day 10 Tasks 7 & 8 — audit findings & fixes
| # | Area | Finding | Fix |
| --- | --- | --- | --- |
| 1 | Voice (CRIT) | Transcript >50k chars → server 400 → row stuck pending, retried forever | Server schema now TRUNCATES to 50k (never rejects); `finalizeVoiceNoteTranscript` + sync FormData cap too |
| 2 | Voice (HIGH) | Recording >50MB → 413 → same doomed upload retried every sync | `performVoiceUpload` skips blobs above the multer cap (`isVoiceUploadWithinServerLimit`) |
| 3 | Voice (MED) | `getUserMedia` failures all showed "grant permission" | Differentiated `NotAllowedError`/`SecurityError` vs `NotFoundError`/`OverconstrainedError` with fixable messages |
| 4 | Voice (DOC) | Cloudinary asset can be orphaned if `destroy` fails during delete/DB-write-fail | Already best-effort cleanup; full server-side orphan sweep needs Cloudinary Admin API + scheduled job → NON-BLOCKING, tracked for later |
| 5 | AI (HIGH) | AiTutor sent the ENTIRE chat history → backend 400 "Too many messages" after ~50 turns + context/token overflow | Request payload now trimmed to last 16 messages (persisted UI history untouched) |
| 6 | AI (MED) | Raw user request uncapped → pasted >20k-char block 400s the whole chat | `buildContextMessages`/`capUserRequest` cap to the backend per-message 20k limit with explicit notice |
| 7 | AI/PDF (MED) | Huge PDFs extracted page-by-page on the main thread → UI freeze | `extractTextFromPdf` reads max 100 pages with a truncation notice |
| 8 | AI/PDF (MED) | Password-protected PDFs showed a generic "could not read" error | Clear "password-protected" message surfaced for PDFs in the AiTutor attach flow |

> Non-blocking notes: Cloudinary server-side orphan sweep (finding 4) is the only deferred item from T7/T8 — it needs infra (Admin API + scheduler) rather than a code fix.

##### Day 10 Task 1 — issues found & FIXED
| # | Sev | Issue | Fix |
| --- | --- | --- | --- |
| 1 | CRIT | Standalone voice memo rejected 400 (`noteId:''` failed `.uuid()`) | `voice-notes.ts`: `z.preprocess` maps `''/null → null` before UUID check |
| 2 | HIGH | Vercel PR/preview origins blocked by exact CORS allow-list | `security.ts`: safe `*.vercel.app` suffix match + restored `studysnap.vercel.app` |
| 3 | HIGH | Second delete-undo silently cancelled the first delete | `undo.ts`: superseded pending delete now performs immediately |
| 4 | HIGH | AiTutor stream interval never cleared on unmount / new-chat → lost answers | `AiTutor.tsx`: tracked cleanup + cancel on unmount & new-chat + persist settled chat |
| 5 | HIGH | Sync layers swallowed network/5xx errors → engine backoff dead code | `notesSync`/`voiceNotesSync`: non-429 failures throw → engine retries with backoff |
| 6 | HIGH | Note delete orphaned its Cloudinary audio permanently | `notes.ts`: destroy linked voice assets (best-effort) before deleting the note |
| 7 | HIGH | Voice-memo rename during upload silently rolled back (no superseded guard) | `voiceNotesSync.ts`: upload keeps local clock when the live row diverged |
| 8 | MED | `apiFetch` header-clobbering + `res.json()` threw on gateway/empty bodies | `config.ts`: headers merged last; `.json().catch(()=>({}))`; `window` guards |
| 9 | MED | Non-`production` NODE_ENV (staging/test) served mocks + lax CORS | `env.ts`/`ai.ts`: `isProd = NODE_ENV !== 'development'` |
| 10 | MED | Browser MIME aliases (`audio/x-m4a`, `audio/aac`) rejected | `voice-notes.ts`: MIME normalization + `audio/wav` allowlisted |
| 11 | MED | Missing `NEXT_PUBLIC_BACKEND_URL` built a CSP that blocks all API calls | `next.config.ts`: production build aborts with a clear error |
| 12 | MED | Tutor badge claimed "Online" while requests failed | `AiTutor.tsx`/`utils.ts`: request-outcome `reachable` → "Unreachable" + CSS + tests |

> Non-blocking notes: KaTeX CSS not imported; seed path can race a newer concurrent edit (now guarded in seed path too); device clock-skew LWW edge; guest AI history dropped on sign-in (by design).

---

## ROADMAP (NEXT)

### DAY 10 — PRODUCTION QUALITY & EDGE CASES ✅ DONE
- Task 1 — Full production regression audit ✅
- Task 2 — Auth/session edge-case audit ✅
- Task 3 — API error-state consistency ✅
- Task 4 — Offline/online transition testing ✅
- Task 5 — Data persistence + hydration edge cases ✅
- Task 6 — Multi-tab / refresh consistency ✅
- Task 7 — Voice notes edge-case audit ✅
- Task 8 — AI context / PDF edge-case audit ✅

Goal:
→ Day 9 ke fixes ke baad koi regression nahi
→ Refresh/offline/reconnect/session expiry properly handle ho

### DAY 11 — PERFORMANCE OPTIMIZATION ✅ DONE
- Task 1 — Bundle-size audit ✅ Initial JS ~0.60MB; pdfjs worker (1.2MB), jspdf (0.4MB) and react-markdown+rehype-katex (0.4MB) already code-split behind `next/dynamic` — nothing extra hits the initial load
- Task 2 — Large component/render audit ✅ Extracted memoized `NoteCard`/`NoteListItem` (components/NoteCards.tsx) + stable `useCallback` handlers (openNote/handleDeleteNote via notesRef, navigate/handleEditNote in page.tsx); single-note updates now re-render one card, not the whole grid
- Task 3 — AI Tutor render optimization ✅ Verified already optimal: `MessageItem` is `React.memo`'d and per-token streaming (`addStreamingMessage`) is reference-preserving, so only the last bubble re-renders
- Task 4 — NoteEditor performance optimization ✅ Verified already optimal: contentEditable host is `React.memo`'d (`EditorArea`), DOM edits run through refs, autosave debounced 1500ms
- Task 5 — Large notes handling ✅ Verified: debounced autosave + controlled content mirror; card previews strip HTML (bounded). No change needed
- Task 6 — PDF processing performance ✅ Verified: main-thread pdf.js is a deliberate, documented CSP choice (pdf.ts) already bounded by MAX_PDF_PAGES=100 (Day 10 T8)
- Task 7 — Image/font optimization ✅ Imported full `katex/dist/katex.min.css` (math was rendering as unstyled spans); 60 KaTeX WOFF2 fonts now bundle and serve from self, allowed by existing `font-src 'self'` CSP
- Task 8 — Network request optimization ✅ Verified: sync is event-driven (mount/reconnect/visibility/manual) single-flight `SyncEngine` with 429 Retry-After backoff; no polling, no redundant requests

Goal:
→ unnecessary renders/request kam ✅
→ large notes/PDF par UI responsive ✅
→ production bundle unnecessarily heavy na ho ✅

Tests: FE 199/199 ✅ (incl. new cardKeyboard.test.mts) · tsc ✅ · eslint ✅ · next build ✅

### DAY 12 — ACCESSIBILITY & RESPONSIVE QA
- Task 1 — Keyboard navigation audit
- Task 2 — Focus management audit
- Task 3 — ARIA labels/roles audit
- Task 4 — Modal/dialog accessibility
- Task 5 — Screen-reader critical flows
- Task 6 — 320px mobile QA
- Task 7 — Tablet layout QA
- Task 8 — Touch target / interaction audit

Goal:
→ desktop + mobile + keyboard users ke liye reliable UX
→ accessibility failures systematically close karna

### DAY 13 — TESTING EXPANSION
- Task 1 — Critical user-flow tests
- Task 2 — Authentication flow tests
- Task 3 — Note CRUD tests
- Task 4 — Folder/category tests
- Task 5 — Voice-note lifecycle tests
- Task 6 — AI flow tests
- Task 7 — Offline/sync recovery tests
- Task 8 — Error/retry tests

Goal:
→ important production flows regression-proof banana

### DAY 14 — SECURITY HARDENING ROUND 2
- Task 1 — Dependency/security audit
- Task 2 — API input validation audit
- Task 3 — Authorization boundary audit
- Task 4 — Rate-limit coverage audit
- Task 5 — File upload security audit
- Task 6 — AI prompt-abuse audit
- Task 7 — Sensitive-data exposure audit
- Task 8 — Production headers/config audit

Goal:
→ security posture ko ek final serious pass dena
→ unnecessary attack surface remove karna

### DAY 15 — OBSERVABILITY & ERROR HANDLING
- Task 1 — Frontend error boundaries
- Task 2 — Backend centralized error handling
- Task 3 — Production-safe logging
- Task 4 — AI failure observability
- Task 5 — Sync failure observability
- Task 6 — API latency/error tracking strategy
- Task 7 — User-facing error consistency
- Task 8 — Recovery/retry UX audit

Goal:
→ production me bug aaye to "kuch nahi chal raha" ke bajay exact failure path identify ho

### DAY 16 — DATABASE & BACKEND ENGINEERING
- Task 1 — Database query audit
- Task 2 — Index audit
- Task 3 — N+1 / unnecessary query audit
- Task 4 — API payload optimization
- Task 5 — Pagination strategy
- Task 6 — Cache usage audit
- Task 7 — Connection/error recovery audit
- Task 8 — Production backend readiness review

### DAY 17 — FINAL PRODUCTION READINESS
- Task 1 — Complete frontend audit
- Task 2 — Complete backend audit
- Task 3 — Security final audit
- Task 4 — Performance final audit
- Task 5 — Accessibility final audit
- Task 6 — Test-suite final verification
- Task 7 — Deployment/env verification
- Task 8 — Final production checklist

### DAY 18 — RELEASE CANDIDATE
- Task 1 — Fresh production build
- Task 2 — Production deployment verification
- Task 3 — Live smoke testing
- Task 4 — Critical user journeys
- Task 5 — Auth/session verification
- Task 6 — AI verification
- Task 7 — Sync/offline verification
- Task 8 — Final release verdict

→ PASS = Production Release Candidate
→ FAIL = Fix → retest → verdict