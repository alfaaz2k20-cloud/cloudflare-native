# Alfaaz Collective: Feature Parity & Route Matrix

This matrix audits and tracks every user-facing and administrative capability discovered in the Alfaaz Collective application, comparing the original implementation with the Cloudflare-native rebuild.

**Audit Status Key:**
- `verified`: Thoroughly verified via automated integration tests and verified against SQLite/D1 and Worker routes.
- `partial`: Functionally implemented with local/grounded engine; requires external live API keys or services (e.g. Gemini, Groq, live webhook) for full external features.
- `blocked`: Cannot execute without remote live infrastructure.
- `untested`: Implementation exists but lacks automated route-level test coverage.

---

## 1. Authentication & Member Identity

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| User Registration | `POST /auth/register` | Create participant account with hashed credentials | Turnstile, PBKDF2, JWT | Public | `users` | None | `POST /auth/register` (PBKDF2 Web Crypto + JWT + Turnstile) | `verified` |
| User Login | `POST /auth/login` | Authenticate user, issue 7-day bearer token | PBKDF2, JWT | Public | `users` | None | `POST /auth/login` (PBKDF2 verify + JWT) | `verified` |
| Forgot Password | `POST /auth/forgot-password` | Issue 15-min password reset link | Turnstile, JWT, Email | Public | `users` | Password Reset Email | `POST /auth/forgot-password` (JWT reset token + Turnstile + Email) | `verified` |
| Reset Password | `POST /auth/reset-password` | Verify token, prevent replay, update password | JWT, PBKDF2 | Public | `users`, `consumed_tokens` | None | `POST /auth/reset-password` (Replay Protected) | `verified` |
| Current User Profile | `GET /auth/me` | Fetch active user credentials and role | JWT Auth | User Auth | `users` | None | `GET /auth/me` | `verified` |
| Update Profile | `PATCH /auth/me` | Update participant display name | JWT Auth | User Auth | `users` | None | `PATCH /auth/me` | `verified` |

---

## 2. Community Events & Gatherings

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Active Events Feed | `GET /events/active` | Public listing of upcoming events with real-time capacity | D1 group-by | Public | `events`, `event_registrations` | None | `GET /events/active` (D1 parameterized query) | `verified` |
| Event Registration | `POST /events/register` | RSVP for event with capacity checking and duplicate prevention | Atomic check | User Auth | `events`, `event_registrations` | None | `POST /events/register` (Atomic check-and-insert) | `verified` |
| My Registrations | `GET /events/my-registrations` | View registered events on dashboard | Database join | User Auth | `events`, `event_registrations` | None | `GET /events/my-registrations` | `verified` |
| Admin: Create Event | `POST /admin/events/create` | Schedule new collective event | Admin role | Admin Auth | `events` | Notice Sync | `POST /admin/events/create` | `verified` |
| Admin: Toggle RSVP | `PATCH /admin/events/:id/toggle` | Open or close registration for an event | Admin role | Admin Auth | `events` | Notice Sync | `PATCH /admin/events/:id/toggle` | `verified` |
| Admin: List Events | `GET /admin/events` | Manage all events and see registration counts | Admin role | Admin Auth | `events`, `event_registrations` | None | `GET /admin/events` | `verified` |
| Admin: View Attendees | `GET /admin/events/:id/registrations` | List attendees and contact numbers | Admin role | Admin Auth | `event_registrations` | None | `GET /admin/events/:id/registrations` | `verified` |
| Admin: Delete Event | `DELETE /admin/events/:id` | Cascade delete event and registrations | Admin role | Admin Auth | `events`, `event_registrations` | Notice Sync | `DELETE /admin/events/:id` | `verified` |

---

## 3. Collective Circles & Clubs (Halqa)

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Apply to Club | `POST /clubs/apply` | Submit membership application for one of 5 creative clubs | Validation | User Auth | `club_applications` | None | `POST /clubs/apply` | `verified` |
| My Club Status | `GET /clubs/my-status` | Display current club membership status on dashboard | Query | User Auth | `club_applications` | None | `GET /clubs/my-status` | `verified` |
| Admin: List Applications | `GET /admin/club-applications` | Review pending/reviewed club submissions | Admin role | Admin Auth | `club_applications` | None | `GET /admin/club-applications` | `verified` |
| Admin: Review Club App | `POST /admin/club-applications/review` | Approve or reject club membership | Admin role | Admin Auth | `club_applications` | None | `POST /admin/club-applications/review` | `verified` |
| Admin: Revert Club App | `PATCH /admin/club-applications/:id/revert` | Revert application back to PENDING | Admin role | Admin Auth | `club_applications` | None | `PATCH /admin/club-applications/:id/revert` | `verified` |

---

## 4. Exhibitions & Curatorial Screening

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Active Exhibition Config | `GET /exhibitions/config` | Fetch active exhibition cycle rules, dates, venue, fees | Query | Public | `exhibitions_list` | None | `GET /exhibitions/config` | `verified` |
| Submit Artwork / Portfolio | `POST /exhibitions/apply` | Submit portfolio for screening under active cycle | Turnstile, Val | User Auth | `exhibition_applications`, `exhibitions_list` | Application Received Email | `POST /exhibitions/apply` (with Turnstile bot defense) | `verified` |
| My Exhibition Status | `GET /exhibitions/my-status` | View approval state, curator note, payment status | Query | User Auth | `exhibition_applications`, `exhibitions_list` | None | `GET /exhibitions/my-status` | `verified` |
| Finalize Registration | `POST /exhibitions/complete-registration` & `/finalize` | Submit fee payment proof and accept T&Cs | Validation | User Auth | `exhibition_applications` | Payment Submitted Email | `POST /exhibitions/complete-registration` | `verified` |
| Admin: Create Exhibition | `POST /admin/exhibitions/create` | Define new exhibition cycle parameters | Admin role | Admin Auth | `exhibitions_list` | None | `POST /admin/exhibitions/create` | `verified` |
| Admin: List Exhibitions | `GET /admin/exhibitions/list` | List all historical and current exhibitions | Admin role | Admin Auth | `exhibitions_list` | None | `GET /admin/exhibitions/list` | `verified` |
| Admin: Activate Exhibition | `PATCH /admin/exhibitions/:id/activate` | Set target exhibition as the active cycle | Admin role | Admin Auth | `exhibitions_list` | Notice Sync | `PATCH /admin/exhibitions/:id/activate` | `verified` |
| Admin: Deactivate All | `PATCH /admin/exhibitions/deactivate-all` | Close exhibition portal completely | Admin role | Admin Auth | `exhibitions_list` | Notice Sync | `PATCH /admin/exhibitions/deactivate-all` | `verified` |
| Admin: List Applications | `GET /admin/exhibitions` | Filter artist submissions by cycle | Admin role | Admin Auth | `exhibition_applications` | None | `GET /admin/exhibitions` | `verified` |
| Admin: Application Cycles | `GET /admin/exhibitions/cycles` | Get unique list of exhibition cycles | Distinct query | Admin Auth | `exhibitions_list`, `exhibition_applications` | None | `GET /admin/exhibitions/cycles` | `verified` |
| Admin: Review Artist | `POST /admin/exhibitions/review` | Approve/reject artist with curator feedback | Email service | Admin Auth | `exhibition_applications` | Clearance/Update Email | `POST /admin/exhibitions/review` | `verified` |
| Admin: Confirm Payment | `PATCH /admin/exhibitions/:id/confirm-payment` | Verify fee transfer and lock exhibition spot | Email service | Admin Auth | `exhibition_applications` | Spot Confirmed Email | `POST /admin/exhibitions/:id/confirm-payment` | `verified` |
| Admin: Revert Status | `PATCH /admin/exhibitions/:id/revert` | Revert application back to PENDING | Admin role | Admin Auth | `exhibition_applications` | None | `PATCH /admin/exhibitions/:id/revert` | `verified` |
| Admin: Registration Detail | `GET /admin/exhibitions/:id/registration` | Inspect payment receipt and participant note | Admin role | Admin Auth | `exhibition_applications` | None | `GET /admin/exhibitions/:id/registration` | `verified` |

---

## 5. Creative Vault (Archives)

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Submit to Vault | `POST /vault/submit` | Upload literary/artistic artifact link to private vault | R2 / Validation | User Auth | `submissions` | None | `POST /vault/submit` | `verified` |
| Secure File Retrieval | `GET /vault/file/:key` | Serve uploaded private documents from Cloudflare R2 | R2 Bucket | User Auth | None | None | `GET /vault/file/:key` (Authenticated, Private Cache) | `verified` |
| Admin: View Submissions | `GET /admin/submissions` | Review chronological vault contributions | Admin role | Admin Auth | `submissions` | None | `GET /admin/submissions` | `verified` |

---

## 6. Curated Archives & Autonomous Essays (Blogs)

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Public Blog Archive | `GET /blogs/` | List all published cultural and philosophical articles | Database query | Public | `blogs` | None | `GET /blogs/` | `verified` |
| Read Single Article | `GET /blogs/:id` | Full text rendering of selected article | Query | Public | `blogs` | None | `GET /blogs/:id` | `verified` |
| Autonomous Essay Generator | `POST /blogs/generate` | Generate 1500+ word scholarly reflection | LLM Adapter | Bearer Token (`PHANTOM_SECRET_TOKEN`) | `blogs` | Notice Sync | `POST /blogs/generate` (Gemini/Groq adapter + offline generator) | `partial` |

---

## 7. Curator AI Conversational Guide

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Conversational Chat | `POST /phantom/ask` | Floating gallery guide with grounded local archive & memory | LLM Engine | Rate limited | None | None | `POST /phantom/ask` (Gemini REST + Groq + Grounded Offline Engine) | `partial` |

---

## 8. Volunteer Recruitment & Behavioral Studio

> **MANDATORY PSYCHOMETRIC INTEGRITY DISCLAIMER:**
> The recruitment assessment tests, situational judgement scoring algorithms, and behavioral simulation tasks implemented within this platform verify software functional correctness, interface responsiveness, deterministic state machines, and relational data pipeline integrity ONLY. They DO NOT measure, claim to measure, or establish psychological, cognitive, psychometric, or clinical validity. Assessment results, construct scores, and synthesized evidence profiles must not be used as clinical diagnostic instruments, definitive personality indicators, or autonomous hiring decisions without independent human review and validated psychometric assessment standards.

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Affirmative Consent | `POST /recruit/consent` | Record 18+ consent, initialize session & Latin Square sequence | Turnstile, UUID | Public | `recruit_sessions`, `consent_records`, `task_assignments` | None | `POST /recruit/consent` (Turnstile Protected) | `verified` |
| Candidate Identity | `POST /recruit/identity` | Save candidate name, email, contact, and LinkedIn | Validation | Public (Session Bound) | `applicant_identities`, `recruit_sessions` | None | `POST /recruit/identity` (with Cascade FK) | `verified` |
| Accessibility Settings | `POST /recruit/accessibility` | Store UI adjustments (contrast, animations) | JSON | Public (Session Bound) | `accessibility_profiles`, `recruit_sessions` | None | `POST /recruit/accessibility` | `verified` |
| Warmup Baseline | `POST /recruit/warmup` | Record motor latency and input baselines | Float math | Public (Session Bound) | `warmup_baselines`, `recruit_sessions` | None | `POST /recruit/warmup` | `verified` |
| Public SJT Scenarios | `GET /recruit/sjt/public` | Return 7 situational scenarios without keys/weights | Config hashes | Public | None | None | `GET /recruit/sjt/public` | `verified` |
| Submit SJT Responses | `POST /recruit/sjt/submit` | Exact integer thirds scoring & version-1 evidence persistence | SJT Engine | Public (Session Bound) | `sjt_responses`, `evidence`, `recruit_sessions` | None | `POST /recruit/sjt/submit` | `verified` |
| Minigame Telemetry Stream | `POST /recruit/telemetry` | Ingest batched interaction traces with strict caps | Ingestion engine | Public (Session Bound) | `telemetry_events` | None | `POST /recruit/telemetry` | `verified` |
| Complete Assessment | `POST /recruit/complete` | Lock session state, extract features & integrate evidence | Integrator engine | Public (Session Bound) | `recruit_sessions`, `features`, `evidence`, `game_scores` | None | `POST /recruit/complete` | `verified` |
| Interview Slots Feed | `GET /recruit/interview-slots` | Available interview slots for next 7 days (skipping Sunday) | Query active bookings | Public | `interview_bookings`, `interview_settings` | None | `GET /recruit/interview-slots` | `verified` |
| Schedule Interview | `POST /recruit/schedule-interview` | Book interview timing with race-condition prevention | Validation, Webhook | Public (Session Bound) | `interview_bookings` | Recruiter & Candidate Email | `POST /recruit/schedule-interview` (UNIQUE constraint protected) | `verified` |
| Check Interview Booking | `GET /recruit/interview-booking/:id` | Retrieve scheduled interview details for session | Query | Public / Admin | `interview_bookings` | None | `GET /recruit/interview-booking/:id` (PII Protected) | `verified` |

---

## 9. Recruiter Research Dossier & Candidate Review

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Recruiter Subsystem Root | `GET /recruit/research` | Status and discoverability endpoint | Admin role | Admin Auth | None | None | `GET /recruit/research` | `verified` |
| Candidate Chronological List | `GET /recruit/research/sessions` | Anti-bias candidate review list (sorting by score prohibited) | Anti-bias guard | Admin Auth | `recruit_sessions`, `applicant_identities`, `interview_bookings` | None | `GET /recruit/research/sessions` | `verified` |
| Candidate Deep Dossier | `GET /recruit/research/sessions/:id` | Audit behavioral traces, task metrics, and recruiter access log | Evidence integrator | Admin Auth | `evidence`, `features`, `game_scores`, `recruiter_access_logs` | Access Log Entry | `GET /recruit/research/sessions/:id` | `verified` |
| Reschedule Interview | `POST /recruit/research/sessions/:id/reschedule` | Administrative interview rescheduling | Email service | Admin Auth | `interview_bookings` | Rescheduled Email | `POST /recruit/research/sessions/:id/reschedule` | `verified` |
| Interview Slot Settings | `GET`/`POST /recruit/research/interview-settings` | View/update default available time slots and skip days | Admin role | Admin Auth | `interview_settings` | None | `GET`/`POST /recruit/research/interview-settings` | `verified` |
| Diagnostic Webhook Test | `POST /recruit/research/webhook-test` | Verify Make.com webhook responsiveness | Webhook | Admin Auth | None | Test Dispatch | `POST /recruit/research/webhook-test` | `partial` |

---

## 10. Administrative Audit & Governance

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| List User Roster | `GET /admin/users` | Overview of all registered accounts and roles | Query | Admin Auth | `users` | None | `GET /admin/users` | `verified` |
| Purge User Account | `DELETE /admin/users/:email` | Cascade purge of user account and associated submissions | Transaction | Admin Auth | `users`, `submissions`, `club_applications`, `event_registrations`, `exhibition_applications` | Admin Audit Log | `DELETE /admin/users/:email` | `verified` |
| Update User Role | `POST /admin/update_status` | Promote to ADMIN or demote to PARTICIPANT (with last-admin lock) | Integrity check | Admin Auth | `users` | Admin Audit Log | `POST /admin/update_status` | `verified` |
| Audit Trail Logs | `GET /admin/audit-logs` | Chronological inspection of high-privilege operations | Limit query | Admin Auth | `admin_audit_logs` | None | `GET /admin/audit-logs` | `verified` |
| Test Email Dispatch | `POST /admin/email/test` | Outbound email diagnostic check | Email service | Admin Auth | None | Test Email | `POST /admin/email/test` | `verified` |
| Email Service Status | `GET /admin/email/status` | Current email provider configuration status | Config inspection | Admin Auth | None | None | `GET /admin/email/status` | `verified` |

---

## 11. Legacy Vercel Serverless Notice Endpoints

| Feature | Original Route | Purpose | Original Provider | Cloudflare-Native Replacement | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Static Notices JSON | `/api/notices.js` | Fast feed of active events and exhibition | Vercel Node + PostgreSQL (`pg`) | Worker route `/api/notices` reading from D1/KV with zero external latency | `verified` |
| Blog List JSON | `/api/blogs.js` | Direct feed of published articles | Vercel Node + PostgreSQL (`pg`) | Worker route `/api/blogs` or `/blogs/` reading from D1 | `verified` |
| Single Blog JSON | `/api/blog.js` | Direct query of single blog article | Vercel Node + PostgreSQL (`pg`) | Worker route `/api/blog?id=...` or `/blogs/:id` | `verified` |
