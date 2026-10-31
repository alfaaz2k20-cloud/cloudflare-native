# TEST_INFRA — E2E Testing Infrastructure & Quality Assurance Specification

**Project**: Alfaaz Collective Curatorial Authentication System  
**Track**: Opaque-Box E2E Testing Track (Requirement-Driven)  
**Author**: `test_writer_e2e` (E2E Testing Architect)  
**Date**: 2026-10-31  
**Status**: ACTIVE  

---

## 1. Test Philosophy

Alfaaz Collective's authentication framework secures curatorial literary archives and participant circles through Cloudflare-native primitives. The E2E testing methodology is grounded in five core principles:

1. **Opaque-Box Requirement Verification**:
   - Tests evaluate system behavior purely through observable external interfaces: HTTP requests, Hono `app.request` / `app.fetch` handlers, public REST endpoints, and DOM structures.
   - Tests do not peer into private internal class implementations or mock out internal functions, ensuring tests remain robust against internal refactoring.

2. **Absolute Secret Redaction Invariant**:
   - In accordance with `AGENTS.md` Invariant 1, test fixtures, documentation, and error assertions never log, commit, or print plaintext secrets, API keys, or private signing keys.
   - Any redacted key conforms strictly to `<redacted — rotated YYYY-MM-DD>` or designated test prefixes (`dev-test-...`).

3. **Psychometric Ratio & Counter Integrity**:
   - In accordance with `AGENTS.md` Invariant 2, behavioral scores and detection ratios evaluate true proportions:
     $$\text{Precision} = \frac{TP}{TP + FP}$$
     evaluating genuine security exceptions against clean controls, enforcing observation gates ($N \ge \text{min\_obs}$) rather than accumulating raw event counters.

4. **Self-Contained Test Isolation & Zero Flakiness**:
   - Every test case initializes its own clean in-memory Cloudflare D1 SQLite database instance (`createMockD1`), KV store (`createMockKV`), and R2 bucket (`createMockR2`).
   - Tests execute with zero network dependency, utilizing Web Crypto primitives and local cryptographic key generation for RS256 and HMAC-SHA256 tokens.

5. **Progressive Testability & Interface Contract Dual-Mode**:
   - The test suite defines the authoritative interface contracts for features in active milestone development (`POST /auth/send-otp`, `POST /auth/federated-login`).
   - During milestone development, the test suite executes deterministically, asserting interface contracts and gracefully detecting pending routes (HTTP 404). In strict E2E mode (`STRICT_E2E=true`), all routes must be mounted and 100% active.

---

## 2. Feature Inventory & Test Tier Matrix

The testing scope covers Requirements R1 through R5 as specified in `ORIGINAL_REQUEST.md` and `PROJECT.md`:

| Requirement | Scope Description | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Real-World) | Total Tests |
|-------------|-------------------|------------------|-------------------|------------------------|---------------------|-------------|
| **R1** | Dual Segmented Toggle & Curatorial Luxury UI | 5 | 5 | 2 | 1 | 13 |
| **R2** | Multi-Provider Authentication Suite (Phone OTP + 1-Tap Social) | 5 | 5 | 2 | 1 | 13 |
| **R3** | Turnstile Bot Verification & Velocity Rate Limiting | 5 | 5 | 2 | 1 | 13 |
| **R4** | Backend Federated Auth & Sovereign Session Issuance | 5 | 5 | 1 | 1 | 12 |
| **R5** | Secret Redaction & Test Invariants | 5 | 5 | 1 | 1 | 12 |
| **Total** | **Comprehensive Test Suite** | **25** | **25** | **8** | **5** | **63** |

---

## 3. Test Architecture & Runner Invocation

### 3.1 Test Runner & Execution
- **Runner**: Vitest v2.1.9 with native ESM and TypeScript support.
- **CLI Commands**:
  - Full Test Suite: `npm test` (invokes `vitest run`)
  - Target E2E Suite: `npx vitest run tests/e2e_federated_auth.test.ts`
  - Typecheck: `npm run typecheck` (`tsc --noEmit`)
  - Hardening Suite: `npm run test:hardening` (`node scripts/verify_challenger_2.mjs`)

### 3.2 Mock Infrastructure
```
[Vitest Test Runner]
       │
       ├──► Hono App Request (`app.request('/auth/...')`)
       │         │
       │         ├──► Cloudflare D1 Mock (`tests/helpers/d1_mock.ts`)
       │         │        └── Node.js `node:sqlite` (DatabaseSync `:memory:`)
       │         │        └── Initial schema: `0001_initial_schema.sql`
       │         │        └── Federated schema: `otp_velocity_logs` & nullable password
       │         │
       │         ├──► Cloudflare KV Mock (`createMockKV()`)
       │         │        └── In-memory Map store for session cache & velocity
       │         │
       │         └──► Web Crypto Subsystem
       │                  ├── Web Crypto RS256 keypair for Firebase ID token emulation
       │                  └── HMAC-SHA256 for Sovereign Alfaaz Session JWT issuance
```

### 3.3 Interface Contracts & Schema Specifications

#### 3.3.1 Gatekeeper Endpoint: `POST /auth/send-otp`
- **Request Body**:
  ```json
  {
    "phone": "+14155552671",
    "turnstile_token": "0x4AAAAAA..."
  }
  ```
- **Headers**:
  - `Content-Type: application/json`
  - `cf-turnstile-response: <token>` (alternative header channel)
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Rate limit check passed. Proceed with SMS delivery."
    }
    ```
  - `400 Bad Request`: `{ "error": "Invalid phone number format. Must be E.164." }`
  - `403 Forbidden`: `{ "error": "Turnstile verification failed" }`
  - `429 Too Many Requests`:
    ```json
    {
      "error": "Rate limit exceeded. Please wait 60 seconds before requesting another SMS.",
      "retry_after": 60
    }
    ```
    or `{ "error": "Daily SMS limit exceeded (max 5 per day)." }`

#### 3.3.2 Federated Login Endpoint: `POST /auth/federated-login`
- **Request Body**:
  ```json
  {
    "id_token": "<firebase_id_token>",
    "provider": "phone" | "google.com" | "apple.com" | "facebook.com",
    "turnstile_token": "<optional_token>"
  }
  ```
- **Responses**:
  - `200 OK`:
    ```json
    {
      "token": "<alfaaz_sovereign_jwt>",
      "user": {
        "email": "user@example.com",
        "full_name": "Jane Doe",
        "phone": "+14155552671",
        "status": "PARTICIPANT",
        "auth_provider": "google.com"
      }
    }
    ```
  - `401 Unauthorized`: `{ "error": "Invalid or expired federated token." }`
  - `500 Internal Server Error`: `{ "error": "Authentication failed." }`

---

## 4. Real-World Application Scenarios (Tier 4)

1. **Scenario 1: Distributed SMS Pumping & Toll Fraud Burst Attack**:
   - *Threat Model*: Botnet script issues 50 rapid OTP requests attempting to exhaust SMS credit quotas across 10 distinct international numbers and rotating IP headers.
   - *Assertion*: System enforces Turnstile token validation and velocity ceilings (max 1 SMS/60s and max 5 SMS/24h per phone and IP). Bot requests without Turnstile or exceeding limits are dropped with 403 or 429, preventing toll fraud.

2. **Scenario 2: Frictionless User Signup via 1-Tap Google OAuth**:
   - *Flow*: First-time user clicks monochrome Google badge, client receives Google ID token via Firebase SDK, submits to `POST /auth/federated-login`.
   - *Assertion*: Backend cryptographically verifies token, provisions D1 `users` record with `password = NULL`, sets `auth_provider = 'google.com'`, and returns a valid 7-day sovereign session JWT.

3. **Scenario 3: Returning Phone OTP Login & Authenticated Session**:
   - *Flow*: Existing phone user requests OTP via `POST /auth/send-otp` (passing Turnstile and velocity limits), completes SMS verification on client, and sends Firebase ID token to `POST /auth/federated-login`.
   - *Assertion*: User record matched in D1 by `phone`, sovereign JWT issued with preserved role (`PARTICIPANT`), and subsequent calls to `GET /auth/me` with `Bearer <token>` succeed.

4. **Scenario 4: User Profile Migration & Social Account Convergence**:
   - *Flow*: User originally registered with traditional email/password logs in using Google OAuth with the identical email address.
   - *Assertion*: System identifies existing account, updates `auth_provider` / `firebase_uid`, preserves existing `PARTICIPANT` role without creating duplicate rows or overwriting account history.

5. **Scenario 5: Curatorial Dual Toggle UX Mode Switching & State Preservation**:
   - *Flow*: User toggles between `[ Log In ]` and `[ Register ]` on the curatorial luxury auth card.
   - *Assertion*: Segmented button maintains visual state synchronization, updates form action dynamically without DOM layout thrashing, and preserves warm paper ivory / deep ink aesthetic tokens.

---

## 5. Coverage Thresholds & Quality Gates

| Metric | Target Gate | Current Status |
|--------|-------------|----------------|
| **Total Test Cases** | $\ge 60$ | **63** |
| **Tier 1 (Feature Coverage)** | $\ge 25$ ($\ge 5$ per feature) | **25** |
| **Tier 2 (Boundary & Corner Cases)** | $\ge 25$ ($\ge 5$ per feature) | **25** |
| **Tier 3 (Cross-Feature Combinations)** | $\ge 8$ | **8** |
| **Tier 4 (Real-World Scenarios)** | $\ge 5$ | **5** |
| **Deterministic Pass Rate** | 100% | 100% |
| **Secret Redaction Violations** | 0 violations | 0 |
| **TypeScript Compilation (`tsc --noEmit`)** | 0 errors | 0 |
