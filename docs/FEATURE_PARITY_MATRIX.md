# Alfaaz Collective: Feature Parity & Route Matrix

This matrix tracks every user-facing and administrative capability discovered in the Alfaaz Collective application, comparing the original implementation with the Cloudflare-native rebuild.

---

## 1. Authentication & Member Identity

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| User Registration | `POST /auth/register` | Create participant account with hashed credentials | Bcrypt, JWT | Public | `users` | None | `POST /auth/register` (PBKDF2 Web Crypto + JWT) | Parity Implemented |
| User Login | `POST /auth/login` | Authenticate user, issue 7-day bearer token | Bcrypt, JWT | Public | `users` | None | `POST /auth/login` (PBKDF2 verify + JWT) | Parity Implemented |
| Forgot Password | `POST /auth/forgot-password` | Issue 15-min password reset link | JWT, Email service | Public | `users` | Password Reset Email | `POST /auth/forgot-password` (JWT reset token + Email adapter) | Parity Implemented |
| Reset Password | `POST /auth/reset-password` | Verify token & update password | JWT, Bcrypt | Public | `users` | None | `POST /auth/reset-password` | Parity Implemented |
| Current User Profile | `GET /auth/me` | Fetch active user credentials and role | JWT Auth | User Auth | `users` | None | `GET /auth/me` | Parity Implemented |
| Update Profile | `PATCH /auth/me` | Update participant display name | JWT Auth | User Auth | `users` | None | `PATCH /auth/me` | Parity Implemented |

---

## 2. Community Events & Gatherings

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Active Events Feed | `GET /events/active` | Public listing of upcoming events with real-time capacity | SQLAlchemy group-by | Public | `events`, `event_registrations` | None | `GET /events/active` (D1 parameterized query) | Parity Implemented |
| Event Registration | `POST /events/register` | RSVP for event with capacity checking and duplicate prevention | Database lock | User Auth | `events`, `event_registrations` | None | `POST /events/register` (D1 atomic check-and-insert) | Parity Implemented |
| My Registrations | `GET /events/my-registrations` | View registered events on dashboard | Database join | User Auth | `events`, `event_registrations` | None | `GET /events/my-registrations` | Parity Implemented |
| Admin: Create Event | `POST /admin/events/create` | Schedule new collective event | Admin role | Admin Auth | `events` | Cloudinary Notice Sync | `POST /admin/events/create` | Parity Implemented |
| Admin: Toggle RSVP | `PATCH /admin/events/:id/toggle` | Open or close registration for an event | Admin role | Admin Auth | `events` | Notice Sync | `PATCH /admin/events/:id/toggle` | Parity Implemented |
| Admin: List Events | `GET /admin/events` | Manage all events and see registration counts | Admin role | Admin Auth | `events`, `event_registrations` | None | `GET /admin/events` | Parity Implemented |
| Admin: View Attendees | `GET /admin/events/:id/registrations` | List attendees and contact numbers | Admin role | Admin Auth | `event_registrations` | None | `GET /admin/events/:id/registrations` | Parity Implemented |
| Admin: Delete Event | `DELETE /admin/events/:id` | Cascade delete event and registrations | Admin role | Admin Auth | `events`, `event_registrations` | Notice Sync | `DELETE /admin/events/:id` | Parity Implemented |

---

## 3. Collective Circles & Clubs (Halqa)

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Apply to Club | `POST /clubs/apply` | Submit membership application for one of 5 creative clubs | Validation | User Auth | `club_applications` | None | `POST /clubs/apply` | Parity Implemented |
| My Club Status | `GET /clubs/my-status` | Display current club membership status on dashboard | Query | User Auth | `club_applications` | None | `GET /clubs/my-status` | Parity Implemented |
| Admin: List Applications | `GET /admin/club-applications` | Review pending/reviewed club submissions | Admin role | Admin Auth | `club_applications` | None | `GET /admin/club-applications` | Parity Implemented |
| Admin: Review Club App | `POST /admin/club-applications/review` | Approve or reject club membership | Admin role | Admin Auth | `club_applications` | None | `POST /admin/club-applications/review` | Parity Implemented |
| Admin: Revert Club App | `PATCH /admin/club-applications/:id/revert` | Revert application back to PENDING | Admin role | Admin Auth | `club_applications` | None | `PATCH /admin/club-applications/:id/revert` | Parity Implemented |

---

## 4. Exhibitions & Curatorial Screening

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Active Exhibition Config | `GET /exhibitions/config` | Fetch active exhibition cycle rules, dates, venue, fees | Query | Public | `exhibitions_list` | None | `GET /exhibitions/config` | Parity Implemented |
| Submit Artwork / Portfolio | `POST /exhibitions/apply` | Submit portfolio for screening under active cycle | Validation | User Auth | `exhibition_applications`, `exhibitions_list` | Application Received Email | `POST /exhibitions/apply` | Parity Implemented |
| My Exhibition Status | `GET /exhibitions/my-status` | View approval state, curator note, payment status | Query | User Auth | `exhibition_applications`, `exhibitions_list` | None | `GET /exhibitions/my-status` | Parity Implemented |
| Finalize Registration | `POST /exhibitions/complete-registration` & `/finalize` | Submit fee payment proof and accept T&Cs | Validation | User Auth | `exhibition_applications` | Payment Submitted Email | `POST /exhibitions/complete-registration` | Parity Implemented |
| Admin: Create Exhibition | `POST /admin/exhibitions/create` | Define new exhibition cycle parameters | Admin role | Admin Auth | `exhibitions_list` | None | `POST /admin/exhibitions/create` | Parity Implemented |
| Admin: List Exhibitions | `GET /admin/exhibitions/list` | List all historical and current exhibitions | Admin role | Admin Auth | `exhibitions_list` | None | `GET /admin/exhibitions/list` | Parity Implemented |
| Admin: Activate Exhibition | `PATCH /admin/exhibitions/:id/activate` | Set target exhibition as the active cycle | Admin role | Admin Auth | `exhibitions_list` | Notice Sync | `PATCH /admin/exhibitions/:id/activate` | Parity Implemented |
| Admin: Deactivate All | `PATCH /admin/exhibitions/deactivate-all` | Close exhibition portal completely | Admin role | Admin Auth | `exhibitions_list` | Notice Sync | `PATCH /admin/exhibitions/deactivate-all` | Parity Implemented |
| Admin: List Applications | `GET /admin/exhibitions` | Filter artist submissions by cycle | Admin role | Admin Auth | `exhibition_applications` | None | `GET /admin/exhibitions` | Parity Implemented |
| Admin: Application Cycles | `GET /admin/exhibitions/cycles` | Get unique list of exhibition cycles | Distinct query | Admin Auth | `exhibitions_list`, `exhibition_applications` | None | `GET /admin/exhibitions/cycles` | Parity Implemented |
| Admin: Review Artist | `POST /admin/exhibitions/review` | Approve/reject artist with curator feedback | Email service | Admin Auth | `exhibition_applications` | Clearance/Update Email | `POST /admin/exhibitions/review` | Parity Implemented |
| Admin: Confirm Payment | `PATCH /admin/exhibitions/:id/confirm-payment` | Verify fee transfer and lock exhibition spot | Email service | Admin Auth | `exhibition_applications` | Spot Confirmed Email | `POST /admin/exhibitions/:id/confirm-payment` | Parity Implemented |
| Admin: Revert Status | `PATCH /admin/exhibitions/:id/revert` | Revert application back to PENDING | Admin role | Admin Auth | `exhibition_applications` | None | `PATCH /admin/exhibitions/:id/revert` | Parity Implemented |
| Admin: Registration Detail | `GET /admin/exhibitions/:id/registration` | Inspect payment receipt and participant note | Admin role | Admin Auth | `exhibition_applications` | None | `GET /admin/exhibitions/:id/registration` | Parity Implemented |

---

## 5. Creative Vault (Archives)

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Submit to Vault | `POST /vault/submit` | Upload literary/artistic artifact link to private vault | Validation | User Auth | `submissions` | None | `POST /vault/submit` | Parity Implemented |
| Admin: View Submissions | `GET /admin/submissions` | Review chronological vault contributions | Admin role | Admin Auth | `submissions` | None | `GET /admin/submissions` | Parity Implemented |

---

## 6. Curated Archives & Autonomous Essays (Blogs)

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Public Blog Archive | `GET /blogs/` | List all published cultural and philosophical articles | Database query | Public | `blogs` | None | `GET /blogs/` | Parity Implemented |
| Read Single Article | `GET /blogs/:id` | Full text rendering of selected article | Query | Public | `blogs` | None | `GET /blogs/:id` | Parity Implemented |
| Autonomous Essay Generator | `POST /blogs/generate` | Generate 1500+ word scholarly reflection | Gemini / Groq LLM | Bearer Token (`PHANTOM_SECRET_TOKEN`) | `blogs` | Notice Sync | `POST /blogs/generate` (Adapter for Gemini/Groq + Workers AI) | Parity Implemented |

---

## 7. Curator AI Conversational Guide

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Conversational Chat | `POST /phantom/ask` | Floating gallery guide with grounded local archive & memory | Gemini REST, Groq fallback, Offline engine | Rate limited | None | None | `POST /phantom/ask` (Gemini REST + Groq + Grounded Offline Fallback) | Parity Implemented |

---

## 8. Volunteer Recruitment & Behavioral Studio

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Affirmative Consent | `POST /recruit/consent` | Record 18+ consent, initialize session & Latin Square sequence | Config hash, UUID | Public | `recruit_sessions`, `consent_records`, `task_assignments` | None | `POST /recruit/consent` | Parity Implemented |
| Candidate Identity | `POST /recruit/identity` | Save candidate name, email, contact, and LinkedIn | Validation | Public (Session Bound) | `applicant_identities`, `recruit_sessions` | None | `POST /recruit/identity` | Parity Implemented |
| Accessibility Settings | `POST /recruit/accessibility` | Store UI adjustments (contrast, animations) | JSON | Public (Session Bound) | `accessibility_profiles`, `recruit_sessions` | None | `POST /recruit/accessibility` | Parity Implemented |
| Warmup Baseline | `POST /recruit/warmup` | Record motor latency and input baselines | Float math | Public (Session Bound) | `warmup_baselines`, `recruit_sessions` | None | `POST /recruit/warmup` | Parity Implemented |
| Public SJT Scenarios | `GET /recruit/sjt/public` | Return 7 situational scenarios without keys/weights | Config hashes | Public | None | None | `GET /recruit/sjt/public` | Parity Implemented |
| Submit SJT Responses | `POST /recruit/sjt/submit` | Exact integer thirds scoring & version-1 evidence persistence | SJT Engine | Public (Session Bound) | `sjt_responses`, `evidence`, `recruit_sessions` | None | `POST /recruit/sjt/submit` | Parity Implemented |
| Minigame Telemetry Stream | `POST /recruit/telemetry` | Ingest batched interaction traces with strict caps | Ingestion engine | Public (Session Bound) | `telemetry_events` | None | `POST /recruit/telemetry` | Parity Implemented |
| Complete Assessment | `POST /recruit/complete` | Lock session state, extract features & integrate evidence | Integrator engine | Public (Session Bound) | `recruit_sessions`, `features`, `evidence`, `game_scores` | None | `POST /recruit/complete` | Parity Implemented |
| Interview Slots Feed | `GET /recruit/interview-slots` | Available interview slots for next 7 days (skipping Sunday) | Query active bookings | Public | `interview_bookings`, `interview_settings` | None | `GET /recruit/interview-slots` | Parity Implemented |
| Schedule Interview | `POST /recruit/schedule-interview` | Book interview timing with race-condition prevention | Validation, Webhook | Public (Session Bound) | `interview_bookings` | Recruiter & Candidate Email | `POST /recruit/schedule-interview` | Parity Implemented |
| Check Interview Booking | `GET /recruit/interview-booking/:id` | Retrieve scheduled interview details for session | Query | Public | `interview_bookings` | None | `GET /recruit/interview-booking/:id` | Parity Implemented |

---

## 9. Recruiter Research Dossier & Candidate Review

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Recruiter Subsystem Root | `GET /recruit/research` | Status and discoverability endpoint | Admin role | Admin Auth | None | None | `GET /recruit/research` | Parity Implemented |
| Candidate Chronological List | `GET /recruit/research/sessions` | Anti-bias candidate review list (sorting by score prohibited) | Query, Anti-bias check | Admin Auth | `recruit_sessions`, `applicant_identities`, `interview_bookings` | None | `GET /recruit/research/sessions` | Parity Implemented |
| Candidate Deep Dossier | `GET /recruit/research/sessions/:id` | Audit behavioral traces, task metrics, and recruiter access log | Evidence integrator | Admin Auth | `evidence`, `features`, `game_scores`, `recruiter_access_logs` | Access Log Entry | `GET /recruit/research/sessions/:id` | Parity Implemented |
| Reschedule Interview | `POST /recruit/research/sessions/:id/reschedule` | Administrative interview rescheduling | Email service | Admin Auth | `interview_bookings` | Rescheduled Email | `POST /recruit/research/sessions/:id/reschedule` | Parity Implemented |
| Interview Slot Settings | `GET`/`POST /recruit/research/interview-settings` | View/update default available time slots and skip days | Admin role | Admin Auth | `interview_settings` | None | `GET`/`POST /recruit/research/interview-settings` | Parity Implemented |
| Diagnostic Webhook Test | `POST /recruit/research/webhook-test` | Verify Make.com webhook responsiveness | Webhook | Admin Auth | None | Test Dispatch | `POST /recruit/research/webhook-test` | Parity Implemented |

---

## 10. Administrative Audit & Governance

| Feature | Original Route | Purpose | Dependencies | Auth Req | DB Entities | Notification | Cloudflare Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| List User Roster | `GET /admin/users` | Overview of all registered accounts and roles | Query | Admin Auth | `users` | None | `GET /admin/users` | Parity Implemented |
| Purge User Account | `DELETE /admin/users/:email` | Cascade purge of user account and associated submissions | Transaction | Admin Auth | `users`, `submissions`, `club_applications`, `event_registrations`, `exhibition_applications` | Admin Audit Log | `DELETE /admin/users/:email` | Parity Implemented |
| Update User Role | `POST /admin/update_status` | Promote to ADMIN or demote to PARTICIPANT (with last-admin lock) | Integrity check | Admin Auth | `users` | Admin Audit Log | `POST /admin/update_status` | Parity Implemented |
| Audit Trail Logs | `GET /admin/audit-logs` | Chronological inspection of high-privilege operations | Limit query | Admin Auth | `admin_audit_logs` | None | `GET /admin/audit-logs` | Parity Implemented |
| Test Email Dispatch | `POST /admin/email/test` | Outbound email diagnostic check | Email service | Admin Auth | None | Test Email | `POST /admin/email/test` | Parity Implemented |
| Email Service Status | `GET /admin/email/status` | Current email provider configuration status | Config inspection | Admin Auth | None | None | `GET /admin/email/status` | Parity Implemented |

---

## 11. Legacy Vercel Serverless Notice Endpoints

| Feature | Original Route | Purpose | Original Provider | Cloudflare-Native Replacement | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Static Notices JSON | `/api/notices.js` | Fast feed of active events and exhibition | Vercel Node + PostgreSQL (`pg`) | Worker route `/api/notices` reading from D1/KV with zero external latency | Parity Implemented |
| Blog List JSON | `/api/blogs.js` | Direct feed of published articles | Vercel Node + PostgreSQL (`pg`) | Worker route `/api/blogs` or `/blogs/` reading from D1 | Parity Implemented |
| Single Blog JSON | `/api/blog.js` | Direct query of single blog article | Vercel Node + PostgreSQL (`pg`) | Worker route `/api/blog?id=...` or `/blogs/:id` | Parity Implemented |
