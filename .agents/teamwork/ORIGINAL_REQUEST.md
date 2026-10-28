# Original User Request

## 2026-10-28T11:01:16Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

Perform a Cloudflare-native application security and deployment readiness audit and correction pass on the existing `cloudflare-native/` implementation. This is a rigorous hardening, correction, and verification pass, not a rebuild.

Working directory: `C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native`
Integrity mode: development

---

## Strict Safety Guardrails
1. Do not deploy anything to remote infrastructure or access live production resources.
2. Do not modify the original application in `alfaaz-project/`.
3. Do not execute remote database commands (`--remote`).
4. Never execute development seed files (`database/seeds/0001_dev_seed.sql`) against any remote database.
5. Preserve all existing work; inspect Git status prior to edits.
6. Never print, log, or commit secret credentials or real applicant data.
7. Verify all claims against actual executable code and test results.

---

## Requirements

### R1. Production Seed Safety & Admin Bootstrap
- Audit all documentation (`docs/`), scripts (`package.json`, `scripts/`), and deployment manuals for any instructions executing seeds against remote databases.
- Remove all instructions that apply development seeds to production. Ensure production provisioning explicitly runs schema migrations only (`wrangler d1 migrations apply DB --remote`).
- Implement and document a secure production administrator bootstrap procedure that does not use hardcoded passwords (e.g., CLI-based one-time initialization script or token invitation).
- Add static validation guards or automated checks that block accidental seeding against remote databases.

### R2. Password Security & Cryptographic Posture
- Inspect PBKDF2 key derivation, iterations, salt length, and hash storage format in `backend/src/auth/crypto.ts` against current OWASP Password Storage recommendations (e.g. 600,000 iterations for PBKDF2-HMAC-SHA256, or evaluate against Cloudflare Workers 10-50ms CPU limits).
- Verify password verification, password reset tokens (15-min expiry, single-use, signature validation), and session token validation.
- Ensure development passwords (`AlfaazAdmin2026!`) can never become production defaults.

### R3. Free-Tier Accuracy & Limits Reconciliation
- Verify all Cloudflare free tier service limits against official Cloudflare documentation (D1 database storage is 500 MB per database / 5 GB total account storage, not 10 GB per DB; 5M row reads/day, 100k row writes/day; R2 10 GB/month; Workers 100k requests/day; Turnstile free).
- Document system behavior and error modes when quotas are exceeded (e.g., D1 quota exceeded errors, 429 status codes).
- Explicitly document that arbitrary-recipient transactional emails require Workers Paid ($5/mo) or an external free-tier webhook provider (Make.com, Brevo, Resend).

### R4. Authorization, Access Control & Private Data Protection
- Trace every admin-only route (`/admin/*`, `/recruit/research/*`, `/exhibitions/review`, etc.) and verify strict server-side role enforcement (`requireAdmin`).
- Test cross-user authorization (e.g., users viewing or modifying other users' club, event, or exhibition applications).
- Ensure private R2 files (payment proofs, candidate portfolios) cannot be accessed without valid session authentication.
- Validate server-side Turnstile verification logic on public registration and application forms.
- Review edge rate limiting and logging statements to prevent leakage of credentials, tokens, or PII.

### R5. Feature Parity, Test Quality & Psychometric Integrity
- Audit `docs/FEATURE_PARITY_MATRIX.md` against actual Hono routes, D1 queries, and frontend controllers. Update status flags to `verified`, `partial`, `blocked`, or `untested`.
- Ensure tests run actual Hono routes and SQL queries (avoid mock-only test suites).
- Test error paths: invalid password resets, duplicate event registrations, conflicting interview bookings, AI provider failures, and invalid SJT inputs.
- Clearly document that recruitment assessment tests verify software functional correctness, not psychological or psychometric validity.

### R6. Database Schema Integrity & Safe Migration Procedure
- Audit all 28 tables in `database/migrations/0001_initial_schema.sql` for foreign keys, cascade rules, unique indexes, and SQLite compatibility.
- Ensure migrations are strictly non-destructive and repeatable.
- Document a safe data migration plan from legacy systems and a disaster recovery / backup procedure (`wrangler d1 export`).

---

## Acceptance Criteria

### Automated Verification & Integrity Checks
- [ ] Automated tests pass 100% via `npm test` across all test suites without unhandled exceptions or syntax errors.
- [ ] Type check passes cleanly via `npm run build:backend` (`tsc --noEmit`).
- [ ] Frontend builds successfully via `npm run build:frontend` (`vite build`).
- [ ] Static safety check confirms zero occurrences of `d1 execute.*--remote.*seed` across all documentation and scripts.
- [ ] OWASP password security assessment documented with verified worker CPU benchmarks.

### Documentation Updates
- [ ] `docs/SECURITY_REVIEW.md` updated with findings classified as Critical, High, Medium, or Low.
- [ ] `docs/FREE_TIER_COSTS_AND_LIMITS.md` updated with verified official Cloudflare limits (corrected D1 500 MB limit).
- [ ] `docs/DATABASE_MIGRATION.md` updated with non-destructive migration rules and recovery instructions.
- [ ] `docs/BEGINNER_DEPLOYMENT_GUIDE.md` updated with safe production provisioning and admin bootstrap steps.
- [ ] `docs/FEATURE_PARITY_MATRIX.md` updated with accurate verified/partial/blocked statuses.
- [ ] Final handover report detailing executed test commands, verification results, and remaining production prerequisites.
