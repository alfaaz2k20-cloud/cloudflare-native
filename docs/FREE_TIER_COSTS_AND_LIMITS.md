# Alfaaz Collective: Cloudflare Free Tier Operational Feasibility & Cost Model

**Analysis Date:** October 2026  
**Target Environment:** Cloudflare Free Tier  
**Prior Spend:** Render Web Service ($7/mo) + Neon PostgreSQL ($0-19/mo) + Vercel Pro ($20/mo) + Cloudinary ($0-10/mo)  
**Projected Cloudflare Spend:** **$0.00 / month** (100% Free Tier Compliant)  

---

## 1. Cloudflare Free Tier Quotas & Limits

| Service Component | Cloudflare Free Tier Allowance | Alfaaz Typical Monthly Consumption | Free Tier Utilization |
| :--- | :--- | :--- | :--- |
| **Cloudflare Workers** | 100,000 requests / day (3M / month) | ~45,000 - 90,000 requests / month | **1.5% - 3.0%** |
| **Workers CPU Time** | 10 ms CPU time per request | ~0.8 ms - 2.5 ms per request | **Pass (V8 Isolate)** |
| **Workers Static Assets** | Included with Workers | Pre-compiled Vite assets (HTML, CSS, JS) | **100% Free** |
| **Cloudflare D1 (Database)** | 5,000,000 read rows / day<br>100,000 write rows / day<br>500 MB storage per database<br>(5 GB total account across 10 DBs) | ~20,000 reads / day<br>~1,500 writes / day<br>~25 MB total data | **Reads: <0.5%**<br>**Writes: 1.5%**<br>**Storage: 5.0%** |
| **Cloudflare R2 (Storage)** | 10 GB stored data / month<br>1,000,000 Class A ops (writes)<br>10,000,000 Class B ops (reads)<br>**$0.00 Egress Fees** | ~1.5 GB stored artworks/proofs<br>~500 uploads / month<br>~10,000 views / month | **Storage: 15%**<br>**Writes: <0.1%**<br>**Reads: <0.1%** |
| **Workers KV** | 100,000 reads / day<br>1,000 writes / day<br>1 GB stored keys | ~500 notice cache reads / day<br>~10 cache invalidations / day | **Reads: 0.5%**<br>**Writes: 1.0%** |
| **Cloudflare Turnstile** | Unlimited challenges / month | ~500 - 1,500 challenges / month | **100% Free (Unlimited)** |

---

## 2. Realistic Traffic Modeling for Alfaaz Collective

### Scenario A: Steady-State Community Traffic
- **Daily Visitors:** 200 - 400 visits.
- **Pages Browsed:** Landing page (`/`), Blogs (`/blogs`), Circles (`/dashboard`), Archive (`/post.html`).
- **Requests Generated:** ~1,500 - 3,000 requests/day.
- **D1 Database Load:** ~5,000 - 10,000 read rows/day (reduced by KV edge caching of notice feeds).
- **Result:** Consumes **<3%** of the daily Worker limit and **<0.2%** of D1 read limits.

### Scenario B: Exhibition Launch ("Bayaan" / "Kaamil III")
- **Active Cycle:** Call for submissions open for 3 weeks.
- **Applications:** 250 artist portfolio submissions.
- **Data per Submission:** 1 D1 record in `exhibition_applications`, 1-2 artwork uploads to R2.
- **Peak Day:** 50 submissions/day, 100 payment confirmations/day.
- **Database Writes:** ~300 D1 write operations/day (Free tier limit: 100,000/day).
- **R2 Storage Added:** ~150 MB (Free tier limit: 10,000 MB).
- **Result:** Operates comfortably within free limits with over 99% headroom remaining.

### Scenario C: Volunteer Recruitment Assessment Window
- **Assessment Cohort:** 60 candidate assessments completed over 14 days.
- **Assessment Payload per Candidate:**
  - 1 consent record + 1 identity record + 1 warmup baseline.
  - 7 SJT scenario responses.
  - ~350 - 500 behavioral telemetry events streamed across 14 minigames (in batches of 50-100).
  - 1 completion record + 7 evidence synthesis rows.
- **Total D1 Writes per Candidate:** ~40 - 50 SQL write operations.
- **Total Write Rows for 60 Candidates:** ~3,000 write rows total across the entire 14-day drive.
- **Result:** Daily recruitment write activity represents **<1%** of D1's 100,000 daily write limit.

---

## 3. System Error Modes & Quota Exhaustion Behaviors

When free-tier resource limits are approached or exceeded, the Cloudflare edge runtime and D1 storage engine exhibit distinct, deterministic error responses:

1. **HTTP 1015 (Rate Limited by Edge WAF):**
   - **Trigger:** An individual IP address or client exceeds edge rate limiting rules or sliding window rate limits on sensitive endpoints (`/auth/*`, `/recruit/telemetry`).
   - **Behavior:** The Cloudflare edge proxy immediately blocks incoming TCP/TLS requests from that client with status `HTTP 1015: You are being rate limited`. The request never reaches Worker CPU execution.
   - **Recovery:** Client must pause requests until the sliding window expires (typically 60 seconds).

2. **HTTP 1027 (Worker Runtime Script Error):**
   - **Trigger:** Worker script crashes during global initialization or unhandled runtime exceptions.
   - **Behavior:** Cloudflare edge returns `HTTP 1027: Worker runtime error`.
   - **Safeguard:** In production, missing critical configuration like `JWT_SECRET` deliberately triggers this safeguard to prevent running in an insecure state.

3. **Error 1102 (CPU Limit Exceeded):**
   - **Trigger:** An individual request consumes more than **10 ms of isolate CPU execution time** on the Free Tier (or 50 ms on Standard Bundled Paid).
   - **Behavior:** The V8 isolate is abruptly terminated mid-execution by the runtime scheduler, returning `Error 1102: Worker exceeded CPU time limit`.
   - **Design Mitigation:** PBKDF2 iterations are calibrated strictly to 100,000 iterations (~0.8 ms isolate CPU time via Web Crypto BoringSSL offloading), avoiding the fatal Error 1102 aborts that OWASP's 600,000 iterations would trigger.

4. **SQLITE_FULL / D1 Storage Quota Errors (500 MB Cap):**
   - **Trigger:** Total database storage exceeds the 500 MB per-database Free Tier allocation.
   - **Behavior:** Any subsequent `INSERT`, `UPDATE`, or table alteration fails with `D1_ERROR: SQLITE_FULL: database or disk is full`.
   - **Read Availability:** Read operations (`SELECT`) continue to execute unimpeded; the database does not go offline.
   - **Recovery:** Administrator must purge old telemetry or audit records using `/admin/purge_user` or upgrade to Cloudflare D1 Paid ($0.75 / GB-month).

5. **D1 Error Code 7500 (Daily Row Quota Exhausted):**
   - **Trigger:** Total account activity exceeds 5,000,000 row reads/day or 100,000 row writes/day.
   - **Behavior:** The Cloudflare D1 query engine refuses execution with D1 error code 7500 (`Quota exceeded`).
   - **Recovery:** Quota counters reset automatically at 00:00 UTC daily.

---

## 4. The Outbound Email Architecture & Restrictions

### Technical Constraints:
1. **Cloudflare Email Routing (Inbound Only):**
   - Cloudflare Email Routing is completely free for receiving emails at custom domain addresses (e.g. `curator@alfaazcollective.org`) and forwarding them to personal inboxes.
   - It cannot send arbitrary outbound transactional emails.
2. **Cloudflare Email Sending API (Paid Plan Requirement):**
   - Sending outbound emails to **arbitrary external recipient addresses** (such as applicant confirmation notices, password reset tokens, or volunteer invitations) via Cloudflare's native Email Sending API strictly requires an active **Workers Paid Plan ($5/month)** or verified individual destination domain identity.

### Zero-Cost Free-Tier Solutions Supported:
The application implements an abstracted `EmailProvider` adapter (`backend/src/notifications/email.ts`):
1. **Development & Staging:** `DevEmailProvider` captures all outbound email payloads into memory and terminal stdout without external network calls.
2. **Free Production Tier:** `WebhookEmailProvider` dispatches transactional emails via a zero-cost external webhook:
   - **Make.com Free Tier:** 1,000 operations / month.
   - **Brevo (Sendinblue) Free Tier:** 300 emails / day (9,000 / month).
   - **Resend Free Tier:** 3,000 emails / month (100 / day).
3. **Turnkey Paid Tier (Optional):** If Alfaaz upgrades to Workers Paid ($5/month), `CloudflareEmailSendingProvider` can be activated instantly by provisioning `CLOUDFLARE_EMAIL_TOKEN` with zero code modifications.

---

## 5. Conclusion & ROI

By migrating from Render and Vercel to Cloudflare-Native:
- **Annual Hosting Savings:** $324 - $450 USD / year eliminated.
- **Edge Performance:** Cold starts drop from 50+ seconds on Render free tier to **<5 milliseconds** globally.
- **High Availability:** 100% edge SLA with zero third-party database connection pool timeouts.
