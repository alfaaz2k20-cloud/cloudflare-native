# Cloudflare-Native Codebase Architecture & Test Readiness Survey

**Date:** October 28, 2026  
**Auditor:** Codebase Architecture Explorer (`explorer_survey_1`)  
**Project Root:** `C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native`  
**Reference Document:** `ORIGINAL_REQUEST.md`  

---

## Executive Summary

A comprehensive architectural and security survey of the `cloudflare-native/` full-stack implementation was executed. The project represents a Cloudflare-native migration of the Alfaaz Collective application, migrating from a legacy multi-cloud setup (Render, Vercel, Neon PostgreSQL, Cloudinary) to a unified Cloudflare Workers isolate topology (Hono v4, D1 SQLite, R2 object storage, KV caching, Workers static assets).

### Verification Baseline
All automated build and test commands were independently executed in the local environment:
1. **Backend Build (`npm run build:backend` / `tsc --noEmit`):** **PASS** (Exit Code 0, 0 type errors).
2. **Frontend Build (`npm run build:frontend` / `vite build`):** **PASS** (Exit Code 0, 12 HTML entry points, 27 build artifacts generated in `frontend/dist`).
3. **Automated Test Suite (`npm test` / `vitest run`):** **PASS** (Exit Code 0, 7 test files, 65 passing assertions, duration ~5.06s).

Despite 100% test pass rates on existing test files, the audit revealed several **critical security vulnerabilities, documentation risks, and test coverage illusions** that must be addressed prior to any production deployment.

---

## 1. Project Topology & Build Configuration

### 1.1 Root Configuration
- **`package.json`:**
  - Name: `alfaaz-cloudflare-native` (v2.0.0, ESM module).
  - Dependencies: `hono` (^4.6.14).
  - DevDependencies: `@cloudflare/workers-types` (^4.20241101.0), `typescript` (^5.7.2), `vitest` (^2.1.8), `wrangler` (^4.154.0).
  - Scripts:
    - `"dev": "wrangler dev"`
    - `"build:frontend": "cd frontend && npm install && npm run build"`
    - `"build:backend": "tsc --noEmit"`
    - `"build": "npm run build:frontend && npm run build:backend"`
    - `"test": "vitest run"`
    - `"db:migrate:local": "wrangler d1 migrations apply DB --local"`
    - `"db:seed:local": "wrangler d1 execute DB --local --file=database/seeds/0001_dev_seed.sql"`
    - `"typecheck": "tsc --noEmit"`
- **`tsconfig.json`:**
  - Target: `ES2022`, Module: `ESNext`, Resolution: `Bundler`.
  - Includes: `backend/src/**/*`.
  - Excludes: `node_modules`, `frontend`, `tests`.
- **`wrangler.jsonc`:**
  - Main Worker Entry: `backend/src/index.ts`
  - Compatibility Flag: `["nodejs_compat"]`, Compatibility Date: `2024-11-01`.
  - Static Assets: Directory `./frontend/dist`, binding `ASSETS`, `html_handling: "auto-trailing-slash"`.
  - D1 Database: Binding `DB`, database name `alfaaz-d1`, migrations dir `database/migrations`.
  - R2 Bucket: Binding `VAULT_BUCKET`, bucket name `alfaaz-vault`.
  - KV Namespace: Binding `CACHE_KV`, id `alfaaz-cache-kv`.
  - Environment Variables: `ENV: "development"`, `FRONTEND_URL: "http://localhost:8787"`, `EMAIL_PROVIDER: "dev"`.

### 1.2 Frontend Structure
- **`frontend/package.json`:**
  - Dependencies: `lucide` (^1.28.0), `pg` (^8.20.0 — Note: `pg` is an unnecessary legacy artifact in the frontend package).
  - DevDependencies: `vite` (^5.0.0), `tailwindcss` (^4.3.3), `postcss` (^8.5.25), `autoprefixer` (^10.5.4).
- **`frontend/vite.config.js`:**
  - Multi-page configuration with 12 entry points:
    `main` (index.html), `admin`, `blogs`, `dashboard`, `exhibition`, `login`, `post`, `register`, `reset`, `submit`, `recruit`, `research`.
- **Client Architecture:**
  - `frontend/global.js`: Shared initialization, `window.globalApiFetch` wrapper with automatic JWT Bearer injection from `localStorage.getItem('alfaaz_token')`, HTML escaping, and backend health ping.
  - `frontend/src/*.js`: Page-specific controllers interacting with Hono API routes.
  - `frontend/src/recruit_games/`: Interactive Canvas/DOM behavioral minigames for candidate assessments.

---

## 2. Backend Architecture & Route Analysis

The backend is built with **Hono v4** running on Cloudflare Workers. It uses a **dual-mount router architecture** in `backend/src/index.ts`: every router is mounted both at the root path (`/auth`, `/events`, etc.) and with an `/api` prefix (`/api/auth`, `/api/events`, etc.) for maximum client compatibility.

```
backend/src/
├── index.ts                     # Main entry point & route dual-mounting
├── types.ts                     # Environment & JWT types
├── auth/
│   └── crypto.ts                # Web Crypto API: PBKDF2 password hashing & HMAC-SHA256 JWT
├── middleware/
│   ├── auth.ts                  # requireAuth & requireAdmin middleware
│   └── rate_limit.ts            # Sliding-window rate limiter & Turnstile verifier
├── notifications/
│   └── email.ts                 # Dev, Webhook (Make.com/Brevo), & Cloudflare Email Sending providers
├── routes/
│   ├── auth.ts                  # /auth (register, login, forgot-password, reset-password, me)
│   ├── events.ts                # /events (active events feed, RSVP registration, my-registrations)
│   ├── clubs.ts                 # /clubs (apply, my-status)
│   ├── exhibitions.ts           # /exhibitions (config, apply, my-status, complete-registration)
│   ├── vault.ts                 # /vault (submit to R2/DB, serve R2 file via /vault/file/:key)
│   ├── blogs.ts                 # /blogs (archive list, article detail, /generate autonomous essays)
│   ├── curator.ts               # /curator and /phantom (Curator AI conversational guide)
│   ├── admin.ts                 # /admin (events, club apps, exhibitions, users, audit logs, email test)
│   ├── recruit.ts               # /recruit (consent, identity, accessibility, warmup, sjt, telemetry, complete, interview-slots, schedule-interview)
│   ├── research.ts              # /recruit/research (admin candidate dossiers, anti-bias list, interview settings)
│   └── notices.ts               # /api/notices, /api/blogs, /api/blog (legacy Vercel compatibility)
└── services/
    ├── curator.ts               # Curator AI prompt grounding & offline fallback
    ├── descriptive_task_record.ts # Human-readable task descriptions & locked games
    ├── evidence.ts              # Evidence synthesis engine, construct mapping & confidence
    ├── features.ts              # Behavioral feature extraction from telemetry
    ├── sjt.ts                   # Situational Judgment Test exact integer thirds scoring
    ├── telemetry.ts             # Telemetry streaming ingestion, cap enforcement, batching
    └── world_order.ts           # 14-row Latin Square & deterministic HMAC seed generator
```

---

## 3. Database & Storage Architecture

### 3.1 D1 Relational Schema (`database/migrations/0001_initial_schema.sql`)
The database contains **25 tables** in pure SQLite D1 syntax with foreign key constraints and cascade rules:
1. `users` (id, email UNIQUE, password, full_name, status)
2. `admin_audit_logs` (admin_email, action, target_type, target_id, details, created_at)
3. `blogs` (id, title, excerpt, content, cover_image, is_published, created_at)
4. `club_applications` (user_email, club_name, note, status, admin_note, UNIQUE(user_email, club_name))
5. `events` (name, description, event_date, registration_open, capacity)
6. `event_registrations` (event_id, user_email, whatsapp_number, UNIQUE(event_id, user_email), FK -> events ON DELETE CASCADE)
7. `exhibitions_list` (title UNIQUE, date_text, venue, about_text, is_active, tnc_pdf_url, registration_fee, payment_instructions, payment_qr_url)
8. `exhibition_applications` (user_email, exhibition_cycle, full_name, age, address, whatsapp, genre, medium, portfolio_url, status, registration_status, payment_proof_url, UNIQUE(user_email, exhibition_cycle))
9. `submissions` (submission_type, title, file_url, note, author_email)
10. `applicant_identities` (session_id PK, full_name, email, phone_or_contact, linkedin_url)
11. `recruit_sessions` (session_id PK, status, current_screen, order_id, spec_version, sjt_version, scoring_version, feature_version, config_hash, device_class, input_modality, completed_at)
12. `consent_records` (session_id UNIQUE, consent_text_version, choices_json, confirmed_18_plus, FK -> recruit_sessions ON DELETE CASCADE)
13. `accessibility_profiles` (session_id PK, modes_enabled_json, FK -> recruit_sessions ON DELETE CASCADE)
14. `warmup_baselines` (session_id PK, tap_latency_baseline_ms, movement_speed_baseline, reading_dwell_baseline_ms, pointer_type, viewport_class, FK -> recruit_sessions ON DELETE CASCADE)
15. `task_assignments` (session_id PK, world_order_id, world_sequence_json, seeds_json, FK -> recruit_sessions ON DELETE CASCADE)
16. `sjt_responses` (session_id, scenario_id, option_id, t_ms, UNIQUE(session_id, scenario_id), FK -> recruit_sessions ON DELETE CASCADE)
17. `telemetry_events` (session_id, seq, segment_id, t_ms, screen, game_world, mini_game, trial, action, input_type, task_def_version, state_json, data_json, UNIQUE(session_id, seq), FK -> recruit_sessions ON DELETE CASCADE)
18. `features` (session_id, mini_game, feature_name, value_raw, value_adjusted, adjust_method, feature_version, valid, flags_json, UNIQUE(session_id, mini_game, feature_name), FK -> recruit_sessions ON DELETE CASCADE)
19. `game_scores` (session_id, game_id, parameter, raw_score, min_score, max_score, span, num, relative_score, band, status, task_def_version, scoring_version, observation_count, flags_json, UNIQUE(session_id, game_id), FK -> recruit_sessions ON DELETE CASCADE)
20. `evidence` (session_id, parameter, version, is_superseded, spec_version, sjt_version, scoring_version, feature_version, config_hash, sjt_raw, sjt_relative, sjt_band, game_raw, game_relative, game_band, consistency, relationship, confidence, data_quality_flags_json, UNIQUE(session_id, parameter, version), FK -> recruit_sessions ON DELETE CASCADE)
21. `data_quality_flags` (session_id, scope, flag, detail, FK -> recruit_sessions ON DELETE CASCADE)
22. `volunteer_outcomes` (session_id, outcome_type, value, recorded_by, FK -> recruit_sessions ON DELETE CASCADE)
23. `recruiter_access_logs` (admin_email, session_id, viewed_at, ip_address, FK -> recruit_sessions ON DELETE CASCADE)
24. `interview_bookings` (session_id UNIQUE, candidate_name, candidate_email, candidate_phone, slot_date, slot_time, slot_display, status, notes, FK -> recruit_sessions ON DELETE CASCADE)
25. `interview_settings` (id PK, slots_json, skip_days_json)

### 3.2 Development Seed Data (`database/seeds/0001_dev_seed.sql`)
- Contains test admin (`admin@alfaaz.com` with password `curator2026!`) and volunteer (`volunteer@alfaaz.com` with password `alfaaz2026!`).
- Contains sample exhibition cycle (`KAAMIL III`), sample events, blog entries, and default interview slots.
- **Critical Risk:** Documentation currently instructs operators to execute this file in production.

---

## 4. Test Suite Audit & Gap Analysis

### 4.1 Current Test Suites
The project has 7 test files in `tests/`:

| Test File | Test Count | Nature of Tests | Target Under Test |
| :--- | :---: | :--- | :--- |
| `tests/d1_routes.test.ts` | 21 | **Real Integration** (Hono + Node SQLite `DatabaseSync` in-memory D1 + Mock R2/KV) | `/auth/*`, `/recruit/*`, `/recruit/research/*`, `/events/*`, `/clubs/*`, `/vault/*`, `/exhibitions/*` |
| `tests/auth.test.ts` | 8 | **Unit Tests** | `backend/src/auth/crypto.ts` (PBKDF2 hashing & HMAC JWT) |
| `tests/admin.test.ts` | 8 | **Mock-Only Isolation** | **Local TypeScript helper functions** mirroring admin business logic; DOES NOT call Hono routes or D1 |
| `tests/events_clubs.test.ts` | 8 | **Mock-Only Isolation** | **Local TypeScript helper functions** mirroring event capacity logic; DOES NOT call Hono routes or D1 |
| `tests/integration.test.ts` | 6 | **Partial Route Test** | `app.request()` for `/ping`, `/api/ping`, `OPTIONS *`, `/recruit/sjt/public`, `/phantom/ask`, `/api/unknown` |
| `tests/sjt_scoring.test.ts` | 5 | **Unit Tests** | `backend/src/services/sjt.ts` (exact integer thirds math & public payload sanitization) |
| `tests/telemetry_evidence.test.ts` | 9 | **Unit & Mock Tests** | `world_order.ts` (seeds), `telemetry.ts` (caps), and a **mismatched local helper** for cross-method delta |

### 4.2 Critical Test Gaps & Fidelity Discrepancies
1. **Mock-Only Test Illusion (`tests/admin.test.ts` & `tests/events_clubs.test.ts`):**
   - In `tests/admin.test.ts`, the tests do not call `adminRouter` or execute D1 statements. Instead, lines 9-29 define private helper functions `validateUserPurge` and `validateAdminDemotion`. The actual endpoints (`/admin/events/*`, `/admin/users/:email`, `/admin/update_status`, `/admin/audit-logs`) in `backend/src/routes/admin.ts` have **zero route-level test coverage**.
   - Similarly, in `tests/events_clubs.test.ts`, lines 13-28 define `attemptRegisterEvent` as an in-memory array operation, rather than testing D1 queries.
2. **Discordant Terminology in `tests/telemetry_evidence.test.ts`:**
   - In `backend/src/services/evidence.ts`, relationship calculation returns `"NOT_AVAILABLE"`, `"NOT_ENOUGH_EVIDENCE"`, `"ALIGNED"`, `"PARTLY_ALIGNED"`, or `"DIFFERENT"`, and confidence returns `"LIMITED"`, `"MODERATE"`, `"SUBSTANTIAL"`.
   - In `tests/telemetry_evidence.test.ts:92`, a local helper `computeRelationshipAndConfidence` returns `"CONCORDANT"`, `"SHIFT_ADJACENT"`, `"DIVERGENT"`, and `"HIGH"`, `"MODERATE"`, `"LOW"`. The test does not exercise the real production service code.
3. **Missing Cross-User Authorization Tests:**
   - No tests verify that User A cannot read or modify User B's club applications, event RSVPs, or exhibition submissions.
4. **Missing Error Path Tests:**
   - Password reset with expired, forged, or reused tokens is untested.
   - Event RSVP with full capacity (database constraint) is untested at route level.
   - Concurrent/colliding interview slot booking is untested at route level.
5. **Untested Subsystems:**
   - `/blogs` routes (`GET /blogs`, `GET /blogs/:id`, `POST /blogs/generate`) have 0 automated test coverage.
   - `/api/notices`, `/api/blogs`, `/api/blog` (legacy noticesRouter) have 0 automated test coverage.
   - Administrative email diagnostic endpoints (`/admin/email/test`, `/admin/email/status`) have 0 automated test coverage.

---

## 5. Security & Readiness Findings by Requirement

### R1. Production Seed Safety & Admin Bootstrap
- **Critical Finding:** `docs/DATABASE_MIGRATION.md` line 114 explicitly instructs:
  ```bash
  npx wrangler d1 execute DB --remote --file=database/seeds/0001_dev_seed.sql
  ```
  This directly applies development seeds containing fabricated test accounts and known passwords (`curator2026!`) to the production database.
- **Admin Bootstrap Gap:** Neither `package.json`, `scripts/`, nor `docs/BEGINNER_DEPLOYMENT_GUIDE.md` provides a mechanism to bootstrap a production administrator without seeds. If an operator only runs `wrangler d1 migrations apply DB --remote`, the `users` table remains completely empty, locking out any administrator.
- **Accidental Seeding Safeguard:** No pre-execution script or hook validates whether `--remote` is being passed with seed files.

### R2. Password Security & Cryptographic Posture
- **PBKDF2 Iteration Assessment:**
  - `backend/src/auth/crypto.ts:56` uses 100,000 iterations of PBKDF2-HMAC-SHA256 with a 16-byte random salt.
  - While OWASP recommendations suggest up to 600,000 iterations for PBKDF2-HMAC-SHA256 on dedicated server hardware, local benchmarking using the Web Crypto API shows:
    - 100,000 iterations: **~64.36 ms**
    - 210,000 iterations: **~172.39 ms**
    - 600,000 iterations: **~560.07 ms**
  - **Worker CPU Limit Constraint:** Cloudflare Workers Free Tier enforces a strict **10 ms CPU time limit per request** (Standard Paid Bundled is 50 ms). Running 600,000 iterations in a Worker will cause `Worker exceeded CPU time limit (Error 1102)` or severe latency spikes. 100,000 iterations is a calibrated compromise for serverless edge runtimes, but must be explicitly documented and defended in the threat model.
- **Single-Use Password Reset Token Vulnerability:**
  - In `backend/src/routes/auth.ts:118-148`, `/auth/reset-password` verifies the JWT signature and `status === 'reset'`, but **does not track or invalidate the token** after use.
  - A password reset token remains valid for multiple password resets until its 15-minute expiration timestamp expires. There is no token blacklist, nonce, or database revocation.
- **Dev Password Leakage:**
  - Seed admin password `curator2026!` and volunteer password `alfaaz2026!` are embedded in `0001_dev_seed.sql` and `.dev.vars.example`.

### R3. Free-Tier Accuracy & Limits Reconciliation
- **D1 Quota Documentation Error:**
  - `docs/FREE_TIER_COSTS_AND_LIMITS.md` line 17 claims:
    `Cloudflare D1 (Database): ... 10 GB total storage`.
  - **Correction:** Official Cloudflare D1 documentation limits storage on the Free Tier to **500 MB per database** (up to 5 GB total account-level storage across all databases).
  - Accurate Free Tier limits:
    - D1 Database Storage: 500 MB / DB (5 GB total account).
    - D1 Row Reads: 5,000,000 / day.
    - D1 Row Writes: 100,000 / day.
    - Workers: 100,000 requests / day.
    - R2 Object Storage: 10 GB / month, 1M Class A, 10M Class B, $0 egress.
    - KV: 100,000 reads / day, 1,000 writes / day, 1 GB storage.
- **Transactional Outbound Email Limitation:**
  - Cloudflare Email Routing is inbound-only forwarding. Outbound transactional emails to arbitrary external recipients require either:
    1. A paid Workers subscription ($5/mo) for the Cloudflare Email Sending API; OR
    2. An external free-tier transactional webhook provider (Make.com, Brevo, Resend).

### R4. Authorization, Access Control & Private Data Protection
- **Unauthenticated R2 Vault Access (High Severity):**
  - In `backend/src/routes/vault.ts:85-103`:
    ```typescript
    vaultRouter.get('/file/:key{.*}', async (c) => {
      const key = decodeURIComponent(c.req.param('key'));
      const object = await c.env.VAULT_BUCKET.get(key);
      ...
    });
    ```
    This endpoint lacks `requireAuth`. Anyone who knows or guesses the key format (`vault/{timestamp}-{filename}`) can download private user files, payment receipts, and candidate portfolios without authentication.
- **Turnstile Bot Protection Missing in Practice (Medium Severity):**
  - `backend/src/middleware/rate_limit.ts:45` defines `verifyTurnstile()`.
  - **Audit Result:** `verifyTurnstile()` is **never called anywhere** in `backend/src/` or `frontend/`. Neither `/auth/register`, `/auth/forgot-password`, nor `/recruit/consent` verifies Turnstile tokens, leaving registration and recruitment open to automated bot flooding.
- **Overly Permissive CORS with Credentials (Medium Severity):**
  - In `backend/src/index.ts:20-27`:
    ```typescript
    app.use('*', cors({
      origin: (origin) => origin || '*',
      ...
      credentials: true
    }));
    ```
    When `credentials: true` is set, reflecting the client's `origin` header allows any malicious third-party website to make authenticated cross-origin requests using ambient credentials. In production, this should restrict origins to `c.env.FRONTEND_URL` and trusted domains.

### R5. Feature Parity, Test Quality & Psychometric Integrity
- **Feature Parity Matrix Accuracy:**
  - `docs/FEATURE_PARITY_MATRIX.md` marks all 46 features as `Parity Implemented` without testing classification.
  - Real status breakdown:
    - `verified`: Core auth (login, register, me), basic events feed/RSVP, basic club applications, SJT engine, Latin square assignment, basic vault upload.
    - `partial`: R2 file download (unauthenticated), password reset (lacks single-use revocation), Turnstile bot protection (not invoked), Admin portal (untested at route level).
    - `untested`: Autonomous essay generator (`/blogs/generate`), Curator AI conversation (`/phantom/ask` under real LLM provider), email diagnostic webhooks (`/admin/email/test`, `/recruit/research/webhook-test`).
- **Psychometric Validity Clarification:**
  - The recruitment evaluation pipeline (`/recruit/*`) executes deterministic algorithmic features (exact integer thirds, Latin square balancing, motor latency baselines).
  - Documentation must explicitly disclaim psychological or clinical validity, confirming that tests verify **functional software correctness** and operational workflows only.

### R6. Database Schema Integrity & Safe Migration Procedure
- **SQLite Compatibility:**
  - All 25 tables in `0001_initial_schema.sql` conform strictly to SQLite syntax supported by Cloudflare D1.
  - Foreign key cascading is defined cleanly with `ON DELETE CASCADE`.
- **Migration & Disaster Recovery Procedure:**
  - Migrations are non-destructive when applying incremental schema updates.
  - A disaster recovery export/import workflow (`wrangler d1 export`) is documented, but the restore command in `docs/DATABASE_MIGRATION.md:129` currently references a remote command without safety warnings.

---

## 6. Actionable Recommendations for Implementation Phase

1. **Immediate Safety Guardrails (R1):**
   - Delete line 114 from `docs/DATABASE_MIGRATION.md`.
   - Update `docs/BEGINNER_DEPLOYMENT_GUIDE.md` to specify `wrangler d1 migrations apply DB --remote` only.
   - Create a secure CLI bootstrap script (e.g. `scripts/bootstrap_admin.ts` or `npm run db:admin:bootstrap`) that prompts for an admin email and password, derives a PBKDF2 hash, and inserts the administrator record directly via Wrangler local/remote execution or one-time invite token.
   - Add a check script (`scripts/verify_no_remote_seed.js`) ensuring `wrangler d1 execute.*--remote.*seed` never appears in the repository.
2. **Cryptographic Hardening (R2):**
   - Add single-use tracking for password reset tokens (e.g., store reset token hashes or nonces in D1 `password_resets` table or `CACHE_KV`, and delete/expire them upon successful reset).
   - Document the PBKDF2 100,000 iterations vs. 600,000 iterations benchmark and justify the Workers 10-50ms CPU limit tradeoff in `docs/SECURITY_REVIEW.md`.
3. **Free-Tier Limits Correction (R3):**
   - Correct `docs/FREE_TIER_COSTS_AND_LIMITS.md` from 10 GB to 500 MB per D1 database (5 GB total account).
   - Detail system behavior on quota breach (HTTP 429 for Workers requests, D1 quota exceeded errors).
4. **Authorization & Access Control Hardening (R4):**
   - Add `requireAuth` and ownership validation to `GET /vault/file/:key` (or restrict access to the file owner and administrators).
   - Wire `verifyTurnstile` into public forms (`/auth/register`, `/auth/forgot-password`, `/recruit/consent`, `/exhibitions/apply`).
   - Tighten CORS in `backend/src/index.ts` to reject unauthorized cross-origin requests when credentials are true.
5. **Test Suite Expansion & Real Route Testing (R5):**
   - Refactor `tests/admin.test.ts` and `tests/events_clubs.test.ts` to call real Hono routes using `app.request()` and the real in-memory SQLite D1 mock (`createMockD1()`).
   - Align `tests/telemetry_evidence.test.ts` with the actual production terminology from `backend/src/services/evidence.ts`.
   - Update `docs/FEATURE_PARITY_MATRIX.md` statuses to `verified`, `partial`, `blocked`, and `untested`.
6. **Documentation Updates (R6):**
   - Reclassify all security findings in `docs/SECURITY_REVIEW.md` into Critical, High, Medium, and Low.
   - Clarify non-destructive migration policies and disaster recovery procedures in `docs/DATABASE_MIGRATION.md`.
