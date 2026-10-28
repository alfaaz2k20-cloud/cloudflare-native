# Handoff Report — Codebase Architecture & Security Survey

**Date:** October 28, 2026  
**From:** Codebase Architecture Explorer (`explorer_survey_1`)  
**To:** Parent Orchestrator (`e0caba17-5a36-4219-a37c-98835d52c4b8`)  
**Working Directory:** `C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native\.agents\teamwork\explorer_survey_1`  
**Reference Document:** `ORIGINAL_REQUEST.md`  
**Detailed Survey Report:** `C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native\.agents\teamwork\explorer_survey_1\survey_codebase.md`  

---

## 1. Observation

### Build and Test Executions
1. `npm run build:backend` was executed from `C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native`:
   - Command: `tsc --noEmit`
   - Exit Code: `0`
   - Output: Clean compilation, 0 TypeScript errors.
2. `npm run build:frontend` was executed from `C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native`:
   - Command: `cd frontend && npm install && npm run build`
   - Exit Code: `0`
   - Output: Vite v5.4.21 transformed 49 modules and built 12 HTML entry points into `frontend/dist` in 2.32s.
3. `npm test` was executed from `C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native`:
   - Command: `vitest run`
   - Exit Code: `0`
   - Result: 7 test files passed, 65 tests passed, duration 5.06s.

### Direct Code Observations
1. **Remote Seeding Instruction in Documentation:**
   - File: `docs/DATABASE_MIGRATION.md` (lines 112-115)
   - Verbatim Text:
     ```markdown
     4. Seed initial master administrator:
        ```bash
        npx wrangler d1 execute DB --remote --file=database/seeds/0001_dev_seed.sql
        ```
     ```
2. **Missing Production Admin Bootstrap:**
   - Files: `package.json`, `docs/BEGINNER_DEPLOYMENT_GUIDE.md`
   - Lines 120-121 in `docs/BEGINNER_DEPLOYMENT_GUIDE.md`:
     ```bash
     npx wrangler d1 migrations apply DB --remote
     ```
   - No subsequent command or script exists to seed or bootstrap an administrator account in production without executing `0001_dev_seed.sql`.
3. **Free Tier D1 Quota Documentation Error:**
   - File: `docs/FREE_TIER_COSTS_AND_LIMITS.md` (line 17)
   - Verbatim Text:
     ```markdown
     | **Cloudflare D1 (Database)** | 5,000,000 read rows / day<br>100,000 write rows / day<br>10 GB total storage | ~20,000 reads / day<br>~1,500 writes / day<br>~25 MB total data |
     ```
   - Official Cloudflare D1 free-tier quota is **500 MB per database** (up to 5 GB total account-level storage), not 10 GB per DB.
4. **Unauthenticated R2 Object Retrieval:**
   - File: `backend/src/routes/vault.ts` (lines 85-103)
   - Verbatim Text:
     ```typescript
     // GET /vault/file/:key - Serve uploaded file from Cloudflare R2
     vaultRouter.get('/file/:key{.*}', async (c) => {
       const key = decodeURIComponent(c.req.param('key'));
       if (!c.env.VAULT_BUCKET) {
         return c.text('R2 storage bucket not configured in this environment.', 503);
       }

       const object = await c.env.VAULT_BUCKET.get(key);
       if (!object) {
         return c.text('File not found in storage vault.', 404);
       }

       const headers = new Headers();
       object.writeHttpMetadata(headers);
       headers.set('etag', object.httpEtag);
       headers.set('cache-control', 'public, max-age=86400');

       return new Response(object.body, { headers });
     });
     ```
   - No `requireAuth` middleware is present; any user or anonymous client can retrieve arbitrary uploaded objects (including private payment proof receipts and candidate portfolios) given the object key.
5. **Reusable / Non-Single-Use Password Reset Tokens:**
   - File: `backend/src/routes/auth.ts` (lines 118-148)
   - Verbatim Text:
     ```typescript
     authRouter.post('/reset-password', async (c) => {
       const body = await c.req.json().catch(() => ({}));
       const token = body.token;
       const newPassword = body.new_password;

       if (!token || !newPassword) {
         return c.json({ detail: 'Token and new password required' }, 400);
       }

       const secret = c.env.JWT_SECRET || 'dev-insecure-secret-key-must-be-changed-in-production-at-least-32-chars';
       try {
         const payload = await verifyToken(token, secret);
         if (!payload || payload.status !== 'reset') {
           return c.json({ detail: 'Invalid or expired reset link.' }, 400);
         }

         const hashedPassword = await hashPassword(newPassword);
         const res = await c.env.DB
           .prepare('UPDATE users SET password = ? WHERE email = ?')
           .bind(hashedPassword, payload.sub)
           .run();

         if (res.meta.changes === 0) {
           return c.json({ detail: 'Account not found.' }, 404);
         }

         return c.json({ message: 'Password reset successfully.' });
       } catch (err: any) {
         return c.json({ detail: 'Invalid or expired reset link.' }, 401);
       }
     });
     ```
   - Reset tokens have a 15-minute lifespan (`createToken(user.email, 'reset', secret, 900)`), but once used, they are not invalidated or blacklisted in D1 or KV. A compromised token can be replayed to reset the password repeatedly within the 15-minute window.
6. **Unwired Turnstile Bot Protection:**
   - File: `backend/src/middleware/rate_limit.ts` (line 45): `verifyTurnstile` is declared.
   - Project-wide search for `verifyTurnstile` across `backend/src` returned **only 1 result** (the declaration at `rate_limit.ts:45`).
   - Project-wide search for `turnstile` across `frontend/` returned **0 results**.
   - No public forms (`/auth/register`, `/auth/forgot-password`, `/recruit/consent`, `/exhibitions/apply`) call `verifyTurnstile`.
7. **Permissive CORS Reflecting Arbitrary Origins with Credentials:**
   - File: `backend/src/index.ts` (lines 20-27)
   - Verbatim Text:
     ```typescript
     app.use('*', cors({
       origin: (origin) => origin || '*',
       allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
       allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'cf-turnstile-response'],
       exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
       maxAge: 86400,
       credentials: true
     }));
     ```
8. **Mock-Only Test Suites & Terminology Inconsistencies:**
   - File: `tests/admin.test.ts` (lines 9-29) defines local functions `validateUserPurge` and `validateAdminDemotion`. None of the tests call `adminRouter` routes via `app.request()`.
   - File: `tests/events_clubs.test.ts` (lines 13-28) defines local function `attemptRegisterEvent` on in-memory objects; none of the tests execute D1 queries for event registration.
   - File: `tests/telemetry_evidence.test.ts` (lines 89-134) tests a local helper `computeRelationshipAndConfidence` returning `"CONCORDANT"`, `"SHIFT_ADJACENT"`, and `"DIVERGENT"`, which does not exist in `backend/src/services/evidence.ts` (which instead returns `"NOT_AVAILABLE"`, `"NOT_ENOUGH_EVIDENCE"`, `"ALIGNED"`, `"PARTLY_ALIGNED"`, and `"DIFFERENT"`).
9. **PBKDF2 Execution Benchmark:**
   - Tested using Web Crypto API in Node.js:
     - 100,000 iterations: **64.36 ms**
     - 210,000 iterations: **172.39 ms**
     - 600,000 iterations: **560.07 ms**
   - Cloudflare Workers Free Tier limits CPU time to **10 ms per request** (Standard Bundled Paid is 50 ms).

---

## 2. Logic Chain

1. **Production Seed Safety (R1):**
   - Observation 1.1 reveals that `docs/DATABASE_MIGRATION.md:114` instructs executing `0001_dev_seed.sql` against the remote database.
   - Observation 1.2 shows there is currently no alternative bootstrap procedure for creating an initial administrator.
   - Therefore, following the current manual deployment instructions directly compromises production security by seeding known development credentials (`curator2026!`). Removing line 114 and implementing an automated CLI bootstrap script is strictly required.

2. **Cryptographic Posture & CPU Limits (R2):**
   - Observation 1.9 proves that PBKDF2 at 600,000 iterations consumes ~560 ms of compute time.
   - Because Cloudflare Workers enforce a 10 ms CPU limit on the Free Plan and 50 ms on Standard Bundled, forcing 600,000 iterations will cause Workers to terminate with Error 1102 (CPU time limit exceeded).
   - Therefore, the 100,000 iteration setting (~64 ms) is a necessary operational compromise for edge serverless runtimes, but its deviation from OWASP recommendations must be formally justified in `docs/SECURITY_REVIEW.md`.
   - Observation 1.5 shows that password reset tokens lack single-use invalidation. Replay protection (via token hashing in DB or KV) must be implemented.

3. **Free-Tier Limits Accuracy (R3):**
   - Observation 1.3 shows `docs/FREE_TIER_COSTS_AND_LIMITS.md` claims D1 provides 10 GB of storage.
   - Cloudflare's official limits cap D1 Free Tier at 500 MB per database.
   - Therefore, this documentation must be corrected to prevent architectural assumptions based on 20x higher storage capacity.

4. **Access Control & Turnstile (R4):**
   - Observation 1.4 demonstrates that `GET /vault/file/:key` has no authentication check, allowing public access to confidential payment proofs and portfolios.
   - Observation 1.6 shows that Turnstile verification is completely dead code (never called).
   - Observation 1.7 shows that CORS dynamically reflects any requesting origin while enabling credentials.
   - Therefore, private R2 assets, public form bot protection, and cross-origin access control must be hardened before public launch.

5. **Test Suite Integrity & Feature Parity (R5):**
   - Observation 1.8 indicates that 2 of the 7 test files test mock functions instead of real routes, and another tests discordant labels.
   - While `tests/d1_routes.test.ts` provides excellent real integration testing with Node SQLite for 21 test cases, the admin portal, error paths, and cross-user authorization remain untested at route level.
   - Therefore, `docs/FEATURE_PARITY_MATRIX.md` (which currently lists 100% of routes as `Parity Implemented`) must be updated with realistic testing statuses (`verified`, `partial`, `untested`).

---

## 3. Caveats

1. **No Production Cloudflare Account Access:**
   - In accordance with safety guardrail 1, no remote deployment or live Cloudflare account interaction was attempted. All behavior was analyzed from local source code and execution.
2. **Web Crypto Offloading in Production Workers:**
   - The PBKDF2 benchmark was measured in Node.js 22 using the global Web Crypto API. On Cloudflare Workers V8 isolates, Web Crypto calls are handled by native BoringSSL. While native code execution is optimized, CPU metering rules still enforce the 10 ms / 50 ms limits.
3. **Untouched Original Application:**
   - As required by safety guardrail 2, `C:\Users\saqrt\OneDrive\Desktop\alliswell\alfaaz-project` was not inspected or modified.

---

## 4. Conclusion

The `cloudflare-native/` codebase represents a functionally rich and well-structured implementation with a strong foundation: type checks pass cleanly (`npm run build:backend`), the multi-page frontend builds without error (`npm run build:frontend`), and the existing integration test harness in `tests/d1_routes.test.ts` successfully leverages Node's `DatabaseSync` for real SQLite schema verification.

However, the implementation is **not currently deployment-ready** due to 5 critical issues:
1. **Critical:** Production database seeding instructions in `docs/DATABASE_MIGRATION.md:114` must be removed and replaced with a secure admin bootstrap script.
2. **High:** `GET /vault/file/:key` in `backend/src/routes/vault.ts` lacks authentication, exposing private uploaded documents.
3. **High:** Password reset tokens in `backend/src/routes/auth.ts` lack single-use invalidation.
4. **Medium:** Cloudflare Turnstile bot verification is dead code and needs wiring to public forms.
5. **Medium:** Test coverage in `admin.test.ts` and `events_clubs.test.ts` relies on in-file mock functions rather than executing actual Hono routes and D1 queries.

---

## 5. Verification Method

Any agent or reviewer can independently verify all observations and conclusions using the following reproducible commands:

1. **Verify Backend Build:**
   ```bash
   cd C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native
   npm run build:backend
   ```
   *Expected result:* Exit code 0, no output.

2. **Verify Frontend Build:**
   ```bash
   cd C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native
   npm run build:frontend
   ```
   *Expected result:* Exit code 0, 12 HTML pages and assets built into `frontend/dist`.

3. **Verify Existing Tests:**
   ```bash
   cd C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native
   npm test
   ```
   *Expected result:* 7 passed test files, 65 passed tests.

4. **Verify Remote Seed Instruction Occurrence:**
   ```powershell
   Select-String -Path "docs\DATABASE_MIGRATION.md" -Pattern "execute DB --remote --file=database/seeds"
   ```
   *Expected result:* Match on line 114.

5. **Verify Dead-Code Turnstile Status:**
   ```powershell
   Select-String -Path "backend\src\**\*.ts" -Pattern "verifyTurnstile"
   ```
   *Expected result:* Exactly 1 match (definition in `rate_limit.ts:45`).

6. **Verify Unauthenticated Vault Endpoint:**
   Inspect `backend/src/routes/vault.ts` lines 85-103 to confirm absence of `requireAuth`.

7. **Verify PBKDF2 Benchmark:**
   ```bash
   node -e "const c=globalThis.crypto;async function b(i){const s=c.getRandomValues(new Uint8Array(16));const k=await c.subtle.importKey('raw',new TextEncoder().encode('P'),{name:'PBKDF2'},false,['deriveBits']);const t0=performance.now();await c.subtle.deriveBits({name:'PBKDF2',salt:s,iterations:i,hash:'SHA-256'},k,256);console.log(i+' iters: '+(performance.now()-t0).toFixed(2)+'ms');}b(100000);b(600000);"
   ```
   *Expected result:* 100k ~60ms, 600k ~550ms.
