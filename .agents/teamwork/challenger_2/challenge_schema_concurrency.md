# Adversarial Challenge Report: Schema Integrity, Concurrency & Error Handling

**Agent**: Challenger 2 (`challenger_2`)  
**Timestamp**: 2026-10-28T12:06:00Z  
**Project Root**: `C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native`  
**Test Suite**: `tests/concurrency_adversarial.test.ts` & `scripts/verify_challenger_2.mjs`  

---

## Challenge Summary

**Overall risk assessment**: **LOW** (All critical concurrency, uniqueness, and error paths are structurally enforced at both the database and routing tiers).

The hardening pass performed by Worker 1 was subjected to rigorous empirical attack vectors:
1. **Concurrency Race Conditions**: 5-way simultaneous interview booking collisions.
2. **Double Event Registration**: Simultaneous RSVPs for identical event and user identity.
3. **Out-of-Bounds Psychometric Fuzzing**: Exhaustive verification across all 16,384 possible SJT response combinations plus malformed/fictitious inputs.
4. **Direct SQLite Bypasses**: Executing raw SQL statements directly on SQLite engine without application middleware to confirm database constraint enforcement.

---

## Challenges

### [Low] Challenge 1: Race Condition in Interview Slot Booking (`interview_bookings`)

- **Assumption challenged**: The application pre-check (`SELECT id FROM interview_bookings WHERE slot_date = ? AND slot_time = ? AND status = 'SCHEDULED'`) was assumed sufficient to prevent double bookings. Under distributed Cloudflare Worker edge execution, concurrent requests arriving simultaneously could bypass this pre-check.
- **Attack scenario**: Multiple candidate sessions simultaneously attempt to book the exact same date and time slot (`2026-12-05 05:30 PM`) in parallel.
- **Blast radius**: Double-booking interview slots causing schedule corruption and candidate friction.
- **Mitigation & Verification**:
  - In `database/migrations/0001_initial_schema.sql` (lines 386 and 388), `interview_bookings` enforces both `UNIQUE(slot_date, slot_time)` and `CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_slot ON interview_bookings(slot_date, slot_time)`.
  - In `backend/src/routes/recruit.ts` (lines 438–442), any database constraint violation is caught and translated to HTTP 409 (`This interview slot was just taken. Please choose another time.`).
  - **Empirical Proof**:
    - Direct database-level execution of conflicting insert threw: `SqliteError: UNIQUE constraint failed: interview_bookings.slot_date, interview_bookings.slot_time`.
    - Hono application test with 5 simultaneous requests via `Promise.all` resulted in exactly 1 confirmation (HTTP 200) and 4 clean rejections (HTTP 409).
    - Database verification confirmed exactly 1 row was stored for the slot.

### [Low] Challenge 2: Duplicate Event Registrations & Capacity Exhaustion (`event_registrations`)

- **Assumption challenged**: Event RSVPs rely only on application-level checks, risking double-counting or seat exhaustion under network retries.
- **Attack scenario**: A user double-clicks the RSVP button or a script sends rapid concurrent registration requests with the same user token.
- **Blast radius**: Artificial inflation of event attendee count, prematurely locking out other community members.
- **Mitigation & Verification**:
  - In `database/migrations/0001_initial_schema.sql` (line 84), the table defines `CONSTRAINT uq_event_user_reg UNIQUE (event_id, user_email)`.
  - In `backend/src/routes/events.ts` (lines 62–69), existing registrations are checked and rejected with HTTP 400 (`Already registered.`).
  - **Empirical Proof**:
    - Direct database-level execution of duplicate insert threw: `SqliteError: UNIQUE constraint failed: event_registrations.event_id, event_registrations.user_email`.
    - Concurrent API test with 2 simultaneous requests resulted in 1 HTTP 200 and 1 HTTP 400. Database contains exactly 1 registration row.

### [Low] Challenge 3: SJT Scoring Out-of-Bounds & Injection Fuzzing

- **Assumption challenged**: Candidate responses to the 7 Situational Judgment Scenarios might result in out-of-bounds construct scores, division-by-zero, NaN, or allow post-submission tampering.
- **Attack scenario**:
  1. Sending missing scenarios (e.g. only S1 and S2).
  2. Sending fictitious options (e.g. `INVALID_OPT_999`).
  3. Sending options valid in other scenarios but invalid in context (e.g. `S2A` for `S1`).
  4. Resubmitting different answers to overwrite previously scored responses.
  5. Crafting worst-case response profiles to break integer thirds math.
- **Blast radius**: Psychometric score distortion, server unhandled exceptions (HTTP 500), or candidate answer manipulation.
- **Mitigation & Verification**:
  - In `backend/src/services/sjt.ts`:
    - Validates scenario existence: throws `Missing response for scenario ${s.id}`.
    - Validates option keys: throws `Invalid option ${optId} for scenario ${s.id}`.
    - Mathematical scoring bounds: integer thirds logic (`3 * num >= 2 * span` -> HIGH; `3 * num >= span` -> MODERATE; else LOW).
  - In `backend/src/routes/recruit.ts` (lines 203–225):
    - Conflicting resubmission is rejected with HTTP 409, logged to `data_quality_flags` (`sjt_conflict`), and original responses preserved.
    - Idempotent resubmission of identical responses is accepted with HTTP 200.
  - **Empirical Proof**:
    - Tested ALL 16,384 possible response combinations across all 7 scenarios. 100% produced valid results:
      - `min <= raw <= max` for all 7 constructs.
      - `0 <= num <= span` with zero division by zero.
      - `0.0 <= sjt_relative <= 1.0`.
      - Band strictly within `['LOW', 'MODERATE', 'HIGH']`.
    - API tests confirmed HTTP 400 on missing scenarios, HTTP 400 on invalid options, HTTP 400 on cross-scenario option misuse, HTTP 409 on conflicting resubmission, and HTTP 200 on idempotent resubmission.

### [Low] Challenge 4: Password Reset Token Single-Use Replay

- **Assumption challenged**: A password reset token intercepted in transit could be replayed multiple times within its 15-minute validity window.
- **Attack scenario**: Attacker replays valid token after legitimate user resets password.
- **Blast radius**: Account takeover during token expiration window.
- **Mitigation & Verification**:
  - In `database/migrations/0001_initial_schema.sql` (lines 20–26), `consumed_tokens` table defines `token_hash TEXT PRIMARY KEY`.
  - In `backend/src/routes/auth.ts`, tokens are checked against `consumed_tokens` and rejected with HTTP 400 if already consumed.
  - **Empirical Proof**:
    - Direct database insertion of duplicate hash threw: `SqliteError: UNIQUE constraint failed: consumed_tokens.token_hash`.
    - Vitest test `tests/error_paths.test.ts` confirmed second reset attempt fails with HTTP 400.

---

## Stress Test Results

| Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| 5 concurrent interview booking requests for same slot | Exactly 1 HTTP 200, 4 HTTP 409 | 1 HTTP 200, 4 HTTP 409 (`This interview slot was just taken`) | **PASS** |
| Raw SQLite duplicate insert on `(slot_date, slot_time)` | DB throws UNIQUE constraint failure | Threw `UNIQUE constraint failed: interview_bookings.slot_date, interview_bookings.slot_time` | **PASS** |
| Raw SQLite duplicate insert on `session_id` in `interview_bookings` | DB throws UNIQUE constraint failure | Threw `UNIQUE constraint failed: interview_bookings.session_id` | **PASS** |
| 2 concurrent event registrations for same user and event | Exactly 1 HTTP 200, 1 HTTP 400 | 1 HTTP 200, 1 HTTP 400 (`Already registered.`) | **PASS** |
| Raw SQLite duplicate insert on `(event_id, user_email)` | DB throws UNIQUE constraint failure | Threw `UNIQUE constraint failed: event_registrations.event_id, event_registrations.user_email` | **PASS** |
| Raw SQLite duplicate insert on `(user_email, club_name)` | DB throws UNIQUE constraint failure | Threw `UNIQUE constraint failed: club_applications.user_email, club_applications.club_name` | **PASS** |
| Raw SQLite duplicate insert on `(session_id, scenario_id)` in `sjt_responses` | DB throws UNIQUE constraint failure | Threw `UNIQUE constraint failed: sjt_responses.session_id, sjt_responses.scenario_id` | **PASS** |
| Raw SQLite duplicate insert on `consumed_tokens.token_hash` | DB throws UNIQUE constraint failure | Threw `UNIQUE constraint failed: consumed_tokens.token_hash` | **PASS** |
| Missing scenario in SJT submission | Returns HTTP 400 with missing scenario detail | HTTP 400 (`Missing response for scenario S3`) | **PASS** |
| Fictitious option in SJT submission | Returns HTTP 400 with invalid option detail | HTTP 400 (`Invalid option S1_IMPOSSIBLE_OPTION_X for scenario S1`) | **PASS** |
| Cross-scenario option misuse (S2 option sent for S1) | Returns HTTP 400 with invalid option detail | HTTP 400 (`Invalid option S2A for scenario S1`) | **PASS** |
| Conflicting SJT resubmission on completed session | Returns HTTP 409, logs flag, preserves original answers | HTTP 409 (`Conflicting SJT submission rejected`), flag logged | **PASS** |
| Idempotent SJT resubmission with identical answers | Returns HTTP 200 | HTTP 200 (`Idempotent SJT resubmission accepted`) | **PASS** |
| Exhaustive 16,384 SJT combinatorial profiles | 100% inside `[min, max]`, no NaN, valid bands | 16,384/16,384 combinations passed all construct bounds | **PASS** |
| Backend TypeScript Build (`tsc --noEmit`) | Clean compilation, exit code 0 | Exit code 0, zero errors | **PASS** |
| Frontend Vite Build (`vite build`) | All 49 modules bundled, exit code 0 | Exit code 0, 49 modules transformed, dist generated | **PASS** |
| Full Test Suite (`npm test`) | 100% pass across all test suites | 10/10 test files passed, 90/90 tests passed | **PASS** |

---

## Unchallenged Areas

- **Remote Cloudflare Edge Infrastructure**: Commands requiring `--remote` or live Cloudflare credentials were intentionally not executed in compliance with strict safety guardrails. All validations were executed against in-memory SQLite and local D1 simulation environments.
- **Third-Party Email Delivery Webhooks**: Arbitrary email sending was validated through dev preview mode rather than live SMTP/webhook credentials.
