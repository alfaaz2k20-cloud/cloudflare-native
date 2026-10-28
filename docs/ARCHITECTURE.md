# Alfaaz Collective: Cloudflare-Native Architecture Specification

**System Version:** 2.0.0 (Cloudflare-Native)  
**Date:** October 2026  
**Runtime:** Cloudflare Workers (V8 Isolates) + Hono (TypeScript)  
**Data Layer:** Cloudflare D1 (SQLite) + Cloudflare R2 + Workers KV + Cloudflare Turnstile  

---

## 1. High-Level Architectural Topology

```
+-----------------------------------------------------------------------------------+
|                           CLOUDFLARE GLOBAL EDGE NETWORK                          |
|                                                                                   |
|  [ Inbound Visitor / Member / Recruiter / Admin Requests ]                       |
|                             |                                                     |
|                             v                                                     |
|             +-------------------------------+                                     |
|             |   Cloudflare Edge Router      |                                     |
|             |   (SSL/TLS, DDoS, WAF, DNS)   |                                     |
|             +---------------+---------------+                                     |
|                             |                                                     |
|       +---------------------+---------------------+                               |
|       |                                           |                               |
|       v                                           v                               |
|  [ Static Asset Request ]                [ API / Subsystem Request ]              |
|  (/, /login.html, /recruit.html,         (/auth/*, /events/*, /exhibitions/*,     |
|   /admin.html, /assets/*)                 /vault/*, /blogs/*, /recruit/*)         |
|       |                                           |                               |
|       v                                           v                               |
|  +-----------------------------+         +-------------------------------+        |
|  |   Workers Static Assets     |         |     Cloudflare Worker Core    |        |
|  |   (./frontend/dist)         |         |     Hono Router (TypeScript)  |        |
|  +-----------------------------+         +---------------+---------------+        |
|                                                          |                        |
|                     +------------------------------------+-----------+            |
|                     |                   |                |           |            |
|                     v                   v                v           v            |
|             +---------------+   +---------------+   +--------+  +---------+       |
|             | Cloudflare D1 |   | Cloudflare R2 |   | Workers|  |Turnstile|       |
|             |  (SQLite DB)  |   | (Vault Bucket)|   |   KV   |  | Captcha |       |
|             |   25 Tables   |   |   Artworks    |   | Notice |  | Rate-   |       |
|             |  Foreign Keys |   | Payment Proofs|   | Cache  |  | Limiter |       |
|             +---------------+   +---------------+   +--------+  +---------+       |
|                     |                                                             |
|                     +-------------------+                                         |
|                                         v                                         |
|                        [ External Provider Connectors ]                           |
|                        - Curator AI: Gemini REST / Groq                           |
|                        - Outbound Email: Make.com / Cloudflare Email              |
+-----------------------------------------------------------------------------------+
```

---

## 2. Key Architecture Differences: Original vs. Cloudflare-Native

| Capability | Legacy Architecture (Render + Vercel) | Cloudflare-Native Architecture |
| :--- | :--- | :--- |
| **Hosting Topology** | Dual-origin (Vercel for frontend/serverless + Render for FastAPI) | Single unified Worker with Static Assets (`assets: { directory: "./frontend/dist" }`) |
| **Cold Starts** | 50s-70s on Render Free Tier after inactivity | Zero cold starts (V8 isolates boot in <5ms) |
| **CORS Complexities** | Fragile cross-origin credential passing between Vercel & Render | Same-origin requests (`/api/*` and `/auth/*` on identical host) |
| **Relational Database** | PostgreSQL on Neon (external TCP connection pool) | Cloudflare D1 (embedded SQLite edge database, zero egress overhead) |
| **Concurrency / Locks** | Row-level locking via SQLAlchemy `with_for_update()` | D1 atomic serialized writes & batch execution (`c.env.DB.batch([...])`) |
| **Object Storage** | Cloudinary REST upload API | Cloudflare R2 S3-compatible bucket (`VAULT_BUCKET`), zero egress costs |
| **Edge Caching** | Vercel edge cache / manual headers | Workers KV (`CACHE_KV`) + native `Cache-Control` headers |
| **Password Hashing** | Python `passlib` / `bcrypt` native C binaries | Web Crypto API PBKDF2 (100,000 iterations, SHA-256) |
| **JWT Tokens** | Python `PyJWT` | Web Crypto API HMAC-SHA256 |
| **Bot Mitigation** | Custom in-memory IP counter dictionaries | Cloudflare Turnstile token validation + sliding-window edge rate limiters |

---

## 3. Storage Layer Design

### 3.1 Relational Storage (Cloudflare D1)
D1 provides a distributed SQLite relational database tightly coupled to Workers.
- **Foreign Key Constraints:** Explicitly enabled via `PRAGMA foreign_keys = ON;`.
- **Atomic State Transitions:** In D1, transactions spanning multiple operations use `db.batch([stmt1, stmt2])` which executes within a single atomic SQLite transaction.
- **Race Condition Prevention:**
  - Event RSVP capacity checks: Serialized read of current registrations vs event capacity within the transactional context.
  - Interview booking slots: Unique index constraints on `(slot_date, slot_time)` guarantee that simultaneous reservation requests for the same slot will result in one success and one SQL constraint violation handled cleanly as HTTP 409 Conflict.

### 3.2 Object Storage (Cloudflare R2)
- Bound under variable `VAULT_BUCKET`.
- Handles user-uploaded creative submissions (poems, essays, photographs, PDFs) and exhibition fee payment proof screenshots.
- Direct streaming through Worker endpoint `/vault/file/:key` with proper MIME detection, ETags, and client caching headers.

### 3.3 Ephemeral & Edge Cache (Workers KV)
- Bound under variable `CACHE_KV`.
- Used to cache dynamic notice board payloads (`notices_feed`) to minimize D1 read units on high-traffic landing page views.
- Automatically invalidated whenever events or exhibitions are updated or toggled by administrators.

---

## 4. Frontend Delivery via Workers Static Assets

Cloudflare Workers Static Assets hosts the pre-compiled Vite production bundle directly from `./frontend/dist`.

### Route Precedence & Fallback Rules:
1. When an incoming request matches a static asset file (e.g. `/index.html`, `/assets/index-D7A_gV6x.js`, `/global.css`, `/sw.js`), the Cloudflare edge serves the static asset directly with aggressive HTTP cache headers.
2. When an incoming request matches an API route (e.g. `/auth/*`, `/events/*`, `/clubs/*`, `/exhibitions/*`, `/vault/*`, `/blogs/*`, `/phantom/*`, `/admin/*`, `/recruit/*`, `/api/*`), the Hono Worker router intercepts and handles the request.
3. Extensionless navigations (e.g. `/recruit`, `/dashboard`, `/admin`) are resolved by the static asset routing configuration to their respective `.html` files.

---

## 5. Security & Cryptographic Subsystem

### 5.1 Zero-Dependency Password Hashing
- Utilizes the browser and isolate-native Web Crypto API (`crypto.subtle`).
- PBKDF2-HMAC-SHA256 with 100,000 iterations and a cryptographically secure 16-byte random salt generated via `crypto.getRandomValues()`.
- Resulting hash is stored in modular string format: `pbkdf2:sha256:100000:<salt_hex>:<hash_hex>`.
- Verification performs identical key derivation and constant-time string comparison.

### 5.2 Stateless HMAC-SHA256 JWT Authentication
- Issues signed JWT tokens using HMAC-SHA256 with a 7-day expiration window.
- Payload contains user identity: `{ email: string, role: "ADMIN" | "PARTICIPANT", iat: number, exp: number }`.
- Validated via `requireAuth` and `requireAdmin` middleware interceptors.

### 5.3 Turnstile Bot Protection
- Public endpoints (`/auth/register`, `/auth/forgot-password`, `/recruit/consent`) accept an optional Turnstile response token in header `cf-turnstile-response` or request body.
- When configured (`TURNSTILE_SECRET_KEY`), the Worker verifies the token with `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
- In development/local testing, if the secret is unconfigured or a test key is provided, the middleware transparently allows requests.

---

## 6. Recruitment Evaluation Subsystem Architecture

The recruitment subsystem (`/recruit`) is an isolated, 14-minigame psychometric and situational evaluation pipeline:
1. **Consent & Order Assignment (`/recruit/consent`):** Implements a 14-row Latin Square algorithm. Inspects current database order distribution, selects the least-represented sequence, and assigns deterministic random seeds.
2. **Pseudonymous Session:** Recruiter evaluation data is pseudonymous; candidate identity is decoupled in `applicant_identities`.
3. **Situational Judgment Test (`/recruit/sjt`):** 7 scenarios scored via an exact integer thirds scoring model across 7 behavioral constructs (Empathy, Conscientiousness, Collaborative Spirit, Emotional Agility, Curiosity, Creative Initiative, Motivation). Candidate-facing payload strips internal scoring keys.
4. **Streaming Behavioral Telemetry (`/recruit/telemetry`):** Collects client interactions in batches of up to 100 events, enforcing a strict 50,000-event per-session hard cap.
5. **Evidence Integration (`/recruit/complete`):** Computes cross-method delta between SJT integer thirds and behavioral game bands, generating final bands, relationship indicators, and confidence ratings.
6. **Recruiter Research Dossier (`/recruit/research`):** Admin-only view presenting candidates in chronological order. Prohibits sorting, ranking, or filtering by psychological evidence traits to eliminate discriminatory bias.
