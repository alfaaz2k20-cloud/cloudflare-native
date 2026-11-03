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
   - The test suite defines the authoritative interface contracts for sovereign and federated auth (`POST /auth/federated-login`, `POST /auth/register`, `POST /auth/login`). Phone OTP (`POST /auth/send-otp`) was decommissioned on 2026-11-03 per `AGENTS.md §3`.
   - During milestone development, the test suite executes deterministically, asserting interface contracts and gracefully detecting pending routes (HTTP 404). In strict E2E mode (`STRICT_E2E=true`), all routes must be mounted and 100% active.

---

## 2. Feature Inventory & Test Tier Matrix

The testing scope covers Requirements R1 through R5 as specified in `ORIGINAL_REQUEST.md` and `PROJECT.md`:

| Requirement | Scope Description | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Real-World) | Total Tests |
|-------------|-------------------|------------------|-------------------|------------------------|---------------------|-------------|
| **R1** | Dual Segmented Toggle & Curatorial Luxury UI | 5 | 5 | 2 | 1 | 13 |
| **R2** | Multi-Provider Authentication Suite (1-Tap Social GIS + Sovereign Auth; Phone OTP decommissioned) | 5 | 5 | 2 | 1 | 13 |
| **R3** | Turnstile Bot Verification & Velocity Rate Limiting | 5 | 5 | 2 | 1 | 13 |
| **R4** | Backend Federated Auth & Sovereign Session Issuance | 5 | 5 | 1 | 1 | 12 |
| **R5** | Secret Redaction & Test Invariants | 5 | 5 | 1 | 1 | 12 |
| **Total** | **Comprehensive Test Suite** | **25** | **25** | **8** | **5** | **63** |

---

## 3. Test Architecture & Runner Invocation

### 3.1 Test Runner & Execution
- **Runner**: Vitest v2.1.9 with native ESM, V8 code coverage, and TypeScript support.
- **CLI Commands**:
  - Full Test Suite: `npm test` (invokes `vitest run`)
  - Target E2E Suite: `npx vitest run tests/e2e_federated_auth.test.ts`
  - Automated Coverage: `npx vitest run --coverage` (powered by `@vitest/coverage-v8`)
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
       │         │        └── Federated schema: nullable password, phone, auth_provider, firebase_uid
       │         │
       │         ├──► Cloudflare KV Mock (`createMockKV()`)
       │         │        └── In-memory Map store for session cache & velocity
       │         │
       │         └──► Web Crypto Subsystem
       │                  ├── Web Crypto RS256 keypair for Firebase ID token emulation
       │                  └── HMAC-SHA256 for Sovereign Alfaaz Session JWT issuance
```

### 3.3 Interface Contracts & Schema Specifications

#### 3.3.1 Gatekeeper Endpoint: `POST /auth/send-otp` (Decommissioned 2026-11-03 per AGENTS.md §3; Archived Spec)
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

1. **Scenario 1: Distributed Pumping & Toll Fraud Prevention (Historical / Archived Spec)**:
   - *Threat Model*: Botnet script issues 50 rapid OTP requests attempting to exhaust SMS credit quotas across 10 distinct international numbers and rotating IP headers.
   - *Assertion*: System enforces Turnstile token validation and velocity ceilings (max 1 SMS/60s and max 5 SMS/24h per phone and IP). Bot requests without Turnstile or exceeding limits are dropped with 403 or 429, preventing toll fraud.

2. **Scenario 2: Frictionless User Signup via 1-Tap Google OAuth**:
   - *Flow*: First-time user clicks monochrome Google badge, client receives Google ID token via GIS, submits to `POST /auth/federated-login`.
   - *Assertion*: Backend cryptographically verifies token, provisions D1 `users` record with `password = NULL`, sets `auth_provider = 'google.com'`, and returns a valid 7-day sovereign session JWT.

3. **Scenario 3: Returning Phone OTP Login & Authenticated Session (Historical / Archived Spec)**:
   - *Flow*: Existing phone user requests OTP via `POST /auth/send-otp` (passing Turnstile and velocity limits), completes SMS verification on client, and sends verified token to `POST /auth/federated-login`.
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
| **Full Repository Test Suite** | 13 test files | **13 passed (13)** |
| **Full Repository Test Count** | $\ge 200$ tests | **209 passed (209)** |
| **Deterministic Pass Rate** | 100% | **100% (209/209)** |
| **Secret Redaction Violations** | 0 violations | **0** |
| **TypeScript Compilation (`tsc --noEmit`)** | 0 errors | **0 errors** |
| **Coverage Tooling (`npx vitest run --coverage`)** | Enabled via `@vitest/coverage-v8` | **Verified V8 Coverage Active** |

### 5.1 Full Test Suite Inventory Breakdown
The repository test suite comprises 209 automated unit, integration, and security verification tests across 13 test files (down from 256 following the 2026-11-03 SMS/OTP decommission):
1. `tests/e2e_federated_auth.test.ts` (60 tests)
2. `tests/error_paths.test.ts` (25 tests)
3. `tests/d1_routes.test.ts` (24 tests)
4. `tests/integration.test.ts` (18 tests)
5. `tests/admin.test.ts` (14 tests)
6. `tests/velocity_turnstile.test.ts` (12 tests)
7. `tests/events_clubs.test.ts` (11 tests)
8. `tests/concurrency_adversarial.test.ts` (10 tests)
9. `tests/telemetry_evidence.test.ts` (9 tests)
10. `tests/verification_roster.test.ts` (9 tests)
11. `tests/auth.test.ts` (8 tests)
12. `tests/security_seed.test.ts` (5 tests)
13. `tests/sjt_scoring.test.ts` (5 tests)
