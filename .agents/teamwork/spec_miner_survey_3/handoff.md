# Handoff Report — Specification & Documentation Mining Survey

**Agent Folder:** `C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native\.agents\teamwork\spec_miner_survey_3`  
**Role:** Specification & Documentation Miner (Survey Pass 3)  
**Parent Orchestrator:** `e0caba17-5a36-4219-a37c-98835d52c4b8`  
**Date:** October 28, 2026  
**Type:** Hard Handoff (Survey Complete)  

---

## 1. Observation

1. **Test Execution & Toolchain Verification:**
   - Ran `npm test` (`vitest run`): 7 passed test files, 65 passed tests in 3.96s (`tests/events_clubs.test.ts`, `tests/telemetry_evidence.test.ts`, `tests/admin.test.ts`, `tests/sjt_scoring.test.ts`, `tests/integration.test.ts`, `tests/d1_routes.test.ts`, `tests/auth.test.ts`).
   - Ran `npm run build:backend` (`tsc --noEmit`): Exited 0 with zero type errors.
   - Ran `npm run build:frontend` (`vite build`): Exited 0; compiled 49 modules and 12 HTML pages (`index.html`, `login.html`, `register.html`, `reset.html`, `dashboard.html`, `exhibition.html`, `submit.html`, `blogs.html`, `post.html`, `recruit.html`, `research.html`, `admin.html`) in 4.03s.
2. **D1 Free Tier Storage Quota Discrepancy:**
   - In `docs/FREE_TIER_COSTS_AND_LIMITS.md`, line 17:
     `| **Cloudflare D1 (Database)** | 5,000,000 read rows / day<br>100,000 write rows / day<br>10 GB total storage | ~20,000 reads / day<br>~1,500 writes / day<br>~25 MB total data | **Reads: <0.5%**<br>**Writes: 1.5%**<br>**Storage: 0.25%** |`
   - Official Cloudflare D1 Free Tier documentation limits per-database storage to **500 MB per database** (5 GB total account storage across up to 10 DBs). 25 MB is **5.0%** of database capacity, not 0.25%.
   - `docs/FREE_TIER_COSTS_AND_LIMITS.md` omits system error modes when quotas are exceeded (HTTP 1015, HTTP 1027, Error 1102, SQLITE_FULL, D1_ERROR 7500).
3. **Remote Seed Command in Documentation:**
   - In `docs/DATABASE_MIGRATION.md`, line 114:
     ```bash
     npx wrangler d1 execute DB --remote --file=database/seeds/0001_dev_seed.sql
     ```
   - This violates Safety Rule 4 and Requirement R1.
4. **Missing Production Administrator Bootstrap:**
   - In `docs/BEGINNER_DEPLOYMENT_GUIDE.md`, Step 3.5 runs `wrangler d1 migrations apply DB --remote`, but provides no instructions for provisioning an initial administrator account. The production database is left with 0 users, locking administrators out.
5. **Database Schema Foreign Key & Concurrency Flaws:**
   - In `database/migrations/0001_initial_schema.sql`:
     - Line 137: `applicant_identities` table defines `session_id TEXT PRIMARY KEY`, but lacks `FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE`.
     - Line 363-377: `interview_bookings` defines `session_id TEXT NOT NULL UNIQUE` and `CREATE INDEX IF NOT EXISTS idx_bookings_slot ON interview_bookings(slot_date, slot_time);`. This index is NON-UNIQUE. `backend/src/routes/recruit.ts:407` checks collision in application code before inserting, but without a unique constraint, concurrent requests for the same slot both succeed, causing double bookings.
     - Table count: Exactly 25 application tables are defined (lines 10 to 385), not 28.
6. **PBKDF2 Password Hashing vs Workers CPU Limit:**
   - In `backend/src/auth/crypto.ts:56`, PBKDF2 iterations is set to 100,000.
   - Benchmark conducted on V8 isolate:
     - 100,000 iterations: ~104 ms (Node crypto) / ~150 ms (WebCrypto deriveBits).
     - 600,000 iterations (OWASP recommendation): ~976 ms - 1,044 ms.
   - Cloudflare Workers Free Tier CPU limit is 10 ms per request (Paid: 50 ms). Running 600,000 iterations would instantly abort with Error 1102 ("Worker exceeded CPU time limit").
7. **Password Reset Token Invalidation Defect:**
   - In `backend/src/routes/auth.ts:118-148`, `/auth/reset-password` verifies the JWT signature and expiration, but does not revoke the token. The token can be used repeatedly within its 15-minute validity window.
8. **Unauthenticated Private R2 Asset Access:**
   - In `backend/src/routes/vault.ts:86-103`, `GET /vault/file/:key` has no authentication middleware (`requireAuth` is absent). It serves uploaded files (including payment proofs with banking details) to any anonymous user with header `cache-control: public, max-age=86400`.
9. **Unwired Cloudflare Turnstile:**
   - In `backend/src/middleware/rate_limit.ts:45`, `verifyTurnstile` is exported, but grep confirms it is never imported or called anywhere in `backend/src/routes/*.ts`.
   - `docs/SECURITY_REVIEW.md:60` falsely claims Turnstile is integrated into `/auth/register`, `/auth/forgot-password`, and `/recruit/consent`.
10. **Missing Psychometric Disclaimer:**
    - `docs/FEATURE_PARITY_MATRIX.md` (Section 8) describes 14 behavioral minigames and SJT scoring, but omits the mandatory disclaimer stating tests verify software functional correctness, not psychological or psychometric validity.

---

## 2. Logic Chain

1. **D1 Quota Discrepancy (Obs 2):**  
   Because Cloudflare's official specification caps free-tier D1 databases at 500 MB each, stating "10 GB total storage" in `FREE_TIER_COSTS_AND_LIMITS.md` misleads operators by 20x. At 25 MB projected data, the actual consumption is 5.0% of a 500 MB database, not 0.25%. Furthermore, exceeding 500 MB triggers `SQLITE_FULL` / D1 storage quota errors on writes while allowing reads, which must be clearly documented.
2. **Production Seeding & Bootstrap Gap (Obs 3, Obs 4):**  
   `DATABASE_MIGRATION.md:114` explicitly instructs running dev seeds against remote databases. Dev seeds contain fixed testing passwords (`curator2026!`). Meanwhile, `BEGINNER_DEPLOYMENT_GUIDE.md` omits production admin creation. Therefore, an operator deploying to production either seeds dev credentials or gets locked out. A secure, non-seed CLI admin bootstrap must be documented, and the remote seed instruction removed.
3. **Database Schema Integrity Deficiencies (Obs 5):**  
   - In `applicant_identities`, the missing foreign key to `recruit_sessions(session_id) ON DELETE CASCADE` means deleting a recruitment session leaves applicant PII orphaned in the database.
   - In `interview_bookings`, the index `idx_bookings_slot` is non-unique. In an edge environment with distributed requests, two candidates booking the same `slot_date` and `slot_time` will experience a race condition where both inserts succeed. A `UNIQUE(slot_date, slot_time)` constraint is essential.
4. **Cryptographic Posture & Workers CPU Trade-off (Obs 6):**  
   OWASP recommends 600,000 iterations for PBKDF2-HMAC-SHA256. However, benchmarks show 600,000 iterations requires ~1,000 ms of CPU time. Because Cloudflare Workers Free Tier enforces a strict 10 ms CPU time limit, 600,000 iterations will fail with Error 1102. 100,000 iterations is a necessary compromise for edge isolates and must be documented with rationale.
5. **Private Data Exposure & Auth Gaps (Obs 7, Obs 8, Obs 9, Obs 10):**  
   - `/vault/file/:key` lacks authentication, allowing anyone to view payment proof screenshots and portfolios.
   - Reset tokens are reusable within 15 minutes because they lack single-use invalidation.
   - Turnstile verification was never wired into route handlers despite being claimed in documentation.
   - `FEATURE_PARITY_MATRIX.md` lacks the psychometric disclaimer required by Requirement R5.

---

## 3. Caveats

- **Test Framework Mocking:** Tests currently run against Node.js `node:sqlite` `DatabaseSync` in-memory rather than real Cloudflare remote D1 infrastructure (as mandated by Safety Rule 1: no remote deployment). While syntactically and relationally equivalent to SQLite, subtle D1 remote API error messages (like error code 7500) were verified against official Cloudflare D1 documentation rather than live remote probing.
- **Worker CPU Accounting:** While WebCrypto derives bits in background threads in some Node versions, in Cloudflare Workers isolates, excessive crypto iterations consume isolate CPU time and risk Error 1102.
- **Scope Limit:** As a read-only Specification Miner, no source code or documentation files outside `.agents/teamwork/spec_miner_survey_3/` were edited.

---

## 4. Conclusion

1. **Documentation Requires Immediate Correction:**
   - `docs/FREE_TIER_COSTS_AND_LIMITS.md` must be updated with the 500 MB per DB limit, corrected 5.0% utilization, and quota exhaustion error modes.
   - `docs/DATABASE_MIGRATION.md` must have line 114 (`d1 execute DB --remote ... seed`) removed, and non-destructive migration rules added.
   - `docs/BEGINNER_DEPLOYMENT_GUIDE.md` must document the secure production administrator bootstrap procedure.
   - `docs/FEATURE_PARITY_MATRIX.md` must include the psychometric validity disclaimer and have statuses downgraded to `partial` for flawed endpoints.
   - `docs/SECURITY_REVIEW.md` must accurately reflect the unwired Turnstile status, missing rate limits on auth routes, unauthenticated R2 access, and PBKDF2 CPU benchmark trade-offs.
2. **Implementation Flaws to Remediate in Later Passes:**
   - Add `ON DELETE CASCADE` foreign key from `applicant_identities` to `recruit_sessions`.
   - Add `UNIQUE(slot_date, slot_time)` constraint to `interview_bookings`.
   - Enforce authentication on `/vault/file/:key` or implement signed R2 access.
   - Wire `verifyTurnstile` into `/auth/register`, `/auth/forgot-password`, and `/recruit/consent`.
   - Implement single-use invalidation for password reset tokens.

---

## 5. Verification Method

1. **Verify Test Suite & Typecheck:**
   ```bash
   cd C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native
   npm test
   npm run build:backend
   npm run build:frontend
   ```
2. **Verify Remote Seed Instruction in Documentation:**
   ```bash
   git grep -n "d1 execute.*--remote.*seed" docs/
   # Output: docs/DATABASE_MIGRATION.md:114:   npx wrangler d1 execute DB --remote --file=database/seeds/0001_dev_seed.sql
   ```
3. **Verify Unauthenticated R2 Access:**
   Inspect `tests/d1_routes.test.ts:643-646` where `subRow.file_url` is fetched without an `Authorization` header and returns 200 OK.
4. **Verify PBKDF2 CPU Benchmark:**
   ```bash
   node -e "
     const crypto = require('node:crypto');
     const start = performance.now();
     crypto.pbkdf2Sync('pass', 'salt', 600000, 32, 'sha256');
     console.log('600k iters:', (performance.now() - start).toFixed(2), 'ms');
   "
   # Output confirms >950 ms, proving incompatibility with Cloudflare Worker 10ms CPU limit.
   ```
5. **Inspect Survey Report:**
   Read full audit details in `C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native\.agents\teamwork\spec_miner_survey_3\survey_specs.md`.
