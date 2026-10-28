# Alfaaz Collective: Comprehensive Source Code Audit

**Audit Date:** 2026-10-28  
**Repository Branch:** `codex/release-candidate`  
**Commit State:** Contains pre-existing uncommitted changes in both frontend and backend trees (preserved without modification).  
**Target Environment:** Cloudflare-Native Full-Stack (Workers, Workers Static Assets, D1, R2, KV, Turnstile)

---

## 1. Executive Summary & Inventory Scope

This audit examines the complete source tree of `alfaaz-project` across three primary application trees:
1. **Frontend (`frontend/`):** Multi-page Vite application comprising 12 HTML entry points, vanilla JavaScript controllers, Tailwind CSS/custom styling, Lucide icons, PWA Service Worker (`sw.js`), and legacy Vercel Serverless Functions (`frontend/api/`).
2. **Core Backend (`backend/`):** Python FastAPI service providing authentication, member dashboard APIs, club memberships, exhibition applications, event registrations, creative vault submissions, Cloudinary notice synchronization, Make.com email triggers, and Curator AI (Gemini + Groq).
3. **Alfaaz Recruitment System (`alfaaz-recruit-system/`):** Integrated psychometric and behavioral volunteer evaluation subsystem mounting under `/recruit` and `/recruit/research`. Includes a 14-minigame telemetry ingestion pipeline, Situational Judgment Test (SJT) scoring engine, feature extractor, evidence integrator, interview calendar scheduler, and recruiter research dossier.

---

## 2. Pre-Existing Uncommitted Working Tree State

Per Section 2 of the safety mandate, existing modified and untracked files are recorded here to ensure zero destructive modifications or accidental overwrites:

### Modified Files in Working Tree:
- `alfaaz-recruit-system/backend/recruit_system/routers/recruit.py`
- `alfaaz-recruit-system/backend/tests/test_gate1_consent_identity.py`
- `alfaaz-recruit-system/backend/tests/test_gate5_r5_recruiter_view_and_anticopy.py`
- `alfaaz-recruit-system/frontend/dist/recruit.html`
- `alfaaz-recruit-system/frontend/dist/research.html`
- `alfaaz-recruit-system/frontend/global.js`
- `alfaaz-recruit-system/frontend/src/recruit.js`
- `backend/app/main.py`
- `backend/app/routers/admin.py`
- `backend/app/routers/clubs.py`
- `backend/app/routers/events.py`
- `backend/app/schemas/auth.py`
- `backend/app/schemas/exhibition.py`
- `backend/app/schemas/submission.py`
- `backend/app/services/audit.py`
- `backend/app/services/curator.py`
- `backend/app/services/rate_limiter.py`
- `frontend/admin.html`
- `frontend/api/blog.js`
- `frontend/api/blogs.js`
- `frontend/api/notices.js`
- `frontend/dist/*.html`
- `frontend/global.css`
- `frontend/global.js`
- `frontend/index.html`
- `frontend/public/sw.js`
- `frontend/src/admin.js`
- `frontend/src/dashboard.js`
- `frontend/src/login.js`
- `frontend/src/post.js`
- `frontend/src/recruit.js`
- `frontend/src/submit.js`

### Untracked Files:
- `backend/tests/` (Unit test suite covering schemas, admin endpoints, vault, and user management)
- `frontend/dist/assets/*` (Newly generated Vite build bundles)
- `alfaaz-recruit-system/frontend/dist/assets/*`

All files in `cloudflare-native/` remain isolated from these paths.

---

## 3. Frontend Architecture Audit

### 3.1 Technology Stack & Build Configuration
- **Build Tool:** Vite 5 (`vite.config.js`) multi-page application setup.
- **Styling:** `global.css`, `recruit-utilities.css`, Tailwind CSS via PostCSS.
- **Icons & Assets:** Lucide CDN / bundled icons, web manifest (`manifest.webmanifest`), PWA offline fallback (`offline.html`), service worker (`sw.js`).
- **Client State:** `localStorage` for `alfaaz_token` (JWT) and `alfaaz_user` object. `sessionStorage` for Curator conversation memory (`alfaaz_curator_history`).

### 3.2 HTML Pages & User Journeys
1. **`index.html` (Landing / Portal):**
   - Cultural introduction (Ibtida, Ta'aruf, Hashiya, Halqa, Risala, Saath).
   - Dynamic notice board fetching `/api/notices` (or Cloudinary fallback).
   - Conversational Curator AI floating modal interacting with `/phantom/ask`.
   - Cultural image carousel, bilingual Urdu/English hover effects (`.ur-hover`).
2. **`login.html` & `register.html`:**
   - Member authentication connecting to `/auth/login` and `/auth/register`.
   - Client validation, redirect to `/dashboard.html` upon token receipt.
3. **`reset.html`:**
   - Password reset initiation (`/auth/forgot-password`) and token consumption (`/auth/reset-password`).
4. **`dashboard.html`:**
   - Member portal: view active events and RSVP status (`/events/active`, `/events/register`).
   - Club applications and membership status (`/clubs/apply`, `/clubs/my-status`).
   - Exhibition status check (`/exhibitions/my-status`).
   - Curator AI dialogue terminal.
   - Profile name update (`PATCH /auth/me`).
5. **`exhibition.html`:**
   - Active exhibition cycle overview (`/exhibitions/config`).
   - Call for submissions form (`/exhibitions/apply`).
   - Terms & Conditions acceptance and fee payment proof submission (`/exhibitions/complete-registration`).
6. **`submit.html`:**
   - Vault submission for literary, artwork, or photo archives (`/vault/submit`).
7. **`blogs.html` & `post.html`:**
   - Article archive reading (`/blogs/`, `/blogs/:id`).
   - Admin/Curator autonomous blog generator UI (`/blogs/generate`).
8. **`recruit.html`:**
   - Volunteer recruitment experience:
     - Step 0: Affirmative consent (`POST /recruit/consent`).
     - Step 1: Candidate identity (`POST /recruit/identity`).
     - Step 2: Accessibility adjustments (`POST /recruit/accessibility`).
     - Step 3: Device warmup latency baseline (`POST /recruit/warmup`).
     - Step 4: 7 Situational Judgment Scenarios (`GET /recruit/sjt/public`, `POST /recruit/sjt/submit`).
     - Step 5: 14 Behavioral Games (F1-F3, A1-A3, C1-C3, E1-E3, Q1-Q3, CR1-CR3, M1-M3) streaming batches to `POST /recruit/telemetry`.
     - Step 6: Session completion (`POST /recruit/complete`).
     - Step 7: Calendar interview scheduler (`GET /recruit/interview-slots`, `POST /recruit/schedule-interview`).
9. **`research.html`:**
   - Recruiter evaluation dossier:
     - Chronological candidate list (`GET /recruit/research/sessions`).
     - Deep-dive behavioral evidence view (`GET /recruit/research/sessions/:id`).
     - Interview slot configuration (`GET`/`POST /recruit/research/interview-settings`).
     - Webhook test runner (`POST /recruit/research/webhook-test`).
10. **`admin.html`:**
    - Unified administrative control panel:
      - Event creation, deletion, registration lists, toggle open/closed.
      - Exhibition cycle management, activation, application reviews, payment approvals.
      - Club application reviews and status reverts.
      - User roster management, role elevation, account purge.
      - Creative vault submissions review.
      - Audit trail log viewer (`/admin/audit-logs`).
      - Outbound email diagnostic check (`/admin/email/test`, `/admin/email/status`).

---

## 4. Backend Architecture Audit

### 4.1 Original Python Architecture (`backend/` + `alfaaz-recruit-system/backend/`)
- **Runtime:** Python 3.11+ / Uvicorn + FastAPI.
- **ORM / Models:** SQLAlchemy & SQLModel, dynamic table synchronization and schema introspection on boot.
- **Relational Storage:** PostgreSQL in production (`render.yaml`), SQLite locally (`alfaaz_data.db`).
- **Authentication:** HS256 JWT tokens with 7-day expiration (`app.core.security`). Password hashing via bcrypt/passlib. Role-based dependency gates (`require_auth`, `require_admin`).
- **External Integrations:**
  - Make.com Webhook (`MAKE_WEBHOOK_URL`): Transmits transactional emails for password resets, exhibition approvals, candidate bookings.
  - Cloudinary: Static hosting of notice feeds (`notices.json`) and media upload storage.
  - Google Gemini API (`gemini-1.5-flash`): Primary LLM provider for conversational Curator AI and autonomous essays.
  - Groq API (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`): Fallback LLM provider.

### 4.2 API Endpoint Inventory
The original backend exposes 45 distinct route handlers:
- Health & Discovery: `GET /ping`, `GET /`
- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/me`, `PATCH /auth/me`
- Events: `GET /events/active`, `POST /events/register`, `GET /events/my-registrations`
- Clubs: `POST /clubs/apply`, `GET /clubs/my-status`
- Exhibitions: `GET /exhibitions/config`, `POST /exhibitions/apply`, `GET /exhibitions/my-status`, `POST /exhibitions/complete-registration`, `POST /exhibitions/finalize`
- Vault: `POST /vault/submit`
- Blogs: `GET /blogs/`, `GET /blogs/:id`, `POST /blogs/generate`
- Curator AI: `POST /phantom/ask`
- Admin Operations:
  - Events: `POST /admin/events/create`, `PATCH /admin/events/:id/toggle`, `GET /admin/events`, `GET /admin/events/:id/registrations`, `DELETE /admin/events/:id`
  - Clubs: `GET /admin/club-applications`, `POST /admin/club-applications/review`, `PATCH /admin/club-applications/:id/revert`
  - Exhibitions: `POST /admin/exhibitions/create`, `GET /admin/exhibitions/list`, `PATCH /admin/exhibitions/:id/activate`, `PATCH /admin/exhibitions/deactivate-all`, `GET /admin/exhibitions`, `GET /admin/exhibitions/cycles`, `POST /admin/exhibitions/review`, `PATCH /admin/exhibitions/:id/confirm-payment`, `PATCH /admin/exhibitions/:id/revert`, `GET /admin/exhibitions/:id/registration`
  - Users: `GET /admin/users`, `DELETE /admin/users/:email`, `POST /admin/update_status`
  - Submissions & Logs: `GET /admin/submissions`, `GET /admin/audit-logs`
  - Diagnostics: `POST /admin/email/test`, `GET /admin/email/status`
- Recruitment:
  - Candidate: `POST /recruit/consent`, `POST /recruit/identity`, `POST /recruit/accessibility`, `POST /recruit/warmup`, `GET /recruit/sjt/public`, `POST /recruit/sjt/submit`, `POST /recruit/telemetry`, `POST /recruit/complete`, `GET /recruit/interview-slots`, `POST /recruit/schedule-interview`, `GET /recruit/interview-booking/:id`
  - Recruiter Research: `GET /recruit/research`, `GET /recruit/research/sessions`, `GET /recruit/research/sessions/:id`, `POST /recruit/research/sessions/:id/reschedule`, `GET /recruit/research/interview-settings`, `POST /recruit/research/interview-settings`, `POST /recruit/research/webhook-test`

---

## 5. Database Schema & Relational Model

The system utilizes 25 relational tables:
1. `users`: Credentials, full names, roles (`ADMIN`, `PARTICIPANT`).
2. `admin_audit_logs`: Audit trail for sensitive administrative operations.
3. `blogs`: Published and drafted editorial essays and cultural reflections.
4. `club_applications`: Per-user club memberships and status.
5. `events`: Physical community gatherings, dates, capacity, registration state.
6. `event_registrations`: User signups per event with contact numbers.
7. `exhibitions_list`: Exhibition cycles, fees, venue metadata, payment instructions.
8. `exhibition_applications`: Portfolios, screening flags, approval states, payment proof.
9. `submissions`: Literary and artwork vault contributions.
10. `applicant_identities`: Recruitment candidate names, emails, and contact details.
11. `recruit_sessions`: Pseudonymous candidate assessment tracking and state machine.
12. `consent_records`: Affirmative consent snapshots with versioning.
13. `accessibility_profiles`: Contrast, motion, and accessibility preferences.
14. `warmup_baselines`: Input device latency and motor baseline benchmarks.
15. `task_assignments`: Latin-Square counterbalanced game sequence and random seeds.
16. `sjt_responses`: Scenario choices and timestamp tracking.
17. `telemetry_events`: Granular user interaction events recorded across minigames.
18. `features`: Behavioral metrics extracted per game (latency, ratio, consistency).
19. `game_scores`: Calibrated game metric bands, bounds, and observation counts.
20. `evidence`: Consolidated psychometric parameter records across 7 core dimensions.
21. `data_quality_flags`: Anomaly detections (rapid responding, rule violations).
22. `volunteer_outcomes`: Post-interview administrative evaluations.
23. `recruiter_access_logs`: Audit log tracking recruiter access to candidate dossiers.
24. `interview_bookings`: Scheduled conversational interviews with collision prevention.
25. `interview_settings`: Recruiter slot availability windows and skip days.

---

## 6. Security & Authorization Analysis

1. **Password Security:**
   - Original used PBKDF2/bcrypt via passlib.
   - Cloudflare Workers compatibility: Web Crypto API (`crypto.subtle.deriveBits` with PBKDF2-HMAC-SHA256) provides zero-dependency, FIPS-compliant, native password hashing without native binary compilation.
2. **Session Security:**
   - JWT validation with HS256. Web Crypto supports HMAC-SHA256 token verification natively.
3. **Data Boundary Enforcement:**
   - Candidate scores and raw telemetry keys are never returned to candidate-facing endpoints (`/recruit/sjt/public`, `/recruit/complete`).
   - Anti-sorting/filtering safeguards on recruiter sessions list (`/recruit/research/sessions`) prevent discriminatory algorithmic sorting.
4. **Rate Limiting:**
   - Original used in-memory Python dictionaries with IP tracking.
   - Cloudflare-native approach: Workers KV or in-memory LRU cache with Cloudflare Turnstile token verification for public forms.

---

## 7. Cloudflare Target Translation Strategy

| Original Component | Original Provider | Cloudflare-Native Target | Rationale |
| :--- | :--- | :--- | :--- |
| Frontend Hosting | Vercel | Cloudflare Workers Static Assets | Unified single-worker routing, zero-cost edge delivery |
| Backend API | Render (FastAPI) | Cloudflare Worker + Hono (TypeScript) | Zero cold starts, 100k free requests/day |
| Database | Neon PostgreSQL / SQLite | Cloudflare D1 (SQLite) | Distributed relational DB, 5M read rows/day free |
| Media / Proofs | Cloudinary | Cloudflare R2 | S3-compatible, 10GB free, zero egress fees |
| Bot Protection | Custom Rate Limit | Cloudflare Turnstile + Worker Middleware | Free bot protection without intrusive CAPTCHAs |
| Cache / Ephemeral | In-Memory / CDN | Workers KV | 100k reads/day free for edge notices and caches |
| AI Integration | Gemini / Groq REST | Gemini / Groq + Workers AI Fallback | Fetch API supported directly on Workers runtime |
| Email System | Make.com Webhook | Email Provider Interface (Dev Preview + Webhook) | Clean abstraction for free-tier dev mode |

---

## 8. Verification Status & Known Limitations

- **Facts Verified:** Complete route list, database schemas, frontend asset tree, build script functionality, SJT scoring mechanics.
- **Assumptions Recorded:** Production deployments on Render/Vercel rely on paid external services (Cloudinary, Make.com) that can be safely simulated or abstracted on Cloudflare without incurring costs.
- **Items Requiring Testing:** D1 migration execution, Hono route integration tests, password hashing interoperability, local Vite build bundle under Workers Static Assets.
