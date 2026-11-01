# Alfaaz Collective — Core Project Rules & Guardrails

## 0. Behavioral Directive: Intent-First Proactive Advisory & Solution Framing
- **Understand the "Why"**: For every user prompt or task, analyze the underlying motivation, user goal, and architectural context before proposing or writing code. Do not merely execute literal, isolated instructions if they risk side effects or miss systemic improvements.
- **Proactive Evaluation & Fixes**: Always surface:
  1. **Root Cause & Intent**: Explicitly articulate why this action is being taken.
  2. **Related Fixes & Edge Cases**: Point out adjacent regressions, concurrency hazards, or missing validations across backend, database, and frontend.
  3. **Architectural Trade-offs**: Contrast lightweight workarounds against long-term maintainable patterns.
  4. **Verification & Evaluation Steps**: Proactively specify how the task should be verified (tests, D1 queries, edge behaviors).

## 1. Absolute Secret Redaction in Audit & Documentation Artifacts
- **Invariant**: Never print, quote, or commit plaintext secrets, API keys, passwords, bearer tokens, or cryptographic signing keys in documentation, audit logs, issue comments, or pull request descriptions.
- **Evidence Reference**: When auditing security configurations or verifying remediations, always redact secret values to `<redacted — rotated YYYY-MM-DD>` and reference `file:line` only.
- **Test Invariant**: Security test suites (`tests/security_seed.test.ts`) must scan `docs/**`, `scripts/**`, and `package.json` for high-entropy literals and unauthorized remote seed commands (`d1 execute --remote`).

## 2. Psychometric Ratio, SJT & Consent Integrity
- **Scoring Bounds**: Any parameter or minigame declared with normalized bounds `[0.0, 1.0]` (e.g. `GAME_BOUNDS.A2 = { min: 0.0, max: 1.0, min_obs: 3 }`) must compute a true proportion or precision ratio rather than accumulating raw integer event counters.
- **Precision Formula**: Exception-handling precision must be computed as:
  $$\text{Precision} = \frac{TP}{TP + FP}$$
  evaluating genuine exceptions against clean controls, enforcing the $N \ge \text{min\_obs}$ observation gate before asserting high confidence.
- **Consent Gate**: Affirmative consent (`consent_records`) and age verification (18+) are required before any recruitment session telemetry or SJT response ingestion is permitted.
- **7-Dimension Balance**: Psychometric scoring evaluates all 7 core dimensions (Empathy, Conscientiousness, Collaborative Spirit, Emotional Agility, Curiosity, Creative Initiative, Motivation) using Latin Square counterbalanced minigame allocation.

## 3. Federated Identity Verification & Email Integrity (SMS/OTP Decommissioned)
- **Verified Email Gate**: When linking or authenticating a federated account (Google, Apple, OAuth/OIDC) by email address, the verified token MUST carry `email_verified === true`. If false, missing, or untrusted, NEVER link or issue a session for an existing account matching that email — reject with `401 Unauthorized`.
- **Cryptographic Provider Integrity**: `auth_provider` must derive ONLY from cryptographically verified token claims (e.g. `firebase.sign_in_provider`); never from mutable client-supplied body fields.
- **Trusted Edge IP**: Rate limiters and Turnstile verification rely solely on `cf-connecting-ip`. Fall back to client-supplied headers (`x-forwarded-for`) only in automated test environments (`ENV === 'test'`).
- **Race-Safe Identity Insertion**: Federated account creation must catch SQLite `UNIQUE` constraint races on `firebase_uid` and `email`, resolving cleanly to the existing identity rather than throwing `500`.
- **SMS/OTP Decommission**: Phone OTP delivery and SMS verification systems are deprecated and removed. Primary authentication relies exclusively on sovereign Email & Password and verified 1-Tap OAuth identities.

## 4. Honest UI & Zero-Facade Engineering
- **Working Core Front-and-Center**: The functional Email & Password flow must be primary and open, never hidden behind a collapsed `<details>` panel while unconfigured flows lead the UI.
- **Visibly Gated Integrations**: Any third-party provider (Google, Apple, Meta) still awaiting client ID configuration or onboarding must be visibly gated with a `"Coming Soon"` badge and an explanatory tooltip—never styled as active buttons that dead-end.

## 5. Curatorial Aesthetic & Design System Tokens
- **Brutalist Editorial Palette**: Strict adherence to Alfaaz curatorial tokens:
  - Background: Warm paper ivory (`#f4f1ea` / `var(--bg-primary)`)
  - Ink / Text: Deep charcoal ink (`#2d312e` / `var(--text-primary)`)
  - Accent: Antique gold (`#8c6d3b` / `var(--accent-gold)`)
  - Borders: Architectural grid borders (`rgba(45, 49, 46, 0.12)` / `var(--grid-border)`)
- **Typography & Layout**: Alegreya serif and Cormorant Garamond for headings, clean humanist sans for data labels, zero or minimal border-radius (`0` to `4px` max), and high-contrast spacious editorial layout. No generic Bootstrap or modern SaaS tropes (no bubbly pill buttons, neon gradients, or generic blues).
- **Bilingual Dignity**: English text paired with Kashmiri/Urdu typography (`Noto Nastaliq Urdu` / `ur-hover` interactive translations) honoring the cultural heritage of the Srinagar valley.

## 6. Cloudflare-Native Architecture & D1 SQLite Concurrency
- **Runtime Stack**: Cloudflare Workers (Hono framework), Cloudflare D1 (SQLite), Cloudflare R2 (Object storage), and Vite multi-page frontend.
- **12-Step D1 Rebuild Pattern**: All D1 SQLite schema migrations modifying column definitions, nullability, or constraints must strictly follow the non-destructive 12-step table rebuild procedure:
  1. `PRAGMA foreign_keys = OFF;`
  2. Drop stale temporary tables (`users_new`).
  3. Create replacement schema with updated constraints.
  4. Copy existing data (`INSERT INTO ... SELECT ...`).
  5. Drop old table, rename new table to canonical name.
  6. Recreate indexes.
  7. Run `PRAGMA foreign_key_check;` before re-enabling `PRAGMA foreign_keys = ON;`.
- **Concurrency & Double-Booking Guards**: Slot reservations (e.g. `/recruit/schedule-interview`, `/events/register`) must prevent race conditions and over-allocation, enforcing atomic checks and returning `409 Conflict` on contention.

## 7. Security Hardening & Fail-Closed Guardrails
- **Turnstile Fail-Closed Invariant**: In production (`ENV === 'production'`), Cloudflare Turnstile bot verification must strictly fail closed (`403 Forbidden`) if `TURNSTILE_SECRET_KEY` is missing or verification fails. Dummy bypass tokens are only tolerated in `ENV === 'development'` or `ENV === 'test'`.
- **Strict Content Security Policy**: CSP must enforce `frame-ancestors 'none'`, restrict scripts to approved domains (`challenges.cloudflare.com`, `accounts.google.com`), and prevent unauthorized origin reflection in CORS.
- **Test Suite Green Invariant**: All code changes must pass the full test suite (`npm test`), typechecking (`npm run typecheck`), and adversarial security suites (`npm run test:hardening`).

## 8. Domain Isolation: Recruitment & Psychometric Research Boundary
- **Separation Invariant**: The recruitment portal (`frontend/recruit.html`, `frontend/src/recruit.js`, `frontend/src/recruit_games/**`) and psychometric research analytics (`frontend/research.html`, `frontend/src/research.js`, and associated telemetry/SJT evaluators) are strictly isolated as a distinct, specialized domain.
- **Scope Boundary**: Do not modify, refactor, bundle, or alter recruitment and research files during general frontend sweeps or audits (e.g. auth, dashboard, admin, editorial passes) until explicitly directed. All psychometric scoring formulas ($TP/(TP+FP)$), telemetry evidence loggers, Latin Square balancing, and game state loops must remain untouched and insulated from cross-cutting UI refactors.

