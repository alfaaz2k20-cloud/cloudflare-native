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
