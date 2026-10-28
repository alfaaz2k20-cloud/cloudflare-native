# Hard Handoff Report: Security & Authentication Survey Pass

**Sender:** Security & Auth Explorer (`explorer_survey_2`)  
**Recipient:** Teamwork Orchestrator (`orchestrator_1` / `e0caba17-5a36-4219-a37c-98835d52c4b8`)  
**Date:** 2026-10-28T11:45:00Z  
**Type:** Hard Handoff (Investigation & Survey Complete)  
**Detailed Survey Artifact:** `C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native\.agents\teamwork\explorer_survey_2\survey_security.md`  

---

## 1. Observation

Direct observations and evidence gathered from the codebase:

1. **Remote Seed Command in Migration Manual:**
   - Location: `docs/DATABASE_MIGRATION.md:112-115`
   - Verbatim Content:
     ```markdown
     4. Seed initial master administrator:
        ```bash
        npx wrangler d1 execute DB --remote --file=database/seeds/0001_dev_seed.sql
        ```
     ```
   - Confirmed via `grep_search`: Exactly one instance of `d1 execute.*--remote.*seed` exists across all project files.

2. **Absence of Production Admin Bootstrap Procedure:**
   - Location: `docs/BEGINNER_DEPLOYMENT_GUIDE.md:118-122`
   - Step 3.5 applies migrations (`npx wrangler d1 migrations apply DB --remote`), then jumps immediately to Step 3.6 (Configure Secrets) and Step 3.7 (Deploy).
   - In `backend/src/routes/auth.ts:41`: `/register` hardcodes `status = 'PARTICIPANT'`.
   - In `backend/src/routes/admin.ts:471`: `/update_status` requires an existing `ADMIN` JWT.
   - Result: Without executing `0001_dev_seed.sql`, a freshly provisioned production database has 0 administrator records and no mechanism to create one.

3. **PBKDF2 Iterations and Benchmark Timing:**
   - Location: `backend/src/auth/crypto.ts:56,100`
   - Iterations: `100000`, PRF: `SHA-256`, Salt: 16 random bytes via `crypto.getRandomValues()`.
   - Hash format: `pbkdf2:sha256:100000:<salt_hex>:<hash_hex>`.
   - Local benchmark via `npm test` (`tests/auth.test.ts`):
     - `Auth & Cryptography Subsystem > PBKDF2 Password Hashing > generates unique salts across multiple hashes of identical password 452ms` (~226ms per hash).
     - OWASP Password Storage recommendation: 600,000 iterations for PBKDF2-HMAC-SHA256 (6x compute time).
     - Cloudflare Workers Free Tier CPU quota: strict 10ms CPU time limit per request (Workers Paid standard: 50ms).

4. **Stateless Replayable Password Reset Tokens:**
   - Location: `backend/src/routes/auth.ts:99,118-148`
   - Reset token generated as 15-minute JWT (`createToken(user.email, 'reset', secret, 900)`).
   - `POST /auth/reset-password` validates signature and expiration, then executes:
     ```typescript
     await c.env.DB
       .prepare('UPDATE users SET password = ? WHERE email = ?')
       .bind(hashedPassword, payload.sub)
       .run();
     ```
   - The token is never invalidated, blacklisted, or recorded as consumed. The same token can be submitted repeatedly within 15 minutes.

5. **Insecure Fallback JWT Secret:**
   - Locations: `backend/src/routes/auth.ts:44,76,98,127` and `backend/src/middleware/auth.ts:12,33`
   - Verbatim:
     `const secret = c.env.JWT_SECRET || 'dev-insecure-secret-key-must-be-changed-in-production-at-least-32-chars';`
   - If `JWT_SECRET` is unset, the system silently uses a public known fallback string.

6. **Unauthenticated R2 Vault File Serving:**
   - Location: `backend/src/routes/vault.ts:86-103`
   - Verbatim:
     ```typescript
     vaultRouter.get('/file/:key{.*}', async (c) => {
       const key = decodeURIComponent(c.req.param('key'));
       // ...
       const object = await c.env.VAULT_BUCKET.get(key);
       // ...
       headers.set('cache-control', 'public, max-age=86400');
       return new Response(object.body, { headers });
     });
     ```
   - The endpoint lacks `requireAuth` or `requireAdmin`. Any uploaded manuscript, portfolio, or payment screenshot can be downloaded publicly without credentials.

7. **Zero Invocations of Server-Side Turnstile Verification:**
   - Location: `backend/src/middleware/rate_limit.ts:45-76` defines `verifyTurnstile(...)`.
   - `grep_search` across `backend/src/` confirms `verifyTurnstile` is never imported or called in `auth.ts`, `recruit.ts`, or any other route file.
   - Lines 51-53 of `rate_limit.ts` fail open if `secretKey` is undefined.

8. **Overly Permissive Dynamic Origin Reflection with Credentials:**
   - Location: `backend/src/index.ts:20-27`
   - Verbatim:
     ```typescript
     app.use('*', cors({
       origin: (origin) => origin || '*',
       // ...
       credentials: true
     }));
     ```
   - Reflects arbitrary `Origin` headers with `credentials: true`.

9. **Candidate PII Exposure Endpoint:**
   - Location: `backend/src/routes/recruit.ts:460-474`
   - Endpoint `GET /recruit/interview-booking/:session_id` returns `candidate_name`, `candidate_email`, `candidate_phone`, and `notes` with zero authentication.

---

## 2. Logic Chain

1. **R1 Logic Chain:**
   - Observation 1 proves `docs/DATABASE_MIGRATION.md` instructs users to apply dev seeds remotely.
   - Observation 2 proves there is no alternative bootstrap mechanism in the codebase.
   - Therefore, simply removing the remote seed command without introducing an admin bootstrap script would leave production deployments broken.
   - Thus, Milestone M1 must simultaneously: (a) eliminate the remote seed line in `DATABASE_MIGRATION.md`, (b) provide a standalone CLI bootstrap tool (`scripts/bootstrap-admin.js`) that safely inserts the initial admin using PBKDF2 Web Crypto, and (c) add a static validation test preventing future regressions.

2. **R2 Logic Chain:**
   - Observation 3 proves PBKDF2 key derivation takes ~200ms per invocation on V8.
   - Cloudflare Workers Free Tier enforces a 10ms CPU limit.
   - Increasing iterations to OWASP's 600,000 would cause Workers Free tier to abort with CPU limit exceeded errors.
   - Therefore, retaining 100,000 iterations is technically necessary, but the architectural rationale must be formally documented in `docs/SECURITY_REVIEW.md`.
   - Observation 4 proves password reset tokens can be replayed.
   - Adding a `password_reset_at` column or KV revocation mechanism will guarantee single-use semantics.
   - Observation 5 proves fallback secrets permit token forgery in production if `JWT_SECRET` is omitted.
   - Throwing a configuration error in production when `JWT_SECRET` is absent eliminates this vulnerability.

3. **R4 Logic Chain:**
   - Observation 6 proves all files in `VAULT_BUCKET` are served to anyone without authentication.
   - Creative portfolios and payment proof screenshots contain sensitive personal and financial data.
   - Serving them with `cache-control: public` compounds the risk by exposing them to intermediary proxy caches.
   - Restricting `/vault/file/:key` to authenticated administrators or matching owners resolves the vulnerability.
   - Observation 7 proves that despite documentation claims, Turnstile bot defense is non-existent in route handlers.
   - Integrating `verifyTurnstile` into `/auth/register`, `/auth/forgot-password`, and `/recruit/consent` closes this gap.
   - Observation 8 proves open CORS reflection exposes session credentials to cross-site request forgery or unauthorized cross-origin reading.
   - Whitelisting valid frontend origins resolves this risk.

---

## 3. Caveats

- **Cloudflare Workers WebCrypto Offloading:** WebCrypto `deriveBits` is processed in C++ BoringSSL. While V8 wall-clock benchmarks in Node take ~200ms for 100k iterations, actual worker CPU time measured by Cloudflare's runtime isolate scheduler depends on how asynchronous WebCrypto calls are billed against the 10ms CPU limit. Live remote testing on Cloudflare infrastructure was strictly prohibited by Safety Guardrail #1.
- **In-Memory Rate Limiting:** The sliding window rate limiter stores hit counters in isolate memory. Because Cloudflare Workers run across multiple edge data centers and isolates, rate limits are enforced per-isolate rather than globally across the edge network. Global rate limiting in production requires Cloudflare WAF Rate Limiting rules or Workers KV/Durable Objects.
- **No other caveats.**

---

## 4. Conclusion

The application exhibits strong baseline architecture (parameterized queries, zero SQL injection vectors, modular routing, clean separation of concerns), but contains four critical/high security gaps that must be corrected before production deployment:
1. **Remote Seed Danger & Missing Admin Bootstrap (R1):** Must remove `docs/DATABASE_MIGRATION.md:114` and implement `scripts/bootstrap-admin.js`.
2. **Replayable Password Reset Tokens & Insecure Fallback Secrets (R2):** Must implement single-use reset tracking and require explicit `JWT_SECRET` in production.
3. **Public Exposure of Private Vault/Payment Proofs (R4):** Must enforce authentication and ownership checks on `/vault/file/:key`.
4. **Inactive Turnstile Verification & Permissive CORS (R4):** Must wire `verifyTurnstile` into public forms and restrict CORS origin reflection.

---

## 5. Verification Method

To independently verify all claims made in this report:

1. **Verify Static Remote Seed Occurrence:**
   ```bash
   grep -rn "d1 execute.*--remote.*seed" docs/ scripts/ package.json
   ```
   *Expected Output:* Matches line 114 of `docs/DATABASE_MIGRATION.md`.

2. **Verify Reset Token Replayability:**
   Inspect `backend/src/routes/auth.ts:118-148`. Confirm that no D1 update or KV call records the token as consumed.

3. **Verify Vault Public File Serving:**
   Inspect `backend/src/routes/vault.ts:86-103`. Confirm no `requireAuth` middleware is present on `GET /vault/file/:key{.*}`.
   Verify with existing integration test in `tests/d1_routes.test.ts:643-646` where `app.request(subRow.file_url)` succeeds with status 200 without Authorization headers.

4. **Verify Turnstile Absence in Routes:**
   ```bash
   grep -rn "verifyTurnstile" backend/src/
   ```
   *Expected Output:* Exactly one match in `backend/src/middleware/rate_limit.ts:45` (declaration only). Zero matches in `backend/src/routes/`.

5. **Run Existing Test Suite:**
   ```bash
   npm test
   ```
   *Expected Output:* 7 test files pass (65 tests), confirming baseline functionality is intact.
