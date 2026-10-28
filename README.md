# Alfaaz Collective (الفاظ) — Cloudflare-Native Implementation

An isolated, zero-dependency, Cloudflare-native full-stack reimplementation of the **Alfaaz Collective** art, literature, and cultural community platform.

This implementation replaces the split Render (FastAPI) + Vercel (Next/Vite + Serverless) + Neon (PostgreSQL) + Cloudinary architecture with a unified, high-performance edge deployment on **Cloudflare Workers**, **Workers Static Assets**, **Cloudflare D1 (SQLite)**, **Cloudflare R2**, and **Workers KV**—operating 100% within Cloudflare's **Free Tier**.

---

## Key Highlights

- **Zero Cold Starts:** V8 isolates replace Render's 50s+ cold starts with sub-5ms edge execution.
- **Unified Origin:** Pre-built Vite multi-page frontend (12 HTML pages) and Hono TypeScript backend live on the identical domain, eliminating CORS friction.
- **D1 Relational Database:** Full 25-table relational schema with foreign key integrity and ACID atomic transactions.
- **Preserved Aesthetic & Cultural Identity:** Kashmiri cultural heritage, Urdu/English bilingual nuances, and brutalist typography preserved without compromise.
- **Volunteer Recruitment Engine:** 14-minigame Latin Square counterbalanced assessment, Situational Judgment Test (SJT) integer-thirds scoring, streaming behavioral telemetry, and bias-free recruiter dossiers.
- **Zero Cost:** Runs indefinitely on Cloudflare's free tier ($0.00/month vs ~$35/month previously).

---

## Documentation Index

The `docs/` directory contains complete documentation:

1. [SOURCE_CODE_AUDIT.md](file:///C:/Users/saqrt/OneDrive/Desktop/alliswell/alfaaz-project/cloudflare-native/docs/SOURCE_CODE_AUDIT.md): Inventory of all 45 routes, 25 database models, 12 HTML pages, and pre-existing uncommitted state.
2. [FEATURE_PARITY_MATRIX.md](file:///C:/Users/saqrt/OneDrive/Desktop/alliswell/alfaaz-project/cloudflare-native/docs/FEATURE_PARITY_MATRIX.md): Detailed comparison across all 45 endpoints and features.
3. [ARCHITECTURE.md](file:///C:/Users/saqrt/OneDrive/Desktop/alliswell/alfaaz-project/cloudflare-native/docs/ARCHITECTURE.md): System topology, data flow, D1/R2/KV architecture, and security layers.
4. [DATABASE_MIGRATION.md](file:///C:/Users/saqrt/OneDrive/Desktop/alliswell/alfaaz-project/cloudflare-native/docs/DATABASE_MIGRATION.md): D1 SQLite schema, migrations, data seed specifications, and type mappings.
5. [SECURITY_REVIEW.md](file:///C:/Users/saqrt/OneDrive/Desktop/alliswell/alfaaz-project/cloudflare-native/docs/SECURITY_REVIEW.md): Threat modeling, PBKDF2 Web Crypto, JWT lifecycle, Turnstile, and anti-bias safeguards.
6. [FREE_TIER_COSTS_AND_LIMITS.md](file:///C:/Users/saqrt/OneDrive/Desktop/alliswell/alfaaz-project/cloudflare-native/docs/FREE_TIER_COSTS_AND_LIMITS.md): Quota breakdown, traffic modeling, outbound email options, and cost analysis.
7. [BEGINNER_DEPLOYMENT_GUIDE.md](file:///C:/Users/saqrt/OneDrive/Desktop/alliswell/alfaaz-project/cloudflare-native/docs/BEGINNER_DEPLOYMENT_GUIDE.md): Step-by-step instructions for local execution and production deployment.

---

## Directory Structure

```
cloudflare-native/
├── backend/
│   └── src/
│       ├── auth/          # PBKDF2 Web Crypto & HMAC-SHA256 JWT
│       ├── config/        # SJT items, parameters, Latin Square definitions
│       ├── middleware/    # Auth, Admin, and Turnstile rate-limiting
│       ├── notifications/ # EmailProvider abstraction (Dev, Webhook, Cloudflare)
│       ├── routes/        # Auth, Events, Clubs, Exhibitions, Vault, Blogs, Curator, Admin, Recruit, Research, Notices
│       ├── services/      # Curator AI, SJT engine, Telemetry, Features, Evidence integrator
│       ├── index.ts       # Hono app entry point with universal routing
│       └── types.ts       # Worker bindings and JWT payload interfaces
├── database/
│   ├── migrations/
│   │   └── 0001_initial_schema.sql  # 25 relational D1 tables with foreign keys
│   └── seeds/
│       └── 0001_dev_seed.sql        # Fabricated dev records for local sandbox
├── docs/                  # Architecture, migration, security, and audit docs
├── frontend/              # 12 HTML entry points, CSS, Vite config, PWA service worker
├── tests/                 # Vitest automated test suite
├── package.json           # Unified dependencies and build scripts
├── tsconfig.json          # TypeScript isolate configuration
├── wrangler.jsonc         # Cloudflare Worker, D1, R2, and KV bindings
└── .dev.vars.example      # Example environment variables template
```

---

## Quickstart

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Build frontend and typecheck backend
npm run build

# 3. Apply local D1 database migrations
npx wrangler d1 migrations apply DB --local

# 4. Seed development data
npx wrangler d1 execute DB --local --file=database/seeds/0001_dev_seed.sql

# 5. Launch local edge development server
npm run dev

# 6. Run automated test suite
npm test
```
