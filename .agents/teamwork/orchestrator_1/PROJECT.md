# Project: Cloudflare-Native Security, Hardening and Deployment Readiness Pass

## Architecture
- **Runtime Target:** Cloudflare Workers (Edge V8 isolate runtime, Hono Web Framework)
- **Database:** Cloudflare D1 (Serverless SQLite, schema migrations in `database/migrations/`)
- **Object Storage:** Cloudflare R2 (`VAULT_BUCKET` for candidate portfolios, manuscripts, payment proofs)
- **Frontend:** Multi-page HTML application built with Vite (`frontend/src`, `frontend/dist`)
- **Authentication & Security:** PBKDF2 Web Crypto password hashing, JWT session/bearer tokens, Cloudflare Turnstile bot verification, sliding window in-memory rate limiting.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Production Seed Safety | Eliminate remote seed instructions and enforce migrations-only in production | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Production Admin Bootstrap | Provide safe CLI bootstrap utility for initial administrator without hardcoded passwords | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Static Remote Seed Guard | Automated test confirming zero occurrences of `d1 execute.*--remote.*seed` | M1 | ORIGINAL_REQUEST §R1, Acceptance Criteria |
| 4 | Safe Deployment Guides | Document safe production provisioning in beginner deployment guide | M1 | ORIGINAL_REQUEST §R1 |
| 5 | PBKDF2 Cryptographic Posture | Benchmark and document PBKDF2 iterations (100k vs 600k) against Cloudflare Workers 10-50ms CPU limits | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Single-Use Password Reset | Add token invalidation / single-use tracking to prevent replay attacks | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Insecure Default / Secret Guard | Forbid insecure fallback secret and hardcoded passwords in production | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Cloudflare D1 Storage Limits | Correct 10 GB claim to official 500 MB per DB (5 GB account total) and 5.0% utilization | M3 | ORIGINAL_REQUEST §R3 |
| 9 | Quota Error Handling Docs | Document error codes (HTTP 1015, HTTP 1027, Error 1102, SQLITE_FULL, D1 7500) | M3 | ORIGINAL_REQUEST §R3 |
| 10 | Transactional Email Limits | Document Workers Paid requirement or external webhook provider for email | M3 | ORIGINAL_REQUEST §R3 |
| 11 | Private Vault Access Control | Enforce authentication on `GET /vault/file/:key` to protect payment proofs & portfolios | M4 | ORIGINAL_REQUEST §R4 |
| 12 | Server-Side Turnstile Integration | Wire `verifyTurnstile` into public registration, reset, consent, and application forms | M4 | ORIGINAL_REQUEST §R4 |
| 13 | Secure CORS Configuration | Restrict dynamic origin reflection with credentials to prevent CSRF/unauthorized access | M4 | ORIGINAL_REQUEST §R4 |
| 14 | Candidate PII Protection | Protect `/recruit/interview-booking/:session_id` from anonymous PII leaks | M4 | ORIGINAL_REQUEST §R4 |
| 15 | Database Schema Foreign Keys | Add foreign key `applicant_identities(session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE` | M5 | ORIGINAL_REQUEST §R6 |
| 16 | Interview Booking Concurrency | Add `UNIQUE(slot_date, slot_time)` on `interview_bookings` to prevent double-booking race condition | M5 | ORIGINAL_REQUEST §R6 |
| 17 | Non-Destructive Migrations & DR | Document safe legacy migration and disaster recovery export (`wrangler d1 export`) | M5 | ORIGINAL_REQUEST §R6 |
| 18 | Feature Parity Matrix Audit | Update all 48 routes to verified/partial/blocked statuses in `FEATURE_PARITY_MATRIX.md` | M6 | ORIGINAL_REQUEST §R5 |
| 19 | Psychometric Integrity Disclaimer | Add Section 8 disclaimer: software functionality validation, not psychometric validity | M6 | ORIGINAL_REQUEST §R5 |
| 20 | Test Suite Real-Route Modernization | Replace mock-only tests in `admin.test.ts` and `events_clubs.test.ts` with real Hono/D1 routes | M6 | ORIGINAL_REQUEST §R5 |
| 21 | Error Path Test Coverage | Test invalid resets, duplicate registrations, slot collisions, invalid SJT inputs | M6 | ORIGINAL_REQUEST §R5 |
| 22 | Security Review Document Update | Comprehensive classification of findings (Critical, High, Medium, Low) in `SECURITY_REVIEW.md` | M6 | Acceptance Criteria |
| 23 | E2E Final Verification & Audit Gate | Verify `npm test`, `build:backend`, `build:frontend`, Challenger stress testing & Forensic Audit | M7 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Production Seed Safety & Admin Bootstrap | R1: Remove remote seed instructions, implement `scripts/bootstrap-admin.js`, add static guard test | none | DONE |
| M2 | Security, Cryptography & Access Control Hardening | R2 & R4: PBKDF2 limits doc, single-use reset tokens, secret guard, authenticated R2 vault, Turnstile wiring, CORS fix | none | DONE |
| M3 | Free-Tier Limits & Quota Documentation | R3: Correct D1 500 MB limit, error modes/codes docs, transactional email constraints | none | DONE |
| M4 | Database Schema Integrity & Migration | R6: Missing FK on `applicant_identities`, UNIQUE index on `interview_bookings`, non-destructive migrations & DR plan | none | DONE |
| M5 | Feature Parity, Test Modernization & Disclaimer | R5: Replace mock tests with real Hono/D1 tests, test error paths, update matrix & psychometric disclaimer | M1, M2, M4 | DONE |
| M6 | Dual-Track Final Acceptance Verification & Audit Gate | Acceptance Criteria: 100% test pass, builds clean, static checks, Challenger stress test & Forensic Audit veto check | M1-M5 | DONE |

## Code Layout
- `backend/src/index.ts`: Application entry point, CORS, routing
- `backend/src/auth/crypto.ts`: PBKDF2 hashing, salt generation, token signing
- `backend/src/routes/auth.ts`: Registration, login, password reset endpoints
- `backend/src/routes/admin.ts`: Administrator endpoints, user purge, role updates
- `backend/src/routes/vault.ts`: R2 object storage upload and retrieval
- `backend/src/routes/recruit.ts`: Recruitment, SJT evaluation, interview bookings
- `backend/src/routes/exhibitions.ts`: Art exhibitions and submissions
- `backend/src/routes/events.ts`: Community events, registrations
- `backend/src/routes/clubs.ts`: Student clubs, memberships
- `backend/src/middleware/auth.ts`: `requireAuth`, `requireAdmin`, session extraction
- `backend/src/middleware/rate_limit.ts`: Rate limiting and Turnstile verification
- `database/migrations/`: D1 SQL migrations
- `database/seeds/0001_dev_seed.sql`: Local development seed only
- `scripts/`: Production maintenance and bootstrap scripts
- `docs/`: Deployment, architecture, security, and quota documentation
- `tests/`: Automated Vitest test suites
