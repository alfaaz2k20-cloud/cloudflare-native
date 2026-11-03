# Alfaaz Collective — Comprehensive System Architecture & Dependency Audit

**Document:** `SYSTEM_AUDIT.md`  
**Repository:** Alfaaz Collective (`cloudflare-native`)  
**Runtime Target:** Cloudflare Workers (V8 Edge Isolates)  
**Version:** 2.0.0  
**Date:** 2026-11-03  
**Status:** Authoritative System Specification & Architectural Reference  
**Security Invariant:** All secrets, keys, and tokens redacted according to `AGENTS.md` Rule 1 (`<redacted — rotated YYYY-MM-DD>`).

---

## 1. Executive Summary & System Overview

Alfaaz Collective is a full-stack, cloudflare-native literary, artistic, and cultural platform engineered for high-performance edge execution, strict zero-trust security, and curatorial aesthetic integrity. The system provides an end-to-end digital salon for Kashmiri vernacular literature, visual arts exhibitions, community circles, autonomous research essays, and psychometric candidate recruitment.

Originally structured across legacy hybrid cloud runtimes (Node.js/Express, Vercel Serverless, and Firebase), the platform was systematically re-architected into a unified Cloudflare-native topology. This edge-first architecture eliminates vendor lock-in, eliminates cold starts, delivers sub-millisecond global static asset and API latency, and enforces cryptographic sovereignty across all authentication and storage pathways.

```
                                  [ Cloudflare Edge Network ]
                                                │
                ┌───────────────────────────────┴───────────────────────────────┐
                ▼                                                               ▼
    [ Apex / Custom Domains ]                                       [ Subdomain Rewrites ]
    alfaazcollective.org                                            tch.alfaazcollective.org
    www.alfaazcollective.org (301 redirect)                         (/tch/*, /tchandervar/*)
                │                                                               │
                └───────────────────────────────┬───────────────────────────────┘
                                                ▼
                             [ Cloudflare Worker (V8 Isolate) ]
                             Entrypoint: backend/src/index.ts
                                                │
       ┌────────────────────────────────────────┼────────────────────────────────────────┐
       ▼                                        ▼                                        ▼
[ Security & Middleware ]             [ Static Asset Fetcher ]                 [ Dual-Mount Routers ]
• Strict CSP & Clickjacking           • c.env.ASSETS                           • /auth & /api/auth
• Tightened CORS Allowlist            • Multi-Page Vite (13 HTML)              • /events & /api/events
• Memory Rate Limiter                 • Public Media & Tchandervar             • /clubs & /api/clubs
• Fail-Closed Turnstile Bot Guard                                              • /exhibitions & /api/exhibitions
                                                                               • /vault & /api/vault
                                                                               • /blogs & /api/blogs
                                                                               • /curator & /api/curator
                                                                               • /admin & /api/admin
                                                                               • /verification & /api/verification
                                                                               • /recruit & /api/recruit (Rule 8)
                                                                               • /recruit/research (Rule 8)
                                                │
       ┌────────────────────────────────────────┼────────────────────────────────────────┐
       ▼                                        ▼                                        ▼
[ Cloudflare D1 SQLite ]               [ Cloudflare R2 Vault ]                  [ Cloudflare KV Cache ]
• DB: alfaaz-d1                        • VAULT_BUCKET: alfaaz-vault             • CACHE_KV: notices_feed
• 28 Tables, 4 Migrations              • Private Object Storage                 • Sub-millisecond edge read
• 12-Step Rebuild Pattern              • Owner Authorization                    • Invalidated on publish
• Atomic Concurrency Guards            • Anti-XSS Content Disposition
```

---

## 2. Backend Architecture & Runtime Subsystem

### 2.1 Cloudflare Workers V8 Isolate Runtime
The backend executes natively within Cloudflare Workers V8 isolates rather than a traditional Node.js runtime or containerized environment.
- **Entrypoint**: `backend/src/index.ts`
- **Platform Configuration**: Defined in `wrangler.jsonc`:
  - `compatibility_date: "2024-11-01"`
  - `compatibility_flags: ["nodejs_compat"]`
- **Bindings & Context (`Env` in `backend/src/types.ts`)**:
  - `DB: D1Database` — Relational database binding to SQLite instance `alfaaz-d1` (`28a3ae5b-4d30-4e04-8c95-d764588e72f5`).
  - `VAULT_BUCKET?: R2Bucket` — Object storage binding to S3-compatible bucket `alfaaz-vault`.
  - `CACHE_KV?: KVNamespace` — Distributed key-value store binding (`a199adbc0269462b9227f908a80025e2`).
  - `ASSETS?: Fetcher` — Direct edge fetcher binding to compiled frontend assets in `./frontend/dist`.
- **Architectural Role**: Executes business logic, cryptographic token verifications, and relational queries at Cloudflare edge points of presence (PoPs) worldwide, achieving zero cold starts and single-digit millisecond latency.
- **Architectural Trade-offs**: Traditional Node.js native binary addons (`bcrypt`, native filesystem `fs`, C++ bindings) cannot execute. All cryptographic primitives rely strictly on the W3C Web Crypto standard (`crypto.subtle`).

### 2.2 Hono Framework (v4.6.14) & Routing Pipeline
- **Framework**: `hono@^4.6.14`
- **Application Instance**: `const app = new Hono<{ Bindings: Env; Variables: Variables }>()`
- **Architectural Role**: Provides an ultra-lightweight (<1ms overhead, zero external dependencies), type-safe HTTP routing engine tailored specifically for Web Standards (`Request`, `Response`, `FetchEvent`).
- **Dual-Mount Routing Architecture**: To guarantee backward compatibility with legacy clients, third-party integrations, and automated test runners, all 12 core route modules are mounted simultaneously at root paths and under the `/api` prefix:
  1. `/auth` & `/api/auth` (`routes/auth.ts`)
  2. `/events` & `/api/events` (`routes/events.ts`)
  3. `/clubs` & `/api/clubs` (`routes/clubs.ts`)
  4. `/exhibitions` & `/api/exhibitions` (`routes/exhibitions.ts`)
  5. `/vault` & `/api/vault` (`routes/vault.ts`)
  6. `/blogs` & `/api/blogs` (`routes/blogs.ts`)
  7. `/curator` & `/phantom` & `/api/curator` (`routes/curator.ts`)
  8. `/admin` & `/api/admin` (`routes/admin.ts`)
  9. `/recruit` & `/api/recruit` (`routes/recruit.ts`)
  10. `/recruit/research` & `/api/recruit/research` (`routes/research.ts`)
  11. `/notices` & `/api` (`routes/notices.ts`)
  12. `/verification` & `/api/verification` (`routes/verification.ts`)

### 2.3 Host Canonicalization & Subdomain Rewrites
In `backend/src/index.ts`, custom routing middleware intercepts requests prior to route matching:
1. **Apex Canonicalization (`index.ts:46-56`)**: Inspects `c.req.header('host')` and issues an HTTP 301 Permanent Redirect from `www.alfaazcollective.org` to apex `alfaazcollective.org`, preserving paths and query parameters while normalizing HTTPS.
2. **Tchandervar Subdomain Routing (`index.ts:142-168`)**: Requests arriving on `tch.alfaazcollective.org` or paths prefixed with `/tch/` or `/tchandervar/` are rewritten to fetch `/tchandervar/index.html` from `c.env.ASSETS`.
3. **Artwork Image Alias Failsafe (`index.ts:153-159`)**: Rewrites `/images/artwork-*` requests to `/tchandervar/images/artwork-*` to maintain backward-compatibility with legacy exhibition bookmarks.
4. **PWA Service Worker Rewrites (`index.ts:201-206`)**: Requests for `/service-worker.js` are forwarded to `/sw.js` via `ASSETS`.

### 2.4 Defensive Middleware Pipeline
Requests pass through a sequential pipeline of defensive middleware:
1. **Security Headers Middleware (`index.ts:23-43`)**:
   - `X-Content-Type-Options: nosniff` (mitigates MIME-confusion attacks).
   - `X-Frame-Options: DENY` (disallows iframe embedding).
   - `Referrer-Policy: strict-origin-when-cross-origin` (protects referrer privacy).
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()` (restricts browser device access).
   - **Content Security Policy (CSP)**:
     ```
     default-src 'self';
     script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://challenges.cloudflare.com https://apis.google.com https://www.gstatic.com https://accounts.google.com;
     style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
     font-src 'self' https://fonts.gstatic.com data:;
     img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://*.googleusercontent.com https://graph.facebook.com https://appleid.cdn-apple.com https://www.gstatic.com https://ssl.gstatic.com;
     connect-src 'self' https://challenges.cloudflare.com https://api.cloudinary.com https://res.cloudinary.com https://*.googleapis.com https://accounts.google.com;
     frame-src 'self' https://challenges.cloudflare.com https://appleid.apple.com https://accounts.google.com;
     frame-ancestors 'none';
     base-uri 'self';
     form-action 'self';
     ```
2. **Tightened CORS Middleware (`index.ts:59-108`)**:
   - Restricts origins to explicit allowlist: `alfaazcollective.org`, `*.alfaaz.pages.dev`, `alfaazcollective.vercel.app`, and local test ports (`3000`, `5173`, `8787`).
   - Rejects arbitrary origin reflection when `credentials: true` is requested.
   - Enforces permitted methods (`GET, POST, PUT, PATCH, DELETE, OPTIONS`) and permitted headers (`Content-Type, Authorization, X-Requested-With, cf-turnstile-response, Accept, Origin`).
3. **Authentication Middleware (`middleware/auth.ts`)**:
   - `requireAuth`: Extracts `Authorization: Bearer <token>`, verifies signature via `verifyToken()`, strictly rejects single-purpose reset tokens (`status === 'reset'`), and sets user context (`c.set('user', payload)`).
   - `requireAdmin`: Enforces `payload.status === 'ADMIN'`, returning `403 Forbidden` if the caller is not an administrator.
4. **Rate Limiting Middleware (`middleware/rate_limit.ts`)**:
   - In-memory sliding window limiter keyed by `${normalizedPath}:${rawIp}`. Automatically normalizes `/api` aliases to prevent route-alias budget gaming.
5. **Turnstile Bot Verification Middleware (`middleware/rate_limit.ts:verifyTurnstile`)**:
   - Sends verification payload to `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
   - **Fail-Closed Security Invariant**: In `ENV === 'production'`, calls fail closed (`403 Forbidden`) if `TURNSTILE_SECRET_KEY` is missing or if dummy test keys (`1x000...`) are passed. Loopback and internal private IP addresses are stripped before forwarding.

### 2.5 Sovereign Cryptography & Authentication Subsystem
Alfaaz Collective operates a sovereign cryptographic suite with zero external npm dependencies (`backend/src/auth/crypto.ts` and `backend/src/auth/federated.ts`):
1. **Password Hashing (PBKDF2)**:
   - Algorithm: PBKDF2 with SHA-256, 100,000 iterations, 16-byte cryptographically secure random salt generated via `crypto.getRandomValues()`.
   - Storage Format: `pbkdf2:sha256:100000:<saltHex>:<hashHex>`.
   - Verification: Derives key bits from provided password and performs a constant-time bitwise XOR comparison across all bytes to prevent timing attacks.
2. **Sovereign JWT Issuance & Verification**:
   - Algorithm: HMAC-SHA256 (`HS256`) signed via Web Crypto `crypto.subtle.sign('HMAC', key, data)`.
   - Lifetime: 7 days for user session tokens; 15 minutes for password reset tokens (`status: 'reset'`).
   - Header Validation: Enforces `alg === 'HS256'` and `typ === 'JWT'`, mitigating algorithm confusion vulnerabilities.
3. **Federated Google Identity Services (GIS) Token Verifier**:
   - Algorithm: Web Crypto RS256 (`RSASSA-PKCS1-v1_5` with SHA-256).
   - JWKS Caching: Fetches and caches Google's public JSON Web Key Sets from `https://www.googleapis.com/oauth2/v3/certs` in an in-memory cache with HTTP `max-age` TTL management.
   - **Audience Validation**: Rejects any token where `payload.aud !== c.env.GOOGLE_CLIENT_ID`.
   - **Verified Email Gate**: Requires `email_verified === true`. Accounts are never linked if email verification is false or absent.
   - **Cryptographic Provider Integrity**: Derives `auth_provider` solely from token claims, ignoring client payload arguments.
4. **Password Reset Replay & Invalidation Protection**:
   - SHA-256 hash of every consumed reset token is permanently inserted into D1 table `consumed_tokens`. Replay attempts fail immediately with `400 Bad Request`.
   - Compares token issuance time against `password_reset_at` timestamp on `users` table: tokens issued prior to the last password change are invalidated.

### 2.6 Notification Subsystem
- **Tri-Modal Email Provider Pattern (`backend/src/notifications/email.ts`)**:
  - `DevEmailProvider`: Captures outbound email messages into an in-memory preview buffer (`devEmailPreviews`) for development inspection and automated test assertions.
  - `WebhookEmailProvider`: Transmits payloads to configured Make.com webhook URL (`MAKE_WEBHOOK_URL`).
  - `CloudflareEmailSendingProvider`: Integrates directly with Cloudflare Transactional Email Sending API (`api.cloudflare.com/client/v4/.../email/sending/send`).
  - Privacy Guard: Outbound email addresses are masked in server logs (`j***e@domain.com`) to prevent PII exposure.
- **SMS Gateway (Decommissioned 2026-11-03 per AGENTS.md §3)**:
  - Phone OTP delivery and Twilio SMS adapter were decommissioned on 2026-11-03. Documented in `AGENTS.md §3` as a probable future capability for phone-ownership verification.

### 2.7 Autonomous Curator AI & Scheduled Edge Automation
- **Autonomous Curatorial Essay Generator (`backend/src/services/curator.ts`)**:
  - Generates scholarly, contemplative essays exploring Kashmiri architecture, vernacular crafts (Pinjrakari, Khatamband), and literature.
  - Multi-Model Support: Evaluates Google Gemini API (`gemini-2.5-flash`), Groq API (`llama-3.3-70b-versatile`), and an extensive, grounded scholarly static essay ("The Geometry of Stillness: Pinjrakari, Khatamband, and the Metaphysics of Kashmiri Vernacular Space") containing authentic academic references.
- **Cloudflare Scheduled Cron Trigger**:
  - Configured in `wrangler.jsonc` as `0 10 * * SUN` (every Sunday at 10:00 UTC).
  - Publication Idempotency: Queries `SELECT id FROM blogs WHERE title = ? LIMIT 1` prior to inserting.
  - Cache Invalidation: Automatically purges `notices_feed` from `CACHE_KV` upon publishing.

### 2.8 Global Error Handling & Information Disclosure Shields
- **`app.onError` (`index.ts:267-277`)**:
  - Traps uncaught exceptions and `HTTPException` instances.
  - Guarantees structured JSON responses (`{ error: string, detail?: string }`) preventing raw 500 HTML leaks.
  - Production Shield: In `ENV === 'production'`, database syntax errors and internal stack traces are redacted to `"An unexpected error occurred."`.
- **`app.all('/api/*', ...)` (`index.ts:264`)**:
  - Captures unmatched API routes and returns `{ error: "Endpoint not found on Cloudflare-native API" }` with HTTP 404.

---

### 2.9 Comprehensive Backend Endpoints Directory (81 Active Endpoints)

| # | HTTP Method | Endpoint Path | Dual-Mount Alias | Router Module | Auth / Security Gate | Operational Contract & Business Logic |
|---|---|---|---|---|---|---|
| 1 | `GET` | `/ping` | `/api/ping` | Root | Public | Returns health status `{ status: 'ALIVE', runtime: 'cloudflare-workers' }`. |
| 2 | `POST` | `/auth/send-otp` | `/api/auth/send-otp` | `auth` | Decommissioned | Decommissioned on 2026-11-03 per `AGENTS.md §3`; retained as future capability spec. |
| 3 | `POST` | `/auth/federated-login` | `/api/auth/federated-login` | `auth` | Rate Limited (20/m) | Verifies Google GIS RS256 token, links/upserts user, issues 7-day session JWT. |
| 4 | `POST` | `/auth/register` | `/api/auth/register` | `auth` | Turnstile + Rate Limited | Creates participant account with PBKDF2 hash, phone, dispatches welcome email. |
| 5 | `POST` | `/auth/login` | `/api/auth/login` | `auth` | Turnstile + Rate Limited | Authenticates email/password via PBKDF2 constant-time check, issues session JWT. |
| 6 | `POST` | `/auth/forgot-password` | `/api/auth/forgot-password` | `auth` | Turnstile + Rate Limited | Generates 15-minute reset JWT (`status: 'reset'`), dispatches recovery email. |
| 7 | `POST` | `/auth/reset-password` | `/api/auth/reset-password` | `auth` | Rate Limited | Validates reset token, checks replay in `consumed_tokens`, updates password hash. |
| 8 | `GET` | `/auth/me` | `/api/auth/me` | `auth` | `requireAuth` | Retrieves authenticated user profile, roles, and verification flags. |
| 9 | `PATCH` | `/auth/me` | `/api/auth/me` | `auth` | `requireAuth` | Updates user full name and phone number with E.164 format and uniqueness check. |
| 10 | `POST` | `/verification/email/send` | `/api/verification/email/send` | `verification` | `requireAuth` | Generates 6-digit email OTP, stores SHA-256 hash in D1 (10m TTL), sends email. |
| 11 | `POST` | `/verification/email/confirm` | `/api/verification/email/confirm` | `verification` | `requireAuth` | Verifies code (max 5 attempts), updates user `email_verified = 1`. |
| 12 | `POST` | `/verification/phone/send` | `/api/verification/phone/send` | `verification` | Decommissioned | Decommissioned on 2026-11-03 per `AGENTS.md §3`; retained as future capability spec. |
| 13 | `POST` | `/verification/phone/confirm` | `/api/verification/phone/confirm` | `verification` | Decommissioned | Decommissioned on 2026-11-03 per `AGENTS.md §3`; retained as future capability spec. |
| 14 | `GET` | `/events/active` | `/api/events/active` | `events` | Public | Returns open events, capacities, registration counts, and spots left. |
| 15 | `POST` | `/events/register` | `/api/events/register` | `events` | `requireAuth` | Atomic RSVP check; enforces event capacity and prevents double-registration. |
| 16 | `GET` | `/events/my-registrations` | `/api/events/my-registrations` | `events` | `requireAuth` | Returns active event RSVPs for the authenticated caller. |
| 17 | `POST` | `/clubs/apply` | `/api/clubs/apply` | `clubs` | `requireAuth` | Submits application to one of 5 circles; enforces unique user/circle constraint. |
| 18 | `GET` | `/clubs/my-status` | `/api/clubs/my-status` | `clubs` | `requireAuth` | Returns status (`NONE, PENDING, APPROVED, REJECTED`) of club applications. |
| 19 | `GET` | `/exhibitions/config` | `/api/exhibitions/config` | `exhibitions` | Public | Returns active exhibition metadata, venue, terms PDF URL, and age criteria. |
| 20 | `POST` | `/exhibitions/apply` | `/api/exhibitions/apply` | `exhibitions` | `requireAuth` + Turnstile | Submits artist portfolio and bio; enforces 18+ gate if cycle requires. |
| 21 | `GET` | `/exhibitions/my-status` | `/api/exhibitions/my-status` | `exhibitions` | `requireAuth` | Returns submission and curation status for the caller's exhibition entry. |
| 22 | `POST` | `/exhibitions/complete-registration` | `/api/exhibitions/complete-registration` | `exhibitions` | `requireAuth` | Submits payment proof URL and transaction notes for approved submissions. |
| 23 | `POST` | `/vault/submit` | `/api/vault/submit` | `vault` | `requireAuth` | Uploads member artwork into R2 (`VAULT_BUCKET`) or logs Cloudinary URL. |
| 24 | `GET` | `/vault/file/:key` | `/api/vault/file/:key` | `vault` | `requireAuth` | Streams private files from R2 with ownership authorization and XSS defense. |
| 25 | `GET` | `/blogs` | `/api/blogs` | `blogs` | Public | Returns published journal essays and autonomous reflections. |
| 26 | `GET` | `/blogs/:id` | `/api/blogs/:id` | `blogs` | Public | Retrieves single article detail with sanitized HTML content. |
| 27 | `POST` | `/blogs/generate` | `/api/blogs/generate` | `blogs` | `CURATOR_SECRET_TOKEN` | Generates and publishes autonomous essay via AI API or static fallback. |
| 28 | `POST` | `/curator/ask` | `/api/curator/ask` | `curator` | Rate Limited (20/m) | Conversational AI interface grounded in Alfaaz literary archives. |
| 29 | `POST` | `/curator` | `/api/curator` | `curator` | Rate Limited (20/m) | Alias endpoint for `/curator/ask`. |
| 30 | `GET` | `/notices` | `/api/notices` | `notices` | Public (KV 60s) | Aggregates hero banner notices (events, exhibition, article) via `CACHE_KV`. |
| 31 | `GET` | `/admin/events` | `/api/admin/events` | `admin` | `requireAdmin` | Lists all community events and participant rosters. |
| 32 | `POST` | `/admin/events/create` | `/api/admin/events/create` | `admin` | `requireAdmin` | Creates new event and logs admin action in `admin_audit_logs`. |
| 33 | `PATCH` | `/admin/events/:id/toggle` | `/api/admin/events/:id/toggle` | `admin` | `requireAdmin` | Toggles registration open/closed status for an event. |
| 34 | `DELETE` | `/admin/events/:id` | `/api/admin/events/:id` | `admin` | `requireAdmin` | Deletes an event and associated registrations. |
| 35 | `GET` | `/admin/club-applications` | `/api/admin/club-applications` | `admin` | `requireAdmin` | Lists pending and reviewed circle applications across all members. |
| 36 | `POST` | `/admin/club-applications/review` | `/api/admin/club-applications/review` | `admin` | `requireAdmin` | Approves or rejects club application with curator feedback notes. |
| 37 | `GET` | `/admin/exhibitions/list` | `/api/admin/exhibitions/list` | `admin` | `requireAdmin` | Lists all exhibition cycles and curation states. |
| 38 | `POST` | `/admin/exhibitions/create` | `/api/admin/exhibitions/create` | `admin` | `requireAdmin` | Provisions a new exhibition cycle. |
| 39 | `PATCH` | `/admin/exhibitions/:id/activate` | `/api/admin/exhibitions/:id/activate` | `admin` | `requireAdmin` | Activates an exhibition cycle while deactivating others. |
| 40 | `PATCH` | `/admin/exhibitions/:id/toggle-age` | `/api/admin/exhibitions/:id/toggle-age` | `admin` | `requireAdmin` | Toggles 18+ requirement on exhibition cycle. |
| 41 | `POST` | `/admin/exhibitions/review` | `/api/admin/exhibitions/review` | `admin` | `requireAdmin` | Approves or rejects artist applications. |
| 42 | `PATCH` | `/admin/exhibitions/:id/confirm-payment` | `/api/admin/exhibitions/:id/confirm-payment` | `admin` | `requireAdmin` | Confirms payment proof for exhibition registration. |
| 43 | `GET` | `/admin/users` | `/api/admin/users` | `admin` | `requireAdmin` | Lists all registered users and contact verification status. |
| 44 | `DELETE` | `/admin/users/:email` | `/api/admin/users/:email` | `admin` | `requireAdmin` | Purges user account (with safeguard preventing admin self-purge). |
| 45 | `POST` | `/admin/update_status` | `/api/admin/update_status` | `admin` | `requireAdmin` | Promotes or demotes user role (`ADMIN` vs `PARTICIPANT`). |
| 46 | `GET` | `/admin/audit-logs` | `/api/admin/audit-logs` | `admin` | `requireAdmin` | Retrieves immutable audit trail of administrative actions. |
| 47 | `GET` | `/admin/diagnostics/system` | `/api/admin/diagnostics/system` | `admin` | `requireAdmin` | Probes D1 table metrics, R2 connectivity, and KV responsiveness. |
| 48 | `POST` | `/recruit/consent` | `/api/recruit/consent` | `recruit` | Domain-Isolated | Records affirmative consent & 18+ confirmation in `consent_records`. |
| 49 | `POST` | `/recruit/identity` | `/api/recruit/identity` | `recruit` | Domain-Isolated | Binds candidate identity to anonymous assessment session. |
| 50 | `POST` | `/recruit/accessibility` | `/api/recruit/accessibility` | `recruit` | Domain-Isolated | Saves candidate accommodations (high-contrast, dyslexia, motion). |
| 51 | `POST` | `/recruit/warmup` | `/api/recruit/warmup` | `recruit` | Domain-Isolated | Calibrates candidate motor baseline latency for telemetry normalization. |
| 52 | `GET` | `/recruit/sjt/public` | `/api/recruit/sjt/public` | `recruit` | Domain-Isolated | Returns public SJT items without latent psychometric scoring weights. |
| 53 | `POST` | `/recruit/sjt/submit` | `/api/recruit/sjt/submit` | `recruit` | Domain-Isolated | Evaluates SJT responses across 7 constructs with integer-thirds banding. |
| 54 | `POST` | `/recruit/telemetry` | `/api/recruit/telemetry` | `recruit` | Domain-Isolated | Ingests behavioral telemetry event stream from 14 visual minigames. |
| 55 | `POST` | `/recruit/complete` | `/api/recruit/complete` | `recruit` | Domain-Isolated | Computes composite score, non-normative bands, and finalizes session. |
| 56 | `POST` | `/recruit/schedule-interview` | `/api/recruit/schedule-interview` | `recruit` | Domain-Isolated | Atomically reserves interview slot; returns 409 Conflict on contention. |
| 57 | `POST` | `/exhibitions/finalize` | `/api/exhibitions/finalize` | `exhibitions` | `requireAuth` + Rate Limited (10/m) | Alias endpoint for `/exhibitions/complete-registration`; finalizes artist registration with T&C consent and payment proof. |
| 58 | `GET` | `/notices/notices` | `/api/notices` | `notices` | Public (KV 60s) | Returns aggregated notices feed (events, exhibitions, blog) matching legacy Vercel path structure. |
| 59 | `GET` | `/notices/blogs` | `/api/blogs` | `notices` | Public (301 Redirect) | Legacy compatibility route; permanently redirects client to canonical `/api/blogs`. |
| 60 | `GET` | `/notices/blog` | `/api/blog` | `notices` | Public (301 Redirect) | Legacy compatibility route; accepts `?id=` query parameter and permanently redirects to `/api/blogs/:id`. |
| 61 | `GET` | `/recruit/interview-slots` | `/api/recruit/interview-slots` | `recruit` | Domain-Isolated (Public) | Computes available candidate interview time slots across the upcoming 10 days, honoring `interview_settings` skip days and existing reservations. |
| 62 | `GET` | `/recruit/interview-booking/:session_id` | `/api/recruit/interview-booking/:session_id` | `recruit` | Domain-Isolated (PII-Gated) | Retrieves candidate booking for a session; redacts personal PII (name, email, phone, notes) for unauthenticated callers while providing full dossier to admins. |
| 63 | `GET` | `/admin/events/:id/registrations` | `/api/admin/events/:id/registrations` | `admin` | `requireAdmin` | Fetches participant attendee roster (user email, WhatsApp contact, registration timestamp) for a specific event ID. |
| 64 | `PATCH` | `/admin/club-applications/:id/revert` | `/api/admin/club-applications/:id/revert` | `admin` | `requireAdmin` | Reverts a reviewed club application back to `PENDING` status and clears admin feedback note; logs action in `admin_audit_logs`. |
| 65 | `PATCH` | `/admin/exhibitions/deactivate-all` | `/api/admin/exhibitions/deactivate-all` | `admin` | `requireAdmin` | Sets `is_active = 0` across all exhibition cycles, invalidates KV notices cache, and records audit log. |
| 66 | `GET` | `/admin/exhibitions` | `/api/admin/exhibitions` | `admin` | `requireAdmin` | Lists artist applications for an exhibition cycle (supports `?cycle=ALL` or defaults to current active cycle) with complete portfolio and registration metadata. |
| 67 | `GET` | `/admin/exhibitions/cycles` | `/api/admin/exhibitions/cycles` | `admin` | `requireAdmin` | Retrieves all configured and historical exhibition cycle titles along with the currently active cycle name. |
| 68 | `PATCH` | `/admin/exhibitions/:id/revert` | `/api/admin/exhibitions/:id/revert` | `admin` | `requireAdmin` | Reverts an exhibition application back to `PENDING` status and clears curator review note; logs audit event. |
| 69 | `GET` | `/admin/exhibitions/:id/registration` | `/api/admin/exhibitions/:id/registration` | `admin` | `requireAdmin` | Returns registration, T&C agreement, fee confirmation, and payment proof details for a specific artist exhibition application. |
| 70 | `GET` | `/admin/submissions` | `/api/admin/submissions` | `admin` | `requireAdmin` | Lists all creative vault submissions (artwork, poetry, manuscripts) uploaded to R2 or Cloudinary. |
| 71 | `GET` | `/admin/blogs` | `/api/admin/blogs` | `admin` | `requireAdmin` | Retrieves full list of journal essays, AI reflections, and draft articles with publication status. |
| 72 | `POST` | `/admin/blogs/create` | `/api/admin/blogs/create` | `admin` | `requireAdmin` | Manually authors and publishes or drafts a new journal essay; invalidates KV notices feed and records audit log. |
| 73 | `PATCH` | `/admin/blogs/:id/toggle` | `/api/admin/blogs/:id/toggle` | `admin` | `requireAdmin` | Toggles article publication state between `PUBLISHED` (1) and `DRAFT` (0); invalidates KV notices feed. |
| 74 | `DELETE` | `/admin/blogs/:id` | `/api/admin/blogs/:id` | `admin` | `requireAdmin` | Permanently deletes a journal article from D1 and invalidates KV notices cache. |
| 75 | `POST` | `/admin/diagnostics/probe` | `/api/admin/diagnostics/probe` | `admin` | `requireAdmin` | Actively probes edge subsystems: executes D1 test query, tests KV put/get/delete, verifies R2 binding, checks JWT/Turnstile invariants, and validates GIS configuration. |
| 76 | `POST` | `/admin/email/test` | `/api/admin/email/test` | `admin` | `requireAdmin` | Dispatches a test diagnostic email to the authenticated admin via configured notification driver (Make webhook, CF Email, or dev preview). |
| 77 | `GET` | `/admin/email/status` | `/api/admin/email/status` | `admin` | `requireAdmin` | Reports active email notification driver and configuration status (Make webhook vs. Cloudflare Email Routing vs. dev console). |
| 78 | `GET` | `/recruit/research` | `/api/recruit/research` | `research` | `requireAdmin` (Domain-Isolated) | Root discovery endpoint returning recruiter dossier API status, quarantine status, and available service route paths. |
| 79 | `GET` | `/recruit/research/sessions` | `/api/recruit/research/sessions` | `research` | `requireAdmin` (Domain-Isolated) | Lists candidate assessment sessions with ethical safeguards; strictly blocks prohibited ranking, trait sorting, and normative fit query parameters (HTTP 400). |
| 80 | `GET` | `/recruit/research/sessions/:session_id` | `/api/recruit/research/sessions/:session_id` | `research` | `requireAdmin` (Domain-Isolated) | Returns comprehensive candidate research dossier: 7 within-person construct indicators, SJT vs. minigame relative emphasis, telemetry quality flags, and task records with non-normative review safeguards. |
| 81 | `POST` | `/recruit/research/sessions/:session_id/reschedule` | `/api/recruit/research/sessions/:session_id/reschedule` | `research` | `requireAdmin` (Domain-Isolated) | Administers candidate interview scheduling: reschedules slot with collision detection (HTTP 409) or cancels booking (`action: 'CANCEL'`). |
| 82 | `GET` | `/recruit/research/interview-settings` | `/api/recruit/research/interview-settings` | `research` | `requireAdmin` (Domain-Isolated) | Retrieves candidate interview scheduling configuration: offered daily time slots and excluded blackout days from `interview_settings` table. |
| 83 | `POST` | `/recruit/research/interview-settings` | `/api/recruit/research/interview-settings` | `research` | `requireAdmin` (Domain-Isolated) | Upserts recruiter interview window configuration (offered slots array, skip days array) into `interview_settings` table with conflict resolution (`ON CONFLICT(id) DO UPDATE`). |
| 84 | `POST` | `/recruit/research/webhook-test` | `/api/recruit/research/webhook-test` | `research` | `requireAdmin` (Domain-Isolated) | Dispatches a diagnostic test notification from the recruiter research subsystem to the caller's admin email. |

---

## 3. Frontend Architecture & Curatorial Design System

### 3.1 Multi-Page Architecture (MPA) & Vite Bundler
The frontend is built as a Multi-Page Application (MPA) bundled by Vite (`frontend/vite.config.js`):
- **Root**: `frontend/`
- **Output Directory**: `frontend/dist/`
- **Rollup Input Configuration**: Configures exactly 13 distinct HTML entry points:
  1. `index.html` — Curatorial homepage, hero showcase, live notices, vitrine slider.
  2. `login.html` — Curatorial luxury authentication with 50/50 segmented toggle and Google 1-Tap GIS.
  3. `register.html` — Standalone registration entrypoint (backward-compatible).
  4. `reset.html` — Password recovery and reset interface.
  5. `dashboard.html` — Member portal (RSVP status, club memberships, profile management).
  6. `admin.html` — Administrative management console.
  7. `blogs.html` — Curated journal and essay archives.
  8. `post.html` — Single article reader with typographical hierarchy.
  9. `exhibition.html` — Exhibition portal & portfolio submission.
  10. `submit.html` — Creative vault member submissions.
  11. `recruit.html` — Candidate assessment & behavioral journey (**Domain Isolated**).
  12. `research.html` — Recruiter research & analytics dossier (**Domain Isolated**).
  13. `tchandervar/index.html` — Commercial-curatorial art offshoot portal.

### 3.2 Client Script Architecture
- **`frontend/global.js`**:
  - Global Configuration: Dynamically resolves `ALFAAZ_API_URL`, Turnstile sitekeys, Cloudinary presets, and Google Client ID.
  - API Fetch Wrapper: `window.globalApiFetch` attaches `Authorization: Bearer <token>`, handles errors, and auto-redirects 401 Unauthorized responses to `/login.html` (except when already on auth routes).
  - PWA Registration: Registers `/sw.js` and listens for offline transitions.
  - Bilingual Typography Cycle: Staggered cycle alternating English and Kashmiri/Urdu phrases.
  - Iconography: Manages Lucide icon lifecycle via `window.refreshGlobalEffects()`.
- **`frontend/src/login.js`**:
  - Powers both `login.html` and `register.html`.
  - Manages equal-sized segmented button toggle (`setAuthMode('login' | 'register')`).
  - Google Identity Services (GIS): Renders Google One-Tap and Google Sign-In button via `window.google.accounts.id.renderButton` with clean container reset preventing iframe memory leaks.
  - Third-Party Providers: Visually gates unconfigured providers (Apple ID, Meta) with `"Coming Soon"` badges and descriptive tooltips.
  - Turnstile Widget: Renders explicit challenge widgets and resets on submission error.
  - Contact Verification Transitions: Prompts unverified users to verify email or phone.
- **`frontend/src/dashboard.js`**:
  - Displays real-time event RSVPs, club memberships, and exhibition submission statuses.
  - Manages contact cross-verification modals, dispatching 6-digit verification codes and handling countdown timers.
- **`frontend/src/admin.js`**:
  - Tabbed administrative interface: Event management, circle application approvals, exhibition curation, user account directory, and system telemetry diagnostics.

### 3.3 Domain-Isolated Recruitment & Psychometric Research Boundary (Rule 8)
In strict accordance with `AGENTS.md` Rule 8, candidate recruitment (`frontend/recruit.html`, `frontend/src/recruit.js`, `frontend/src/recruit_games/**`) and psychometric research analytics (`frontend/research.html`, `frontend/src/research.js`) are insulated from cross-cutting UI refactoring.
- **Telemetry Battery (14 Minigames)**:
  - `the_archive.js`: Classification, taxonomy, and structural attention.
  - `the_broken_tool.js`: Creative problem-solving under constrained rules.
  - `the_frequency.js`: Rhythm, latency, and temporal coordination.
  - `the_hidden_gallery.js`: Visual search, spatial memory, and exploration breadth.
  - `the_repetition.js`: Cadence, endurance, and quality consistency.
  - `the_shared_canvas.js`: Collaborative space allocation and conflict avoidance.
  - `the_shifting_grid.js`: Cognitive flexibility and set-shifting agility.
- **Mathematical Invariant**: Precision scoring is computed strictly as:
  $$\text{Precision} = \frac{TP}{TP + FP}$$
  evaluating true exceptions against clean controls, enforcing $N \ge \text{min\_obs}$ before asserting high confidence.
- **Latin Square Counterbalancing**: Minigame sequences are assigned via a 14-order Latin Square matrix (`LATIN_SQUARE_14`) to eliminate order effects and fatigue bias.

### 3.4 Curatorial Design System & Visual Tokens
The visual identity adheres to a brutalist editorial palette defined in `frontend/global.css`:
- **Color Palette Tokens**:
  - Background Primary: Warm paper ivory (`--bg-primary: #f4f1ea`).
  - Background Secondary: Pure white paper (`--bg-secondary: #ffffff`).
  - Background Overlay: Semi-transparent ivory (`--bg-overlay: rgba(244, 241, 234, 0.85)`).
  - Text Primary: Deep charcoal ink (`--text-primary: #2d312e`).
  - Text Secondary: Muted ink (`--text-secondary: #626764`).
  - Accent Gold: Terracotta / antique gold (`--accent-gold: #bd6f5d`).
  - Accent Green: Pine green (`--accent-green: #7a8f7c`).
  - Accent Red: Brick red (`--accent-red: #c96b65`).
  - **High-Contrast Text Variants (Passes WCAG AA >= 4.5:1 on `#f4f1ea`)**:
    - `--accent-gold-text: #964e3d;`
    - `--accent-green-text: #456247;`
    - `--accent-red-text: #9e3d36;`
  - Grid Borders: Thin architectural borders (`--grid-border: rgba(45, 49, 46, 0.12)`).
- **Typography Tokens**:
  - Headings: `'Alegreya', serif` (scholarly, literary, contemplative).
  - Body & Data Labels: `'Alegreya Sans', sans-serif` (humanist, legible).
  - Kashmiri / Urdu: `'Noto Nastaliq Urdu', serif` (authentic Nastaliq calligraphy).
- **Tactile Paper Experience**:
  - Fixed SVG fractal noise layer in `body::after` simulating handcrafted khadi paper.
  - Zero/minimal border-radius (`0` to `4px` maximum) across cards, inputs, and buttons.
  - Total absence of modern SaaS tropes: no bubbly floating pill buttons, no neon gradients, no generic blues.

### 3.5 Offline Resilience & Progressive Web App (PWA)
- **Service Worker (`frontend/public/sw.js`)**:
  - Pre-caches 28 critical assets during install:
    - Root Shell: `/`, `/index.html`, `/offline.html`, `/manifest.webmanifest`, `/images/favicon.ico`.
    - 12 HTML Pages: `/blogs.html`, `/dashboard.html`, `/exhibition.html`, `/login.html`, `/post.html`, `/register.html`, `/reset.html`, `/submit.html`, `/admin.html`, `/recruit.html`, `/research.html`, `/tchandervar/index.html`.
    - PWA Icons: `/images/icons/icon-192.png`, `/images/icons/icon-512.png`, `/images/icons/maskable-512.png`.
    - Curatorial Gallery Sliders: `/images/slider-1.jpg` through `/images/slider-8.jpg`.
  - Cache Strategy: Network-first with offline fallback to cached resources or `/offline.html`.

---

## 4. Database Architecture & Cloudflare D1 Relational Engine

### 4.1 Cloudflare D1 SQLite Mechanics
Cloudflare D1 runs SQLite at the edge, offering fast reads with serialized single-writer transactions.
- **Concurrency & Race Conditions**: D1 serializes writes. To prevent race conditions during high-concurrency bursts (e.g., simultaneous interview slot bookings or event RSVPs), write operations utilize atomic conditional queries (`INSERT INTO ... SELECT ... WHERE NOT EXISTS (...)`).
- **Foreign Key Enforcement**: Enforced via `PRAGMA foreign_keys = ON;`.

### 4.2 Non-Destructive 12-Step Table Rebuild Procedure (Rule 6)
Because SQLite does not support modifying column constraints, nullability, or types in-place, all schema migrations modifying existing tables strictly follow the non-destructive 12-step table rebuild procedure:
1. `PRAGMA foreign_keys = OFF;`
2. Drop stale temporary table if exists (`DROP TABLE IF EXISTS users_new;`).
3. Create replacement schema (`CREATE TABLE users_new (...);`).
4. Copy existing data (`INSERT INTO users_new SELECT ... FROM users;`).
5. Drop original table (`DROP TABLE users;`).
6. Rename new table to canonical name (`ALTER TABLE users_new RENAME TO users;`).
7. Recreate indexes on the rebuilt table.
8. Execute foreign key integrity check (`PRAGMA foreign_key_check;`).
9. Re-enable foreign key constraints (`PRAGMA foreign_keys = ON;`).

### 4.3 Migration History
1. `0001_initial_schema.sql` (14.5 KB): Establishes 20 core tables (users, blogs, events, event_registrations, exhibitions_list, exhibition_applications, submissions, admin_audit_logs, consumed_tokens, recruit_sessions, applicant_identities, consent_records, sjt_responses, telemetry_events, features, game_scores, evidence, interview_bookings, interview_settings, data_quality_flags).
2. `0002_federated_auth.sql` (2.5 KB): Rebuilds `users` table to make `password` nullable, adds `phone TEXT UNIQUE`, `auth_provider TEXT DEFAULT 'email'`, and `firebase_uid TEXT UNIQUE`. Provisions `otp_velocity_logs` table with composite indices on `(phone, created_at DESC)` and `(ip, created_at DESC)`.
3. `0003_contact_verification.sql` (2.7 KB): Rebuilds `users` table to add `email_verified`, `phone_verified`, `email_verified_at`, and `phone_verified_at`. Provisions `verification_codes` table with indices on `(user_id, purpose, created_at DESC)`.
4. `0004_exhibition_age_toggle.sql` (0.4 KB): Adds `require_over_18 INTEGER NOT NULL DEFAULT 1` to `exhibitions_list` allowing administrators to toggle age requirements for adult vs. youth exhibition cycles.
5. `0005_drop_otp_velocity.sql` (0.3 KB): Drops decommissioned `otp_velocity_logs` table and its composite indices `idx_otp_velocity_phone` and `idx_otp_velocity_ip`.

---

### 4.4 Comprehensive Database Table Catalog (27 Active Tables)

| # | Table Name | Columns & Constraints | Purpose & Operational Role |
|---|---|---|---|
| 1 | `users` | `id` (INTEGER PK), `email` (TEXT UQ), `password` (TEXT NULL), `full_name` (TEXT), `phone` (TEXT UQ), `firebase_uid` (TEXT UQ), `status` (TEXT), `auth_provider` (TEXT), `email_verified` (INT), `phone_verified` (INT), `password_reset_at` (INT) | Primary identity and authentication table. Accommodates both password and federated users. |
| 2 | `consumed_tokens` | `token_hash` (TEXT PK), `consumed_at` (DATETIME), `expires_at` (DATETIME) | Replay protection ledger for single-use password reset tokens. |
| 3 | `verification_codes` | `id` (INTEGER PK), `user_id` (INTEGER FK), `purpose` (TEXT), `target` (TEXT), `code_hash` (TEXT), `attempts` (INTEGER), `expires_at` (INTEGER), `consumed_at` (INTEGER) | Contact cross-verification OTP store for email (and future phone verification). |
| 4 | `otp_velocity_logs` | *(Dropped in 0005)* | Decommissioned 2026-11-03 per `AGENTS.md §3`. Historical rate-limiting ledger. |
| 5 | `admin_audit_logs` | `id` (INTEGER PK), `admin_email` (TEXT), `action` (TEXT), `target_type` (TEXT), `target_id` (TEXT), `details` (TEXT), `created_at` (DATETIME) | Immutable security audit trail recording all administrative operations. |
| 6 | `blogs` | `id` (INTEGER PK), `title` (TEXT), `excerpt` (TEXT), `content` (TEXT), `cover_image` (TEXT), `is_published` (INTEGER), `created_at` (DATETIME) | Curated journal essays, literary reflections, and autonomous AI publications. |
| 7 | `club_applications` | `id` (INTEGER PK), `user_email` (TEXT), `club_name` (TEXT), `status` (TEXT), `note` (TEXT), `admin_note` (TEXT), `created_at` (DATETIME), `UQ(user_email, club_name)` | Collective circles membership applications across 5 disciplines. |
| 8 | `events` | `id` (INTEGER PK), `name` (TEXT), `description` (TEXT), `event_date` (DATETIME), `registration_open` (INTEGER), `capacity` (INTEGER), `created_at` (DATETIME) | Community gatherings, poetry readings, and workshop schedules. |
| 9 | `event_registrations` | `id` (INTEGER PK), `event_id` (INTEGER FK), `user_email` (TEXT), `whatsapp_number` (TEXT), `created_at` (DATETIME), `UQ(event_id, user_email)` | RSVP attendance records with strict capacity enforcement. |
| 10 | `exhibitions_list` | `id` (INTEGER PK), `title` (TEXT UQ), `date_text` (TEXT), `venue` (TEXT), `about_text` (TEXT), `is_active` (INTEGER), `require_over_18` (INTEGER), `registration_fee` (INTEGER) | Master exhibition cycle configurations. |
| 11 | `exhibition_applications` | `id` (INTEGER PK), `user_email` (TEXT), `exhibition_cycle` (TEXT), `full_name` (TEXT), `age` (INTEGER), `genre` (TEXT), `medium` (TEXT), `portfolio_url` (TEXT), `status` (TEXT), `payment_proof_url` (TEXT) | Artist portfolio submissions and curatorial review workflows. |
| 12 | `submissions` | `id` (INTEGER PK), `submission_type` (TEXT), `title` (TEXT), `file_url` (TEXT), `note` (TEXT), `author_email` (TEXT), `created_at` (DATETIME) | Member artwork vault submissions stored in R2 or Cloudinary. |
| 13 | `recruit_sessions` | `session_id` (TEXT PK), `status` (TEXT), `current_screen` (TEXT), `spec_version` (TEXT), `scoring_version` (TEXT), `completed_at` (DATETIME) | Recruitment assessment lifecycle state machine (**Domain Isolated**). |
| 14 | `applicant_identities` | `session_id` (TEXT PK, FK), `full_name` (TEXT), `email` (TEXT), `phone_or_contact` (TEXT), `linkedin_url` (TEXT) | Candidate PII records segregated from anonymous telemetry. |
| 15 | `consent_records` | `id` (INTEGER PK), `session_id` (TEXT UQ, FK), `consent_text_version` (TEXT), `choices_json` (TEXT), `confirmed_18_plus` (INTEGER) | Affirmative research consent and 18+ age verification records. |
| 16 | `accessibility_profiles` | `session_id` (TEXT PK, FK), `modes_enabled_json` (TEXT), `updated_at` (DATETIME) | Candidate accessibility accommodation settings. |
| 17 | `warmup_baselines` | `session_id` (TEXT PK, FK), `tap_latency_baseline_ms` (REAL), `movement_speed_baseline` (REAL), `pointer_type` (TEXT) | Motor control baselines for telemetry latency normalization. |
| 18 | `task_assignments` | `session_id` (TEXT PK, FK), `world_order_id` (INTEGER), `world_sequence_json` (TEXT), `seeds_json` (TEXT) | Latin Square counterbalanced minigame allocation. |
| 19 | `sjt_responses` | `id` (INTEGER PK), `session_id` (TEXT FK), `scenario_id` (TEXT), `option_id` (TEXT), `t_ms` (INTEGER), `UQ(session_id, scenario_id)` | Situational Judgment Test responses and decision latencies. |
| 20 | `telemetry_events` | `id` (INTEGER PK), `session_id` (TEXT FK), `seq` (INTEGER), `screen` (TEXT), `mini_game` (TEXT), `action` (TEXT), `state_json` (TEXT), `data_json` (TEXT), `UQ(session_id, seq)` | High-frequency telemetry stream from behavioral minigames. |
| 21 | `features` | `id` (INTEGER PK), `session_id` (TEXT FK), `mini_game` (TEXT), `feature_name` (TEXT), `value_raw` (REAL), `value_adjusted` (REAL), `UQ(session_id, mini_game, feature_name)` | Normalized psychometric features extracted from telemetry. |
| 22 | `game_scores` | `id` (INTEGER PK), `session_id` (TEXT FK), `game_id` (TEXT), `parameter` (TEXT), `relative_score` (REAL), `band` (TEXT), `status` (TEXT), `UQ(session_id, game_id)` | Calibrated minigame construct scores. |
| 23 | `evidence` | `id` (INTEGER PK), `session_id` (TEXT FK), `parameter` (TEXT), `version` (TEXT), `sjt_relative` (REAL), `game_relative` (REAL), `confidence` (REAL), `UQ(session_id, parameter, version)` | Unified evidence across 7 core dimensions. |
| 24 | `data_quality_flags` | `id` (INTEGER PK), `session_id` (TEXT FK), `scope` (TEXT), `flag` (TEXT), `detail` (TEXT), `created_at` (DATETIME) | Data integrity, outlier flags, and behavioral anomaly markers. |
| 25 | `volunteer_outcomes` | `id` (INTEGER PK), `session_id` (TEXT FK), `outcome_type` (TEXT), `value` (TEXT), `recorded_at` (DATETIME), `recorded_by` (TEXT) | Post-interview outcome ratings and recruiter evaluations. |
| 26 | `recruiter_access_logs` | `id` (INTEGER PK), `admin_email` (TEXT), `session_id` (TEXT FK), `viewed_at` (DATETIME), `ip_address` (TEXT) | Audit log recording recruiter access to candidate dossiers. |
| 27 | `interview_bookings` | `id` (INTEGER PK), `session_id` (TEXT UQ, FK), `candidate_name` (TEXT), `candidate_email` (TEXT), `slot_date` (TEXT), `slot_time` (TEXT), `UQ(slot_date, slot_time)` | Candidate interview slot reservations with double-booking prevention. |
| 28 | `interview_settings` | `id INTEGER PRIMARY KEY AUTOINCREMENT`, `slots_json TEXT NOT NULL`, `skip_days_json TEXT NOT NULL`, `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP` | Configuration ledger storing available candidate interview time slots and blackout calendar dates for recruitment scheduling (queried and updated by `routes/research.ts`). |

---

## 5. Infrastructure & Cloudflare Platform Bindings

### 5.1 Platform Configuration (`wrangler.jsonc`)
The Cloudflare platform settings establish edge bindings, cron schedules, and static asset handling:
```jsonc
{
  "name": "alfaaz-cloudflare-native",
  "main": "backend/src/index.ts",
  "compatibility_date": "2024-11-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./frontend/dist",
    "binding": "ASSETS",
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "404-page"
  },
  "routes": [
    { "pattern": "alfaazcollective.org", "custom_domain": true },
    { "pattern": "www.alfaazcollective.org", "custom_domain": true },
    { "pattern": "tch.alfaazcollective.org", "custom_domain": true }
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "alfaaz-d1",
      "database_id": "28a3ae5b-4d30-4e04-8c95-d764588e72f5",
      "migrations_dir": "database/migrations"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CACHE_KV",
      "id": "a199adbc0269462b9227f908a80025e2"
    }
  ],
  "r2_buckets": [
    {
      "binding": "VAULT_BUCKET",
      "bucket_name": "alfaaz-vault"
    }
  ],
  "triggers": {
    "crons": ["0 10 * * SUN"]
  },
  "vars": {
    "ENV": "production",
    "FRONTEND_URL": "https://alfaazcollective.org",
    "EMAIL_PROVIDER": "webhook"
  }
}
```

### 5.2 Storage & Binding Roles
1. **D1 Relational Database (`DB`)**:
   - Master relational datastore for user accounts, events, exhibitions, recruitment telemetry, and audit logs.
2. **R2 Object Storage (`VAULT_BUCKET`)**:
   - S3-compatible, zero-egress fee object storage bucket (`alfaaz-vault`).
   - Stores member vault portfolio files (`vault/${timestamp}-${filename}`).
   - Direct public bucket access is disabled; files are streamed via `GET /vault/file/:key` after verifying ownership and forcing `Content-Disposition: attachment` on HTML/SVG files to prevent stored XSS attacks.
3. **Workers KV Namespace (`CACHE_KV`)**:
   - High-throughput key-value store caching the public notices feed (`notices_feed`) for sub-millisecond edge read latency.
   - Automatically invalidated upon publication of new blog articles or exhibition updates.
4. **Static Asset Fetcher (`ASSETS`)**:
   - Binds the Cloudflare Worker directly to the compiled Vite output directory (`./frontend/dist`). Serves static HTML, CSS, JavaScript, and images directly from edge cache.
5. **Scheduled Triggers (Crons)**:
   - Configured for `0 10 * * SUN` (Sundays at 10:00 UTC) to invoke the autonomous curator essay generation service.

---

## 6. Third-Party Dependencies, External Services & CDNs

### 6.1 Root Dependencies (`package.json`)
- **Runtime Dependencies**:
  - `hono` (`^4.6.14`): Cloudflare-native web framework providing routing, context management, and middleware composition.
- **Development & Verification Dependencies**:
  - `@cloudflare/workers-types` (`^4.20241101.0`): Static TypeScript definitions for Workers runtime, D1, R2, KV, and Fetcher bindings.
  - `typescript` (`^5.7.2`): Static type checker enforcing compilation standards across backend routes, services, and tests (`npm run typecheck`).
  - `vitest` (`^2.1.8`): Modern ESM test runner executing 255 automated unit and integration tests (`npm test`).
  - `wrangler` (`^4.154.0`): Official Cloudflare CLI for local development emulation, migration execution, and production deployment.

### 6.2 Frontend Dependencies (`frontend/package.json`)
- **Runtime Dependencies**:
  - `lucide` (`^1.28.0`): Minimalist SVG iconography library matching curatorial editorial aesthetics.
- **Development Dependencies**:
  - `vite` (`^5.0.0`): Multi-page bundler and local development server.
  - `tailwindcss` (`^4.3.3`): Utility-first CSS framework providing structural layout classes.
  - `postcss` (`^8.5.25`) & `autoprefixer` (`^10.5.4`): CSS post-processing pipeline ensuring cross-browser compatibility.

### 6.3 External Cloud Services & CDNs
1. **Google Identity Services (GIS)** (`https://accounts.google.com/gsi/client`):
   - Delivers Google One-Tap and Google Sign-In prompt. ID tokens are cryptographically verified by the Worker using Web Crypto RS256 against Google's public JWKs. Replaces deprecated Firebase Auth.
2. **Cloudflare Turnstile** (`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`):
   - Delivers frictionless bot protection without user-facing CAPTCHAs. Sitekey: `0x4AAAAAAFsRHzhKR6YGsXSy` (production); `1x00000000000000000000AA` (dev/test dummy key).
3. **Google Fonts** (`https://fonts.googleapis.com` & `https://fonts.gstatic.com`):
   - Delivers typographic web fonts: Alegreya serif, Alegreya Sans, and Noto Nastaliq Urdu.
4. **Lucide CDN** (`https://unpkg.com/lucide@1.66.0/dist/umd/lucide.min.js`):
   - Fallback CDN script tag for static HTML pages.
5. **Cloudinary** (`res.cloudinary.com` / `api.cloudinary.com`):
   - External media preset used for artist portfolio submissions and gallery vitrines.
6. **Twilio**:
   - Decommissioned on 2026-11-03 per `AGENTS.md §3`; documented future capability for SMS verification.
7. **Make.com**:
   - Webhook automation target for transactional email notifications.
8. **Google Gemini API & Groq API**:
   - Generative AI endpoints powering autonomous curator essays (`gemini-2.5-flash` and `llama-3.3-70b-versatile`).

---

## 7. Comprehensive Architectural Rationale & Trade-Offs Matrix

| Component / Layer | Technology Chosen | Why Chosen (Architectural Intent) | System Role | Architectural Trade-offs & Mitigations |
|---|---|---|---|---|
| **Runtime Environment** | Cloudflare Workers (V8 Isolates) | Global edge execution, 0ms cold starts, instant scaling, and edge-native D1/R2 bindings. | Executes all API routing, security checks, and database queries. | **Trade-off**: Node.js C++ addons and filesystem `fs` unavailable. **Mitigation**: Pure W3C Web Crypto (`crypto.subtle`) implementation. |
| **Routing Framework** | Hono (`v4.6.14`) | Sub-millisecond routing overhead, zero external dependencies, native Web Standards support. | Governs route dispatch, middleware chain, and dual-mount aliasing. | **Trade-off**: Middleware ecosystem is edge-specific. **Mitigation**: Clean, self-contained custom middleware. |
| **Database Engine** | Cloudflare D1 (SQLite) | Distributed relational database at the edge, ACID compliance, zero infrastructure management. | Master persistent store for 27 relational tables. | **Trade-off**: Serialized single-writer and limited `ALTER TABLE`. **Mitigation**: Atomic conditional SQL and 12-step rebuild migrations. |
| **Object Storage** | Cloudflare R2 (`alfaaz-vault`) | S3-compatible object storage with zero egress fees and native Workers binding. | Archives member creative submissions and exhibition portfolios. | **Trade-off**: Private bucket requires custom stream proxy. **Mitigation**: `GET /vault/file/:key` with ownership verification and anti-XSS headers. |
| **Edge Cache** | Cloudflare KV (`CACHE_KV`) | Global key-value cache with sub-millisecond edge read latency. | Caches public notices feed (`notices_feed`) for hero ticker. | **Trade-off**: Eventual consistency on writes. **Mitigation**: Explicit cache invalidation upon publishing new content. |
| **Static Delivery** | Cloudflare Workers `ASSETS` | Serves compiled Vite assets directly from Cloudflare PoPs without external origins. | Delivers all 13 HTML pages, CSS, scripts, and gallery media. | **Trade-off**: Assets must be pre-compiled into `frontend/dist`. **Mitigation**: Integrated Vite multi-page build script. |
| **Frontend Architecture** | Multi-Page Application (MPA) via Vite | SEO-optimized static entry points, progressive enhancement, fast initial page load. | Serves 13 distinct user workflows (landing, auth, admin, exhibitions, recruit). | **Trade-off**: Navigation involves page loads. **Mitigation**: Precached PWA service worker (`sw.js`) and shared CSS cache. |
| **Authentication Strategy** | Google Identity Services (GIS) + Sovereign PBKDF2/JWT | Eliminates third-party vendor lock-in (Firebase decommissioned); maintains sovereign control of user tokens. | Manages user identity, session issuance, and contact verification. | **Trade-off**: Requires in-house token verifiers. **Mitigation**: RS256 Web Crypto verifier with automated Google JWKS caching. |
| **Design System** | Brutalist Editorial Curatorial Tokens | Warm paper ivory (`#f4f1ea`), deep ink (`#2d312e`), antique gold (`#bd6f5d`), and Kashmiri Nastaliq typography. | Reflects Kashmiri literary dignity and avoids generic SaaS tropes. | **Trade-off**: Custom styling requires strict discipline. **Mitigation**: Global tokens in `global.css` and zero border-radius invariants. |
| **Bot Mitigation** | Cloudflare Turnstile | Frictionless, privacy-preserving bot detection without hostile image puzzles. | Protects registration, login, and sensitive mutation endpoints from abuse. | **Trade-off**: Requires external client challenge. **Mitigation**: Fail-closed server verification with dev bypass guards. |

---

## 8. Security Audit, Invariants & Secret Redaction

### 8.1 Secret Redaction Invariant (`AGENTS.md` Rule 1)
All secrets, signing tokens, private keys, and passwords across Alfaaz Collective documentation and code are strictly redacted.
- **Invariant**: Plaintext high-entropy literals, API keys, or passwords must never appear in documentation, commit logs, or pull request descriptions.
- **Standard Redaction Format**: `<redacted — rotated YYYY-MM-DD>`.
- **Verified References**:
  - `JWT_SECRET`: `<redacted — rotated 2026-10-31>` (`backend/src/auth/crypto.ts:17`)
  - `TURNSTILE_SECRET_KEY`: `<redacted — rotated 2026-10-31>` (`backend/src/middleware/rate_limit.ts:54`)
  - `CURATOR_SECRET_TOKEN`: `<redacted — rotated 2026-10-31>` (`backend/src/routes/blogs.ts:47`)
  - `GEMINI_API_KEY`: `<redacted — rotated 2026-10-31>` (`backend/src/services/curator.ts:25`)
  - `GROQ_API_KEY`: `<redacted — rotated 2026-10-31>` (`backend/src/services/curator.ts:60`)
  - `TWILIO_AUTH_TOKEN`: `<redacted — rotated 2026-10-31>` (Historical — decommissioned 2026-11-03)

### 8.2 Static Security Guard Verification
Automated test suite `tests/security_seed.test.ts` scans all documentation, scripts, configuration files, and source code on every test run:
1. Asserts zero occurrences of unauthorized remote seed commands (`d1 execute.*--remote.*seed`) in `docs/`, `scripts/`, or `package.json`.
2. Asserts zero hardcoded production passwords in `scripts/bootstrap-admin.js`.
3. Scans all files for unredacted high-entropy API key patterns (`AIzaSy...`, `gsk_...`), requiring explicit `<redacted` tags.

### 8.3 Fail-Closed Defensive Controls
- **Turnstile Verification**: In production mode (`ENV === 'production'`), any missing `TURNSTILE_SECRET_KEY`, unconfigured secret, or dummy pass key triggers an immediate `403 Forbidden` (`[TURNSTILE] Critical: TURNSTILE_SECRET_KEY not configured... failing closed`).
- **Audience & Email Verification**: Federated login strictly fails closed if `payload.aud !== GOOGLE_CLIENT_ID` or if `email_verified !== true`.
- **Database Concurrency Protection**: High-contention operations (interview bookings, event RSVPs, club memberships) enforce database-level `UNIQUE` constraints and conditional SQL, rejecting conflicting writes with `409 Conflict`.

---

## 9. Repository Maintenance, Pruning & Boundary Rules

### 9.1 Pruning Candidates (Safe for Removal)
The following files and directories are obsolete scratch files, superseded logs, or empty folders identified for removal in Milestone 2:
1. `docs/audits/cloudflare-full-system-audit.md` (61.3 KB, 719 lines — superseded early audit snapshot).
2. `docs/audits/final-system-audit.md` (60.2 KB, 664 lines — superseded audit snapshot).
3. `docs/audits/final-system-audit-qoder-2026-10-29.md` (105.8 KB, 1,155 lines — obsolete external CLI snapshot).
4. `docs/audits/final-review-delta-2026-10-30.md` (27.7 KB, 333 lines — superseded delta log).
5. `TEST_READY.md` (9.5 KB, 162 lines — obsolete milestone receipt).
6. `frontend/src/content/` (empty directory, 0 bytes).
7. `backend/src/database/` (empty directory, 0 bytes).
8. `backend/tests/` (empty directory, 0 bytes; all tests reside in root `tests/`).
9. `frontend/dist/` (build output, regenerable via `npm run build`).

### 9.2 Core Project Documentation (MUST PRESERVE)
The following 11 core documentation files define the system's operational architecture and deployment standards:
1. `AGENTS.md` (Root) — Core system rules, invariants, secret redaction, and Rule 8 domain boundaries.
2. `PROJECT.md` (Root) — Master architectural specification, feature inventory, and milestone contracts.
3. `README.md` (Root) — Repository entrance, quickstart guide, topology map, and documentation index.
4. `TEST_INFRA.md` (Root) — Vitest test architecture, 5-principle test strategy, and test tier definitions.
5. `SYSTEM_AUDIT.md` (Root) — This comprehensive system architecture and dependency specification.
6. `docs/ARCHITECTURE.md` — Detailed edge topology, Workers V8 isolates, and D1/R2/KV interactions.
7. `docs/BEGINNER_DEPLOYMENT_GUIDE.md` — Step-by-step onboarding for local Wrangler and Cloudflare deployments.
8. `docs/DATABASE_MIGRATION.md` — D1 SQLite schema, 12-step rebuild procedures, and constraint catalogs.
9. `docs/FEATURE_PARITY_MATRIX.md` — Exhaustive matrix comparing all 45 legacy endpoints against Cloudflare implementations.
10. `docs/FREE_TIER_COSTS_AND_LIMITS.md` — Cloudflare free tier quota modeling and rate-limit policies.
11. `docs/SECURITY_REVIEW.md` — Threat models, Web Crypto PBKDF2/JWT lifecycle, Turnstile mitigations, and CSP.

### 9.3 Domain-Isolated Subsystem Preservation (Rule 8)
Under no circumstances may any automated sweeper or refactoring process alter the domain-isolated recruitment and psychometric research files:
- **Frontend Files**: `frontend/recruit.html`, `frontend/research.html`, `frontend/src/recruit.js`, `frontend/src/research.js`, `frontend/src/recruit-utilities.css`, `frontend/src/recruit_games/**` (all 7 minigames).
- **Backend Files**: `backend/src/routes/recruit.ts`, `backend/src/routes/research.ts`, `backend/src/services/world_order.ts`, `backend/src/services/sjt.ts`, `backend/src/services/telemetry.ts`, `backend/src/services/evidence.ts`, `backend/src/services/features.ts`, `backend/src/services/descriptive_task_record.ts`, `backend/src/config/parameters.json`, `backend/src/config/sjt_items.json`.
- **Database Tables**: `recruit_sessions`, `consent_records`, `sjt_responses`, `telemetry_events`, `evidence`, `interview_bookings`, `task_assignments`, `minigame_results`.
- **Verification Suites**: `tests/sjt_scoring.test.ts`, `tests/telemetry_evidence.test.ts`, `scripts/verify_challenger_2.mjs`.

### 9.4 Build Dependency Safeguards
- **`frontend/tchandervar/images/`**: Contains 53 image files referenced by relative URLs inside `frontend/tchandervar/index.html`. It is an active build-time dependency for Vite and must **never** be deleted.
- **`backend/src/notifications/sms.ts`**: Delivers telephone cross-verification OTPs (`POST /verification/phone/send`) and is verified by `tests/verification_roster.test.ts`. It is **not** dead code and must be preserved.
- **`scripts/bootstrap-admin.js`**: Dynamically imported by `tests/security_seed.test.ts` and executed by `npm run bootstrap:admin`. Must be preserved.
- **`scripts/verify_challenger_2.mjs`**: Executed by `npm run test:hardening` to verify 16,384 SJT combinatorial profiles. Must be preserved.
