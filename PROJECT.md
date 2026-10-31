# Project: Alfaaz Collective Curatorial Authentication System

## Architecture
Alfaaz Collective is a Cloudflare-native application built with Cloudflare Workers (Hono framework), Cloudflare D1 SQLite, and a multi-page Vite frontend styled with curatorial luxury tokens (warm paper ivory `#f4f1ea`, deep ink `#2d312e`, Alegreya serif/sans, zero border-radius).

### Data & Authentication Flow
1. **Frontend Auth Card (`frontend/login.html`)**:
   - Equal-sized segmented toggle switches between `[ Log In ]` and `[ Register ]`.
   - Monochrome editorial badges initiate 1-tap OAuth (Google, Apple ID, Meta) via Firebase Client SDK.
   - Mobile Phone + OTP input initiates SMS flow via pre-flight backend Turnstile + velocity check before triggering Firebase Phone Auth.
   - Traditional Email & Password inputs retained as a secondary option.
2. **Backend Gatekeeper & Token Issuance (`backend/src/routes/auth.ts`, `backend/src/auth/federated.ts`)**:
   - `POST /auth/send-otp`: Verifies Cloudflare Turnstile token (`verifyTurnstile`), validates E.164 phone format, enforces velocity rate limits (max 1 SMS/60s per phone, max 5 SMS/day per phone & IP) recorded in D1 table `otp_velocity_logs`.
   - `POST /auth/federated-login`: Verifies Firebase ID token using zero-dependency Web Crypto RS256 against Google's public x509 certs/JWKs, maps or upserts the user in Cloudflare D1 `users` table, and issues an Alfaaz sovereign session HMAC-SHA256 JWT (7-day validity, role-preserved).
3. **Database Layer (`database/migrations/0002_federated_auth.sql`)**:
   - D1 SQLite table rebuild of `users` table to make `password` nullable for federated/passwordless users.
   - Adds `phone TEXT UNIQUE`, `auth_provider TEXT DEFAULT 'email'`, and `firebase_uid TEXT UNIQUE`.
   - Creates `otp_velocity_logs` table with indices on `(phone, created_at)` and `(ip, created_at)`.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Dual Segmented Toggle | Equal-sized 50%/50% segmented button toggle on auth card switching mode between [ Log In ] and [ Register ] | M3 | ORIGINAL_REQUEST §R1 |
| 2 | Monochrome Editorial Social Badges | Minimalist monochrome editorial badges for Google, Apple, and Facebook (Meta) in warm paper ivory & deep ink palette | M3 | ORIGINAL_REQUEST §R1 |
| 3 | Secondary Traditional Email/Password | Retain traditional email and password login/registration as a secondary fallback option | M3 | ORIGINAL_REQUEST §R1 |
| 4 | Mobile Phone Number + OTP Flow | Client-side OTP delivery via Firebase Phone Auth (`signInWithPhoneNumber`) consuming free tier | M3 | ORIGINAL_REQUEST §R2 |
| 5 | 1-Tap Social Logins | 1-tap OAuth popup login for Google, Apple ID, and Facebook (Meta) via Firebase SDK | M3 | ORIGINAL_REQUEST §R2 |
| 6 | Cloudflare Turnstile Bot Verification | Strict Turnstile bot verification enforced on every send-otp and phone auth call (`rate_limit.ts:verifyTurnstile`) | M2 | ORIGINAL_REQUEST §R3 |
| 7 | Velocity Rate Limiting (60s cooldown) | Max 1 SMS per 60 seconds per phone number | M1 | ORIGINAL_REQUEST §R3 |
| 8 | Velocity Rate Limiting (Daily Quota) | Max 5 SMS per day per phone number and max 5 SMS per day per IP address | M1 | ORIGINAL_REQUEST §R3 |
| 9 | D1 Schema Migration for Federated Auth | Non-destructive SQLite table rebuild making `password` nullable, adding `phone`, `auth_provider`, `firebase_uid` | M1 | ORIGINAL_REQUEST §R4 |
| 10 | Velocity Logs Table | Dedicated `otp_velocity_logs` table in D1 with indexed timestamps for atomic, race-free limits | M1 | ORIGINAL_REQUEST §R3 |
| 11 | Cryptographic Firebase ID Token Verification | Zero-dependency Web Crypto RS256 token verification using Google's public x509 certs/JWKs in Cloudflare Worker | M2 | ORIGINAL_REQUEST §R4 |
| 12 | User Mapping & Upserting | D1 user lookup by `firebase_uid`, `email`, or `phone`, upserting profile and preserving existing roles | M2 | ORIGINAL_REQUEST §R4 |
| 13 | Sovereign Alfaaz Session JWT Issuance | Issuance of Alfaaz HMAC-SHA256 session JWTs with 7-day validity and custom roles (`PARTICIPANT`/`ADMIN`) | M2 | ORIGINAL_REQUEST §R4 |
| 14 | Send-OTP Backend Gatekeeper Endpoint | `POST /auth/send-otp` enforcing Turnstile and velocity limits before authorizing client SMS delivery | M2 | ORIGINAL_REQUEST §R3 |
| 15 | Federated Login Backend Endpoint | `POST /auth/federated-login` handling token verification, user upsert, and sovereign JWT issuance | M2 | ORIGINAL_REQUEST §R4 |
| 16 | Content Security Policy Headers | Update CSP in `backend/src/index.ts` to allow Google and Firebase authentication domains | M2 | Survey Explorer 2 |
| 17 | Absolute Secret Redaction | Strict redaction of secrets in all logs, documentation, and tests (`<redacted — rotated YYYY-MM-DD>`) | M1, M2, M3, M4 | ORIGINAL_REQUEST §R5, AGENTS.md |
| 18 | Test Suite Invariants | All existing test suites pass: `npm test`, `npm run test:hardening`, `npm run typecheck`, `npm run build` | M1, M2, M3, M4 | ORIGINAL_REQUEST §R5 |
| 19 | E2E Test Suite (Tiers 1-4) | Comprehensive opaque-box test suite for all auth features, boundaries, combinations, and workloads | M4 / E2E Track | ORIGINAL_REQUEST Acceptance Criteria |
| 20 | Adversarial Hardening (Tier 5) | White-box adversarial testing, edge-case exploitation, and gap hardening | M4 | Project Pattern |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Schema & Velocity Engine | D1 migration `0002_federated_auth.sql` (nullable password rebuild, phone, auth_provider, firebase_uid, otp_velocity_logs) and D1 velocity rate limiting helper | none | PLANNED |
| M2 | Backend Federated Auth & Verification | `POST /auth/send-otp`, `POST /auth/federated-login`, Web Crypto RS256 Firebase verifier, sovereign JWT issuance, CSP headers | M1 | PLANNED |
| M3 | Frontend Curatorial Auth UI & Integration | Segmented toggle `[ Log In ]` / `[ Register ]`, monochrome social badges, Firebase Phone Auth & social handlers, Turnstile pre-flight | M2 | PLANNED |
| M4 | Final Milestone: E2E Test Pass & Adversarial Hardening | Pass 100% of E2E test suite (Tiers 1-4) and complete Tier 5 adversarial coverage hardening | M3, E2E Track | PLANNED |

---

## Interface Contracts

### Frontend Client ↔ Backend Gatekeeper (`POST /auth/send-otp`)
- **Request Body**:
  ```json
  {
    "phone": "+14155552671",
    "turnstile_token": "0x4AAAAAA..."
  }
  ```
- **Headers**:
  - `Content-Type: application/json`
  - `cf-turnstile-response: <token>` (optional fallback)
- **Response**:
  - `200 OK`: `{ "success": true, "message": "Rate limit check passed. Proceed with SMS delivery." }`
  - `400 Bad Request`: `{ "error": "Invalid phone number format. Must be E.164." }`
  - `403 Forbidden`: `{ "error": "Turnstile verification failed" }`
  - `429 Too Many Requests`: `{ "error": "Rate limit exceeded. Please wait 60 seconds before requesting another SMS.", "retry_after": 60 }` or `{ "error": "Daily SMS limit exceeded (max 5 per day)." }`

### Frontend Client ↔ Backend Federated Login (`POST /auth/federated-login`)
- **Request Body**:
  ```json
  {
    "id_token": "<firebase_id_token>",
    "provider": "phone" | "google.com" | "apple.com" | "facebook.com",
    "turnstile_token": "<optional_token>"
  }
  ```
- **Response**:
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

### Velocity Engine Interface (`backend/src/services/velocity.ts` or `rate_limit.ts`)
- **Function**: `checkAndRecordOtpVelocity(db: D1Database, phone: string, ip: string): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }>`
- **Rules**:
  - Rejects if `phone` has record within past 60s (`retryAfter` set).
  - Rejects if `phone` has >= 5 records within past 24h.
  - Rejects if `ip` has >= 5 records within past 24h.
  - On allowed: inserts `(phone, ip, CURRENT_TIMESTAMP)` into `otp_velocity_logs`.

---

## Code Layout
- `database/migrations/`:
  - `0001_initial_schema.sql` (baseline)
  - `0002_federated_auth.sql` (M1: nullable password table rebuild, phone, auth_provider, firebase_uid, otp_velocity_logs)
- `backend/src/`:
  - `index.ts` (routing, CSP, CORS headers)
  - `routes/auth.ts` (auth router, `/send-otp`, `/federated-login`, `/register`, `/login`)
  - `auth/crypto.ts` (sovereign HMAC-SHA256 JWT issuance and verification)
  - `auth/federated.ts` (M2: Web Crypto RS256 Google x509/JWK verification)
  - `middleware/rate_limit.ts` (Turnstile bot verification and velocity rate limiting)
- `frontend/`:
  - `login.html` (curatorial luxury auth card with segmented toggle, monochrome social badges, phone OTP, email/pw)
  - `register.html` (backward-compatibility redirect or render mode)
  - `global.css` (editorial styles, segmented button toggle, monochrome grid)
  - `src/login.js` (segmented toggle handler, social login triggers, phone OTP handler)
  - `src/firebase.js` (Firebase client SDK initialization, phone auth verifier, social popup providers)
- `tests/`:
  - `auth.test.ts` (existing auth suite)
  - `federated_auth.test.ts` (federated login, token verification, D1 upsert)
  - `velocity_turnstile.test.ts` (Turnstile enforcement, 60s cooldown, 5/day quotas)
  - `security_seed.test.ts` (secret redaction scanner)
