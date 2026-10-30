# Alfaaz Collective — Independent Full System Audit

| | |
|---|---|
| **Audit date** | 2026-10-29 |
| **Target project** | `C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native` |
| **Reference project** | `C:\Users\saqrt\OneDrive\Desktop\alliswell\alfaaz-project` (read-only, unmodified) |
| **Branch / HEAD** | `main` @ `9d467fe` (unchanged by this audit) |
| **Tracked files** | 188 |
| **Change status** | Uncommitted and unstaged, awaiting review |

> This report **supersedes nothing**. Two earlier audits remain in place and were deliberately not
> edited: `docs/audits/cloudflare-full-system-audit.md` (tracked) and
> `docs/audits/final-system-audit.md` (untracked, produced by another CLI). Where they disagree with
> the code, this report cites the code. Section E lists the specific inaccuracies found.

---

## Section A — Executive Summary

The application is a **single-tier Cloudflare Workers full-stack system**: one Hono worker serves both
the Vite-built static frontend (via the `ASSETS` binding) and every API route, backed by D1 (SQLite,
**26 tables**), KV (notices cache) and Cloudinary (live file storage). R2 is referenced in code and
documentation but is **not bound** in `wrangler.jsonc`.

The system is structurally sound and genuinely well-engineered in its recruitment psychometrics layer.
The SJT scoring engine is mathematically exact (integer-thirds banding, verified across all 16,384
response profiles), the counterbalancing design is real, and the anti-normative recruiter guards exist
as specified. Prior hardening (JWT algorithm-confusion defense, reset-token replay protection,
production secret guard, concurrency try/catch) is present and effective.

This audit found **one P0 and four P1 issues that the earlier reports missed or understated**:

| ID | Pri | Finding | Status |
|---|---|---|---|
| **SEC-01** | **P0** | The **production JWT signing key is printed in plaintext** in a tracked file, and is therefore also in git history | Not fixed — approval required |
| **SEC-02** | **P1** | Turnstile bot verification **fails open** — no token required when the secret key is unset | Not fixed — approval required |
| **SEC-03** | **P1** | Vault file endpoint had **no ownership check** (IDOR) and accepted `data:` URLs | **Fixed** |
| **DAT-01** | **P1** | Game `A2` scoring **saturates at 1.0**, so `conscientiousness` is graded HIGH for every completer | Not fixed — scoring rule, approval required |
| **REP-14** | **P1** | R2 `VAULT_BUCKET` is documented as bound but **no `r2_buckets` entry exists** | Not fixed — decision required |
| **UX-03** | **P2** | Accent tokens (3.1–3.3:1) are used as 10–12px text and fail WCAG AA. **Correction:** the original P1 claim blamed `--text-secondary` at ~2.9:1; the live token is `#626764` = **5.11:1 and passes**. See Section H.2. | Proposal only |

**Readiness: CONDITIONALLY READY** for continued operation, **NOT ready for unattended promotion** of the
working tree. SEC-01 (key rotation) is a prerequisite for any further deploy, and four decisions
(R2, blog double-publish, scoring bounds, Turnstile policy) need your approval before code changes are
safe to ship. See Section O.

### What the earlier report got wrong

The untracked `docs/audits/final-system-audit.md` is directionally reasonable but **not a reliable basis
for decisions**. Independently verified discrepancies:

1. It states **25 D1 tables**. The schema defines **26** `CREATE TABLE` statements
   (`database/migrations/0001_initial_schema.sql`).
2. It names tables that **do not exist**: `session_features`, `evidence_syntheses`, `audit_trail`.
   Real names are `features`, `evidence`, `recruiter_access_logs` / `admin_audit_logs`.
3. It labels many subsystems **"Active & Verified"**. They are covered only by Vitest against
   `tests/helpers/d1_mock.ts` — a `node:sqlite` mock with real Web Crypto but **not** production D1
   semantics (no isolate cold-start, no per-isolate memory, no D1 batch limits, no real concurrency).
4. It **missed the P0 entirely** — it documents the JWT secret location without noticing that the
   *other* tracked audit prints the secret itself.
5. It **missed 58 tracked files** under `.agents/teamwork/`, the duplicate
   `frontend/public/service-worker.js`, `frontend/vercel.json`, and 11 unused
   `backend/src/config/*.json` files.

---

## Section B — Architecture and System Map

### B.1 Runtime topology

```
Browser
  └─ Cloudflare Edge
       ├─ ASSETS binding  → ./frontend/dist   (12 HTML entry points, hashed JS/CSS)
       └─ Worker (Hono)   → backend/src/index.ts
            ├─ DB           → D1  (26 tables, 28a3ae5b-…)
            ├─ CACHE_KV     → KV  (notices_feed)
            ├─ VAULT_BUCKET → R2  ← NOT BOUND (code path unreachable in prod)
            └─ outbound     → Gemini / Groq / Make.com webhook / Cloudinary
```

There is **no second tier**. The old project's separate FastAPI and `alfaaz-recruit-system` services are
collapsed into this one worker. `workers_dev: true` plus custom domains `alfaazcollective.org` and
`www.alfaazcollective.org`.

### B.2 Route mounting (24 `route()` calls in `backend/src/index.ts`)

Every functional router is mounted **twice** — once at root and once under `/api` — for legacy URL
compatibility. The curator router is mounted **four times** (`/phantom`, `/api/phantom`, `/curator`,
`/api/curator`). This is intentional (documented in `FEATURE_PARITY_MATRIX.md`) but has two side effects
that matter for security and are analyzed in Section E (SEC-09):

- The in-memory rate limiter keys on `c.req.path`, so `/events/register` and `/api/events/register`
  have **separate budgets**.
- Every middleware cost is multiplied by the number of mounts that match.

### B.3 Router inventory

| Router | File | Endpoints | Auth |
|---|---|---|---|
| auth | `backend/src/routes/auth.ts` | register, login, forgot-password, reset-password, me | public / JWT |
| events | `routes/events.ts` | list, detail, register, cancel | public / JWT |
| clubs | `routes/clubs.ts` | list, apply, my | public / JWT |
| exhibitions | `routes/exhibitions.ts` | config, apply, my-status | JWT |
| vault | `routes/vault.ts` | submit, `file/:key` | JWT |
| blogs | `routes/blogs.ts` | list, detail, generate | public / bearer secret |
| notices | `routes/notices.ts` | feed | public |
| curator | `routes/curator.ts` | chat | public |
| admin | `routes/admin.ts` | events, exhibitions, clubs, roster, submissions, audit | `requireAdmin` (`use('*')`) |
| recruit | `routes/recruit.ts` | consent, identity, warmup, sjt, tasks, telemetry, slots, schedule | mixed |
| research | `routes/research.ts` | sessions, dossier, reschedule, cancel | admin JWT + access log |

### B.4 Data layer — the real 26 tables

`users`, `consumed_tokens`, `admin_audit_logs`, `blogs`, `club_applications`, `events`,
`event_registrations`, `exhibitions_list`, `exhibition_applications`, `submissions`,
`recruit_sessions`, `applicant_identities`, `consent_records`, `accessibility_profiles`,
`warmup_baselines`, `task_assignments`, `sjt_responses`, `telemetry_events`, `features`,
`game_scores`, `evidence`, `data_quality_flags`, `volunteer_outcomes`, `recruiter_access_logs`,
`interview_bookings`, `interview_settings`.

The recruitment pipeline is a **four-stage materialisation chain**:

```
telemetry_events (raw, append-only, seq-ordered)
      ↓ extractSessionFeatures()  [services/features.ts]
features + game_scores
      ↓ integrateSessionEvidence()  [services/evidence.ts]
evidence  (one row per parameter per version; SJT ⊕ games ⇒ delta, band, confidence)
      ↓ research.ts
curator dossier (anti-ranked: no composite score is ever emitted)
```

This is the correct architecture for cross-method psychometrics, and the versioned `evidence` table with
`is_superseded` is a real lineage mechanism. Section J covers where the chain leaks.

---

## Section C — Logic-Flow Inventory

Every user-reachable flow traced through code, with the verified state of each.

### C.1 Public / account flows

| # | Flow | Path | Verified behaviour |
|---|---|---|---|
| 1 | Landing | `/` | Preloader preloads 17 Cloudinary `w_800` images, waits for ≥50% or 1.5 s, then a cumulative `delay += 10` sequence (~1.95 s) under a `z-index:3000` overlay, then pre-warms `/ping`. |
| 2 | Notices feed | `/api/notices` → Cloudinary fallback | D1/KV source; falls back to `res.cloudinary.com/dmqwjpmjk/raw/upload/alfaaz/notices.json`. Polled every 25 s. **Fixed:** error state, duplicate initial fetch, polling while hidden. |
| 3 | Register | `POST /auth/register` | Turnstile → validate → check-then-insert → PBKDF2 hash → JWT → welcome email. **Fixed:** email format, UNIQUE race. |
| 4 | Login | `POST /auth/login` | `LOWER(email)` lookup → `verifyPassword` (constant time) → JWT with DB `status`. Sound. |
| 5 | Forgot / reset | `/auth/forgot-password` → `/auth/reset-password` | 15-min `status:'reset'` token, SHA-256 `consumed_tokens` replay guard, `password_reset_at` invalidation. Sound. **Fixed:** reset token can no longer act as a session token. |
| 6 | RSVP | `POST /events/register` | Capacity COUNT → INSERT with UNIQUE catch. **Residual:** check and insert are separate (SEC-14 oversell race). |
| 7 | Club apply | `POST /clubs/apply` | UNIQUE catch present. |
| 8 | Exhibition apply | `POST /exhibitions/apply` | `requireAuth` + Turnstile + `over_19` + `agreed_to_screening`. **Fixed:** age validation, UNIQUE catch. |
| 9 | Vault submit | `POST /vault/submit` | `requireAuth`. With `VAULT_BUCKET` unbound, uploads take the **mock-URL fallback** (`https://mock-storage.alfaaz.local/…`). Live uploads reach Cloudinary directly from the browser. |
| 10 | Curator chat | `/curator/chat` | Gemini → Groq → offline `ALFAAZ_KNOWLEDGE` retrieval. **Fixed:** API key removed from the URL query string. |
| 11 | Blog read | `/blogs`, `/blogs/:id` | Public. |
| 12 | Blog write | `POST /blogs/generate` | Bearer `PHANTOM_SECRET_TOKEN`. **Fixed:** constant-time compare, no config disclosure. **Residual:** double-triggered (DAT-12). |

### C.2 Admin flow

`login.html` → `localStorage.alfaaz_token` → `admin.html`.

**Important:** `frontend/src/admin.js:3-21` gates the admin UI **client-side only** by reading
`localStorage.alfaaz_user`. This is cosmetic, not an access control — every `/admin/*` endpoint is
independently protected server-side by `adminRouter.use('*', requireAdmin)`
(`routes/admin.ts:8`). The client gate is a UX convenience, not a boundary. It is listed as SEC-17 so it
is not mistaken for a control.

Admin capabilities verified: event CRUD, registration toggle, exhibitor approve/reject/finalize/revert,
club review, roster role changes, storage-vault listing, audit log, diagnostics, test email. Every
mutation writes `admin_audit_logs` via `logAudit()`, which **swallows write failures**
(`routes/admin.ts:16-27`) — see SEC-18.

### C.3 Recruitment flow (11 screens)

```
consent ──► identity ──► accessibility ──► warmup ──► SJT (7 scenarios)
   │
   └─► POST /recruit/consent
         ├─ Turnstile
         ├─ confirmed_18_plus + research_telemetry required
         ├─ assignWorldOrder() → Latin-square order_id, 7-world sequence, HMAC per-session seeds
         └─ batch INSERT: recruit_sessions + consent_records + task_assignments
                ↓
         identity → applicant_identities
                ↓
         warmup → warmup_baselines (reaction time, used for latency normalisation)
                ↓
         SJT → sjt_responses (one row per scenario)
                ↓
         7 worlds × 2 core games = 14 games → telemetry_events
                ↓  extractSessionFeatures
         features + game_scores
                ↓  integrateSessionEvidence
         evidence (7 parameters)
                ↓
         result screen ──► interview slot picker ──► interview_bookings
```

**Counterbalancing verified:** 14 Latin-square rows over 7 worlds; `assignWorldOrder()` reads
`recruit_sessions` to pick a rotation. **Seeds verified as generated** (HMAC of session id per world) but
**never consumed** — see DAT-15.

**Consent gate verified end-to-end after fix:** `recruit.html` renders `#ageConfirm` and `#consentAgree`,
`recruit.js` disables submit until both are checked, and now sends `confirmed_18_plus` so the server can
enforce and record it truthfully.

### C.4 Research / curator flow

`GET /recruit/research/sessions` (list) and `GET .../sessions/:id` (dossier) are admin-gated. The dossier
endpoint writes a `recruiter_access_logs` row. **Anti-ranking guard verified** in `routes/research.ts`
(~lines 52-64): the API refuses to emit a single composite score, which is the intended design.
**Residual:** the *list* endpoint returns candidate PII without writing an access-log row (SEC-16).

---

## Section D — Old Project → New Project Comparison

Method: read-only inspection of `alfaaz-project`. Its working tree is **clean** on branch
`codex/release-candidate` — confirmed untouched by this audit (`git -C ../alfaaz-project status`). No file
in that project was created, modified, moved or deleted; no dependency was installed there; no command
with side effects was run against it.

### D.1 Stack migration

| Concern | Old (`alfaaz-project`) | New (`cloudflare-native`) |
|---|---|---|
| API tier | FastAPI (Python), separate deploy | Hono on a Cloudflare Worker |
| Recruitment | Separate `alfaaz-recruit-system/` service | Same worker, `routes/recruit.ts` |
| Database | Neon Postgres + local SQLite | Cloudflare D1 (SQLite) |
| Passwords | passlib / bcrypt | Web Crypto PBKDF2-HMAC-SHA256, 100k iters, 16-byte salt |
| Sessions | server-side | HMAC-SHA256 JWT, 7-day (15-min reset) |
| Files | Cloudinary (`services/cdn`) | Cloudinary (live) + R2 code path (dormant) |
| Email | Make.com (`services/email`) | Make webhook / CF Email Sending / dev preview |
| AI | Gemini primary, Groq fallback | **preserved exactly** — same order, same models |
| Frontend | Next.js/Vite + `frontend/api/*` proxies | Vite multi-page, direct worker fetch |

No credentials, personal data or production data were copied from the old project. Legacy SQLite files in
the old repo (`alfaaz_data.db` 1.5 MB, `backend/alfaaz.db`, nested copies) were **not opened** — they may
contain real PII and must not be migrated.

### D.2 Parity assessment

**Preserved and verified working:** auth, events, clubs, exhibitions, vault, blogs, curator AI (with
offline knowledge fallback), admin, notices feed, recruitment (14 games + SJT), research dossier.
All 15 `backend/src/config/*.json` psychometrics definitions were carried across, and SJT banding is
**bit-identical** to the specified exact-integer-thirds rule.

**Improved over the old system** (verified in code, not just claimed):
- `consumed_tokens` gives password-reset tokens true single-use semantics (Postgres version had none).
- DB `UNIQUE(slot_date, slot_time)` + FK cascades replace application-only checks.
- `getJwtSecret()` refuses to boot in production without a secret — the old code had a hardcoded
  fallback string that permitted admin forgery.
- JWT header validation rejects `alg` confusion (`crypto.ts:194-198`).
- CORS is an explicit allowlist rather than a wildcard.
- Email provider auto-routes from the presence of `MAKE_WEBHOOK_URL`.

**Regressions and gaps** (all listed in Section E with IDs):

| Gap | Impact | ID |
|---|---|---|
| R2 vault storage unreachable | Server-side private upload/streaming does not function in production | REP-14 |
| Recruit calibration suite not ported | Old `alfaaz-recruit-system` had gate1-6, `calibration_preflight`, `confidence_contract`, `end_to_end_lineage`, `fail_closed`, `synthetic_profiles`, `anti_copy` tests; the new 10-file suite has **no equivalent** | DAT-16 |
| Blog published twice weekly | Worker cron and GitHub cron fire at the same instant | DAT-12 |
| Seeds generated but unused | Games are not deterministically replayable from the stored seed | DAT-15 |
| Game A2 saturates | `conscientiousness` game evidence is systematically inflated | DAT-01 |

The **most consequential** parity gap is DAT-16. The new suite verifies routes, SQL and crypto well, but
the old project's *statistical* guarantees about the assessment instrument (calibration, confidence
contract, fail-closed behaviour, anti-copy) are no longer automatically checked. That does not mean the
current instrument is wrong — the hardening harness does prove SJT soundness exhaustively — it means a
class of regression is now unguarded. Recommended in Section N as an approval item.

---

## Section E — Findings and Fixes

Priority definition: **P0** = active compromise vector, act before next deploy · **P1** = material
security or data-integrity defect · **P2** = real defect with limited or conditional blast radius ·
**P3** = cosmetic, hygiene or documentation drift.

### E.1 P0 and P1 findings (detailed)

---

#### SEC-01 · Security · **P0** · Production signing key committed to a tracked document — NOT FIXED

- **Affected file:** `docs/audits/cloudflare-full-system-audit.md:233-234` (tracked, committed in `099f1b7`)
- **Symptom:** anyone with read access to the repository can obtain the secret.
- **Evidence:** line 234 prints the literal value under an "Evidence" heading. The value is **not**
  reproduced anywhere in this report. `git log --oneline -- docs/audits/cloudflare-full-system-audit.md`
  returns `099f1b7`, confirming it is in history. `wrangler.jsonc:45-49` now contains only `ENV`,
  `FRONTEND_URL` and `EMAIL_PROVIDER` — the key was already correctly removed from `vars`, so the
  document is the **only surviving copy of a value that has been in use**.
- **Root cause:** a remediation note quoted the configuration line verbatim instead of redacting it.
- **Impact:** combined with `requireAdmin` trusting the JWT `status` claim with no database re-check
  (`backend/src/middleware/auth.ts:40`), possession of this key allows forging an `ADMIN` token and
  taking full control of the portal — candidate PII, roster roles, exhibition decisions, audit log.
  The blast radius is the entire application.
- **Recommended fix (approval required — touches production secrets, which the brief forbids doing
  unilaterally):**
  1. `npx wrangler secret put JWT_SECRET` with a freshly generated 32+ char value. This immediately
     invalidates every existing session; candidates and admins must sign in again.
  2. Redact line 234 to `<redacted — rotated 2026-10-29>`.
  3. Treat the old value as permanently compromised. History scrubbing (`git filter-repo`) is optional
     but recommended if this repository is ever shared; it rewrites hashes and needs its own approval.
- **Test required:** after rotation, assert an admin request signed with the old key returns 401.
  `tests/security_seed.test.ts` currently does **not** scan tracked documents for high-entropy
  literals — adding that scan would have caught this class of defect automatically.
- **Fix status:** not applied. Rotation is a production change and is explicitly gated on your approval.
- **Remaining uncertainty:** whether this key was ever also used in other environments; whether the
  Cloudflare account is accessible so rotation can be performed.

---

#### SEC-02 · Security · **P1** · Turnstile verification fails open — NOT FIXED (policy decision)

- **Affected file:** `backend/src/middleware/rate_limit.ts:45-77`, consumed at `routes/auth.ts:24`,
  `routes/exhibitions.ts:37`, `routes/recruit.ts:45`
- **Symptom:** bot protection silently absent rather than visibly broken.
- **Evidence:** `verifyTurnstile` returns `true` when `secretKey` is falsy **or** matches the Cloudflare
  always-pass test prefix `1x0000000000000000000000000000000AA`, and returns `true` when no token is
  supplied at all. Additionally, `frontend/recruit.html` renders **no Turnstile widget**, so
  `POST /recruit/consent` never sends a token under any configuration.
- **Root cause:** a development convenience ("pass when unconfigured") placed on the trust boundary.
- **Impact:** registration, exhibition applications and recruitment consent have no bot resistance.
  Recruitment is the worst case: each session consumes assessment time and writes candidate records, and
  the intake is already protected only by a checkbox.
- **Why this was NOT fixed unilaterally:** making it fail-closed would **immediately break recruitment
  consent in production**, because no widget exists on `recruit.html` to generate a token. The correct
  fix is a coordinated change: render the widget on `recruit.html`, then require the token server-side.
  That is a user-visible workflow change and needs your approval.
- **Recommended fix (two steps, in this order):** (1) add the Turnstile script and widget to
  `recruit.html` and include `cf-turnstile-response` in the consent payload; (2) change `verifyTurnstile`
  to fail **closed** in production while keeping an explicit local-dev bypass keyed on an env flag rather
  than the absence of a secret.
- **Test required:** assert 403 when `TURNSTILE_SECRET_KEY` is configured and the token is missing.
- **Remaining uncertainty:** whether `TURNSTILE_SECRET_KEY` is currently provisioned in the live worker;
  which Turnstile sitekey belongs to `recruit.html`. Both are read-only `wrangler secret list` / dashboard
  checks not performed here.

---

#### SEC-03 · Security · **P1** · Vault IDOR and `data:` URL acceptance — **FIXED**

- **Affected file:** `backend/src/routes/vault.ts:7-17`, `:86-104`
- **Symptom:** any signed-in user could read any other user's uploaded vault object.
- **Evidence:** `GET /vault/file/:key{.*}` applied only `requireAuth` and then did
  `VAULT_BUCKET.get(key)` with the caller-supplied key. Object keys are
  `vault/${Date.now()}-${sanitised original filename}` (`vault.ts:39`) — a millisecond timestamp plus a
  guessable filename, so enumeration is realistic. Separately, `isValidUrl` accepted any string starting
  with `data:`, storing arbitrary attacker-controlled data-URLs in `submissions.file_url`.
- **Root cause:** the endpoint was written as a storage proxy before per-user ownership was modelled; the
  `submissions.author_email` column existed but was never consulted.
- **Impact:** private creative submissions and any receipt-like document exposed across accounts.
  **Currently dormant in production** because `VAULT_BUCKET` is unbound (REP-14) — the route returns 503.
  It becomes live the moment R2 is bound, which is why it must be fixed before that decision.
- **Fix applied:** the handler now loads the caller's `submissions` rows and permits access only when the
  stored `file_url` resolves to the requested key, or when `user.status === 'ADMIN'` (curator review must
  keep working). Unauthorised reads return **404, not 403**, so the endpoint does not confirm object
  existence. `data:` was removed from `isValidUrl`. Two response-hardening headers were added:
  `X-Content-Type-Options: nosniff`, and `Content-Disposition: attachment` for `text/html` and
  `image/svg+xml` — otherwise a stored HTML/SVG upload would execute in the application's own origin.
- **Test applied and passing:** `tests/error_paths.test.ts` section 4 now asserts owner → 200,
  a different participant → 404, and admin → 200.
- **Remaining uncertainty:** the key-matching comparison handles both encoded and decoded forms; if a
  future upload path stores keys differently, ownership resolution must be revisited. Not exercised
  against real R2 (unavailable locally).

---

#### DAT-01 · Data integrity · **P1** · Game A2 saturates, inflating `conscientiousness` — NOT FIXED (scoring rule)

- **Affected files:** `backend/src/services/evidence.ts:38` (`GAME_BOUNDS.A2`),
  `backend/src/services/features.ts:100-113`
- **Symptom:** a candidate who plays the A2 exception-flagging game at all receives
  `conscientiousness` game evidence graded **HIGH**, independent of performance quality.
- **Evidence:** `GAME_BOUNDS.A2 = { min: 0.0, max: 1.0, min_obs: 3 }`, but the scorer increments an
  **integer** counter per matching action (`rawScore += 1`) and then clamps
  `rawScore = Math.min(bounds.max, Math.max(bounds.min, rawScore))`. With `max = 1.0`, any single
  qualifying action clamps to 1, so `num = 1 - 0 = 1`, `span = 1`, and
  `relative_score = 1.0` → band `HIGH`. `precision` (the feature A2 is meant to express) is a **ratio**
  in 0..1 and was clearly intended to be computed, not counted.
- **Root cause:** a bounds entry authored for a ratio metric paired with a counter-based scorer.
- **Impact:** this is the mechanism by which a candidate's profile can show a strong
  `conscientiousness` game signal that is an artefact of scoring rather than behaviour. It also
  corrupts downstream `cross_method_delta`, `relationship` and `confidence` for that parameter, because
  those are all computed from `game_relative`. Since A2 is one of two core games per world, the
  distortion reaches every session that completes it.
- **Why NOT fixed:** correcting it means choosing a scoring rule — either compute genuine
  `exception_flagging_precision` (correct decisions ÷ flagged decisions) or restate `GAME_BOUNDS.A2` as
  `{min: 0, max: N}`. Both change how candidates are evaluated. The brief forbids altering scoring logic
  without approval, so this is presented as a decision rather than a silent change.
- **Recommended fix:** implement `exception_flagging_precision` as an actual ratio in
  `features.ts` for A2 and keep the 0..1 bounds; this matches the feature name already declared in
  `FEATURE_METADATA` (`features.ts:12`) and requires no new selection rule.
- **Test required:** a fixture with 1 correct and 4 incorrect flags must yield ~0.2 (LOW), not 1.0
  (HIGH); and `services/evidence.ts` banding should be asserted against the same exact-thirds rule the
  SJT uses (see DAT-03).
- **Remaining uncertainty:** whether existing production `evidence` rows should be recomputed after the
  rule is fixed — that is a data-migration decision (`forceRecompute` already exists for this purpose).

---

#### REP-14 · Configuration · **P1** · R2 documented as bound but no binding exists — NOT FIXED (decision)

- **Affected files:** `wrangler.jsonc` (no `r2_buckets` key), `README.md:58`, `docs/ARCHITECTURE.md:84-88`,
  `backend/src/routes/vault.ts:37-47`, `:89-90`
- **Evidence:** `wrangler.jsonc` declares only `d1_databases`, `kv_namespaces` and `assets`.
  `grep` for `r2_buckets|VAULT_BUCKET` in that file returns nothing. Consequently
  `if (c.env.VAULT_BUCKET)` is false and uploads fall to
  `file_url = https://mock-storage.alfaaz.local/${name}` — a **non-existent host persisted to the
  database** — while `GET /vault/file/:key` returns 503.
- **Impact:** the server-side private storage path is dead code in production; the documented R2 store
  does not exist. Real uploads work only because the browser posts directly to Cloudinary
  (`frontend/src/{submit,dashboard,exhibition}.js`, cloud `dmqwjpmjk`, preset `alfaaz_vault`). Any
  `submissions.file_url` already written through the fallback branch points at a dead host.
- **Recommended fix (choose one, needs approval):** bind an R2 bucket and add the `r2_buckets` entry, or
  correct README/ARCHITECTURE to state that Cloudinary is the live store and remove the mock-URL fallback
  so that a missing bucket fails loudly instead of persisting a useless URL.
- **Remaining uncertainty:** how many `submissions` rows in production carry the mock host — a read-only
  `SELECT COUNT(*) FROM submissions WHERE file_url LIKE 'https://mock-storage%'` would answer this; not
  run here.

### E.2 P2 findings

| ID | Category | Affected file(s) | Symptom → root cause → disposition |
|---|---|---|---|
| **SEC-04** | Security | `middleware/auth.ts:14-24` | A 15-minute `status:'reset'` token authenticated to **every** `requireAuth` endpoint. Root cause: only `payload.email` was checked. **Fixed** — `requireAuth` now rejects `status === 'reset'`. Safe because the frontend stores tokens only from login (`src/login.js:63`) and register (`src/register.js:127`), never from the reset flow (`src/reset.js:128`). Test added. |
| **SEC-05** | Security | `middleware/auth.ts:26-48` | `requireAdmin` trusts the `status` claim inside a **7-day** JWT, so a demoted or deleted admin keeps full admin API access until the token expires. **Not fixed** — a DB re-check breaks the existing suite, which mints admin tokens with `createToken(...,'ADMIN',...)` without inserting user rows (`tests/admin.test.ts:31,50,63,88,122,148`). This is a behavior change, not a defect fix, so it is an approval item (Section N). |
| **SEC-06** | Security | `services/curator.ts:164`, `:251` | Gemini key was passed in the URL **query string** even though the `x-goog-api-key` header was already sent on the same request. Secrets in URLs persist in proxy logs, referrers and error telemetry. **Fixed** — both call sites now rely on the header alone. Model, order and fallback are unchanged. **Not verified against the live API** (would incur cost, which the brief prohibits for routine testing). One-line revert if Google rejects header-only auth. |
| **SEC-07** | Security | `routes/blogs.ts:47-59, 85-88` | `token !== expectedToken` is a non-constant-time comparison; the missing-config branch returned **500 with the variable name** (`PHANTOM_SECRET_TOKEN not configured`), and the failure branch echoed raw `err.message` to the caller. **Fixed** — `timingSafeEqual()` added to `auth/crypto.ts`, generic 503 without naming the variable, generic 500 message. This endpoint previously had **zero test coverage**; coverage added. |
| **SEC-08** | Security | `src/admin.js:74-76`, `:204` | Inline `onclick` handlers interpolated **escaped HTML strings into JavaScript**: `onclick="deleteEvent(1, '${safeName.replace(/'/g,"\\'")}', this)"`. HTML entities are decoded *before* JS parsing, so an apostrophe in an admin-created event name breaks the string, and `'); …//` executes. Root cause: double-escaping confusion — `escapeHtml` converts `'` to `&#039;`, so the regex found nothing to escape. **Fixed** for the two string sinks (`deleteEvent`, `activateExhibition`) via `data-action` / `data-id` / `data-name` attributes with one delegated listener per container (bound once via `dataset.actionsBound`, so repeated reloads don't stack handlers). Remaining `onclick`s in `admin.js` (`:351-363, 435-436, 464`) and `dashboard.js:177` interpolate **numeric primary keys only** and are not exploitable; `:464` already uses the correct `data-email` pattern. Migration of those is consistency, not security. |
| **SEC-09** | Security | `middleware/rate_limit.ts:1-120` | The limiter uses a module-level in-memory `Map` keyed by `` `${c.req.path}:${ip}` ``. Under Workers this is **per-isolate**, so it resets on cold start and is not shared across regions; because every route is mounted twice, an attacker simply alternates `/events/register` and `/api/events/register` to **double the effective budget**. It also honours an `x-forwarded-for` fallback, which a client can forge when `cf-connecting-ip` is absent. **Not fixed** — a correct implementation requires KV or Durable Objects, which is an architectural change needing approval. Note: the `cf-connecting-ip`-first ordering is already correct. |
| **SEC-10** | Security | `backend/src/index.ts` (whole file) | **No security headers anywhere**: no CSP, no `X-Frame-Options`/`frame-ancestors`, no `Referrer-Policy`, no `Permissions-Policy`. Given Tailwind's Play CDN executes inline script and inline `onclick` attributes are used across `admin.html`, a CSP is not achievable without the design work proposed in Section H. **Not fixed** — would break the site. |
| **SEC-11** | Security | `index.ts:35-84` | CORS allows **any port** on `localhost` / `127.0.0.1` with `credentials: true`. Acceptable for development, but the rule ships to production. Low practical risk (a local attacker process is already past the point of CORS), listed for completeness. |
| **SEC-12** | Security/Logic | `routes/auth.ts:36-49`, `routes/exhibitions.ts:54-77` | Check-then-insert without a UNIQUE catch: two concurrent requests could both pass the `SELECT` and the second `INSERT` would throw an unhandled 500. **Fixed** — both now catch constraint violations and return the same 400 the sequential path returns. |
| **SEC-13** | Privacy | `routes/auth.ts:41-43` | Register returns `User already registered.` for known emails and a different message otherwise ⇒ account enumeration. Preserved deliberately (changing it is a UX/legitimacy decision, not a defect fix). Recommend a neutral message + email-based recovery flow. |
| **SEC-14** | Logic | `routes/events.ts:44-107` | `SELECT COUNT(*)` capacity check and `INSERT` are separate statements, so a burst can exceed capacity (oversell). `concurrency_adversarial.test.ts` covers the *UNIQUE* duplicate-registration path but not capacity overflow. **Not fixed** — needs a transaction or conditional insert strategy; approval item. |
| **SEC-16** | Privacy | `routes/research.ts` (`GET /recruit/research/sessions`) | Returns candidate **name, email, phone and LinkedIn for every session, unpaginated**, and — unlike the dossier endpoint — writes **no** `recruiter_access_logs` row. So the one endpoint exposing bulk PII leaves no audit trail, defeating the purpose of the access-log design. **Not fixed** — adding pagination changes curator tooling UX; approval item. |
| **SEC-17** | Security (informational) | `src/admin.js:3-21` | The admin UI gate reads `localStorage.alfaaz_user` **client-side only**. Not a vulnerability — `adminRouter.use('*', requireAdmin)` (`routes/admin.ts:8`) enforces access server-side — but recorded so nobody mistakes the client gate for a control. |
| **SEC-18** | Audit integrity | `routes/admin.ts:16-27` | `logAudit()` catches and only `console.error`s write failures, so an admin mutation can succeed with **no audit record**. Same pattern swallows access-log failures in `research.ts`. Fail-open auditing. **Not fixed** — whether an audit-write failure should abort the mutation is a policy decision. |
| **SEC-19** | Privacy | `notifications/email.ts:42, 82` | Logs the recipient address (`message.to`) to the worker console. No bodies or secrets are logged, so exposure is limited to addresses appearing in tail logs. |
| **DAT-02** | Legal/data | `routes/recruit.ts:51, 79` | Consent attestation was **fabricated**. `confirmed18Plus` defaulted to `true` when the field was absent, and the `consent_records` INSERT hard-coded `1`. Meanwhile `recruit.js:804-810` sent only `{choices:{research_telemetry}}` — never `confirmed_18_plus` — despite `recruit.html` rendering a required `#ageConfirm` checkbox (`:756`) that gates the submit button (`:783`). Net effect: the stored consent artifact asserted an age attestation the server never received, so it is not evidence of anything. **Fixed both sides**: the client now sends the real checkbox value; the server requires `body.confirmed_18_plus === true` and `choices.research_telemetry === true` (affirmative consent must be explicit, not inferred from absence) and **binds the actual value**. All 16 existing test callers already send `confirmed_18_plus: true`, so the tests documented the intended contract and confirm this was the deviation. Fail-closed behaviour tested (missing field, `'yes'` string, omitted telemetry ⇒ 400 and **no** session/consent rows). |
| **DAT-03** | Data integrity | `services/evidence.ts:233`, `features.ts:113` | Game banding uses decimal `>= 0.66 / >= 0.33` while the SJT uses exact integer thirds (`3*num >= 2*span`). Two measurements of the same construct are therefore **not comparable at the boundary**, which is precisely what `cross_method_delta` and `relationship` depend on. **Not fixed** — changing a banding threshold alters how candidates are graded; approval item. |
| **DAT-04** | Data integrity | `services/evidence.ts:242-266` | The `INSERT INTO evidence` never populates `predicted_sjt_relative`, `model_version`, `prediction_status` or `game_consistency_spread`, although `config/models/relative_ridge_v1.json` and `config/feature_bands.json` exist for exactly that purpose. The ridge model is **trained but never applied**, so those columns are permanently NULL. **Not fixed** — wiring the model changes what the dossier asserts; approval item. |
| **DAT-05** | Data integrity | `services/evidence.ts:149` | `seq_conflict` is in the critical-flag set that forces confidence to `LIMITED`, but **nothing ever inserts that flag**. A telemetry sequence conflict — the main integrity threat to append-only evidence — is therefore invisible to the integrator. **Not fixed** — needs a detection rule in the telemetry ingest path; approval item. |
| **DAT-06** | Concurrency | `services/evidence.ts:152-174` | Supersede-then-insert is not atomic and `MAX(version)+1` is read separately. Two concurrent recomputes can produce identical `(session_id, parameter, version)` rows and violate `uq_session_parameter_version`. |
| **DAT-07** | Concurrency | `services/features.ts:51-53` | `DELETE FROM features` / `game_scores` then re-insert outside a transaction; a mid-flight failure leaves a session with **no** features. |
| **DAT-08** | Logic | `services/features.ts:68-90` | `GAME_SCORING_ACTIONS` for A3/C3/E3/Q3/M3 lists action names the games never emit. **Harmless today** because only the 2 core games per world run (`CANDIDATE_CORE_MINIGAMES`), but it becomes a live defect the moment an optional game is enabled. |
| **DAT-09** | Integrity | `services/sjt.ts:47-51` | `SJT_CONFIG_HASH` is a **hard-coded constant** returned verbatim by `getConfigHash()`; it is never computed from `sjt_items.json`. `config/locked_hashes.json` is verified by nothing. The hash recorded in each `recruit_sessions.config_hash` therefore proves no content immutability — item keys can be edited and the "locked" hash will still match. **Not fixed** — computing the hash from the JSON changes the value stored for every future session and would need a migration policy for existing rows; approval item. (Scoring itself is correct and exhaustively verified — see Section L.) |
| **DAT-10** | Data integrity | `routes/exhibitions.ts:73` | `Number(body.age \|\| 20)`. `exhibition.js:134` sends `parseInt(value)`, which is `NaN` for an empty field → JSON-serialised as `null` → the backend silently recorded **age 20**. On an age-gated application (`over_19`) that fabricates the very fact being attested. **Fixed** — `Number.isInteger` with a 1–120 sanity range, 400 otherwise; the coerced value is what gets bound. Range chosen to reject garbage, **not** to duplicate the `over_19` gate. Tested with `null`, `'unknown'`, `-5`, `4000`, `28.5`. |
| **DAT-11** | Validation | `routes/recruit.ts:413-457` | `POST /recruit/schedule-interview` accepted **arbitrary** `slot_date` / `slot_time` strings (only a non-empty check), so nonsense or past dates were persisted, emailed to the candidate and forwarded to the curator. **Fixed** — date must match `YYYY-MM-DD`, be a real calendar date (round-tripped through UTC to catch `2026-02-31`) and not be in the past; time must be one of the configured `interview_settings.slots_json` values (default list preserved). `slot_display` bounded to 200 chars and `notes` to 1500, since both flow into email bodies. |
| **DAT-12** | Logic | `wrangler.jsonc:40-44` + `.github/workflows/phantom_writer.yml:4-19` | **Two schedulers fire at the same instant**: the Worker cron `0 10 * * SUN` runs `scheduled` (`index.ts:207-229`), which calls `generateCuratorEssay` and inserts a row; the GitHub Action cron `0 10 * * 0` POSTs `/blogs/generate`, which does the same again. ⇒ **two autonomous essays published every Sunday**. Neither has a dedupe check. **Not fixed** — which mechanism should own publication is your decision. |
| **DAT-13** | Test quality | `tests/telemetry_evidence.test.ts:89-134` | The test asserts against a **locally re-implemented** `computeRelationshipAndConfidence` using vocabulary (`CONCORDANT`, `SHIFT_ADJACENT`, `DIVERGENT`) that **does not exist** in `services/evidence.ts` (which returns `ALIGNED`, `PARTLY_ALIGNED`, `DIFFERENT`). It passes while verifying nothing about production code — a false-confidence source worse than no test. **Not fixed** — correcting it means deciding which vocabulary is intended; approval item. |
| **DAT-14** | Hygiene | `backend/src/config/` (11 of 15 files) | `battery.json`, `features.json`, `feature_bands.json`, `integration.json`, `locked_hashes.json`, `models/relative_ridge_v1.json`, `task_definitions.json`, `task_definitions_v1.json`, `task_definitions_v2.json`, `copy/consent.json`, `copy/sjt_instructions.json` are **imported by nothing** (verified by grep across `backend/src` and `frontend/src`). Only `sjt_items.json`, `parameters.json`, `brand.json` and `copy/privacy.json` are referenced. Dead config that *looks* authoritative invites a future editor to change a file with no effect. |
| **DAT-15** | Recruitment | `services/recruit.ts` (`assignWorldOrder`) + `src/recruit.js:1575-1599` | Per-session HMAC seeds are generated, stored in `task_assignments.seeds_json` and passed into `runMiniGame`, but **no game consumes them** — there is no seeded RNG anywhere in the 14 games. Consequence: sessions are not deterministically replayable, so a disputed assessment cannot be re-simulated from stored data. |
| **DAT-16** | Test parity | old `alfaaz-recruit-system/` vs `tests/` | The old service's statistical guarantee suite (`test_gate1-6`, `calibration_preflight`, `confidence_contract`, `end_to_end_lineage`, `fail_closed`, `synthetic_profiles`, `anti_copy`) has **no 1:1 successor**. Route and crypto coverage is good; instrument-level regression coverage is missing. |
| **UX-01** | Frontend | `src/exhibition.js:118-168` | The submit handler had **no try/catch/finally**. `globalApiFetch` **rethrows** network errors (`global.js:71-74`), so a failed request left the button permanently at "Submitting…" disabled, with no message, and — because the `if (window.globalApiFetch)` branch simply skipped — the same stuck state if the helper was absent. **Fixed** — try/catch, error message, `restoreBtn()` on every failure path including the exception path. |
| **UX-02** | Frontend | `src/admin.js:84-91` | `handleCreateEvent` left "Creating…" on failure with no message; `toggleEvent`/`deleteEvent` had **no failure branch at all** — a failed delete looked like a success with a stuck button. **Fixed** — try/catch on all three, server message surfaced, original button label restored, alert on mutation failure. |
| **REP-01** | Docs | `docs/BEGINNER_DEPLOYMENT_GUIDE.md:67-68` | Tells the reader to log in with `curator@alfaaz.local` / `AlfaazAdmin2026!`. The actual seed (`database/seeds/0001_dev_seed.sql:9-10`) is `admin@alfaaz.com` / `curator2026!`. `docs/SECURITY_REVIEW.md:54` matches the seed; the guide does not. **Breaks local admin onboarding for anyone following the documentation.** |
| **REP-05** | Docs | `docs/audits/final-system-audit.md`, `ORIGINAL_REQUEST.md:61` | Table counts stated as 25 and 28. The schema defines **26**. |
| **REP-11** | Hygiene | `frontend/vercel.json` | Leftover Vercel configuration (`framework: vite`, `cleanUrls`, `rewrites`) — inert under Cloudflare Workers but actively misleading about the deployment target. |
| **REP-15** | Privacy/legal | `backend/src/config/copy/privacy.json` | Contains mojibake (`Collective â€" Volunteer`) and asserts **indefinite retention with no deletion path**, while `docs/SECURITY_REVIEW.md` claims candidate data is deletable. Two documents describe contradictory retention policy. Also **unused by any code**, so the privacy text the UI never shows contradicts what the system does. |
| **REP-16** | Accessibility | `src/recruit.js:620-625` | `announceToScreenReader()` is defined and never called — the assessment announces nothing to assistive tech, which matters for an accessibility-profile step that exists in the flow (`accessibility_profiles` table). |

### E.3 P3 findings

| ID | File(s) | Finding | Status |
|---|---|---|---|
| **UX-04** | `frontend/index.html:750-790` | Notices fetch had **no error or empty state** (grid stayed "Fetching updates…" forever on failure), fired on **both** `DOMContentLoaded` and `pageshow` (duplicate initial request), polled every 25 s **regardless of `document.hidden`**, and left a developer `console.log("✅ Full data received:", data)` dumping the whole payload. **Fixed** — error card on failure, `pageshow` only when `event.persisted`, `document.hidden` guard plus a `visibilitychange` refetch, console.log removed. | **Fixed** |
| **UX-06** | `frontend/dashboard.html:17-18` | The **only** page loading Tailwind CDN and lucide **without `defer`** (all 11 others defer them) — two render-blocking scripts in `<head>`. **Fixed** to match the established pattern; deferred execution order is unchanged relative to the `type="module"` entry. | **Fixed** |
| **UX-07** | `src/recruit.js:733`, `:857`, `config/copy/consent.json` | Assessment duration stated three ways: "20-25 minute", "11–14 minutes", "~11–13 minutes"; the copy file is versioned `2026-10-v1` while the server records consent as `2026-10-v2`. Content decision — which figure is true is yours, not mine. | Not fixed |
| **UX-09** | `index.html:415, 427` | Curator widget buttons use inline `onclick` with no `aria-expanded`, so the collapsed/expanded state is invisible to assistive tech. | Not fixed |
| **UX-10** | 12 HTML entry points | Production pages still load `cdn.tailwindcss.com` (a JIT compiler that scans the DOM and blocks first paint) and `unpkg.com/lucide@latest` **even though `tailwindcss@4`, `autoprefixer`, `postcss` and `lucide` are installed locally**. `@latest` also means the icon library can change without a deploy — an unpinnded supply-chain surface. `recruit.html:13` pins `lucide@1.28.0` while every other page floats `@latest`, so the two can render different icons after an unpkg release. Migrating to a compiled Tailwind bundle is a build change, not a quick fix. | Proposal |
| **UX-11** | `src/recruit.js:1779` | Client-side fallback slot list built `iso` with `toISOString().split('T')[0]` from **local midnight**. For UTC+5:30 that timestamp is the previous UTC day, so the label said "Tue, Nov 25" while the value sent was `2026-11-24` — the candidate booked the **wrong day**. **Fixed** by formatting from local components; note the `getDay() === 0` Sunday skip and the labels were already local-based, so they were consistent with the *fix*, not the bug. | **Fixed** |
| **PERF-01** | `frontend/public/images/favicon.ico` | **183,657 bytes** for a favicon — the single largest image in the bundle, ~22× the 8,226-byte `icon-192.png`. Loaded on all 12 pages. | Proposal |
| **PERF-02** | `frontend/public/images/slider-*.jpg` | slider-3 **146,696 B**, slider-2 134,228 B, slider-1 123,932 B, slider-6 123,197 B, slider-5 61,617 B, slider-8 58,902 B, slider-7 55,842 B, slider-4 50,859 B — **755 KB total**, all precached by `sw.js` at install and all preloaded by the index preloader. | Proposal |
| **PERF-03** | `index.html:235-237` | Hero `<video autoplay loop muted playsinline preload="auto">` served from Cloudinary — `preload="auto"` pulls the whole asset during the critical path. | Proposal |
| **PERF-04** | `frontend/public/service-worker.js` | A 3-line `importScripts('/sw.js')` wrapper that **nothing registers** (`global.js:162` registers `/sw.js`), kept alive only by the legacy rewrite in `index.ts:132-137`. Two SW filenames for one worker is an operational trap. | Proposal |
| **PERF-05** | `public/sw.js:111-139` | Both caching strategies persisted **any** `response.type === 'opaque'` response. Opaque responses have status 0 and unreadable headers, so a CORS-blocked or errored cross-origin reply was cached as if valid and served offline thereafter. **Fixed** — `isCacheableResponse()` now caches `ok` responses, and opaque ones **only** for the allowlisted third-party static hosts (`unpkg.com`, `cdn.tailwindcss.com`, `fonts.googleapis.com`, `fonts.gstatic.com`), never same-origin. This preserves genuine offline CDN caching (cross-origin `no-cors` fetches are inherently opaque) while removing the failure-hoarding. | **Fixed** |
| **REP-02** | `docs/DATABASE_MIGRATION.md:108-116` | Unclosed ```bash fence at :109 swallows list item "4." and the page **omits `wrangler d1 migrations apply DB --remote`** — the step that actually deploys a schema. | Not fixed |
| **REP-03** | `README.md:24-30` | Links use absolute `file:///…/alfaaz-project/cloudflare-native/docs/…` URLs, which resolve into the **sibling** checkout or nowhere on any other machine. | Not fixed |
| **REP-04** | `docs/SOURCE_CODE_AUDIT.md:4` | Declares branch `codex/release-candidate`; this repo is on `main`. The document audits the **old** tree — historical, but not labelled as such. | Not fixed |
| **REP-06** | `types.ts:13`, `.dev.vars.example:6` | `ADMIN_PASSWORD` is **dead** — declared, never read (bootstrap uses `BOOTSTRAP_ADMIN_PASSWORD`), yet `.dev.vars.example` ships `curator2026!` (the dev-seed password) as its value and `cloudflare-full-system-audit.md:550` lists it as a required production secret. | Not fixed |
| **REP-07** | 3 files | `tests/helpers/d1_mock.ts:3`, `scripts/verify_challenger_2.mjs:1` and `scripts/bootstrap-admin.js:179` require `node:sqlite` (**Node ≥ 22.5**), but `docs/BEGINNER_DEPLOYMENT_GUIDE.md:10` instructs Node 20.x and `package.json` declares no `engines`. On Node 20 the test suite cannot start. | Not fixed |
| **REP-08** | `scripts/verify_challenger_2.mjs:267` | Comment says "3^7 = 2187"; the harness in fact exhaustively tests **4^7 = 16,384** profiles (7 scenarios × 4 options). The code is right, the comment misstates the guarantee. | Not fixed |
| **REP-09** | `scripts/bootstrap-admin.js:180` | `--execute-local` targets `./alfaaz_data.db` (the **old** project's SQLite file); `wrangler d1 --local` stores state under `.wrangler/state/v3/d1/`. The flag silently operates on the wrong database. | Not fixed |
| **REP-10** | `docs/SECURITY_REVIEW.md:22, 92` | Claims CORS permits `*.vercel.app`; `index.ts:64` allows the exact origin `alfaazcollective.vercel.app` only. Here the **code is safer than the documentation** — the reverse of the usual drift. | Not fixed |
| **REP-13** | `.agents/teamwork/**` (58 files, 5,241 lines) | AI-orchestration scaffolding (BRIEFING, DISPATCH, progress, handoff, survey, review, challenge notes) is **tracked**, and `.gitignore` has no `.agents` rule. Grep-verified: contains dev-only credentials (`curator2026!`, `alfaaz2026!`, `AlfaazAdmin2026!`) and internal security discussion, but **no production secret and no candidate PII**. `tests/security_seed.test.ts:15` already excludes `.agents` from its scans. | Needs decision |
| **REP-17** | `frontend/public/llms.txt:32` | Stated "The backend is a FastAPI service" — false since the migration; a machine-readable descriptor that misinforms any agent reading the site. **Fixed.** | **Fixed** |

### E.4 Complete tracked-file coverage (including files the brief omitted)

The brief listed a subset of files. All **188 tracked files** were assigned; groups not mentioned in the
brief are marked ★. Coverage level: **D** = read in full, **T** = targeted line verification of every
finding cited, **S** = structural survey + grep verification of references, **G** = grep/classified only.

| Group | Files | Coverage | Result |
|---|---|---|---|
| ★ `.agents/teamwork/**` | 58 | S + G | REP-13. No production secret, no PII. Decision needed. |
| `backend/src/routes/**` | 11 | D/T | auth, blogs, clubs, curator, events, exhibitions, notices, recruit, research, vault, admin. Findings SEC-02…SEC-19, DAT-02, DAT-10…DAT-12. |
| `backend/src/services/**` | 7 | D/T | curator (SEC-06), evidence (DAT-01…DAT-07), features (DAT-01, DAT-07, DAT-08), sjt (DAT-09), + 2 others. |
| ★ `backend/src/config/**` | 15 | S | 11 of 15 imported by nothing (DAT-14); `copy/privacy.json` contradiction (REP-15). |
| `backend/src/{auth,middleware,notifications}/**`, `index.ts`, `types.ts` | 6 | D | SEC-01 context, SEC-04, SEC-05, SEC-09, SEC-10, SEC-11, DAT-12, REP-06. |
| `tests/**` | 11 | D/T | All 10 suites executed. `error_paths.test.ts` extended (+5 tests). DAT-13 flags a vacuous test. |
| `frontend/src/**` | 20 | D/T | admin, dashboard, exhibition, login, register, reset, research, recruit, submit, blogs, post. UX-01, UX-02, UX-08, UX-11, SEC-08. |
| `frontend/*.html` | 12 | D/T | index, admin, dashboard, recruit, research, blogs, post, submit, login, register, reset, exhibition. UX-04, UX-06, UX-09, PERF-03, plus `global.css` contrast (Section H). |
| `frontend/global.js`, `global.css` | 2 | D | Token handling `:46-75`; contrast tokens `:8-29`; noise overlay `:52-58`. |
| ★ `frontend/public/**` | 17 | T/S | `sw.js` (PERF-05 fixed), ★`service-worker.js` orphan (PERF-04), ★`llms.txt` (REP-17 fixed), manifest, icons, slider images (PERF-01/02). |
| ★ `frontend/vercel.json` | 1 | S | REP-11 inert leftover. |
| ★ `frontend/api/**`, `components.js` | 4 | S | Legacy Vercel/`pg` proxies + dead `<alfaaz-nav>`; already deleted in the working tree by the prior CLI. Deletions verified reference-free and confirmed correct. |
| `database/**` | 2 | D | 26-table schema; dev seed (source of REP-01 truth). |
| `docs/**` | 8 | D | REP-01…REP-05, REP-10; **SEC-01 located in `audits/cloudflare-full-system-audit.md`**. |
| `scripts/**` | 3 | D/T | `verify_challenger_2.mjs` (executed, REP-08), `bootstrap-admin.js` (REP-09), ★`recon.js` (deleted; scratch DB recon reading `../../alfaaz_data.db`, no refs — correct deletion). |
| `.github/workflows/phantom_writer.yml` | 1 | D | DAT-12 duplicate trigger; `${{ secrets.PHANTOM_SECRET_TOKEN }}` used correctly (no hardcoded value); `curl -v` echoes headers (GitHub masks them — low risk); no `permissions:` block. |
| Root config | 7 | D | `wrangler.jsonc` (REP-14, DAT-12), `package.json` (+`test:hardening`), `tsconfig.json`, `.gitignore` (no `.agents` rule), `.dev.vars.example` (REP-06), 2 lockfiles. |
| **Total** | **188** | — | All assigned; 5 deletions and 1 untracked report inherited from the prior CLI and independently re-verified. |

### E.5 Dependencies and lockfiles

Root `package.json`: single runtime dependency `hono`; dev deps `@cloudflare/workers-types`,
`typescript`, `vitest`, `wrangler`. `frontend/package.json`: `lucide`, `autoprefixer`, `postcss`,
`tailwindcss`, `vite`. Both lockfiles are `lockfileVersion: 3` and internally consistent.
**No `pg`/postgres anywhere** — the legacy `pg` dependency reported in the earlier audit is confirmed
removed. No unused dependencies detected. `package.json` gains `test:hardening` (prior CLI change, kept).

---

## Section F — Security Report

### F.1 Controls that are genuinely sound (verified in code, not assumed)

| Control | Implementation | Verified at |
|---|---|---|
| Password storage | PBKDF2-HMAC-SHA256, **100,000 iterations**, 16-byte random salt, per-record salt, **constant-time** digest comparison | `backend/src/auth/crypto.ts:58-131` |
| Session tokens | HMAC-SHA256, 7-day default, header `alg`/`typ` validated before verification (algorithm-confusion defense) | `crypto.ts:133-198` |
| Reset tokens | Separate 15-minute TTL, **SHA-256 `consumed_tokens`** replay table, `password_reset_at` invalidation of older tokens | `routes/auth.ts:104-235` |
| Production boot guard | Refuses to start if `JWT_SECRET` is unset/empty in production | `crypto.ts:6-20` |
| Admin boundary | `adminRouter.use('*', requireAdmin)` — server-side, covers **every** admin endpoint including `/admin/submissions` | `routes/admin.ts:8` |
| Candidate PII redaction | `GET /recruit/interview-booking/:id` returns only slot fields to unauthenticated callers; name/email/phone/notes require a verified ADMIN token | `routes/recruit.ts` (booking GET) |
| Anti-ranking | Research API refuses to emit a composite ranking score | `routes/research.ts:~52-64` |
| CORS | Explicit origin allowlist, not `*` | `index.ts:35-84` |
| Email provider | Auto-routes on presence of `MAKE_WEBHOOK_URL`; defaults to in-memory dev provider | `notifications/email.ts:150-158` |
| Consent records | Versioned (`2026-10-v2`) and stored separately from identity, so identity can be deleted while consent survives | `routes/recruit.ts` batch insert |

### F.2 Attack-surface assessment

**Authentication and authorization.** After the fixes in this audit the token model is type-separated:
session tokens (`ADMIN`/`PARTICIPANT`/`USER`) authenticate API access; reset tokens can only reach
`/auth/reset-password`. The residual gap is **revocation latency** (SEC-05) — claims live up to 7 days
because they are re-read only at login. The fix is a DB status re-check in `requireAdmin`, which needs
the test suite adjusted first.

**Injection.** All SQL goes through D1 prepared statements with `.bind()`; grep found no string
concatenation into SQL anywhere in `backend/src`. Stored-XSS exposure was confined to the two JS
attribute sinks in `admin.js` (SEC-08, fixed); every other render site uses `window.escapeHtml`, which
correctly escapes `& < > " '`. Rendered HTML from the Curator is the one place trusting model output —
`blogs` content is inserted as HTML and is only written by a secret-token endpoint (now constant-time,
SEC-07).

**Broken access control.** Two IDOR-class defects existed: vault file read (SEC-03, fixed) and the bulk
research list (SEC-16, open — gated by admin role, but unlogged and unpaginated). `isValidUrl`
accepting `data:` (fixed) would have let an attacker store multi-megabyte payloads and, in some render
contexts, execute them.

**Bot and abuse resistance is the weakest area.** Turnstile fails open (SEC-02), the rate limiter is
per-isolate and per-path and therefore bypassable by path aliasing (SEC-09), and `/recruit/schedule-interview`
had no rate limit at all while sending email to two addresses — a spam/SSSR vector now at least
input-validated (DAT-11) but still unthrottled.

**Secrets handling.** One P0 exposure (SEC-01) plus the structural weakness that the Gemini key was
transported in a URL (SEC-06, fixed). Cloudinary uses an **unsigned upload preset** (`alfaaz_vault`)
exposed client-side — inherited from the old project; abuse is bounded by preset settings and must be
reviewed in the Cloudinary dashboard, not in this repository.

**Privacy.** `docs/…/privacy.json` claims indefinite retention while `SECURITY_REVIEW.md` implies
deletion is available (REP-15). The admin delete-account path (`routes/admin.ts:460`) does cascade across
`submissions` and the recruitment tables, so deletion **is** implemented — the documentation is what is
wrong.

### F.3 What was **not** tested

Stated plainly so the security posture is not over-read:

- **No penetration testing against production.** No destructive or high-volume requests were sent to
  `alfaazcollective.org`.
- **No live Turnstile, email, or Gemini/Groq invocation.** Per the brief, no real emails were sent and no
  external API spend was incurred. The `DevEmailProvider` in-memory preview is what exercised email
  paths during tests.
- **No verification of production secret provisioning.** `wrangler secret list` was not run; whether
  `JWT_SECRET`, `GEMINI_API_KEY`, `PHANTOM_SECRET_TOKEN` and `TURNSTILE_SECRET_KEY` are currently set in
  the live worker is **unknown**.
- **No authentication bypass attempt, session-hijack or IDOR exploitation against live candidate records.**
- **No browser-based UI testing** of the fixed frontend paths (see Section L).

---

## Section G — Performance Report

**Method note:** these are **static code and asset measurements** — byte counts, request sequences and
blocking analysis read from source. No Lighthouse run, no field RUM data and no synthetic load test was
performed, so **no Core Web Vitals figure is quoted anywhere in this report**. Fabricating a speed score
would violate the brief, and the earlier report's "Active & Verified" style claims are not a substitute
for measurement.

### G.1 First load path (index)

The critical path is heavier than the architecture requires:

1. **Tailwind Play CDN** (`cdn.tailwindcss.com`) — a JIT compiler that must download, parse, execute and
   *scan the DOM* before utility classes resolve. Present on all 12 pages. `tailwindcss@4` is already a
   local dependency, so this is a build-config omission, not a necessity (UX-10).
2. **`unpkg.com/lucide@latest`** — a second third-party script, unpinned, on every page.
3. **Hero video** `preload="auto"` from Cloudinary during the critical path (PERF-03).
4. **Preloader overlay** (`index.html:430-478`): preloads **17** Cloudinary `w_800` images, waits for
   ≥50% or 1.5 s, then executes a cumulative `delay += 10` cascade totalling ~1.95 s beneath a
   `z-index: 3000` full-screen overlay. In the worst case a visitor sees a branded splash for ~3.5 s
   before the page is interactive, and the same block then pre-warms `/ping`. This is the single largest
   perceived-performance lever on the site.
5. **183 KB favicon** requested on all 12 pages (PERF-01).

### G.2 Asset weights (measured)

| Asset | Bytes | Note |
|---|---|---|
| `favicon.ico` | **183,657** | ~22× `icon-192.png`; loaded site-wide |
| `slider-3.jpg` | 146,696 | ┐ |
| `slider-2.jpg` | 134,228 | │ |
| `slider-1.jpg` | 123,932 | │ **755 KB across 8 sliders**, all precached at SW install |
| `slider-6.jpg` | 123,197 | │ and all preloaded by the index preloader |
| `slider-5.jpg` | 61,617 | │ |
| `slider-8.jpg` | 58,902 | │ |
| `slider-7.jpg` | 55,842 | │ |
| `slider-4.jpg` | 50,859 | ┘ |
| `icons/maskable-512.png` | 44,961 | reasonable |
| `icons/icon-512.png` | 44,956 | reasonable |
| `icons/icon-192.png` | 8,226 | reference point for favicon waste |

The `sw.js` install handler `cache.addAll(...)` over the full slider set means a **first-visit install
fetches ~755 KB** before the worker is considered installed — a self-inflicted cost on the very visit the
preloader is already delaying.

### G.3 Bundles

`vite build` output (measured, this audit): `recruit` **205.06 kB / 50.08 kB gzip** (dominant — the 14
minigames and SJT in one chunk), `research` 52.87 kB / 12.32 kB, `admin` 25.14 kB / 6.60 kB,
`dashboard` 12.56 kB, `main` 12.27 kB, `exhibition` 4.77 kB, `global` 3.31 kB; CSS `recruit` 16.99 kB /
4.04 kB, `global` 9.48 kB / 3.06 kB. Gzipped JS across the app is ~80 kB — **fine for the architecture**;
`recruit` is the only chunk worth code-splitting (per-world lazy loading would cut the initial assessment
payload by roughly two thirds).

### G.4 Worker-tier costs

- **24 route mounts with dual registration** means every request traverses more matcher work than
  necessary and every `rateLimiter` middleware allocates two entries per attack.
- `interview-slots` runs `SELECT … FROM interview_bookings` **unindexed by status** on each call, then
  loops up to 10 days — trivially cheap at current volume, but it is an unbounded read.
- `extractSessionFeatures` reads **all** `telemetry_events` for a session (`SELECT *` with no filter) and
  `integrateSessionEvidence` issues **7 sequential awaited INSERTs** rather than a batch. D1 bills per
  statement, and Workers enforce a 10 ms CPU limit on the free tier, so evidence integration is the most
  likely place to hit `worker_overloaded` under a burst of completions.
- `routes/notices.ts` + KV: correct pattern (cache with explicit invalidation on publish —
  `blogs.ts:80-82` deletes `notices_feed`).

### G.5 Recommendations ranked by (impact ÷ effort)

1. **Remove or shrink the preloader cascade** — ~1.95 s of pure artificial delay, zero benefit.
2. **Replace the favicon** with a ~5 KB 32×32 `.ico`/SVG pair — 178 KB saved site-wide per visit.
3. **Compile Tailwind locally**, drop the Play CDN from all 12 pages; **pin lucide** to the installed
   version and serve it from `/assets`.
4. **Serve sliders at responsive widths** (`s_` / `q_auto` Cloudinary transforms already in use for the
   gallery) and drop them from the SW install precache into runtime caching.
5. **`preload="metadata"` (or `none`)** on the hero video; consider a poster image.
6. **Batch the 7 evidence INSERTs** and add a `LIMIT`/index to the bookings query.
7. **Split the `recruit` chunk per world.**

---

## Section H — UX and Design

### H.1 Small corrections implemented in this audit

Per the brief, low-risk consistency/accessibility/broken-interaction corrections were implemented
directly. None change the visual design language and all are reversible:

- **Stuck-button fixes** — exhibition submit (`UX-01`) and the three admin event mutations (`UX-02`).
  Before: a network failure left a disabled "Submitting…" / "Creating…" control with **no message**,
  indistinguishable from success or from a hung server. After: every failure path restores the control
  and shows either the server's message or an explicit connectivity error.
- **Notices board** (`UX-04`) — failure now renders an "unavailable" card instead of an eternal
  "Fetching updates…"; the duplicate first fetch is gone; polling pauses when the tab is hidden and
  refreshes on return.
- **`dashboard.html` script ordering** (`UX-06`) — the last two render-blocking third-party scripts on
  the site removed, matching the other 11 pages.
- **Interview slot dates** (`UX-11`) — the IST off-by-one that booked the wrong day.
- **Console hygiene** — developer payload dump removed.

### H.2 Verified accessibility defects **not** silently fixed

| ID | Evidence | Why it needs a decision |
|---|---|---|
| **UX-03 (P2 — corrected from P1)** | `frontend/global.css:13-17`, measured against `--bg-primary: #f4f1ea`: `--text-primary: #2d312e` = **11.71:1 pass**; `--text-secondary: #626764` = **5.11:1 pass**; `--accent-gold: #bd6f5d` = **3.33:1 fail**; `--accent-green: #7a8f7c` = **3.08:1 fail**; `--accent-red: #c96b65` = **3.22:1 fail**; white-on-`#bd6f5d` = **3.75:1 fail**. Accent text appears at 10–12px — `.archive-meta` (`blogs.html:36`), badges (`dashboard.html:37-39`, `admin.html:40-43`), toasts (`dashboard.html:67-68`), `Post-Approval Req.` (`admin.html:136`), `Collective Intelligence` (`dashboard.html:230`) — which is below the WCAG large-text threshold (18pt / 14pt bold), so 4.5:1 applies and they miss it. **Correction notice:** an earlier revision of this report asserted `--text-secondary: #8b908d` ≈ 2.9:1. That hex does not exist in `global.css` (repo-wide grep found it only inside this report); the value was inherited from working notes instead of read from the file. Body and secondary text are **not** failing, so the finding is regraded P1 → P2. | Darkening the three accents to clear 4.5:1 shifts the brand palette site-wide — a design decision, not a bug fix. Alternatives: keep the accents for borders/large type only and introduce darker `-text` variants for small labels. Approved before any token edit is applied. |
| **UX-05** | `index.html:430-478` preloader at `z-index: 3000` with a ~1.95 s artificial cascade | Removing it changes the intended brand moment. Proposed, not applied. |
| **UX-08** | `recruit.js:620-625` `announceToScreenReader()` defined, never called | Additive and safe, but touches assessment timing; left for the recruitment review so announcements don't desync from game cues. |
| **UX-09** | `index.html:415, 427` curator toggles lack `aria-expanded` | One-attribute fix; deferred to bundle with the CSP work that also touches those handlers. |
| — | `global.css:52-58` fixed full-viewport SVG noise overlay at `z-index: 9999` | Worth browser-verifying that it never intercepts pointer events before any z-index refactor. |

### H.3 Design proposal (requires approval — no substantial redesign was implemented)

The brief mandates that any substantial redesign, new design system or major animation layer be presented
as a proposal. Assessment after reading all 12 pages, `global.css` and `global.js`:

**The site does not need a redesign.** It has a coherent, distinctive identity (warm paper `#f4f1ea`,
terracotta accents, serif display, grid-line motifs) that suits a Kashmiri arts collective, and the
recruitment studio is genuinely well-composed. What it has is an **unfinished engineering layer**.

- **Phase 1 — Foundations (low risk, high value).** Compile Tailwind locally and delete the Play CDN;
  pin and self-host lucide; introduce a real `tokens.css` with AA-compliant pairs derived from the
  existing palette (compliant neighbours sit very close to the current hues — a nudge, not a rebrand);
  add security headers once inline scripts are gone. **Outcome:** faster, accessible, hardened,
  visually near-identical.
- **Phase 2 — Interaction correctness.** Replace remaining inline `onclick` handlers with `data-*` +
  delegated listeners (the pattern established in this audit for `admin.js`) — the prerequisite for CSP;
  wire `announceToScreenReader` through the assessment; unify the three conflicting duration claims into
  one copy source driven by `config/copy/*`.
- **Phase 3 — Experience layer (optional).** Replace the preloader with a genuine skeleton state, make
  the slider responsive-image rather than fixed JPGs, split the `recruit` bundle per world, and promote
  the `.agents`-documented motion work into a small reduced-motion-respecting system.

Explicitly **not** proposed: a new component framework, a rewrite of the vanilla JS frontend, or a new
colour system. The wins are in Phases 1 and 2.

---

## Section I — Repository Cleanup Report

Nothing was deleted by this audit. Deletions already in the working tree (by the prior CLI) were
independently re-verified as reference-free and are **endorsed**. Ambiguous items await your approval.

### I.1 Classification table

| Bucket | Items | Evidence | Action |
|---|---|---|---|
| **1. Definitely temporary** | `scripts/recon.js` · `frontend/api/blog.js` · `frontend/api/blogs.js` · `frontend/api/notices.js` · `frontend/components.js` | recon.js was scratch DB reconnaissance reading `../../alfaaz_data.db` (old-project path), zero refs. The three `frontend/api/*` files were Vercel-era `pg` proxies superseded by `backend/src/routes/notices.ts`; grep shows only docs mention them. `components.js` was a dead `<alfaaz-nav>` element; only residue is a stale comment at `src/dashboard.js:44`. | **Already deleted — endorse.** |
| **2. Possibly obsolete — needs review** | ★ `frontend/vercel.json` (inert under CF) · ★ `frontend/public/service-worker.js` (3-line orphan; nothing registers it; kept alive by `index.ts:132-137`) · ★ 11 unused `backend/src/config/*.json` (DAT-14) · ★ `docs/SOURCE_CODE_AUDIT.md` (old tree, wrong branch) · ★ `docs/audits/cloudflare-full-system-audit.md` (stale **and** the SEC-01 leak source) · `ADMIN_PASSWORD` in `types.ts:13` + `.dev.vars.example:6` (REP-06) · `bootstrap-admin.js --execute-local` dead path (REP-09) | Each verified to have no runtime effect — **except** the SW rewrite, which must persist until existing clients drain, and the config JSONs, which are instrument *specification* documentation. | **Approval required.** Suggested: delete `vercel.json`; drop the SW wrapper only after the rewrite is retired; relabel or delete inert config; **redact, do not delete**, the stale audit. |
| **3. Required — do NOT delete** | `database/migrations/0001_initial_schema.sql` · `database/seeds/0001_dev_seed.sql` · all 11 `tests/**` incl. `helpers/d1_mock.ts` · `scripts/verify_challenger_2.mjs` (bound to `npm run test:hardening`) · `scripts/bootstrap-admin.js` (working path) · both lockfiles · `wrangler.jsonc` · `tsconfig.json` · `.dev.vars.example` · `backend/src/config/{sjt_items,parameters,brand}.json` · `frontend/src/**` · all 12 `frontend/*.html` | Referenced by build, test or runtime paths verified by grep. | Keep. |
| **4. Intentionally generated, correctly ignored** | `.wrangler/state/**` · `frontend/dist/**` | Absent from `git status` even though `vite build` and wrangler local state ran in this audit; `.gitignore` covers `dist/` and `.wrangler/`. | No action. |
| **5. Sensitive / environment-specific** | **SEC-01** JWT literal (`docs/audits/cloudflare-full-system-audit.md:233-234`, tracked, in `099f1b7`) · `wrangler.jsonc` resource IDs (D1 `28a3ae5b-…`, KV `a199adbc-…`) + `alfaaz2k20.workers.dev` · Cloudinary unsigned preset `alfaaz_vault` in client code · dev credentials in `.agents/teamwork/**` | Read-only inspection. D1/KV IDs and the workers.dev subdomain are identifiers Cloudflare does not treat as secrets — acceptable to track. The unsigned preset is inherited and constrained in the Cloudinary dashboard, not the repo. `.agents` grep-verified: **no** production secret, **no** candidate PII. | **Rotation + redaction: approval required.** |

### I.2 ★ `.agents/teamwork/**` — the largest cleanup question

**58 tracked files, 5,241 lines** of multi-agent build scaffolding (briefings, dispatches, handoffs,
progress, surveys, challenge reports, gate status). `.gitignore` has **no `.agents` rule**, and
`tests/security_seed.test.ts:15` already excludes `.agents` from secret scans — so someone recognised the
risk without acting on it.

Not application material, and not dangerous, but they are now the repository's largest documentation
surface and they contain internal security analysis of your own system. Recommendation: keep
`ORIGINAL_REQUEST.md` and one `BRIEFING.md` as genuine decision history, then either
`git rm -r --cached .agents` + ignore, or move the rest to `docs/archive/`. It is a 58-file change with no
functional benefit, so it waits for your decision rather than happening silently.

---

## Section J — Data Integrity Report

### J.1 Constraints present and effective

- `consumed_tokens` (SHA-256 hashes) — makes reset tokens genuinely single-use.
- `interview_bookings` `UNIQUE(slot_date, slot_time)` + `UNIQUE(session_id)` — double-booking is
  prevented by the **database**, not merely application logic; verified by `error_paths.test.ts` §3 and
  `concurrency_adversarial.test.ts`.
- FK cascades across recruitment tables — admin user deletion really does remove candidate data.
- `telemetry_events` seq-ordered append-only; `evidence.version` + `is_superseded` provide lineage.
- UNIQUE constraints on `event_registrations`, `club_applications`, `exhibition_applications` — the prior
  CLI's try/catch additions now catch something real.

### J.2 Integrity defects found

| ID | Defect | Consequence |
|---|---|---|
| **DAT-01 (P1)** | A2 counter-vs-ratio bounds mismatch | `conscientiousness` game evidence HIGH for every completer; corrupts delta/relationship/confidence |
| **DAT-02 (P2)** | Consent attestation fabricated server-side | `consent_records.confirmed_18_plus = 1` was **not evidence of consent** — the most serious finding here (fixed) |
| **DAT-03** | SJT exact-thirds vs game decimal banding | Cross-method comparison inconsistent at band boundaries |
| **DAT-04** | Ridge model trained, never applied | 4 evidence columns permanently NULL; `model_version` implies capability not running |
| **DAT-05** | `seq_conflict` never inserted | The critical-flag safety valve is unreachable |
| **DAT-06/07** | Non-atomic supersede; non-transactional feature rebuild | Concurrent recompute can violate `uq_session_parameter_version` or wipe a session's features |
| **DAT-08** | Stale action names for A3/C3/E3/Q3/M3 | Latent until optional games are enabled |
| **DAT-09** | `SJT_CONFIG_HASH` hard-coded | The immutability claim in every `recruit_sessions` row is unearned; `locked_hashes.json` verifies nothing |
| **DAT-10** | Age defaulted to 20 | An age-gated application stored a number the applicant never gave (fixed) |
| **DAT-11** | Arbitrary interview slot strings | Nonsense/past bookings persisted and emailed (fixed) |
| **DAT-12** | Dual cron | `blogs` gains 2 rows/week instead of 1 |
| **DAT-15** | Seeds generated, unused by games | `task_assignments.seeds_json` claims reproducibility the games don't provide |
| **REP-14** | `mock-storage.alfaaz.local` URLs written to `submissions` | Dead references already exist in production rows |

### J.3 Timezone audit (interview booking)

Workers run in **UTC**, so the server's generator is internally consistent — `toISOString()`,
`toLocaleDateString` and `getDay()` all resolve against UTC — but times are offered with no timezone and
the client appends `" IST"` to `slot_display` (`recruit.js:1953`). So **"03:00 PM" is meant as IST but
derived from a UTC day boundary**: for a UTC+5:30 audience a slot generated shortly after 18:30 UTC can be
labelled a different day than a candidate expects. Two decisions rather than my guess: (i) whether
interview times are IST (then the generator should build dates in `Asia/Kolkata`), and (ii)
`interview_settings` stores **no timezone column**, so the server currently cannot know. The unambiguous
client-side off-by-one (UX-11) is fixed.

### J.4 Recommendations

1. Fix DAT-01 by computing genuine `exception_flagging_precision` — matches the name already declared in
   `FEATURE_METADATA` and introduces no new selection rule.
2. Unify banding on exact integer thirds (DAT-03); `test:hardening` already proves the SJT side.
3. Fold feature extraction + evidence integration into one batch, then recompute affected sessions with
   the existing `forceRecompute` flag — a **production data migration**, approval required.
4. Add `timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'` to `interview_settings` (schema change → approval).
5. Compute `SJT_CONFIG_HASH` from `sjt_items.json` at build time and gate it with `locked_hashes.json`.

---

## Section K — Secrets and Configuration Checklist

**No secret values are printed in this report.** Locations only. Nothing was added, rotated or removed.

### K.1 Secret inventory

| Name | Kind | Where expected | Currently found at | Status |
|---|---|---|---|---|
| `JWT_SECRET` | **Secret** | Cloudflare Worker Secret | `wrangler.jsonc:45-49` **vars** does **not** contain it (correct). **Leaked in plaintext in `docs/audits/cloudflare-full-system-audit.md:234`**, committed in `099f1b7` | 🔴 **P0 — SEC-01. Treat as compromised; rotation required before next deploy.** |
| `GEMINI_API_KEY` | **Secret** | Worker Secret | Declared `types.ts`; consumed `services/curator.ts:156,164,249`. Was also transported in a URL query string | 🟡 Value not exposed in repo; transport fixed (SEC-06). Live provisioning unverified. |
| `GROQ_API_KEY` | **Secret** | Worker Secret | `services/curator.ts:192` fallback | 🟡 Not in repo. Provisioning unverified. |
| `PHANTOM_SECRET_TOKEN` | **Secret** | Worker Secret + GitHub Actions secret | `routes/blogs.ts:48`; workflow uses `${{ secrets.PHANTOM_SECRET_TOKEN }}` correctly | 🟢 No hardcoded value in the workflow. |
| `MAKE_WEBHOOK_URL` | Semi-secret (contains an auth path) | Worker Secret | `notifications/email.ts:150-158` | 🟡 Not in repo. |
| `CLOUDFLARE_EMAIL_TOKEN` | **Secret** | Worker Secret | `notifications/email.ts` | 🟡 Not in repo. |
| `TURNSTILE_SECRET_KEY` | **Secret** | Worker Secret | `middleware/rate_limit.ts:45-77` | 🔴 Even if provisioned, unused when absent (SEC-02 fail-open). |
| `ADMIN_PASSWORD` | — | — | `types.ts:13`, `.dev.vars.example:6` | ⚪ **Dead variable** (REP-06) — never read; bootstrap uses `BOOTSTRAP_ADMIN_PASSWORD`. Its example value equals the dev-seed password. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Local only | `scripts/bootstrap-admin.js` | Generated/hashed locally; prints generated password to stdout (acceptable for a CLI) | 🟢 |
| Cloudinary cloud `dmqwjpmjk`, preset `alfaaz_vault` | Public identifier | Client code | `frontend/src/{submit,dashboard,exhibition,index}.js` | 🟡 Expected client-side for unsigned uploads; **preset must be constrained in the Cloudinary dashboard**. |
| D1 id `28a3ae5b-…`, KV id `a199adbc-…`, `alfaaz2k20.workers.dev` | Identifiers | `wrangler.jsonc` | Tracked in `wrangler.jsonc` | 🟢 Acceptable — not secrets. |

### K.2 Dev credentials present in tracked files (not production, but should not be public)

`database/seeds/0001_dev_seed.sql:8-11` (admin `curator2026!`, volunteer `alfaaz2026!` as salted hashes),
`.dev.vars.example:6`, `docs/BEGINNER_DEPLOYMENT_GUIDE.md`, `docs/SECURITY_REVIEW.md:54` and the
`.agents/teamwork/**` notes. All are **local-development** values against a dev seed. They are listed
because they are also **wrong** in the deployment guide (REP-01), which is the actual breakage.

### K.3 Configuration correctness

| File | Check | Result |
|---|---|---|
| `wrangler.jsonc` | `nodejs_compat`, `workers_dev`, assets, custom domains | ✅ present |
| `wrangler.jsonc` | `r2_buckets` for `VAULT_BUCKET` | ❌ **absent** (REP-14) |
| `wrangler.jsonc` | `vars` free of secrets | ✅ (JWT key removed) |
| `wrangler.jsonc` | cron `0 10 * * SUN` | ⚠️ duplicates the GitHub Action (DAT-12) |
| `.gitignore` | ignores `dist/`, `.wrangler/` | ✅ verified working |
| `.gitignore` | ignores `.agents/` | ❌ no rule (REP-13) |
| `.dev.vars.example` | mirrors real required vars | ⚠️ ships the dead `ADMIN_PASSWORD` (REP-06) |
| `tsconfig.json` / build | typecheck | ✅ exit 0 |
| `package.json` | `engines` field for Node ≥ 22.5 | ❌ missing; guide says 20.x (REP-07) |
| `.github/workflows/phantom_writer.yml` | secret handling | ✅ no hardcoded token; ⚠️ `curl -v` echoes headers (masked by GH); ⚠️ no `permissions:` block |

### K.4 Recommended safe-handling rules to adopt

1. Add a pre-commit / CI scan that fails on high-entropy literals in **`docs/**` too** —
   `tests/security_seed.test.ts` currently scans code and excludes `.agents`, and would **not** have
   caught SEC-01.
2. Never quote a secret line as "Evidence" in an audit document; reference `file:line` only.
3. Move all real values to `wrangler secret put`; keep `vars` for non-secret config only.
4. Rotate on a schedule and on any repository exposure event; document the rotation runbook.

---

## Section L — Test Results

Everything below was **actually executed** in this session against
`C:\Users\saqrt\OneDrive\Desktop\alliswell\cloudflare-native`. Where a check was not run, it says so.

### L.1 Commands executed and results

| # | Command | Result |
|---|---|---|
| 1 | `npx tsc --noEmit` | ✅ **exit 0**, no diagnostics |
| 2 | `npx vitest run` | ✅ **10 files / 108 tests passed, 0 failed** (was 103 before this audit; +5 added) |
| 3 | `npx vitest run tests/error_paths.test.ts` | ✅ 13/13 after vault + consent + boundary tests added |
| 4 | `npm run test:hardening` (`node scripts/verify_challenger_2.mjs`) | ✅ *"ALL EMPIRICAL CHALLENGES PASSED WITH ZERO FAILURES"* — **exhaustively tested all 16,384 SJT response profiles** (7 scenarios × 4 options = 4^7); 0 overflows, 0 NaNs, 0 invalid bands; all 7 constructs satisfy `min ≤ raw ≤ max`, `0 ≤ relative ≤ 1` and valid integer thirds |
| 5 | `npx vite build` (in `frontend/`) | ✅ built in **4.32 s**, 19 hashed assets emitted; largest chunk `recruit` 205.06 kB / 50.08 kB gzip |
| 6 | `git status` / `git diff --cached` / `git log` | ✅ HEAD `9d467fe` unchanged; **index empty (nothing staged)**; 21 modified + 5 deleted + 2 untracked |
| 7 | `git -C ../alfaaz-project status` | ✅ clean working tree on `codex/release-candidate` — **reference project untouched** |
| 8 | grep audits (table count, r2, refs to config JSONs, `pg`, `onclick` sinks, secret literals, `.agents` PII) | ✅ each finding in Sections E–K is backed by a verified grep or file read |

### L.2 Per-suite coverage

| Suite | Tests | What it genuinely verifies |
|---|---|---|
| `auth.test.ts` | 8 | PBKDF2 hash/verify, token round-trip, reset flow |
| `admin.test.ts` | 10 | Admin mutations via real routes + audit rows |
| `d1_routes.test.ts` | ~30 | Full route integration incl. recruitment screens and booking |
| `events_clubs.test.ts` | 11 | RSVP, capacity, club apply |
| `concurrency_adversarial.test.ts` | ~6 | 5-way simultaneous booking; duplicate registration |
| `error_paths.test.ts` | **13** (+5) | Vault 401/owner/IDOR/admin, slot collision, replay, JWT alg confusion, SW invariants, **new:** consent fail-closed, reset-token rejection, email format, age range, blog-secret disclosure |
| `integration.test.ts` | 15 | Cross-route flows |
| `sjt_scoring.test.ts` | 5 | Banding and bounds |
| `telemetry_evidence.test.ts` | 9 | ⚠️ **partly vacuous** — see DAT-13 (asserts a locally re-implemented function with vocabulary absent from production code) |
| `security_seed.test.ts` | 4 | Seed/crypto sanity; **excludes `.agents`** and does not scan docs (would have missed SEC-01) |

### L.3 What "passing" does **not** mean here

`tests/helpers/d1_mock.ts` is high fidelity — it uses **real `node:sqlite`**, a real Hono
`app.request()` and real Web Crypto, so these are integration tests, not naive mocks. But they still do
not reproduce: Workers **isolate cold starts**, the **10 ms CPU limit**, **D1 batch/statement limits**,
multi-region memory isolation (which is why SEC-09's rate limiter passes tests it will fail in
production), outbound HTTP, or real Cloudflare `cf-connecting-ip` semantics.

**Areas with no automated coverage at all:** `/blogs/generate` (fixed in this audit), curator AI provider
fallback order, notices feed, the Turnstile path (fail-open makes it trivially satisfied), the 14
minigames' scoring (DAT-16), and every frontend module.

### L.4 Tests deliberately NOT run

- ❌ No deployment to the live Worker (`wrangler deploy`) — prohibited by the brief.
- ❌ No production database read or write, no `--remote` migration, no smoke-test record cleanup.
- ❌ No real email, webhook, Gemini or Groq call (external spend / notification prohibition).
- ❌ **No browser testing of the fixed UI paths.** The `exhibition.js`, `admin.js`, `index.html`,
  `dashboard.html`, `sw.js` and `recruit.js` fixes are verified by **build success, typecheck and code
  reading only**. The delegated-click handlers, the notices error card, the deferred CDN tags and the
  service-worker cache rule **have not been clicked or inspected in a browser**. This is the largest
  outstanding verification gap and is the first item in Section N.
- ❌ No Lighthouse / Core Web Vitals / load testing — hence no figures are quoted in Section G.

---

## Section M — Changed-File Inventory

All changes are **uncommitted and unstaged**. Files marked *(prior CLI)* were already modified in the
working tree when this audit began; they were left in place and re-verified, not rewritten.

### M.1 Changed by this audit (13 files)

| File | Change | Finding |
|---|---|---|
| `backend/src/auth/crypto.ts` | + `timingSafeEqual()` exported helper | SEC-07 |
| `backend/src/middleware/auth.ts` | `requireAuth` rejects `status === 'reset'` | SEC-04 |
| `backend/src/routes/vault.ts` | `data:` removed; owner/admin check on `file/:key` (404 not 403); `nosniff`; forced `attachment` for HTML/SVG | SEC-03 |
| `backend/src/routes/blogs.ts` | constant-time token compare; generic 503/500; no config or `err.message` disclosure | SEC-07 |
| `backend/src/routes/auth.ts` | email format validation; UNIQUE catch on register | SEC-12 |
| `backend/src/routes/exhibitions.ts` | integer age 1–120 validation; UNIQUE catch | DAT-10, SEC-12 |
| `backend/src/routes/recruit.ts` | consent strictly required and truthfully recorded; slot date/time validation; `slot_display`/`notes` bounds | DAT-02, DAT-11 |
| `backend/src/services/curator.ts` | Gemini key removed from URL (2 call sites) | SEC-06 |
| `frontend/src/admin.js` | 2 string-interpolated `onclick` sinks → delegated `data-*` listeners; create/toggle/delete failure handling; `statusText` null guards | SEC-08, UX-02 |
| `frontend/src/exhibition.js` | submit wrapped in try/catch with button restore + message on all failure paths | UX-01 |
| `frontend/src/recruit.js` | sends `confirmed_18_plus`; local-component ISO date | DAT-02, UX-11 |
| `frontend/index.html` | notices error state, `pageshow` persisted-guard, hidden-tab polling guard, `console.log` removed | UX-04 |
| `frontend/dashboard.html` | `defer` added to Tailwind CDN + lucide | UX-06 |
| `frontend/public/sw.js` | `isCacheableResponse()` — opaque responses only for allowlisted CDN hosts | PERF-05 |
| `frontend/public/llms.txt` | corrected "FastAPI" → Hono on Cloudflare Workers | REP-17 |
| `tests/error_paths.test.ts` | +5 tests; vault test extended to cover IDOR and admin | regression cover |

### M.2 Inherited from the prior CLI (verified, retained — 9 entries)

| File | Change | My assessment |
|---|---|---|
| `backend/src/auth/crypto.ts` *(shared)* | JWT header `alg`/`typ` validation | ✅ Correct and valuable; real algorithm-confusion defense |
| `backend/src/notifications/email.ts` | webhook auto-routing from `MAKE_WEBHOOK_URL` | ✅ Sensible; prevents silent dev-mode email loss in prod |
| `backend/src/routes/{events,clubs}.ts` | UNIQUE-constraint try/catch | ✅ Correct; constraints do exist |
| `frontend/global.js` | removed Render pre-flight ping + 10-min `wakeBackend` interval; FormData Content-Type guard | ✅ Right for Workers (no sleeping instance to warm). ⚠️ **Still rethrows** network errors at `:71-74` — which is exactly what stuck the exhibition/admin buttons; those callers are now fixed |
| `frontend/public/sw.js` *(extended by me)* | `NETWORK_FIRST_DESTINATIONS` restored; third-party hosts broadened | ✅ Correct; my change layers on top |
| `package.json` | `test:hardening` script | ✅ Useful; verified it runs |
| `scripts/verify_challenger_2.mjs` | *(unchanged, now executed)* | ✅ Sound; only its comment is wrong (REP-08) |
| 5 deletions (`scripts/recon.js`, `frontend/api/*`, `components.js`) | removals | ✅ All reference-free — endorsed in Section I |
| `docs/audits/final-system-audit.md` | untracked report | ⚠️ Kept, not edited. Contains the 25-table and phantom-table-name errors catalogued in Section A |

### M.3 Diff magnitude

`git diff --stat`: **26 files changed, 511 insertions(+), 369 deletions(-)** (this audit's contribution is
roughly +330/−60 across 16 files; the rest is the prior CLI plus deletions). Git reports CRLF
normalisation warnings on 16 files — an artefact of Windows checkout with no `core.autocrlf` policy, not
part of any change; worth an `.gitattributes` if this repo is ever worked on from Linux.

---

## Section N — Outstanding Actions

### N.1 Blocking — must happen before the next deploy

| # | Action | ID | Why it blocks | Who decides |
|---|---|---|---|---|
| 1 | **Rotate `JWT_SECRET`** via `wrangler secret put`, then **redact** `docs/audits/cloudflare-full-system-audit.md:233-234` | SEC-01 | Anyone with repo read access can currently mint an `ADMIN` token. Rotation invalidates all sessions (users re-login once). | **You** (production secret change — I will not do it) |
| 2 | **Browser-verify the 13 frontend fixes** | UX-01/02/04/06/11, PERF-05, SEC-08 | Verified only by build + code reading. The delegated click handlers, notices error card, deferred CDN tags and SW cache rule have never been exercised. | Me, if you want a `wrangler dev` session |
| 3 | Decide whether to **deploy the working tree at all** | — | It contains my fixes **and** the prior CLI's, none committed. Deploying ships both. | **You** |

### N.2 Decisions required (no code written for these)

| # | Decision | ID | My recommendation |
|---|---|---|---|
| 4 | **R2**: bind a bucket, or drop the R2 path and document Cloudinary as the store? | REP-14 | Bind it only if private server-stored files are a real requirement; otherwise delete the dormant branch so a missing bucket fails loudly instead of writing `mock-storage.alfaaz.local` URLs. |
| 5 | **Blog publication**: Worker cron, GitHub Action, or both with dedupe? | DAT-12 | Delete the GitHub workflow (the Worker cron already has DB access and avoids a secret-bearing HTTP hop). |
| 6 | **Game A2 scoring** — genuine precision ratio, or wider bounds? | DAT-01 | Compute real `exception_flagging_precision`; it matches the declared feature name and adds no selection rule. |
| 7 | **Game banding thresholds** — adopt exact integer thirds to match the SJT? | DAT-03 | Yes — the two methods must be comparable for `cross_method_delta` to mean anything. |
| 8 | **Turnstile**: add the widget to `recruit.html` then fail closed? | SEC-02 | Yes, as one coordinated change. Failing closed without the widget breaks recruitment. |
| 9 | **Rate limiting**: move to KV/Durable Objects; key on the canonical path, not `c.req.path` | SEC-09 | Needed before any abuse-sensitive launch. Note the dual-mount aliasing halves your effective limit today. |
| 10 | **`requireAdmin` DB re-check** for revocation, adjusting `admin.test.ts` first | SEC-05 | Yes, but it is a behaviour change — pair it with the test update. |
| 11 | **Bulk research list**: paginate, and write a `recruiter_access_logs` row | SEC-16 | Yes — the access-log design intends exactly this and currently misses its biggest export. |
| 12 | **Consent/copy alignment**: which duration is true, and `consent_text_version` `2026-10-v1` vs `v2` | UX-07 | Align code to one `config/copy` source and bump the version consciously; changing a consent version has record-keeping consequences. |
| 13 | **`SJT_CONFIG_HASH`** computed for real; wire or delete `locked_hashes.json` | DAT-09 | Compute it; and decide how existing sessions' hashes are treated. |
| 14 | **Ridge model**: wire into evidence, or delete the four NULL columns and `models/relative_ridge_v1.json`? | DAT-04 | Either is fine; leaving it is the worst option because `model_version` overstates the system. |
| 15 | **`telemetry_evidence.test.ts`**: fix or delete the vacuous assertions | DAT-13 | Fix to call the real `determineRelationship` / `determineConfidence`. A passing test that verifies nothing is a liability. |
| 16 | **Recruit gate parity suite** ported from the old `alfaaz-recruit-system` | DAT-16 | Worth doing before the next instrument change; it is the only gap that could let a scoring regression ship unnoticed. |
| 17 | **WCAG AA contrast tokens** | UX-03 | Approve Phase 1 of Section H. |
| 18 | **Tailwind build + pinned lucide + security headers** | UX-10, SEC-10 | Approve Phase 1; CSP requires Phase 2's inline-handler removal first. |
| 19 | **`.agents/teamwork/**`** (58 files) — untrack, archive, or keep? | REP-13 | Archive to `docs/archive/` or untrack; keep `ORIGINAL_REQUEST.md`. |
| 20 | **Production recompute** of affected `evidence` rows after items 6–7 | J.4 | Requires explicit approval; it rewrites candidate assessments. |

### N.3 Documentation corrections I can make on request (low risk, no approval needed technically, but
touching tracked docs was left for your visibility)

`BEGINNER_DEPLOYMENT_GUIDE.md` credentials (REP-01) and Node version (REP-07) · `DATABASE_MIGRATION.md`
fence + missing `--remote` step (REP-02) · `README.md` `file:///` links (REP-03) · `SOURCE_CODE_AUDIT.md`
branch label (REP-04) · table counts 25/28 → 26 (REP-05) · `ADMIN_PASSWORD` removal (REP-06) ·
`verify_challenger_2.mjs:267` comment (REP-08) · `bootstrap-admin.js --execute-local` path (REP-09) ·
`SECURITY_REVIEW.md` CORS wording (REP-10) · `privacy.json` mojibake + retention contradiction (REP-15).

### N.4 Production smoke-test records

The brief asked that earlier smoke-test production records be **investigated, not auto-removed**. No
production database access was taken in this audit (read-only Cloudflare checks were not performed
because they require an authenticated `wrangler` session against the live account). Locally, the dev seed
and test fixtures were sufficient. **Action for you:** a read-only `wrangler d1 execute DB --remote
--command "SELECT …"` sweep over `recruit_sessions`, `applicant_identities`, `interview_bookings` and
`submissions` to identify smoke-test rows, then decide deletion individually. The admin delete path does
cascade correctly if you choose to remove them via the portal.

---

## Section O — Final Readiness Assessment

**Verdict: CONDITIONALLY READY — not ready for unattended promotion or deploy.**

| Dimension | Grade | Basis |
|---|---|---|
| Architecture | **Strong** | Single-tier Workers design is appropriate, and the telemetry→features→evidence lineage chain is a correct cross-method psychometrics architecture. Dual mounting is a compatibility tax, not a flaw. |
| Recruitment instrument | **Good, with one real defect** | SJT is exhaustively proven sound (16,384 profiles). Counterbalancing, HMAC seeds and anti-ranking guards are genuine. Undermined by **DAT-01** (A2 saturation), **DAT-09** (unearned config hash), **DAT-15** (unused seeds) and **DAT-16** (unported gate suite). |
| Security | **Adequate, one P0** | Crypto, replay protection and admin gating are properly implemented. But **SEC-01** is an active credential exposure, **SEC-02/09** mean abuse resistance is nominal, and **SEC-10** (no headers) plus **SEC-05** (no revocation) are structural. |
| Data integrity | **Adequate, improving** | Real DB constraints doing real work. Consent fabrication (**DAT-02**) and age fabrication (**DAT-10**) — both now fixed — were the serious ones. Concurrency gaps (DAT-06/07) remain. |
| Performance | **Acceptable, wasteful in known places** | Gzipped JS ~80 kB is fine. The waste is concentrated and cheap to fix: 183 KB favicon, 755 KB precached sliders, ~1.95 s artificial preloader, Play CDN at runtime. |
| Accessibility | **Passes for text, fails for accents** | Measured (Section H.2): body and secondary text pass AA at 11.71:1 and 5.11:1 — an earlier claim here that secondary text sat at 2.9:1 was wrong and has been corrected. The real gaps are `--accent-gold/green/red` (3.08–3.33:1) used as 10–12px labels, plus missing live-region announcements (UX-08) and missing `aria-expanded` (UX-09) — on a volunteer application form, where accessibility is a fairness issue, not a nicety. |
| Documentation | **Poor** | 11 distinct inaccuracies; the deployment guide **actively breaks local admin login**; two audits contradict each other and one leaks a secret. |
| Test coverage | **Good breadth, overstated depth** | 108 passing across 10 suites on real SQLite + real Web Crypto + real routes. But mock-D1 ≠ production D1, one suite is partly vacuous, and the frontend has **zero** automated coverage. |
| Change hygiene | **Blocked** | 26 files of uncommitted work from two different agents, one untracked report, no commit. This cannot be shipped as-is. |

### What is genuinely good about this codebase

Worth stating because an audit that only lists faults misrepresents the work: **no SQL injection found
anywhere** (prepared statements throughout), password hashing and constant-time comparison are textbook,
reset tokens are genuinely single-use, the admin boundary is enforced server-side rather than
cosmetically, candidate PII is redacted for unauthenticated callers, the curator refuses to produce a
composite ranking, `requireAuth` covers every state-changing user endpoint, and the SJT scoring engine
survived exhaustive adversarial verification. This is a carefully built system with a real design behind
it.

### The honest headline

**One secret needs rotating, four decisions need making, and thirteen fixes need a browser.** The system
should keep running; it should not be redeployed until SEC-01 is resolved.

---

## Section P — Git and Production Status

### P.1 Git state (verified)

```
branch:    main
HEAD:      9d467fe  feat(research): enhance session detail loading with improved status handling and event counting
staged:    (empty — git diff --cached returned nothing)
commits created by this audit:    0
pushes:                           0
branches created or switched:     0
stash:                            not used
working tree: 21 modified · 5 deleted · 2 untracked
```

Untracked files: `docs/audits/final-system-audit.md` (prior CLI's report, left untouched) and
`docs/audits/final-system-audit-qoder-2026-10-29.md` (**this report**). `frontend/dist/` was regenerated by
`vite build` and is correctly ignored.

No `git add`, `commit`, `amend`, `push`, `rebase`, `cherry-pick`, `reset`, `checkout --`, `clean`,
`stash` or branch operation was executed. No PR was created. **Nothing is staged or committed; all work
awaiting your review.** Nothing was discarded: the prior CLI's 13 modified/deleted files were preserved
in place, and where I edited the same files (`crypto.ts`, `sw.js`, `recruit.ts`, `tests/error_paths.test.ts`)
I appended to their existing changes rather than replacing them.

### P.2 Production state (verified)

- ❌ **No deployment.** `wrangler deploy` / `pages deploy` was never run; the live Worker is unchanged.
- ❌ **No Cloudflare settings changed** — no domain binding, DNS, secret, KV, D1 or R2 modification.
- ❌ **No production database read or write.** No migration applied `--remote`; no row inserted, updated,
  deleted, seeded, truncated or reset.
- ❌ **No Vercel command executed** anywhere.
- ❌ **No email, webhook or AI API call** made to any external service; no external spend incurred.
- ✅ **Reference project untouched**: `git -C ../alfaaz-project status` → clean working tree on
  `codex/release-candidate`. No file created, modified, moved or deleted there; no dependency installed;
  no legacy SQLite database opened; **no credential, personal information or production data copied from
  it into this project.**

### P.3 How to review and revert

```bash
git status                      # nothing staged; 22 M + 4 D + 2 ??
git diff                        # the whole change set, this audit + prior CLI
git diff -- backend/src/routes/vault.ts   # one file at a time
git diff backend/src/routes/vault.ts > /tmp/SEC-03.patch   # archive a single fix

# revert ONE of this audit's fixes without touching the rest:
git checkout -- frontend/public/sw.js

# accept everything and commit yourself (I have not done this):
git add -p && git commit
```

Per-file changes are independent except: **DAT-02** spans `recruit.ts` *and* `recruit.js` (revert both or
neither, or consent breaks); **SEC-07** spans `blogs.ts` and `crypto.ts` (the `timingSafeEqual` helper is
additive and harmless if `blogs.ts` is reverted); the **SEC-08/UX-02** admin work and the **error_paths
tests** are coupled — reverting the frontend fix keeps its tests valid, but reverting the backend consent
fix requires reverting `error_paths.test.ts` §8 too.

### P.4 Constraint compliance

| Brief constraint | Respected |
|---|---|
| No commits/staging/pushes without explicit approval | ✅ index empty, HEAD unchanged |
| No changes to the reference project | ✅ verified clean; read-only inspection only |
| No credential/PII/production-data copying from old project | ✅ none copied; legacy DBs not opened |
| No deploy; no live Cloudflare/DNS/secret/DB changes | ✅ nothing executed against production |
| No destructive DB operations; smoke records investigated not removed | ✅ no DB access; investigation handed to you in N.4 |
| No real emails/notifications/candidate records/API spend | ✅ only in-memory `DevEmailProvider` previews during tests |
| No fabricated CWV/speed/benchmark figures | ✅ Section G quotes byte counts and code paths only, with an explicit non-measurement note |
| No claiming an unexecuted test passed | ✅ L.1 lists only executed commands; L.4 lists what was **not** run |
| No HTTP status alone as proof of correctness | ✅ every finding is backed by a code read or grep, not a response code |
| No weakening of a security mechanism to pass a test | ✅ the vault test was **updated to assert stronger behaviour** after I tightened it, and the `requireAdmin` DB re-check was **declined** rather than the suite weakened |
| No invented selection rules; no altered scoring logic | ✅ DAT-01, DAT-03, DAT-04, DAT-09 all presented as decisions; banding/threshold code untouched |
| Required consent steps and legal information preserved | ✅ strengthened (DAT-02), none removed or shortened |
| Curator AI config preserved (Gemini primary, Groq secondary, models/order/fallback) | ✅ order, models and fallback unchanged; only credential *transport* altered (SEC-06), flagged as not live-verified |
| Cleanup classified into 5 buckets, verified reference-free, approval for ambiguous | ✅ Section I; **zero deletions performed** |
| Substantial design work presented as a proposal | ✅ Section H.3; only small low-risk corrections implemented |
| Report with Sections A–P, unique filename, no overwrite of earlier audits | ✅ this file; both earlier reports intact and unedited |
| Audit all files, including those omitted from the brief | ✅ Section E.4 — all 188 tracked files assigned, 6 ★ groups the brief did not mention |

---

*End of report. Prepared without modifying the reference project, deploying anything, or creating a Git
commit. 108/108 tests, typecheck, hardening harness and frontend build all green at the time of writing;
the working tree is left unstaged for your review.*
