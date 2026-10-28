# Alfaaz Collective: Beginner's Deployment & Operations Guide

This guide walks you step-by-step through setting up, testing, and operating the Cloudflare-native Alfaaz Collective platform—both locally on your development machine and deployed to Cloudflare's global edge network.

---

## 1. Prerequisites

Before beginning, ensure you have the following installed on your workstation:
1. **Node.js:** v20.x, v22.x, or v24.x ([Download Node.js](https://nodejs.org/)).
2. **Git:** ([Download Git](https://git-scm.com/)).
3. **Cloudflare Account:** Free tier account registered at [cloudflare.com](https://dash.cloudflare.com/sign-up).

---

## 2. Local Development & Testing (No Cloud Account Required)

You can run the entire system—frontend, backend, SQLite database, and assets—completely locally with zero cloud dependencies.

### Step 2.1: Open the Project Directory
Open your terminal (PowerShell, Command Prompt, or Bash) and navigate to the `cloudflare-native` directory:
```bash
cd cloudflare-native
```

### Step 2.2: Install Dependencies
Install all required Node dependencies:
```bash
npm install --legacy-peer-deps
```

### Step 2.3: Build Frontend Static Assets
Compile the Vite frontend bundle into `./frontend/dist`:
```bash
npm run build:frontend
```
*You should see all 12 HTML pages and assets build successfully in approximately 2 seconds.*

### Step 2.4: Initialize Local SQLite (D1) Database
Apply the database migrations to your local SQLite sandbox:
```bash
npx wrangler d1 migrations apply DB --local
```
*(Select "Yes" when prompted to apply migrations).*

### Step 2.5: Seed Initial Development Data
Populate your local database with fabricated test records (admin user, volunteer accounts, sample exhibition cycle, and community events):
```bash
npx wrangler d1 execute DB --local --file=database/seeds/0001_dev_seed.sql
```

### Step 2.6: Launch the Local Development Server
Start the unified full-stack server:
```bash
npm run dev
```
The server will boot at:
```
http://localhost:8787
```

### Step 2.7: Test Key Journeys Locally
1. **Public Portal:** Open `http://localhost:8787/` to view the landing page, notice board, and Curator AI widget.
2. **Administrator Dashboard:**
   - Go to `http://localhost:8787/login.html`.
   - Log in with seed admin credentials:
     - **Email:** `curator@alfaaz.local`
     - **Password:** `AlfaazAdmin2026!`
   - Open `http://localhost:8787/admin.html` to manage events, exhibition cycles, and users.
3. **Volunteer Recruitment Evaluation:**
   - Go to `http://localhost:8787/recruit.html`.
   - Complete consent, identity, warmup, 7 Situational Judgment scenarios, and 14 behavioral games.
   - Schedule an interview slot.
4. **Recruiter Research Dossier:**
   - Go to `http://localhost:8787/research.html` as administrator to review candidate evidence dossiers.

---

## 3. Cloudflare Production Deployment

When you are ready to publish the application to the live Internet on Cloudflare:

### Step 3.1: Authenticate with Cloudflare
Log into your Cloudflare account via the command line:
```bash
npx wrangler login
```
*(A browser window will open asking you to approve the connection).*

### Step 3.2: Provision Cloudflare D1 Database
Create the distributed production relational database:
```bash
npx wrangler d1 create alfaaz-db
```
The terminal will display output containing your new `database_id`:
```jsonc
[[d1_databases]]
binding = "DB"
database_name = "alfaaz-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
Copy this `database_id` and paste it into `cloudflare-native/wrangler.jsonc` under the `DB` binding.

### Step 3.3: Provision Cloudflare R2 Storage Bucket
Create the object storage bucket for creative vault uploads and payment proofs:
```bash
npx wrangler r2 bucket create alfaaz-vault
```

### Step 3.4: Provision Workers KV Namespace
Create the KV store for edge caching notice boards:
```bash
npx wrangler kv:namespace create CACHE_KV
```
Copy the returned namespace `id` into `cloudflare-native/wrangler.jsonc` under the `CACHE_KV` binding.

### Step 3.5: Apply Migrations to Remote D1
Run your schema migrations against the live Cloudflare D1 database:
```bash
npx wrangler d1 migrations apply DB --remote
```

### Step 3.6: Configure Production Secrets
Set sensitive credentials using Wrangler encrypted secrets (they will never appear in code):
```bash
npx wrangler secret put JWT_SECRET
# Enter a random 64-character secret string

npx wrangler secret put PHANTOM_SECRET_TOKEN
# Enter a random secret token for Curator AI essay generation

npx wrangler secret put TURNSTILE_SECRET_KEY
# Enter your Cloudflare Turnstile secret key

npx wrangler secret put GEMINI_API_KEY
# (Optional) Enter your Google Gemini API key from Google AI Studio

npx wrangler secret put GROQ_API_KEY
# (Optional) Enter your Groq API key from Groq Console
```

### Step 3.7: Deploy to Cloudflare Edge
Build both frontend and backend, then deploy:
```bash
npm run build
npx wrangler deploy
```

Your application will be live instantly across Cloudflare's global edge network at:
`https://alfaaz-collective.<your-subdomain>.workers.dev`

---

## 4. Troubleshooting & FAQ

### Q: Why do I get `401 Unauthorized` on protected routes?
A: Protected routes (`/admin/*`, `/dashboard.html`) require an active JWT session stored in `localStorage.alfaaz_token`. Log in through `/login.html` to obtain a fresh token.

### Q: How do I reset the local database?
A: You can wipe the local SQLite state by deleting `.wrangler/state/v3/d1` inside `cloudflare-native/` and re-running Steps 2.4 and 2.5.

### Q: Does this modify anything in the original `alfaaz-project/`?
A: No. All code, databases, configurations, and scripts are strictly isolated inside `cloudflare-native/`. The legacy repository files remain 100% untouched.
