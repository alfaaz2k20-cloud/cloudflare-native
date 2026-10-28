# Alfaaz Collective: Comprehensive Security Review & Threat Model

**Audit Date:** October 2026  
**System Target:** Cloudflare-Native Full-Stack (`cloudflare-native/`)  
**Security Status:** Pass with Operational Safeguards Documented  

---

## 1. Executive Summary

This security review evaluates the defensive posture of the Cloudflare-native reimplementation of Alfaaz Collective. By moving from a multi-cloud split architecture (Render + Vercel + Neon + Cloudinary) to an isolate-native topology (Cloudflare Workers + D1 + R2 + KV + Turnstile), the attack surface is significantly consolidated:
- **Zero Exposed Database Connection Strings:** Cloudflare D1 uses internal V8 binding calls rather than public TCP database endpoints (`postgresql://...`).
- **Elimination of Cross-Origin Credential Leaks:** Static assets and API endpoints are delivered from the exact same origin, eliminating wildcard CORS configurations.
- **Cryptographic Independence:** Replaces native binary C dependencies (`bcrypt`, `cryptography`) with the W3C Web Crypto API standard.

---

## 2. Threat Modeling & Mitigation Analysis

### 2.1 Credential & Authentication Security
- **Password Storage:** Passwords are never stored in plaintext. They are hashed using PBKDF2 (`PBKDF2-HMAC-SHA256`) with:
  - 100,000 key derivation iterations.
  - A cryptographically random 16-byte salt generated via `crypto.getRandomValues()`.
  - Stored format: `pbkdf2:sha256:100000:<salt_hex>:<hash_hex>`.
- **JWT Authentication:**
  - Standardized JSON Web Tokens (JWT) signed with HMAC-SHA256 using the runtime `JWT_SECRET`.
  - Expiration timestamp (`exp`) is enforced on every request.
  - Role-based authorization (`ADMIN` vs `PARTICIPANT`) is validated on protected routes via `requireAdmin` and `requireAuth`.
- **Administrative Protection:**
  - Self-purge prevention: Administrators cannot delete their own account.
  - Demotion prevention: The last remaining administrator account in the database cannot be demoted to `PARTICIPANT`.

### 2.2 Injection & Input Sanitization
- **SQL Injection:**
  - 100% of queries against Cloudflare D1 use parameterized prepared statements:
    ```typescript
    await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    ```
  - Dynamic string concatenation is strictly banned across all route modules.
- **Cross-Site Scripting (XSS):**
  - All user-submitted literary notes, exhibition notes, and portfolio URLs are bound as text parameters.
  - File URLs are validated to ensure they adhere to valid HTTP/HTTPS schemes or internal storage vault paths, preventing `javascript:` URI injection.

### 2.3 Recruitment Subsystem Ethical & Anti-Bias Protections
- **Anti-Sorting & Anti-Filtering Safeguard:**
  - The recruiter session list endpoint (`/recruit/research/sessions`) actively inspects all incoming query parameters.
  - Requests containing sorting or filtering parameters on psychometric traits (`band`, `parameter`, `confidence`, `relationship`, `score`, `sort`, `search`, `rank`, `fit`, `features`, `trait`) are rejected with HTTP 400 Bad Request.
  - Candidates are returned in strict chronological order of completion (`created_at DESC`).
- **Data Boundary Isolation:**
  - Candidate-facing endpoints (`/recruit/sjt/public`, `/recruit/sjt/submit`, `/recruit/complete`) never leak internal scoring keys, weights, construct definitions, or computed bands back to the client.
  - Telemetry streaming is pseudonymous and linked only to `session_id`.

### 2.4 Denial of Service & Abuse Mitigation
- **Streaming Telemetry Hard Caps:**
  - Maximum 100 events per request batch.
  - Hard cap of 50,000 total events per candidate session. Any attempt to flood telemetry returns HTTP 429.
- **Edge Rate Limiting:**
  - Sensitive endpoints (authentication, password resets, Curator AI, exhibition registrations) are protected by sliding-window rate limiters.
- **Cloudflare Turnstile:**
  - Integrated into `/auth/register`, `/auth/forgot-password`, and `/recruit/consent` to block automated bot submissions without intrusive user CAPTCHAs.

---

## 3. Secret Management & Zero Exposure Policy

### Rules Enforced:
1. **Zero Hardcoded Secrets:** `wrangler.jsonc` and all TypeScript source files contain no API keys, private tokens, or production passwords.
2. **Local Development Isolation:** All development secrets are placed exclusively in `.dev.vars` (which is included in `.gitignore` and never committed).
3. **Production Secret Provisioning:** In production, secrets must be registered using Cloudflare Wrangler encrypted secrets:
   ```bash
   wrangler secret put JWT_SECRET
   wrangler secret put PHANTOM_SECRET_TOKEN
   wrangler secret put TURNSTILE_SECRET_KEY
   wrangler secret put GEMINI_API_KEY
   wrangler secret put GROQ_API_KEY
   ```

---

## 4. Unresolved Manual Production Prerequisites

The following steps cannot and should not be automated and require administrator execution before going live in production:
1. **Cloudflare Account & Zone Setup:** The production domain (`alfaazcollective.org` or similar) must be added to a Cloudflare account with DNS routed through Cloudflare's proxy.
2. **Turnstile Site Key Generation:** Create a Turnstile widget in the Cloudflare Dashboard under "Turnstile", obtain the `Site Key` (for frontend `index.html`/`login.html`) and `Secret Key` (for Worker secret).
3. **Transactional Email Setup:** If outbound emails are sent to arbitrary non-admin email addresses, either configure Make.com webhook URL (`MAKE_WEBHOOK_URL`) or acquire a Workers Paid plan to enable Cloudflare Email Sending API to unverified recipients.
4. **Google Gemini / Groq API Keys:** Obtain official production API keys from Google AI Studio and Groq Console for Curator AI.
