# Alfaaz Collective — Core Project Rules & Guardrails

## 1. Absolute Secret Redaction in Audit & Documentation Artifacts
- **Invariant**: Never print, quote, or commit plaintext secrets, API keys, passwords, bearer tokens, or cryptographic signing keys in documentation, audit logs, issue comments, or pull request descriptions.
- **Evidence Reference**: When auditing security configurations or verifying remediations, always redact secret values to `<redacted — rotated YYYY-MM-DD>` and reference `file:line` only.
- **Test Invariant**: Security test suites (`tests/security_seed.test.ts`) must scan `docs/**` in addition to source code for high-entropy literals.

## 2. Psychometric Ratio vs. Counter Integrity
- **Scoring Bounds**: Any parameter or minigame declared with normalized bounds `[0.0, 1.0]` (e.g. `GAME_BOUNDS.A2 = { min: 0.0, max: 1.0, min_obs: 3 }`) must compute a true proportion or precision ratio rather than accumulating raw integer event counters.
- **Precision Formula**: Exception-handling precision must be computed as:
  $$\text{Precision} = \frac{TP}{TP + FP}$$
  evaluating genuine exceptions against clean controls, enforcing the $N \ge \text{min\_obs}$ observation gate before asserting high confidence.

## 3. Federated Identity Verification & Email Integrity
- **Verified Email Gate:** When linking or authenticating a federated account (Firebase/OAuth/OIDC) BY EMAIL ADDRESS, the verified token MUST carry email_verified === true. If false, missing, or untrusted, NEVER link or issue a session for an existing account matching that email — reject 401.
- **Cryptographic Provider Integrity:** auth_provider must derive ONLY from verified token claims (firebase.sign_in_provider); never from mutable client-supplied body fields.
- **Trusted Edge IP:** Rate/velocity limiters rely solely on cf-connecting-ip. Never fall back to client-supplied x-forwarded-for in production.
- **Race-Safe Identity Insertion:** Federated inserts must catch UNIQUE-constraint races and resolve to the existing identity instead of throwing 500.

## 4. Honest UI & Zero-Facade Engineering
- **Working Core Front-and-Center:** The functional Email & Password flow must be primary/open, never hidden behind a collapsed <details> while unconfigured flows lead the UI.
- **Visibly Gated Integrations:** Any third-party provider (Google/Apple/Meta/SMS login) still in onboarding must be visibly gated ("Coming Soon" + tooltip), never styled as live buttons that dead-end.

## 5. Geographic SMS Routing & International Candidate Onboarding
- **Domestic SMS Channel**: SMS OTP verification is strictly scoped to domestic (+91) numbers where regional telecom routing is dependable and free of trial/roaming barriers.
- **International Routing to Global Identifiers**: When an international participant enters a non-+91 number, the platform routes them to Google One-Tap or Email + Code. The platform must never block or burden international participants with SMS delivery failures when high-deliverability zero-cost global channels (Google/Email) are available.
