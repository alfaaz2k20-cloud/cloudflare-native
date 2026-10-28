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
| **Cloudflare D1 (Database)** | 5,000,000 read rows / day<br>100,000 write rows / day<br>10 GB total storage | ~20,000 reads / day<br>~1,500 writes / day<br>~25 MB total data | **Reads: <0.5%**<br>**Writes: 1.5%**<br>**Storage: 0.25%** |
| **Cloudflare R2 (Storage)** | 10 GB stored data / month<br>1M Class A operations (writes)<br>10M Class B operations (reads)<br>**$0.00 Egress Fees** | ~1.5 GB stored artworks/proofs<br>~500 uploads / month<br>~10,000 views / month | **Storage: 15%**<br>**Writes: <0.1%**<br>**Reads: <0.1%** |
| **Workers KV** | 100,000 reads / day<br>1,000 writes / day<br>1 GB stored keys | ~500 notice cache reads / day<br>~10 cache invalidations / day | **Reads: 0.5%**<br>**Writes: 1.0%** |
| **Cloudflare Turnstile** | Unlimited challenges / month | ~500 - 1,500 challenges / month | **100% Free** |

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

## 3. The Outbound Email Caveat & Recommendation

### The Technical Nuance:
1. **Cloudflare Email Routing:**
   - Free for receiving emails (e.g. `curator@alfaazcollective.org`) and auto-forwarding them to personal inbox destinations.
2. **Cloudflare Email Sending (Transactional):**
   - Cloudflare provides an outbound transactional Email Sending API. However, sending outbound emails to **arbitrary external recipient addresses** (such as applicant confirmation emails or password reset tokens) requires an active **Workers Paid Plan ($5/month)** or manual domain identity verification.

### Zero-Cost Free-Tier Solutions:
The Cloudflare-native rebuild implements an abstracted `EmailProvider` interface:
1. **Development & Staging:** `DevEmailProvider` captures all outbound email bodies into memory and terminal logs without external services.
2. **Free Production Tier:** `WebhookEmailProvider` forwards transactional emails via a free webhook (e.g. Make.com free tier [1,000 operations/month], Brevo free tier [300 emails/day], or Resend free tier [3,000 emails/month]).
3. **Turnkey Paid Tier (Optional):** If the organization elects to spend $5/month on Workers Paid in the future, `CloudflareEmailSendingProvider` can be activated by setting `CLOUDFLARE_EMAIL_TOKEN` with zero code modifications.

---

## 4. Conclusion & ROI

By migrating from Render and Vercel to Cloudflare-Native:
- **Annual Cost Savings:** $324 - $450 USD / year in hosting fees.
- **Performance:** Cold starts drop from 50+ seconds on Render free tier to **<5 milliseconds** globally.
- **Reliability:** 100% edge SLA with zero third-party database connection pool timeouts.
