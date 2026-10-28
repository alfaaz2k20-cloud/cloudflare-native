# Specification & Documentation Survey Report
**Audit Scope:** Cloudflare-Native Full-Stack Architecture, Database Schema, Free-Tier Limits, and Security Posture  
**Working Directory:** `C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native\.agents\teamwork\spec_miner_survey_3`  
**Date:** October 28, 2026  
**Auditor:** Specification Miner (Survey Pass 3)  
**Parent Orchestrator:** `e0caba17-5a36-4219-a37c-98835d52c4b8`  

---

## 1. Executive Summary & Verification Environment

A comprehensive, read-only specification, documentation, and database schema audit was executed against the `cloudflare-native/` implementation. The verification suite and toolchains were executed locally to ground all findings in empirical evidence:
- **Test Suite (`npm test`):** 7 test files, 65 tests passed (100% pass rate, execution time ~3.96s).
- **Backend Typecheck (`npm run build:backend` / `tsc --noEmit`):** 0 TypeScript errors.
- **Frontend Static Asset Build (`npm run build:frontend` / `vite build`):** 12 HTML pages and all compiled chunks built cleanly into `frontend/dist` in 4.03s.
- **Node.js SQLite Runtime:** In-memory testing harness (`tests/helpers/d1_mock.ts`) executes `0001_initial_schema.sql` and `0001_dev_seed.sql` on real `node:sqlite` `DatabaseSync`, confirming SQL query syntactical validity against real SQLite.

Despite test success, multiple high-severity documentation inaccuracies, database schema discrepancies, unauthenticated endpoint vulnerabilities, and production deployment safety violations were discovered and are detailed below.

---

## 2. R3: Cloudflare Free-Tier Quota & Limits Reconciliation

### 2.1 Specification Reconciliation Table

| Component | Official Cloudflare Free Tier Limit | Claimed in `docs/FREE_TIER_COSTS_AND_LIMITS.md` | Audit Finding & Correction |
| :--- | :--- | :--- | :--- |
| **Cloudflare D1 Storage** | **500 MB per database**<br>(5 GB total account storage across max 10 DBs) | "10 GB total storage" (Line 17) | **CRITICAL ERROR:** Overstated by 20x. Free tier D1 database max size is 500 MB. Projected ~25 MB data represents **5.0%** of database capacity, NOT 0.25%. |
| **Cloudflare D1 Operations** | 5,000,000 read rows / day<br>100,000 write rows / day | 5,000,000 reads / day<br>100,000 writes / day | **Accurate.** Daily quotas correctly documented. |
| **Cloudflare Workers Requests** | 100,000 requests / day (UTC reset) | 100,000 requests / day | **Accurate.** |
| **Cloudflare Workers CPU Time** | **10 ms CPU time per request** (Free plan) | 10 ms CPU time per request | **Accurate in docs**, but creates cryptographic tension with PBKDF2 password derivation (see Section 6). |
| **Cloudflare R2 Object Storage** | 10 GB stored data / month<br>1M Class A operations (writes)<br>10M Class B operations (reads)<br>$0.00 Egress | 10 GB stored data / month<br>1M Class A<br>10M Class B<br>$0.00 Egress | **Accurate.** |
| **Workers KV** | 100,000 reads / day<br>1,000 writes / day<br>1 GB stored keys | 100,000 reads / day<br>1,000 writes / day<br>1 GB stored keys | **Accurate.** |
| **Cloudflare Turnstile** | Unlimited free challenges / month | Unlimited challenges / month | **Accurate.** |
| **Transactional Email** | Cloudflare Email Routing is free for inbound forwarding.<br>Cloudflare Email Sending API to **arbitrary recipients** requires **Workers Paid ($5/mo)** or domain verification. | Requires Workers Paid ($5/mo) or external webhook relay | **Accurate.** The abstract `EmailProvider` pattern (`DevEmailProvider`, `WebhookEmailProvider`, `CloudflareEmailSendingProvider`) properly implements zero-cost alternatives. |

### 2.2 System Behavior & Error Modes When Quotas Are Exceeded

`docs/FREE_TIER_COSTS_AND_LIMITS.md` currently omits the failure modes and edge behavior when quotas are exhausted. The following authoritative error modes must be documented:

1. **D1 Per-Database Storage Limit Exceeded (>500 MB):**
   - **Behavior:** D1 transitions the database to read-only mode for mutations.
   - **Observable Error:** Write statements (`INSERT`, `UPDATE`, `CREATE TABLE`) reject with SQLite error `SQLITE_FULL` or Cloudflare D1 error: `D1_ERROR: database size limit reached (500MB)`.
   - **HTTP Response:** The Worker throws an unhandled exception or returns HTTP 500 unless wrapped in try/catch. Read queries continue to function normally.
2. **D1 Daily Read/Write Quotas Exceeded (>5M reads/day or >100k writes/day):**
   - **Behavior:** Queries exceeding the daily quota are rejected until the UTC midnight quota reset.
   - **Observable Error:** `D1_ERROR: Storage or compute limits exceeded` (API error code 7500 / HTTP 429).
   - **Application Impact:** Member registrations, event RSVPs, and research telemetry streams fail with HTTP 500 or 429.
3. **Workers Daily Inbound Request Quota Exceeded (>100,000 requests/day):**
   - **Behavior:** The Cloudflare Edge network blocks subsequent requests before Worker code is executed.
   - **Observable Error:** Edge returns Cloudflare error page with **HTTP 1015 (You are being rate limited)** or **HTTP 1027 (Worker exceeded daily request limit)**.
   - **Application Impact:** Entire site API and static assets routed through the Worker become unreachable until 00:00 UTC.
4. **Workers CPU Time Limit Exceeded (>10 ms per invocation on Free Plan):**
   - **Behavior:** The V8 Isolate watchdog cancels the request if CPU execution time exceeds 10 ms.
   - **Observable Error:** Edge returns **Error 1102: Worker exceeded CPU time limit** with HTTP 503.
   - **Application Impact:** High-iteration PBKDF2 hashing or intensive array transforms will trigger immediate isolate termination.
5. **Workers KV Operations Limit Exceeded (>100k reads/day or >1k writes/day):**
   - **Behavior:** Subsequent `get()` and `put()` calls throw rate limit exceptions: `KV_ERROR: Rate limit exceeded`.
   - **Application Impact:** Notice board caching fails; fallback direct D1 queries are triggered, accelerating D1 read consumption.
6. **Cloudflare R2 Quota Exhaustion (>10 GB or >1M Class A operations):**
   - **Behavior:** If billing is disabled, uploads fail with HTTP 429 / 403 quota errors; if billing is enabled, overage is billed at $0.015/GB-mo and $4.50/M Class A operations.

---

## 3. R5: Feature Parity Matrix Audit & Route-by-Route Verification

Every feature claimed in `docs/FEATURE_PARITY_MATRIX.md` was cross-checked against actual Hono route handlers, database queries, frontend callers, and tests.

### 3.1 Route & Feature Parity Table

| # | Category | Feature & Endpoint | Actual Route & D1 Implementation | Frontend Caller | Test Coverage | Verified Status | Audit Findings & Gaps |
|---|---|---|---|---|---|---|---|
| 1 | Auth | User Registration (`POST /auth/register`) | `backend/src/routes/auth.ts:16`<br>D1 `INSERT INTO users` | `frontend/src/register.js:25` | `tests/d1_routes.test.ts:30` | **Verified** | Correctly rejects duplicates with 400. Has no rate limiter. Turnstile not checked. |
| 2 | Auth | User Login (`POST /auth/login`) | `backend/src/routes/auth.ts:53`<br>D1 `SELECT ... FROM users` | `frontend/src/login.js:22` | `tests/d1_routes.test.ts:73` | **Verified** | Verified password with PBKDF2 constant-time compare. Has no rate limiter. |
| 3 | Auth | Forgot Password (`POST /auth/forgot-password`) | `backend/src/routes/auth.ts:85`<br>Dispatches 15-min JWT | `frontend/src/reset.js:15` | `tests/d1_routes.test.ts:123` | **Verified** | Generates 15-min expiry reset token. Uses `DevEmailProvider`. Has no rate limiter. |
| 4 | Auth | Reset Password (`POST /auth/reset-password`) | `backend/src/routes/auth.ts:118`<br>D1 `UPDATE users SET password` | `frontend/src/reset.js:45` | `tests/d1_routes.test.ts:137` | **Partial** | **VULNERABILITY:** Token lacks single-use invalidation; token remains valid for 15 minutes across multiple uses. |
| 5 | Auth | Current Profile (`GET /auth/me`) | `backend/src/routes/auth.ts:150`<br>`requireAuth` | `frontend/src/dashboard.js:18` | `tests/d1_routes.test.ts:105` | **Verified** | Returns email and role. Rejects unauthenticated with 401. |
| 6 | Auth | Update Profile (`PATCH /auth/me`) | `backend/src/routes/auth.ts:163`<br>D1 `UPDATE users SET full_name` | `frontend/src/dashboard.js:85` | `tests/auth.test.ts` (unit) | **Verified** | Updates display name. Bounded to authenticated user email. |
| 7 | Events | Active Events (`GET /events/active`) | `backend/src/routes/events.ts:8`<br>D1 `SELECT ... FROM events` + count | `frontend/src/content/events.js` | `tests/d1_routes.test.ts:526` | **Verified** | Correctly computes spots left and full status. |
| 8 | Events | RSVP (`POST /events/register`) | `backend/src/routes/events.ts:43`<br>Rate limited + D1 check & insert | `frontend/src/dashboard.js:140` | `tests/d1_routes.test.ts:536` | **Verified** | Checks capacity, enforces duplicate prevention, rate limited (10/min). |
| 9 | Events | My RSVPs (`GET /events/my-registrations`) | `backend/src/routes/events.ts:89`<br>D1 join query | `frontend/src/dashboard.js:115` | `tests/events_clubs.test.ts` | **Verified** | Scoped to authenticated user email. |
| 10 | Events (Admin) | Create Event (`POST /admin/events/create`) | `backend/src/routes/admin.ts:30`<br>`requireAdmin` | `frontend/src/admin.js:95` | `tests/d1_routes.test.ts` | **Verified** | Admin role required, audit log generated. |
| 11 | Events (Admin) | Toggle RSVP (`PATCH /admin/events/:id/toggle`) | `backend/src/routes/admin.ts:49`<br>`requireAdmin` | `frontend/src/admin.js:120` | `tests/events_clubs.test.ts` | **Verified** | Toggles `registration_open`. |
| 12 | Events (Admin) | List All Events (`GET /admin/events`) | `backend/src/routes/admin.ts:64`<br>`requireAdmin` | `frontend/src/admin.js:80` | `tests/d1_routes.test.ts` | **Verified** | Includes registration counts. |
| 13 | Events (Admin) | Attendee Roster (`GET /admin/events/:id/registrations`) | `backend/src/routes/admin.ts:85`<br>`requireAdmin` | `frontend/src/admin.js:145` | `tests/events_clubs.test.ts` | **Verified** | Returns attendee email and WhatsApp contact. |
| 14 | Events (Admin) | Delete Event (`DELETE /admin/events/:id`) | `backend/src/routes/admin.ts:105`<br>`requireAdmin` | `frontend/src/admin.js:160` | `tests/events_clubs.test.ts` | **Verified** | Cascade deletes event registrations via D1 foreign key cascade. |
| 15 | Clubs | Apply to Club (`POST /clubs/apply`) | `backend/src/routes/clubs.ts:9`<br>`requireAuth` | `frontend/src/dashboard.js:195` | `tests/d1_routes.test.ts:573` | **Verified** | Validates club name against 5 valid clubs; allows re-applying if rejected. |
| 16 | Clubs | My Status (`GET /clubs/my-status`) | `backend/src/routes/clubs.ts:62`<br>`requireAuth` | `frontend/src/dashboard.js:175` | `tests/d1_routes.test.ts:577` | **Verified** | Returns status, club name, and admin note. |
| 17 | Clubs (Admin) | List Apps (`GET /admin/club-applications`) | `backend/src/routes/admin.ts:123`<br>`requireAdmin` | `frontend/src/admin.js:210` | `tests/d1_routes.test.ts` | **Verified** | Filterable by status. |
| 18 | Clubs (Admin) | Review App (`POST /admin/club-applications/review`) | `backend/src/routes/admin.ts:141`<br>`requireAdmin` | `frontend/src/admin.js:240` | `tests/d1_routes.test.ts` | **Verified** | Approves/rejects with optional admin note; logs audit event. |
| 19 | Clubs (Admin) | Revert App (`PATCH /admin/club-applications/:id/revert`) | `backend/src/routes/admin.ts:165`<br>`requireAdmin` | `frontend/src/admin.js:265` | `tests/d1_routes.test.ts` | **Verified** | Resets application to PENDING. |
| 20 | Exhibitions | Active Config (`GET /exhibitions/config`) | `backend/src/routes/exhibitions.ts:9`<br>Public | `frontend/src/exhibition.js:20` | `tests/d1_routes.test.ts:649` | **Verified** | Returns title, dates, venue, fee, QR code, T&C URL. |
| 21 | Exhibitions | Apply / Portfolio (`POST /exhibitions/apply`) | `backend/src/routes/exhibitions.ts:31`<br>`requireAuth` + rate limited | `frontend/src/exhibition.js:65` | `tests/d1_routes.test.ts:658` | **Verified** | Validates over-19, screening agreement; prevents duplicate submission per cycle. |
| 22 | Exhibitions | My Status (`GET /exhibitions/my-status`) | `backend/src/routes/exhibitions.ts:86`<br>`requireAuth` | `frontend/src/exhibition.js:110` | `tests/d1_routes.test.ts` | **Verified** | Returns curator note and registration status. |
| 23 | Exhibitions | Complete Reg (`POST /exhibitions/complete-registration`) | `backend/src/routes/exhibitions.ts:187`<br>`requireAuth` + rate limited | `frontend/src/exhibition.js:145` | `tests/d1_routes.test.ts` | **Verified** | Accepts payment proof URL, dispatches confirmation email. |
| 24 | Exhibitions (Admin) | Create Cycle (`POST /admin/exhibitions/create`) | `backend/src/routes/admin.ts:189`<br>`requireAdmin` | `frontend/src/admin.js:310` | `tests/d1_routes.test.ts` | **Verified** | Creates exhibition cycle; enforces single active cycle rule. |
| 25 | Exhibitions (Admin) | List Cycles (`GET /admin/exhibitions/list`) | `backend/src/routes/admin.ts:214`<br>`requireAdmin` | `frontend/src/admin.js:290` | `tests/d1_routes.test.ts` | **Verified** | Lists all exhibition records. |
| 26 | Exhibitions (Admin) | Activate Cycle (`PATCH /admin/exhibitions/:id/activate`) | `backend/src/routes/admin.ts:229`<br>`requireAdmin` | `frontend/src/admin.js:335` | `tests/d1_routes.test.ts` | **Verified** | Atomically deactivates others and activates target cycle. |
| 27 | Exhibitions (Admin) | Deactivate All (`PATCH /admin/exhibitions/deactivate-all`) | `backend/src/routes/admin.ts:246`<br>`requireAdmin` | `frontend/src/admin.js:350` | `tests/d1_routes.test.ts` | **Verified** | Closes exhibition portal. |
| 28 | Exhibitions (Admin) | List Submissions (`GET /admin/exhibitions`) | `backend/src/routes/admin.ts:253`<br>`requireAdmin` | `frontend/src/admin.js:370` | `tests/d1_routes.test.ts` | **Verified** | Filterable by cycle and status. |
| 29 | Exhibitions (Admin) | Review Artist (`POST /admin/exhibitions/review`) | `backend/src/routes/admin.ts:313`<br>`requireAdmin` | `frontend/src/admin.js:405` | `tests/d1_routes.test.ts` | **Verified** | Updates status (APPROVED/REJECTED), curator note, dispatches email. |
| 30 | Exhibitions (Admin) | Confirm Payment (`PATCH /admin/exhibitions/:id/confirm-payment`) | `backend/src/routes/admin.ts:356`<br>`requireAdmin` | `frontend/src/admin.js:430` | `tests/d1_routes.test.ts` | **Verified** | Locks registration to CONFIRMED, dispatches spot confirmation email. |
| 31 | Exhibitions (Admin) | Inspect Reg (`GET /admin/exhibitions/:id/registration`) | `backend/src/routes/admin.ts:407`<br>`requireAdmin` | `frontend/src/admin.js:460` | `tests/d1_routes.test.ts` | **Verified** | Returns payment proof URL and notes. |
| 32 | Vault | Submit Artifact (`POST /vault/submit`) | `backend/src/routes/vault.ts:20`<br>`requireAuth` + R2 upload | `frontend/src/submit.js:40` | `tests/d1_routes.test.ts:612` | **Verified** | Supports multipart upload directly to R2 bucket. |
| 33 | Vault | Serve File (`GET /vault/file/:key`) | `backend/src/routes/vault.ts:86`<br>Streams R2 object | Direct links | `tests/d1_routes.test.ts:643` | **Partial** | **CRITICAL FLAW:** No authentication check! Any unauthenticated user can download private payment proofs/portfolios; headers specify `public, max-age=86400`. |
| 34 | Blogs | Article List (`GET /blogs/`) | `backend/src/routes/blogs.ts:8`<br>D1 query | `frontend/src/blogs.js:15` | `tests/d1_routes.test.ts` | **Verified** | Returns published blogs with excerpt and cover image. |
| 35 | Blogs | Single Article (`GET /blogs/:id`) | `backend/src/routes/blogs.ts:27`<br>D1 query | `frontend/src/post.js:20` | `tests/d1_routes.test.ts` | **Verified** | Full HTML text rendering. |
| 36 | Blogs | Generate Essay (`POST /blogs/generate`) | `backend/src/routes/blogs.ts:47`<br>Bearer token check | Internal / Cron | `tests/integration.test.ts` | **Verified** | Validates `PHANTOM_SECRET_TOKEN`; invokes Gemini/Groq with static fallback. |
| 37 | Curator AI | Ask Guide (`POST /phantom/ask` & `/curator/ask`) | `backend/src/routes/curator.ts:16`<br>Rate limited (15/min) | `frontend/src/main.js:120` | `tests/integration.test.ts` | **Verified** | Gemini -> Groq -> Offline local archive engine. Rate limited. |
| 38 | Recruit | Step 0: Consent (`POST /recruit/consent`) | `backend/src/routes/recruit.ts:39`<br>D1 Latin square assignment | `frontend/src/recruit.js:180` | `tests/d1_routes.test.ts:431` | **Verified** | Requires 18+ and affirmative consent; assigns counterbalanced Latin square sequence. Turnstile missing. |
| 39 | Recruit | Step 1: Identity (`POST /recruit/identity`) | `backend/src/routes/recruit.ts:87`<br>D1 session verification | `frontend/src/recruit.js:240` | `tests/d1_routes.test.ts:438` | **Verified** | Validates email, full_name >= 2 chars, upserts identity. |
| 40 | Recruit | Step 2: Access (`POST /recruit/accessibility`) | `backend/src/routes/recruit.ts:122`<br>D1 session check | `frontend/src/recruit.js:290` | `tests/telemetry_evidence.test.ts` | **Verified** | Persists UI accommodations JSON. |
| 41 | Recruit | Step 3: Warmup (`POST /recruit/warmup`) | `backend/src/routes/recruit.ts:142`<br>D1 session check | `frontend/src/recruit.js:340` | `tests/telemetry_evidence.test.ts` | **Verified** | Records motor latency and reading baselines. |
| 42 | Recruit | Step 4a: SJT Scenarios (`GET /recruit/sjt/public`) | `backend/src/routes/recruit.ts:173`<br>Config hash check | `frontend/src/recruit.js:380` | `tests/sjt_scoring.test.ts:25` | **Verified** | Returns 7 scenarios; strictly omits keys/weights. |
| 43 | Recruit | Step 4b: Submit SJT (`POST /recruit/sjt/submit`) | `backend/src/routes/recruit.ts:179`<br>Exact thirds engine | `frontend/src/recruit.js:420` | `tests/sjt_scoring.test.ts:40` | **Verified** | Verifies all 7 responses; computes exact thirds relative scores and persists v1 evidence. |
| 44 | Recruit | Step 5: Telemetry Stream (`POST /recruit/telemetry`) | `backend/src/routes/recruit.ts:258`<br>Batched ingestion | `frontend/src/recruit.js:560` | `tests/telemetry_evidence.test.ts` | **Verified** | Hard caps: max 100 per batch, max 50,000 per session. Deduplicates by `(session_id, seq)`. |
| 45 | Recruit | Step 6: Complete (`POST /recruit/complete`) | `backend/src/routes/recruit.ts:290`<br>Feature & evidence extraction | `frontend/src/recruit.js:720` | `tests/telemetry_evidence.test.ts` | **Verified** | Atomically extracts behavioral features, updates status to COMPLETE. |
| 46 | Recruit | Step 7a: Interview Slots (`GET /recruit/interview-slots`) | `backend/src/routes/recruit.ts:330`<br>Queries settings & bookings | `frontend/src/recruit.js:780` | `tests/d1_routes.test.ts` | **Verified** | Computes available slots for next 7 days, excluding skip days and booked slots. |
| 47 | Recruit | Step 7b: Book Interview (`POST /recruit/schedule-interview`) | `backend/src/routes/recruit.ts:383`<br>Collision check & insert | `frontend/src/recruit.js:840` | `tests/d1_routes.test.ts` | **Partial** | **CONCURRENCY FLAW:** Missing UNIQUE constraint on `(slot_date, slot_time)` allows simultaneous duplicate bookings. |
| 48 | Recruit (Admin) | Recruiter Root (`GET /recruit/research`) | `backend/src/routes/research.ts:35`<br>`requireAdmin` | `frontend/src/research.js:15` | `tests/d1_routes.test.ts` | **Verified** | Status discovery endpoint. |
| 49 | Recruit (Admin) | Candidate List (`GET /recruit/research/sessions`) | `backend/src/routes/research.ts:50`<br>`requireAdmin` | `frontend/src/research.js:65` | `tests/d1_routes.test.ts:414` | **Verified** | Enforces anti-sorting/filtering safeguard: query params on score/rank return HTTP 400. Returns chronological order. |
| 50 | Recruit (Admin) | Deep Dossier (`GET /recruit/research/sessions/:id`) | `backend/src/routes/research.ts:135`<br>`requireAdmin` | `frontend/src/research.js:180` | `tests/d1_routes.test.ts:467` | **Verified** | Full dossier with 7 constructs, task records, and recruiter access log insertion. |
| 51 | Recruit (Admin) | Reschedule (`POST /recruit/research/sessions/:id/reschedule`) | `backend/src/routes/research.ts:445`<br>`requireAdmin` | `frontend/src/research.js:310` | `tests/d1_routes.test.ts` | **Verified** | Updates booking and sends notification email. |
| 52 | Recruit (Admin) | Interview Settings (`GET`/`POST /recruit/research/interview-settings`) | `backend/src/routes/research.ts:472`<br>`requireAdmin` | `frontend/src/research.js:420` | `tests/d1_routes.test.ts:489` | **Verified** | Reads/writes default slots and skip days in `interview_settings`. |
| 53 | Admin | List User Roster (`GET /admin/users`) | `backend/src/routes/admin.ts:440`<br>`requireAdmin` | `frontend/src/admin.js:520` | `tests/d1_routes.test.ts` | **Verified** | Lists all registered accounts and roles. |
| 54 | Admin | Purge Account (`DELETE /admin/users/:email`) | `backend/src/routes/admin.ts:445`<br>`requireAdmin` | `frontend/src/admin.js:560` | `tests/admin.test.ts:31` | **Verified** | Prevents self-deletion, prevents admin deletion, manually cascades deletions. |
| 55 | Admin | Update Role (`POST /admin/update_status`) | `backend/src/routes/admin.ts:471`<br>`requireAdmin` | `frontend/src/admin.js:590` | `tests/admin.test.ts:65` | **Verified** | Prevents demoting last remaining administrator account. |
| 56 | Admin | Audit Trail (`GET /admin/audit-logs`) | `backend/src/routes/admin.ts:502`<br>`requireAdmin` | `frontend/src/admin.js:630` | `tests/d1_routes.test.ts` | **Verified** | Returns chronological log of high-privilege operations. |
| 57 | Admin | Email Test (`POST /admin/email/test`) | `backend/src/routes/admin.ts:508`<br>`requireAdmin` | `frontend/src/admin.js:670` | `tests/d1_routes.test.ts` | **Verified** | Sends diagnostic email via active provider. |
| 58 | Admin | Email Status (`GET /admin/email/status`) | `backend/src/routes/admin.ts:519`<br>`requireAdmin` | `frontend/src/admin.js:655` | `tests/d1_routes.test.ts` | **Verified** | Returns configured provider mode (`dev`, `webhook`, `cloudflare`). |
| 59 | Legacy Serverless | Notices Feed (`GET /api/notices`) | `backend/src/routes/notices.ts:7`<br>D1 + KV cache | `frontend/src/main.js:40` | `tests/d1_routes.test.ts` | **Verified** | Emulates legacy Vercel serverless function with zero external latency. |

### 3.2 Psychometric Integrity & Disclaimer Requirement

**Mandatory Requirement R5 Finding:**  
`docs/FEATURE_PARITY_MATRIX.md` (Section 8) describes the 14 behavioral minigames and Situational Judgment Test (SJT) scoring engine, but currently **lacks the required prominent psychometric disclaimer**.  
To ensure legal, ethical, and scientific compliance, the following disclaimer must be appended to Section 8 of `docs/FEATURE_PARITY_MATRIX.md`:

> **⚠️ Psychometric & Assessment Validity Disclaimer:**  
> The automated volunteer recruitment assessment subsystem (`/recruit/*`), its 14 behavioral minigames, the Situational Judgment Test (SJT) scoring engine, and the candidate evidence dossier (`/recruit/research/*`) are implemented strictly to verify **software functional correctness, data integrity, and system operational readiness**. They do **NOT** claim, constitute, or imply psychological, psychometric, or clinical validity. No automated selection, ranking, or normative candidate filtering is performed or permitted.

---

## 4. R6: Database Schema Integrity Audit

### 4.1 Schema Overview & Table Count Clarification
- **Assigned Count vs Actual Count:** The dispatch assignment noted "Audit all 28 tables in `database/migrations/0001_initial_schema.sql`".
- **Actual Count in File:** An exhaustive line-by-line inspection of `database/migrations/0001_initial_schema.sql` reveals exactly **25 application tables** (lines 10 to 385). There are no additional tables in `alfaaz-project/` (the legacy PostgreSQL application had 9 models in `backend/app/models` and 16 in `recruit_system/models`, totaling exactly 25 tables).
- **SQLite Compatibility:** All tables are 100% compliant with SQLite 3 / Cloudflare D1 syntax:
  - `INTEGER PRIMARY KEY AUTOINCREMENT` used consistently for auto-incrementing IDs.
  - Text-based UUIDs for `session_id`.
  - UTC ISO-8601 strings stored in `DATETIME DEFAULT CURRENT_TIMESTAMP` or `TEXT`.
  - Integer flags (`0`/`1`) used for booleans.
  - JSON objects stored in `TEXT` columns with defaults `'[]'` or `'{}'`.
  - `PRAGMA foreign_keys = ON;` explicitly placed at line 7.

### 4.2 Comprehensive Audit of All 25 Application Tables

| # | Table Name | Primary Key | Foreign Keys & Cascade Rules | Unique Constraints & Indexes | Integrity & Design Findings |
|---|---|---|---|---|---|
| 1 | `users` | `id INTEGER PK AUTOINCREMENT` | None | `UNIQUE(email)`, Index `idx_users_email` | Valid. Missing check constraint on `status IN ('ADMIN', 'PARTICIPANT')`. |
| 2 | `admin_audit_logs` | `id INTEGER PK AUTOINCREMENT` | None | Index `idx_audit_created ON (created_at DESC)` | Valid. Retains audit trails even if admin account purged. |
| 3 | `blogs` | `id INTEGER PK AUTOINCREMENT` | None | Index `idx_blogs_published ON (is_published, created_at DESC)` | Valid. |
| 4 | `club_applications` | `id INTEGER PK AUTOINCREMENT` | **None** (relies on manual app-level cascade) | `UNIQUE(user_email, club_name)`, Index `idx_club_apps_user` | **Integrity Gap:** Missing FK to `users(email)`. Direct SQL deletions of users leave orphan applications. |
| 5 | `events` | `id INTEGER PK AUTOINCREMENT` | None | Index `idx_events_open ON (registration_open)` | Valid. |
| 6 | `event_registrations` | `id INTEGER PK AUTOINCREMENT` | `FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE` | `UNIQUE(event_id, user_email)`, Index `idx_event_regs_user` | Valid event cascade. Missing FK to `users(email)`. |
| 7 | `exhibitions_list` | `id INTEGER PK AUTOINCREMENT` | None | `UNIQUE(title)`, Index `idx_exhibitions_active` | Valid. |
| 8 | `exhibition_applications` | `id INTEGER PK AUTOINCREMENT` | **None** | `UNIQUE(user_email, exhibition_cycle)`, Indexes `idx_exh_apps_user`, `idx_exh_apps_cycle` | **Integrity Gap:** Missing FK to `users(email)` and `exhibitions_list(title)`. |
| 9 | `submissions` | `id INTEGER PK AUTOINCREMENT` | **None** | Index `idx_submissions_author` | **Integrity Gap:** Missing FK to `users(email)`. |
| 10 | `applicant_identities` | `session_id TEXT PRIMARY KEY` | **None** | Index `idx_identities_email` | **CRITICAL INTEGRITY DEFECT:** Missing `FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE`. If a session is purged, candidate PII is orphaned. |
| 11 | `recruit_sessions` | `session_id TEXT PRIMARY KEY` | None | Indexes `idx_sessions_status`, `idx_sessions_created` | Valid parent session table. |
| 12 | `consent_records` | `id INTEGER PK AUTOINCREMENT` | `FK (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | `UNIQUE(session_id)` | Valid. Cascades on session purge. |
| 13 | `accessibility_profiles` | `session_id TEXT PRIMARY KEY` | `FK (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | Implicitly unique via PK | Valid. Cascades on session purge. |
| 14 | `warmup_baselines` | `session_id TEXT PRIMARY KEY` | `FK (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | Implicitly unique via PK | Valid. Cascades on session purge. |
| 15 | `task_assignments` | `session_id TEXT PRIMARY KEY` | `FK (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | Implicitly unique via PK | Valid. Cascades on session purge. |
| 16 | `sjt_responses` | `id INTEGER PK AUTOINCREMENT` | `FK (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | `UNIQUE(session_id, scenario_id)`, Index `idx_sjt_session` | Valid. Prevents duplicate answers per scenario. |
| 17 | `telemetry_events` | `id INTEGER PK AUTOINCREMENT` | `FK (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | `UNIQUE(session_id, seq)`, Index `idx_telemetry_session` | Valid. Enforces sequence deduplication. |
| 18 | `features` | `id INTEGER PK AUTOINCREMENT` | `FK (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | `UNIQUE(session_id, mini_game, feature_name)`, Index `idx_features_session` | Valid. |
| 19 | `game_scores` | `id INTEGER PK AUTOINCREMENT` | `FK (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | `UNIQUE(session_id, game_id)`, Index `idx_game_scores_session` | Valid. |
| 20 | `evidence` | `id INTEGER PK AUTOINCREMENT` | `FK (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | `UNIQUE(session_id, parameter, version)`, Index `idx_evidence_session` | Valid. Tracks versioned psychometric parameters. |
| 21 | `data_quality_flags` | `id INTEGER PK AUTOINCREMENT` | `FK (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | None | Valid FK. Missing index on `session_id` (slows dossier assembly). |
| 22 | `volunteer_outcomes` | `id INTEGER PK AUTOINCREMENT` | `FK (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | None | Valid FK. Missing index on `session_id`. |
| 23 | `recruiter_access_logs` | `id INTEGER PK AUTOINCREMENT` | `FK (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | Index `idx_recruiter_logs_session` | Valid access audit trail. |
| 24 | `interview_bookings` | `id INTEGER PK AUTOINCREMENT` | `FK (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | `UNIQUE(session_id)`, Index `idx_bookings_slot ON (slot_date, slot_time)` | **CRITICAL INTEGRITY DEFECT:** `idx_bookings_slot` is a NON-UNIQUE index! Simultaneous requests for the same slot will double-book candidates. Must be `UNIQUE(slot_date, slot_time)`. |
| 25 | `interview_settings` | `id INTEGER PRIMARY KEY` | None | Single-row singleton table | Valid. |

### 4.3 Migration Safety & Disaster Recovery (`docs/DATABASE_MIGRATION.md`)

1. **Dangerous Instruction Identified:**
   - In `docs/DATABASE_MIGRATION.md`, line 114:
     ```bash
     npx wrangler d1 execute DB --remote --file=database/seeds/0001_dev_seed.sql
     ```
   - **Severity:** CRITICAL. Directly violates Safety Rule 4 and Requirement R1. Seeding remote databases populates production with test passwords (`curator2026!`), fake events, and dummy volunteers.
2. **Non-Destructive Migration Principles:**
   - Existing migration rules in `DATABASE_MIGRATION.md` must mandate:
     - All schema changes must be forward-compatible and non-destructive.
     - Table drops (`DROP TABLE`) and column drops are strictly prohibited in production migrations.
     - New columns must include safe `DEFAULT` values or be nullable.
     - Production migrations must only be executed via:
       ```bash
       npx wrangler d1 migrations apply DB --remote
       ```
3. **Disaster Recovery & Backup Procedures:**
   - D1 remote backup verification command:
     ```bash
     npx wrangler d1 export alfaaz-d1 --remote --output=backups/d1_backup_$(date +%Y%m%d_%H%M%S).sql
     ```
   - Safe restoration procedure:
     ```bash
     npx wrangler d1 execute alfaaz-d1 --remote --file=backups/d1_backup_20261028.sql
     ```

---

## 5. R1: Production Seed Safety & Administrator Bootstrap

### 5.1 Static Code & Documentation Scan for Remote Seeding
A global regex search for `d1 execute.*--remote.*seed` across all files in `cloudflare-native/` yielded:
- **`package.json`:** Clean. Only `db:seed:local` exists (`wrangler d1 execute DB --local --file=database/seeds/0001_dev_seed.sql`).
- **`scripts/`:** Clean. No remote seeding scripts exist.
- **`docs/DATABASE_MIGRATION.md:114`:** **VIOLATION FOUND.** Step 4 instructs executing `0001_dev_seed.sql` against remote DB.
- **`docs/BEGINNER_DEPLOYMENT_GUIDE.md`:** Clean of remote seed commands, but omits production admin creation entirely.

### 5.2 Missing Admin Bootstrap Procedure in Deployment Manual
In `docs/BEGINNER_DEPLOYMENT_GUIDE.md`, Step 3.5 applies migrations to remote D1:
```bash
npx wrangler d1 migrations apply DB --remote
```
Then Step 3.6 sets secrets and Step 3.7 deploys the worker.
**Resulting Problem:** The production `users` table is left completely empty. The administrator cannot log into `/login.html` or access `/admin.html`. A user following the guide would have no way to create their first admin account without either running `0001_dev_seed.sql` (introducing hardcoded credentials) or manually writing raw SQL inserts.

### 5.3 Recommended Secure Admin Bootstrap Procedure
A secure, one-time admin initialization pattern must be documented in `BEGINNER_DEPLOYMENT_GUIDE.md`:
1. Use an automated CLI one-time bootstrap script or parameterized Wrangler SQL execution where the administrator provides a custom password at provisioning time:
   ```bash
   # Generate salt and PBKDF2 hash using node
   HASH=$(node -e "
     const crypto = require('node:crypto');
     const salt = crypto.randomBytes(16).toString('hex');
     const hash = crypto.pbkdf2Sync(process.argv[1], Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex');
     console.log('pbkdf2:sha256:100000:' + salt + ':' + hash);
   " "YourSecureCustomAdminPasswordHere!")

   # Insert initial master administrator into remote D1
   npx wrangler d1 execute DB --remote --command="INSERT INTO users (email, password, full_name, status) VALUES ('admin@yourdomain.org', '$HASH', 'Master Administrator', 'ADMIN');"
   ```
2. Alternatively, implement an automated admin invitation token in `wrangler secret put ADMIN_BOOTSTRAP_TOKEN` that allows first-time registration via a secure one-time setup URL.

---

## 6. R2: Password Security & Cryptographic Posture

### 6.1 PBKDF2 Hashing Parameters & OWASP Reconciliation
In `backend/src/auth/crypto.ts`:
- **Current Algorithm:** `PBKDF2-HMAC-SHA256`
- **Salt:** 16 random bytes via `crypto.getRandomValues()` (Hex encoded: 32 chars)
- **Iterations:** 100,000 iterations
- **Key Length:** 256 bits (32 bytes)
- **Storage Format:** `pbkdf2:sha256:100000:<salt_hex>:<hash_hex>`

**OWASP Guidance vs Edge Worker Realities:**
- OWASP Password Storage Cheat Sheet recommends **600,000 iterations** for PBKDF2-HMAC-SHA256 on dedicated servers.
- Empirical CPU Benchmarks conducted on V8 isolate runtime:
  - **100,000 iterations:** ~104 ms (Node crypto) / ~150 ms (WebCrypto deriveBits)
  - **200,000 iterations:** ~220 ms
  - **600,000 iterations:** ~976 ms - 1,044 ms (~1 full second of pure CPU execution!)
- **Cloudflare Worker CPU Quotas:**
  - **Free Tier:** **10 ms CPU limit**
  - **Paid Tier:** **50 ms CPU limit**
- **Evaluation:** Setting iterations to 600,000 in Cloudflare Workers will instantly abort requests with **Error 1102 (Worker exceeded CPU time limit)**. Even at 100,000 iterations, WebCrypto execution operates at the threshold of serverless CPU budgets.
- **Conclusion:** 100,000 iterations is a pragmatic compromise for edge serverless runtimes. `docs/SECURITY_REVIEW.md` must clearly document this architectural rationale, explaining why 600,000 iterations cannot be deployed on Cloudflare Workers without triggering Error 1102.

### 6.2 Password Reset Token Security Vulnerabilities
In `backend/src/routes/auth.ts:85-148`:
- **Expiration:** Set to 900 seconds (15 minutes). Enforced via JWT `exp` claim.
- **VULNERABILITY 1 (Not Single-Use):** The reset token is a stateless JWT containing `{ sub: email, status: 'reset', exp: now + 900 }`. There is no token ID (`jti`), no revocation record in D1/KV, and no verification against the user's previous password hash. A single reset token can be used multiple times within its 15-minute validity window.
- **VULNERABILITY 2 (Fallback Secret):** Line 98 & 127:
  ```typescript
  const secret = c.env.JWT_SECRET || 'dev-insecure-secret-key-must-be-changed-in-production-at-least-32-chars';
  ```
  If `JWT_SECRET` is unset, tokens are signed with a known public string.

---

## 7. R4: Authorization, Access Control & Private Data Protection

### 7.1 Role Enforcement Across Admin Routes
- **`backend/src/routes/admin.ts:9`:** `adminRouter.use('*', requireAdmin);` protects all `/admin/*` routes.
- **`backend/src/routes/research.ts:12`:** `researchRouter.use('*', requireAdmin);` protects all `/recruit/research/*` routes.
- Both routes reject unauthenticated requests with HTTP 401 and non-admin participants (`status === 'PARTICIPANT'`) with HTTP 403.
- In `backend/src/index.ts`, `/recruit/research` is mounted before `/recruit`, correctly preventing route shadowing.

### 7.2 Private R2 Asset Exposure Vulnerability
In `backend/src/routes/vault.ts:86-103`:
```typescript
vaultRouter.get('/file/:key{.*}', async (c) => {
  const key = decodeURIComponent(c.req.param('key'));
  ...
  const object = await c.env.VAULT_BUCKET.get(key);
  ...
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('cache-control', 'public, max-age=86400');
  return new Response(object.body, { headers });
});
```
- **Severity:** HIGH.
- **Vulnerability:** The route contains **zero authentication checks**. Any anonymous internet user who obtains or guesses an R2 object key can retrieve the file.
- **Exposed Assets:** `VAULT_BUCKET` stores user creative submissions, applicant portfolios, and **exhibition payment proof screenshots** (which contain sensitive banking UPI IDs, transaction reference numbers, and account names).
- **Cache Poisoning Risk:** Setting `cache-control: public, max-age=86400` instructs Cloudflare edge caches and public proxies to cache private financial proofs globally for 24 hours.

### 7.3 Unwired Cloudflare Turnstile Verification
- **Severity:** MEDIUM / DOCUMENTATION GAP.
- **Finding:** `backend/src/middleware/rate_limit.ts:45` defines `verifyTurnstile(token, secretKey, remoteIp)`.
- However, `verifyTurnstile` is **never imported or invoked anywhere in the application routes**.
- `authRouter.post('/register')`, `authRouter.post('/forgot-password')`, and `recruitRouter.post('/consent')` parse request JSON and execute operations without validating `cf-turnstile-response`.
- `docs/SECURITY_REVIEW.md:60` falsely claims Turnstile is active on these routes.

### 7.4 Edge Rate Limiting Gaps
- `backend/src/middleware/rate_limit.ts` implements an in-memory `Map` rate limiter.
- While `/events/register`, `/exhibitions/apply`, and `/curator/ask` apply `rateLimiter({ limit: 10, windowMs: 60000 })`, **critical authentication endpoints have zero rate limiting**:
  - `POST /auth/login` (vulnerable to credential stuffing)
  - `POST /auth/register` (vulnerable to bot registration spam)
  - `POST /auth/forgot-password` (vulnerable to email bombing / quota exhaustion)
  - `POST /auth/reset-password` (vulnerable to token brute-forcing)

---

## 8. Features Discovered & Edge Cases

### Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth | User Registration | Creates participant account with PBKDF2 hash | JSON `{ email, password, full_name }` | HTTP 200 `{ user, token }` | 400 if missing or duplicate email | `backend/src/routes/auth.ts:16` |
| 2 | Auth | User Login | Authenticates credentials and returns 7-day JWT | JSON `{ email, password }` | HTTP 200 `{ user, token }` | 401 if invalid credentials | `backend/src/routes/auth.ts:53` |
| 3 | Auth | Password Reset Request | Issues 15-minute signed reset token via email | JSON `{ email }` | HTTP 200 `{ message }` | Generic 200 to prevent user enumeration | `backend/src/routes/auth.ts:85` |
| 4 | Auth | Password Reset Confirmation | Verifies JWT and updates password in D1 | JSON `{ token, new_password }` | HTTP 200 `{ message }` | 400/401 on expired or tampered token | `backend/src/routes/auth.ts:118` |
| 5 | Auth | Profile Inspection | Returns profile of authenticated user | Bearer Token | HTTP 200 `{ email, status }` | 401 if token missing or invalid | `backend/src/routes/auth.ts:150` |
| 6 | Auth | Profile Update | Modifies participant display name | Bearer Token, JSON `{ full_name }` | HTTP 200 `{ status, full_name }` | 400 if name > 80 chars | `backend/src/routes/auth.ts:163` |
| 7 | Events | Active Events Feed | Public list of events with real-time RSVPs | None | HTTP 200 `Array<EventSummary>` | Empty array if no open events | `backend/src/routes/events.ts:8` |
| 8 | Events | Event RSVP | Atomically books an event spot with capacity check | Bearer Token, JSON `{ event_id, whatsapp }` | HTTP 200 `{ status: 'SUCCESS' }` | 400 if event full or already registered | `backend/src/routes/events.ts:43` |
| 9 | Events | My Registrations | Lists current user's registered events | Bearer Token | HTTP 200 `Array<UserEvent>` | 401 if unauthorized | `backend/src/routes/events.ts:89` |
| 10 | Events (Admin) | Create Event | Schedules new community event | Admin Token, JSON `{ name, event_date, capacity }` | HTTP 200 `{ status: 'SUCCESS' }` | 400 if missing fields; 403 non-admin | `backend/src/routes/admin.ts:30` |
| 11 | Events (Admin) | Toggle RSVP | Opens or closes registrations for event | Admin Token, Param `:id` | HTTP 200 `{ status: 'SUCCESS', registration_open }` | 404 if event missing | `backend/src/routes/admin.ts:49` |
| 12 | Events (Admin) | List All Events | Detailed admin event view with headcount | Admin Token | HTTP 200 `Array<AdminEvent>` | 403 non-admin | `backend/src/routes/admin.ts:64` |
| 13 | Events (Admin) | Attendee List | Exports registered user contacts | Admin Token, Param `:id` | HTTP 200 `Array<Attendee>` | 403 non-admin | `backend/src/routes/admin.ts:85` |
| 14 | Events (Admin) | Delete Event | Cascades deletion of event and RSVPs | Admin Token, Param `:id` | HTTP 200 `{ status: 'SUCCESS' }` | 403 non-admin | `backend/src/routes/admin.ts:105` |
| 15 | Clubs | Apply to Club | Submits application to one of 5 creative clubs | Bearer Token, JSON `{ club_name, note }` | HTTP 200 `{ status: 'PENDING' }` | 400 if already member or invalid club | `backend/src/routes/clubs.ts:9` |
| 16 | Clubs | My Club Status | Fetches active club membership status | Bearer Token | HTTP 200 `{ status, club, admin_note }` | Returns status 'NONE' if no app | `backend/src/routes/clubs.ts:62` |
| 17 | Clubs (Admin) | Review Application | Approves or rejects club membership | Admin Token, JSON `{ application_id, status }` | HTTP 200 `{ status: 'SUCCESS' }` | 400 invalid status; 404 app not found | `backend/src/routes/admin.ts:141` |
| 18 | Clubs (Admin) | Revert Application | Resets application to PENDING | Admin Token, Param `:id` | HTTP 200 `{ status: 'SUCCESS' }` | 404 app not found | `backend/src/routes/admin.ts:165` |
| 19 | Exhibitions | Active Exhibition Config | Public exhibition cycle guidelines and fees | None | HTTP 200 `{ is_open, title, venue, fee }` | Returns `is_open: false` if closed | `backend/src/routes/exhibitions.ts:9` |
| 20 | Exhibitions | Submit Portfolio | Submits artist portfolio for curatorial screening | Bearer Token, JSON artist details | HTTP 200 `{ status: 'SUCCESS' }` | 400 if terms unagreed or portal closed | `backend/src/routes/exhibitions.ts:31` |
| 21 | Exhibitions | My Exhibition Status | Checks artist approval state and curator note | Bearer Token | HTTP 200 `{ status, curator_note, ... }` | Returns `status: 'NONE'` if unapplied | `backend/src/routes/exhibitions.ts:86` |
| 22 | Exhibitions | Complete Registration | Submits fee payment proof screenshot | Bearer Token, JSON `{ payment_proof_url }` | HTTP 200 `{ status: 'SUBMITTED' }` | 400 if not approved or already confirmed | `backend/src/routes/exhibitions.ts:187` |
| 23 | Exhibitions (Admin) | Activate Cycle | Sets target exhibition cycle as active | Admin Token, Param `:id` | HTTP 200 `{ status: 'SUCCESS' }` | Deactivates all other cycles | `backend/src/routes/admin.ts:229` |
| 24 | Exhibitions (Admin) | Confirm Payment | Validates transfer and confirms exhibition slot | Admin Token, Param `:id` | HTTP 200 `{ status: 'SUCCESS' }` | Dispatches confirmation email | `backend/src/routes/admin.ts:356` |
| 25 | Vault | Submit Artifact | Uploads file/link to creative archive | Bearer Token, Multipart/JSON | HTTP 200 `{ status: 'SUCCESS' }` | 400 invalid URL or missing fields | `backend/src/routes/vault.ts:20` |
| 26 | Vault | Serve R2 File | Streams uploaded file from R2 bucket | Param `:key` | HTTP 200 File stream with mime headers | 404 if file missing; 503 if R2 unbound | `backend/src/routes/vault.ts:86` |
| 27 | Blogs | Article List | Returns published cultural reflections | None | HTTP 200 `Array<BlogSummary>` | 200 empty array | `backend/src/routes/blogs.ts:8` |
| 28 | Blogs | Single Article | Renders full text of cultural article | Param `:id` | HTTP 200 `BlogDetail` | 404 article not found | `backend/src/routes/blogs.ts:27` |
| 29 | Blogs | Autonomous Essay Gen | Generates 1500+ word scholarly essay | Bearer `PHANTOM_SECRET_TOKEN` | HTTP 200 `{ title, excerpt, content }` | 401 unauthorized token | `backend/src/routes/blogs.ts:47` |
| 30 | Curator AI | Gallery Chatbot | Interactive AI guide with offline fallback | JSON `{ question, history }` | HTTP 200 `{ response }` | 429 if rate limit exceeded (15/min) | `backend/src/routes/curator.ts:16` |
| 31 | Recruit | Affirmative Consent | Step 0: Consent & Latin square balancing | JSON `{ confirmed_18_plus, choices }` | HTTP 200 `{ session_id, world_sequence }` | 400 if consent not affirmative | `backend/src/routes/recruit.ts:39` |
| 32 | Recruit | Candidate Identity | Step 1: Pseudonymous identity attachment | JSON `{ session_id, full_name, email }` | HTTP 200 `{ status: 'IDENTIFIED' }` | 400 if invalid email or name < 2 chars | `backend/src/routes/recruit.ts:87` |
| 33 | Recruit | Accessibility Settings | Step 2: Records visual/motor accommodations | JSON `{ session_id, modes }` | HTTP 200 `{ status: 'SUCCESS' }` | 400 session missing | `backend/src/routes/recruit.ts:122` |
| 34 | Recruit | Motor Warmup | Step 3: Calibrates baseline latency & dwell | JSON `{ session_id, tap_latency_ms }` | HTTP 200 `{ status: 'SUCCESS' }` | 400 session missing | `backend/src/routes/recruit.ts:142` |
| 35 | Recruit | Public SJT Scenarios | Step 4a: Returns 7 scenarios without weights | None | HTTP 200 `{ scenarios, config_hash }` | Static JSON delivery | `backend/src/routes/recruit.ts:173` |
| 36 | Recruit | Submit SJT | Step 4b: Scores exact thirds & saves v1 evidence | JSON `{ session_id, responses }` | HTTP 200 `{ status: 'SCORED' }` | 400 if answers incomplete/invalid | `backend/src/routes/recruit.ts:179` |
| 37 | Recruit | Telemetry Stream | Step 5: Batched ingestion of minigame traces | JSON `{ session_id, events: [...] }` | HTTP 200 `{ status: 'INGESTED' }` | 400 if batch > 100; 429 if total > 50k | `backend/src/routes/recruit.ts:258` |
| 38 | Recruit | Complete Assessment | Step 6: Feature extraction & evidence synthesis | JSON `{ session_id }` | HTTP 200 `{ status: 'COMPLETE' }` | 400 if unconsented | `backend/src/routes/recruit.ts:290` |
| 39 | Recruit | Interview Slots Feed | Step 7a: Available booking slots for next 7 days | Query `?days=7` | HTTP 200 `Array<{ date, times: [...] }>` | Excludes booked slots and Sundays | `backend/src/routes/recruit.ts:330` |
| 40 | Recruit | Schedule Interview | Step 7b: Reserves candidate interview slot | JSON `{ session_id, slot_date, slot_time }` | HTTP 200 `{ status: 'CONFIRMED' }` | 409 if slot already scheduled | `backend/src/routes/recruit.ts:383` |
| 41 | Recruit (Admin) | Candidate List | Anti-bias candidate review list | Admin Token | HTTP 200 `Array<CandidateSummary>` | 400 if query contains sorting/filtering | `backend/src/routes/research.ts:50` |
| 42 | Recruit (Admin) | Deep Dossier | Complete behavioral synthesis & audit log | Admin Token, Param `:session_id` | HTTP 200 `DossierJSON` | 404 session missing; 403 non-admin | `backend/src/routes/research.ts:135` |
| 43 | Recruit (Admin) | Reschedule Interview | Reassigns candidate interview timing | Admin Token, JSON `{ slot_date, slot_time }` | HTTP 200 `{ status: 'RESCHEDULED' }` | 409 collision; dispatches email | `backend/src/routes/research.ts:445` |
| 44 | Recruit (Admin) | Interview Settings | Configures available daily slots & skip days | Admin Token, JSON `{ slots, skip_days }` | HTTP 200 Settings JSON | 403 non-admin | `backend/src/routes/research.ts:472` |
| 45 | Admin | User Roster | Overview of all registered user accounts | Admin Token | HTTP 200 `Array<UserSummary>` | 403 non-admin | `backend/src/routes/admin.ts:440` |
| 46 | Admin | Purge Account | Cascade purge of user and submissions | Admin Token, Param `:email` | HTTP 200 `{ status: 'SUCCESS' }` | 400 if self-delete; 403 if target admin | `backend/src/routes/admin.ts:445` |
| 47 | Admin | Update Role | Promotes/demotes user role with lock | Admin Token, JSON `{ email, status }` | HTTP 200 `{ status: 'SUCCESS' }` | 400 if demoting last admin | `backend/src/routes/admin.ts:471` |
| 48 | Admin | Audit Logs | Chronological audit trail of privileged actions | Admin Token | HTTP 200 `Array<AuditLogEntry>` | 403 non-admin | `backend/src/routes/admin.ts:502` |

### Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Auth Password Reset | Reset token used twice within 15 minutes | Both requests succeed and update password; token is not invalidated upon first use. |
| 2 | Auth User Purge | Administrator requests `DELETE /admin/users/<own_email>` | Rejected with HTTP 400: `Cannot purge your own administrator account.` |
| 3 | Auth User Purge | Administrator requests `DELETE /admin/users/<other_admin_email>` | Rejected with HTTP 403: `Cannot delete an admin account.` |
| 4 | Auth Role Demotion | Demoting only admin when `adminCount === 1` | Rejected with HTTP 400: `Cannot demote the last administrator account.` |
| 5 | Events RSVP | Registering for an event that has `capacity: 0` | Registration succeeds (0 is treated as unlimited capacity). |
| 6 | Events RSVP | Registering for an event where `registered >= capacity` | Rejected with HTTP 400: `Event full.` |
| 7 | Events RSVP | Duplicate registration by same email | Rejected with HTTP 400: `Already registered.` |
| 8 | Exhibitions Registration | Submitting application when no active cycle exists | Rejected with HTTP 400: `The portal is currently closed. No active exhibition.` |
| 9 | Exhibitions Registration | Submitting application without agreeing to screening terms | Rejected with HTTP 400: `You must agree to the terms to proceed.` |
| 10 | Vault File Serving | Unauthenticated anonymous `GET /vault/file/<valid_key>` | Returns HTTP 200 with full file contents and `cache-control: public, max-age=86400`. |
| 11 | Recruit Consent | Submitting consent with `confirmed_18_plus: false` | Rejected with HTTP 400: `Affirmative consent is required.` |
| 12 | Recruit SJT Submit | Submitting option ID not in predefined scenario configuration | Rejected with HTTP 400: `Invalid option <id> for scenario <id>.` |
| 13 | Recruit Telemetry | Submitting batch of 101 telemetry events | Rejected with HTTP 400: `Batch exceeds maximum size of 100 events.` |
| 14 | Recruit Telemetry | Submitting events exceeding 50,000 total session events | Rejected with HTTP 429: `Session telemetry event limit reached.` |
| 15 | Recruit Dossier Anti-Bias | Querying `/recruit/research/sessions?sort=score` | Rejected with HTTP 400: `Anti-bias safeguard: Sorting, ranking, or filtering by psychometric traits is strictly prohibited.` |
| 16 | Interview Booking | Two concurrent requests for same `(slot_date, slot_time)` | Both pass application check and insert due to non-unique index; double booking occurs. |

---

## 9. Recommended Corrective Action Plan for Next Passes

1. **Fix `docs/FREE_TIER_COSTS_AND_LIMITS.md`:**
   - Correct D1 database size from "10 GB total storage" to **500 MB per database** (5 GB total account storage across free tier).
   - Recalculate 25 MB projected data utilization to **5.0%** (not 0.25%).
   - Add Section 1.1 detailing failure modes and error codes when quotas are exceeded (HTTP 1015, HTTP 1027, Error 1102, SQLITE_FULL, D1_ERROR 7500).
2. **Purge Remote Seeding & Update `docs/DATABASE_MIGRATION.md`:**
   - Remove line 114: `npx wrangler d1 execute DB --remote --file=database/seeds/0001_dev_seed.sql`.
   - Update instructions to mandate schema migrations only (`wrangler d1 migrations apply DB --remote`).
   - Add explicit non-destructive migration rules and verified D1 export/import recovery commands.
3. **Update `docs/BEGINNER_DEPLOYMENT_GUIDE.md`:**
   - Add a dedicated "Production Administrator Bootstrap" step that uses a secure, parameterized CLI command to create the initial admin account with a custom password.
   - Clarify the boundary between local dev testing (`0001_dev_seed.sql`) and production.
4. **Update `docs/FEATURE_PARITY_MATRIX.md`:**
   - Append the mandatory Psychometric & Assessment Validity Disclaimer to Section 8.
   - Update statuses to reflect actual vulnerabilities (`partial` for reset password, vault file serving, interview scheduling; `untested` for Turnstile).
5. **Update `docs/SECURITY_REVIEW.md`:**
   - Document PBKDF2 100k iteration trade-off vs OWASP 600k recommendation, citing the 10ms Worker CPU limit.
   - Record findings on unauthenticated R2 `/vault/file/:key` access, lack of single-use password reset tokens, and missing Turnstile wiring.
   - Classify findings into Critical, High, Medium, Low severity.
6. **Schema Fixes in Subsequent Engineering Passes:**
   - Add `FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` to `applicant_identities`.
   - Add `CONSTRAINT uq_slot UNIQUE (slot_date, slot_time)` to `interview_bookings`.
   - Add session authentication to `/vault/file/:key` or signed URLs.
   - Wire Turnstile into public submission endpoints.
   - Add single-use token revocation logic for password resets.
