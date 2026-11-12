# Project: Alfaaz Collective — Cloudflare-Native Platform

## Architecture Overview
Alfaaz Collective is a production-grade, Cloudflare-native platform engineered for high-performance edge execution, sovereign security, and curatorial aesthetic integrity. The application executes inside Cloudflare Workers V8 isolates using the Hono framework (v4.6.14), Cloudflare D1 (SQLite), Cloudflare R2 (`alfaaz-vault`), Cloudflare Workers KV (`CACHE_KV`), and a multi-page Vite frontend styled with brutalist luxury curatorial tokens (warm paper ivory `#f4f1ea`, deep charcoal ink `#2d312e`, antique gold `#bd6f5d`, and Kashmiri/Urdu typography).

### Data & Authentication Architecture
1. **Frontend Authentication (`frontend/login.html`, `frontend/register.html`)**:
   - Equal-sized 50%/50% segmented button toggle switching between `[ Log In ]` and `[ Register ]`.
   - Google Identity Services (GIS) One-Tap and Google Sign-In button rendering via Web Crypto RS256 token transmission.
   - Traditional sovereign Email & Password inputs backed by PBKDF2 password hashing.
   - Cloudflare Turnstile bot verification challenge on sensitive registration and authentication pathways.
   - Unconfigured third-party providers (Apple ID, Meta) visibly gated with `"Coming Soon"` badges and tooltips.
2. **Backend Gateway & Token Issuance (`backend/src/routes/auth.ts`, `backend/src/auth/federated.ts`, `backend/src/auth/crypto.ts`)**:
   - `POST /auth/federated-login`: Cryptographically verifies Google GIS RS256 ID tokens against Google's public JWKs (`https://www.googleapis.com/oauth2/v3/certs`), validates audience (`aud === GOOGLE_CLIENT_ID`), enforces verified email (`email_verified === true`), maps or upserts user in Cloudflare D1 `users` table, and issues a 7-day sovereign HMAC-SHA256 session JWT.
   - `POST /auth/login` & `POST /auth/register`: Authenticates or creates users using PBKDF2 with SHA-256 (100,000 iterations, 16-byte random salt, constant-time bitwise XOR verification).
   - `POST /auth/forgot-password` & `POST /auth/reset-password`: Single-use 15-minute reset tokens protected by replay ledger in D1 table `consumed_tokens`.
3. **Database Layer (`database/migrations/0001_initial_schema.sql` to `0007_youth_safeguarding_and_recent_works.sql`)**:
   - Cloudflare D1 SQLite relational engine running 28 tables with foreign keys and atomic conditional queries.
   - Non-destructive 12-step table rebuild migration procedure (Rule 6 in `AGENTS.md`).
   - Sovereign credential storage, contact verification replay ledgers, youth safeguarding verification statuses, and rate limiting. (SMS/OTP velocity logging decommissioned on 2026-11-03 per `AGENTS.md §3`).
4. **Domain-Isolated Recruitment & Psychometric Research (Rule 8 in `AGENTS.md`)**:
   - Specialized candidate assessment portal (`frontend/recruit.html`, `src/recruit.js`, 14 minigames) and recruiter analytics dashboard (`frontend/research.html`, `src/research.js`).
   - Protected mathematical invariants: precision ratio $TP/(TP+FP)$ and 14-order Latin Square counterbalanced minigame allocation (`LATIN_SQUARE_14`).

---

## Current Scope: System Audit, Pruning, and Site Hardening
The current development scope covers a comprehensive repository-wide audit, documentation of all architectural components and dependencies, safe pruning of obsolete scratch files and logs, and defensive hardening against runtime failures.

### Milestones

| # | Name | Scope & Responsibilities | Status |
|---|---|---|---|
| **M1** | **Comprehensive System Audit & Dependency Documentation** | Author authoritative `SYSTEM_AUDIT.md` in root cataloging all 5 pillars (Backend [84 endpoints], Frontend [13 entry points], Database [28 tables], Infrastructure, Third-Party CDNs) with architectural rationale, trade-offs, and Rule 1 secret redactions. Update `PROJECT.md` to reflect current scope. | **COMPLETED** |
| **M2** | **Pruning Unwanted Files & Isolated Dead Code** | Prune obsolete audit files (`docs/audits/*.md`), remove `docs/audits/` directory, prune `TEST_READY.md`, clean empty folders (`frontend/src/content/`, `backend/src/database/`, `backend/tests/`). Strictly preserve all 11 core documentation files, Rule 8 domain files (23+ files), build-time dependencies (`frontend/tchandervar/images/`), and test-linked scripts (`bootstrap-admin.js`, `sms.ts`). | **COMPLETED** |
| **M3** | **Site Hardening & Error Resilience** | Implement branded curatorial `frontend/404.html` (matching design tokens and registered in Vite/PWA precache); restore automated test coverage via `@vitest/coverage-v8`; add offline status and submission guards in `global.js`; bind Turnstile error recovery in `login.js`; wrap D1 rate limiting queries in safe fail-closed try/catch. | **IN_PROGRESS** |
| **M4** | **Final Milestone: Verification & Adversarial Audit** | Run full verification across test suites (`npm test`, `npm run typecheck`, `npm run test:hardening`, `npm run build`), conduct adversarial gap analysis, and obtain forensic audit clearance. | **PLANNED** |

---

## Feature Inventory

| # | Feature | Description | Scope |
|---|---|---|---|
| 1 | Sovereign Cloudflare Workers Runtime | Edge execution via Hono v4.6.14 with dual-mount routing (`/*` and `/api/*`) and custom domain canonicalization | Core Platform |
| 2 | Curatorial Multi-Page Vite Frontend | 13 HTML entry points bundled with Vite 5, Tailwind CSS utilities, and Lucide icons | Frontend |
| 3 | Brutalist Editorial Design Tokens | Warm paper ivory (`#f4f1ea`), deep ink (`#2d312e`), antique gold (`#bd6f5d`), and Kashmiri/Urdu typography | Design System |
| 4 | Dual Segmented Auth Toggle | Equal-sized 50%/50% segmented button toggle on auth card switching mode between [ Log In ] and [ Register ] | Authentication |
| 5 | Google Identity Services (GIS) One-Tap | Zero-dependency Web Crypto RS256 Google ID token verification against Google public JWKs | Authentication |
| 6 | Sovereign PBKDF2 Password Hashing | PBKDF2 SHA-256 with 100,000 iterations, 16-byte random salt, and constant-time XOR verification | Authentication |
| 7 | Sovereign Session JWT Issuance | HMAC-SHA256 session JWTs with 7-day validity and strict algorithm verification | Authentication |
| 8 | Cloudflare Turnstile Bot Verification | Strict bot protection with fail-closed security in production (`ENV === 'production'`) | Security |
| 9 | Contact Cross-Verification | Email and phone number cross-verification with 6-digit OTPs and rate limiting | Member Portal |
| 10 | Community Events & RSVP Engine | Event scheduling, capacity enforcement, and atomic double-registration prevention | Events |
| 11 | Collective Circles (Clubs) | Application and review workflows across 5 creative circles with uniqueness constraints | Community |
| 12 | Curatorial Exhibition Cycles | Exhibition submission, 18+ age criteria toggles, portfolio curation, and fee verification | Exhibitions |
| 13 | Creative Vault & Private R2 Storage | Private object storage in `alfaaz-vault` with ownership checks and anti-XSS attachment disposition | Storage |
| 14 | Curated Journal & Autonomous Essays | Scholarly essays, weekly Cloudflare Cron writer (`0 10 * * SUN`), and AI model integrations | Journal |
| 15 | Administrative Management Console | RBAC console for events, clubs, exhibitions, user directory, and audit logs | Administration |
| 16 | Domain-Isolated Recruitment (Rule 8) | Candidate intake, affirmative consent, 14 behavioral minigames, and interview scheduling | Recruitment |
| 17 | Psychometric Research Analytics | 7-construct non-normative radar charts and telemetry evidence synthesis | Research |
| 18 | D1 Relational Engine & 12-Step Rebuilds | Cloudflare D1 SQLite layer with 28 tables and non-destructive rebuild migrations | Database |
| 19 | Absolute Secret Redaction (Rule 1) | Strict redaction of secrets in all logs and documentation (`<redacted — rotated YYYY-MM-DD>`) | Security |
| 20 | System Audit & Architecture Catalog | Authoritative documentation in `SYSTEM_AUDIT.md` cataloging backend, frontend, D1, R2, and CDNs | System Audit |

---

## Interface Contracts

### 1. Google Identity Services (GIS) Federated Login (`POST /auth/federated-login`)
- **Request Body**:
  ```json
  {
    "id_token": "<google_gis_credential_jwt>",
    "provider": "google.com",
    "turnstile_token": "<optional_token>"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "token": "<alfaaz_sovereign_session_jwt>",
    "user": {
      "email": "scholar@example.com",
      "full_name": "Lalla Ded",
      "phone": "+919876543210",
      "status": "PARTICIPANT",
      "auth_provider": "google.com"
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: `{ "error": "Invalid or expired federated token." }`
  - `403 Forbidden`: `{ "error": "Turnstile verification failed" }`

### 2. Candidate Interview Slot Reservation (`POST /recruit/schedule-interview`)
- **Request Body**:
  ```json
  {
    "session_id": "sess_candidate_123",
    "candidate_name": "Habba Khatoon",
    "candidate_email": "habba@alfaaz.local",
    "slot_date": "2026-11-25",
    "slot_time": "11:00 AM"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "booking": {
      "slot_date": "2026-11-25",
      "slot_time": "11:00 AM"
    }
  }
  ```
- **Error Response (`409 Conflict`)**:
  ```json
  {
    "error": "This interview slot has just been reserved by another candidate. Please select another slot."
  }
  ```

---

## Code Layout

- `backend/src/`:
  - `index.ts`: Application entry point, CSP & security headers, CORS, host canonicalization, router mounting, cron triggers, and global error handling.
  - `types.ts`: TypeScript environment bindings (`Env`), JWT payload definitions, and context variables.
  - `routes/`: Dual-mounted route controllers (`auth.ts`, `events.ts`, `clubs.ts`, `exhibitions.ts`, `vault.ts`, `blogs.ts`, `curator.ts`, `admin.ts`, `recruit.ts`, `research.ts`, `notices.ts`, `verification.ts`).
  - `auth/crypto.ts`: Sovereign PBKDF2 password hashing and HMAC-SHA256 JWT issuance/verification.
  - `auth/federated.ts`: Web Crypto RS256 token verifier for Google Identity Services (GIS).
  - `middleware/rate_limit.ts`: In-memory sliding window rate limiter and Cloudflare Turnstile verifier.
  - `services/`: Autonomous curator AI, telemetry event validator, feature extraction, SJT scoring engine, and Latin Square allocator.
  - `notifications/`: Tri-modal email provider (Dev, Webhook, Cloudflare).
- `database/migrations/`:
  - `0001_initial_schema.sql`: 20 baseline tables.
  - `0002_federated_auth.sql`: Nullable password rebuild, phone, auth_provider, firebase_uid, otp_velocity_logs.
  - `0003_contact_verification.sql`: Contact verification flags, timestamps, and verification_codes table.
  - `0004_exhibition_age_toggle.sql`: Exhibition 18+ requirement toggle.
  - `0005_drop_otp_velocity.sql`: Drops decommissioned otp_velocity_logs and its indexes.
  - `0006_exhibitions_list.sql`: Multi-cycle exhibition list management table.
  - `0007_youth_safeguarding_and_recent_works.sql`: Youth safeguarding intake (guardian contact/consent, youth assent, verification status), recent works upload URLs, and cycle-level allow_recent_works_youth.
- `frontend/`:
  - `index.html`, `login.html`, `register.html`, `reset.html`, `dashboard.html`, `admin.html`, `blogs.html`, `post.html`, `exhibition.html`, `submit.html`, `recruit.html`, `research.html`, `tchandervar/index.html`, `404.html`.
  - `global.css`: Brutalist curatorial design tokens, typography, step indicators, guardian boxes, and khadi paper noise filter.
  - `global.js`: Global API fetch wrapper, Turnstile/GIS initialization, and PWA service worker registration.
  - `src/`: Client scripts (`login.js`, `dashboard.js`, `admin.js`, `blogs.js`, `post.js`, `exhibition.js`, `submit.js`, `reset.js`, `i18n.js`, `recruit.js`, `research.js`, and `recruit_games/**`).
  - `public/`: Service worker (`sw.js`), web manifest, offline page (`offline.html`), icons, `robots.txt`, and `sitemap.xml`.
  - `vite.config.js`: Rollup multi-page input bundle definition.
- `tests/`:
  - 19 Vitest test suites executing 266 automated tests (`auth.test.ts`, `d1_routes.test.ts`, `e2e_federated_auth.test.ts`, `error_paths.test.ts`, `concurrency_adversarial.test.ts`, `admin.test.ts`, `verification_roster.test.ts`, `velocity_turnstile.test.ts`, `events_clubs.test.ts`, `integration.test.ts`, `security_seed.test.ts`, `telemetry_evidence.test.ts`, `sjt_scoring.test.ts`, `exhibitions_multicycle_safeguarding.test.ts`, `session_revocation.test.ts`, `static_asset_headers.test.ts`, `cors_allowlist.test.ts`, `curator_prompt_roles.test.ts`, `sprint3_remediations.test.ts`).
  - `helpers/d1_mock.ts`: In-memory SQLite (`node:sqlite` DatabaseSync) test harness.
- `scripts/`:
  - `bootstrap-admin.js`: CLI script for administrative credential initialization.
  - `verify_challenger_2.mjs`: Hardening harness validating 6 database constraints and 16,384 SJT combinatorial profiles.
