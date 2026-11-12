# Alfaaz Collective
## Whole-site engineering, UX and design audit

**Audit date:** 11 November 2026  
**Source reviewed:** `cloudflare-native` repository snapshot supplied in this conversation  
**Latest repository commit:** `2468ddb` — `fix(ui): resolve dashboard layout overlap and restore direct exhibition submission form`  
**Review type:** Source-code, architecture, static-markup and workflow audit. No source files were changed.

---

## 1. Executive assessment

Alfaaz is a cultural platform with a real operational system behind it. It is not just a brochure site. The repository contains a public editorial website, a member workspace, event and creative-circle workflows, a multi-cycle exhibition application system, a creative vault, a journal, an administration console, and a separate recruitment and research subsystem. It also contains the Tchandervar cultural subsite.

The strongest part of the project is its underlying direction: the warm-paper palette, charcoal typography, terracotta accent, Alegreya family, Urdu typography, archival imagery and restrained geometry give the public site a recognisable editorial identity. The Cloudflare-native architecture is also coherent for the size and shape of the platform.

The main weakness is not that every page looks bad. It is that the site has not yet established a sufficiently clear distinction between **editorial experiences** and **operational interfaces**. The dashboard is allowed to be a practical workspace. The exhibition experience, however, currently presents an operational form as though it were the exhibition itself. It uses the brand's colours and fonts, but it does not carry enough of the site's cultural, visual and curatorial character.

There are also several functional and privacy issues in the exhibition workflow that should be resolved before treating the page as finished. Most notably, the multi-cycle ID contract is inconsistent across the dashboard, exhibition client and API; the public exhibition page redirects visitors to login before showing the open call; and the upload path can bypass the application's private R2 file-access controls by uploading directly to Cloudinary.

### Overall assessment

| Area | Assessment | Notes |
|---|---|---|
| Brand and visual identity | Good foundation, uneven application | Strong global tokens; page-specific styling and layouts drift |
| Public website | Sound structure | Editorial home and archive are the clearest expression of the brand |
| Dashboard | Directionally appropriate | Utility-first is correct; some repeated navigation and status handling need work |
| Exhibition experience | Needs a rethink | Currently form-first, not exhibition-first; public discovery is gated |
| Multi-cycle exhibition logic | High-priority defect | Query parameter contract and finalisation logic are inconsistent |
| Security and privacy | Mixed | Good baseline controls; upload and rate-limit gaps remain |
| Accessibility and SEO | Needs systematic cleanup | Missing metadata, heading and label issues in several pages |
| Performance | Moderate improvement opportunity | Large duplicated image assets and external runtime dependencies |
| Automated verification | Incomplete in supplied archive | TypeScript passed; tests/build could not run because dependencies in archive are incomplete |

**Recommendation:** Do not redesign the entire site. Keep the shared identity and the broad product architecture. Rework the exhibition experience as an editorial open-call page with a clearly separated application journey, repair the multi-cycle workflow as one end-to-end contract, and address the upload/privacy and youth-safeguarding issues.

---

## 2. What the site actually is

### 2.1 Product map

Alfaaz currently has three connected experiences, plus two specialist surfaces.

| Experience | Purpose | Main pages / modules |
|---|---|---|
| **Public collective** | Explain the organisation, publish work, announce activities and invite participation | `index.html`, `blogs.html`, `post.html`, `submit.html`, exhibition open call |
| **Member platform** | Let participants manage their relationship with Alfaaz | `login.html`, `register.html`, `reset.html`, `dashboard.html`, event, circle, vault and exhibition workflows |
| **Administration** | Run the organisation's programmes and review submissions | `admin.html`, `src/admin.js`, `/admin/*` API |
| **Recruitment and research** | Separate volunteer assessment and recruiter research workflows | `recruit.html`, `research.html`, `src/recruit.js`, `src/research.js` |
| **Tchandervar** | A distinct cultural/archive microsite served through its own subdomain and path rewrites | `tchandervar/index.html`, image archive, Worker rewrite logic |

The member platform is not a second public website. It is an account workspace. The administration console is not part of the public design experience. The recruitment and research surfaces are intentionally isolated and should remain so during general visual refactoring, in line with the repository's `AGENTS.md` instructions.

### 2.2 Main user journeys

**Participant journey**

1. Discover Alfaaz through the public site, archive, an event, a circle or an exhibition open call.
2. Register or sign in.
3. Enter the member dashboard.
4. Explore activities, apply to a circle, RSVP to events, submit work or apply to an exhibition.
5. Track review and registration status through the dashboard.

**Curatorial / administrative journey**

1. An administrator signs in.
2. Creates and activates exhibition cycles, events, notices or journal content.
3. Reviews participant and artist submissions.
4. Changes decisions, verifies payment or manages programme records.
5. The participant sees relevant status changes in the member workspace.

**Recruitment journey**

The volunteer assessment and research tools form a separate candidate-intake and review system. They should not be pulled into a general dashboard redesign or have their protected assessment logic changed as part of this work.

### 2.3 Technical architecture

The project is a multi-page Vite frontend and a Hono API running on Cloudflare Workers.

- **Frontend:** 14 Vite HTML entries, including the Tchandervar page and the branded 404 page.
- **Backend:** 12 route modules, mounted under their main paths and mostly mirrored under `/api` for compatibility.
- **Database:** Cloudflare D1 using SQLite and six migration files in the supplied snapshot.
- **Object storage:** Cloudflare R2 through the `VAULT_BUCKET` binding.
- **Cache:** Cloudflare Workers KV for the notices feed and cache invalidation.
- **Static assets:** Cloudflare Workers Assets, with `run_worker_first: true` so the Worker can apply response headers before forwarding to the asset binding.
- **Scheduled work:** a weekly Cron trigger is configured for the journal/curator workflow.
- **External services:** Google Identity Services, Cloudflare Turnstile, Cloudinary, Google Fonts and unpkg/Lucide; recruitment and research also load the Tailwind CDN.

The architecture is more substantial than the public site alone suggests. This matters when changing a page: exhibition UI changes touch a multi-step workflow involving the dashboard, API, D1 records, R2 or Cloudinary files, and administrative review.

---

## 3. Design-system diagnosis

### 3.1 What is already working

The shared palette and typography are coherent:

- Warm paper: `#f4f1ea`
- Charcoal: `#2d312e`
- Terracotta accent: `#bd6f5d`
- Green and red status accents with darker text variants
- Alegreya for headings, Alegreya Sans for body text, Amiri and Noto Nastaliq Urdu for Arabic-script typography
- Thin grid borders, square corners and restrained shadows

These choices support an editorial, literary and gallery-oriented identity. The homepage's video-led hero, archive imagery and spacious sections are much closer to the site's character than a typical software dashboard. See `frontend/global.css:8-34` and the public homepage in `frontend/index.html`.

### 3.2 Where the system loses consistency

The shared CSS is a good token layer, but it is not yet a full interface system. Many page layouts, panels, buttons, status blocks and spacing rules are defined in page-local `<style>` blocks or inline styles. The dashboard injects exhibition cards with inline styles in JavaScript. This produces a common colour palette without necessarily producing a common visual rhythm.

The practical result is that each page can feel as though it was designed separately, even when each uses the correct brand colours. The solution is not to make every page identical. It is to define a small set of reusable patterns for:

- Editorial page headers and section introductions
- Artwork / archive cards
- Metadata rows for dates, venue, category and status
- Member-workspace panels and compact status indicators
- Forms, upload controls and consent sections
- Empty, loading, error and success states

**Design principle:** public pages should lead with culture and content; member pages should lead with tasks and status; admin pages should lead with control and clarity. Shared identity, different information architecture.

---

## 4. Exhibition experience: why it does not fit

### 4.1 The central problem

The exhibition page is currently an application portal with an exhibition title on top. It is not yet an exhibition landing page that happens to contain an application route.

The page currently has:

1. A 44vh video header with a generic “Exhibition Open Call” heading.
2. A large instruction panel with four numbered cards.
3. The application form directly underneath.
4. A cycle selector embedded as the first field of the form.
5. A selected-cycle summary card nested inside the form.

The form and instructions dominate the page. There is very little visual material about the actual exhibition, no prominent artwork or exhibition image, no clear curatorial introduction, no selected-work context and no meaningful bridge to the collective's archive. The page uses the brand's tokens, but its hierarchy and content make it feel like a generic submission portal.

Relevant implementation: `frontend/exhibition.html:32-48`, `:213-280`, `:283-327`.

### 4.2 A second problem: the open call is hidden from the public

`frontend/src/exhibition.js:2-7` checks for `alfaaz_token` immediately on page load and redirects visitors without a token to the login page. This happens before the public exhibition configuration is rendered.

The API's `/exhibitions/config` endpoint is public (`backend/src/routes/exhibitions.ts:9-59`), so the site already has a public data source for active cycles. The client simply does not let anonymous visitors see it.

That is a conversion problem. An artist should be able to understand the exhibition, its theme, eligibility, requirements and deadline before being asked to create an account. Authentication should be required when the visitor starts or submits an application, not to read the open call.

### 4.3 Recommended exhibition page structure

Keep the current route if useful, but change the page's hierarchy.

**A. Exhibition-led opening**

- Use the actual exhibition title, not a generic portal title.
- Show the open-call status, dates, venue and eligible participant group as concise metadata.
- Use one strong piece of artwork, an image from a previous exhibition, or an approved exhibition visual. Avoid reusing a generic blurred video background as the main visual identity of every cycle.
- Add a short curatorial statement or a concise description of what the exhibition is inviting.

**B. The work being invited**

- Explain what participants can submit.
- Clarify medium, format, file requirements and any selection conditions.
- For multiple active cycles, show separate exhibition cards with their own title, age group, dates and status. Do not make the cycle selector the first meaningful thing a visitor sees.

**C. Practical information**

- Eligibility and age group
- Venue and exhibition dates
- Submission deadline or open/close state
- File requirements and any fee, where applicable
- Review and notification process
- Contact and accessibility information

**D. Curatorial context / archive**

Where relevant, show selected work, a previous exhibition, a small image strip or a link to the archive. The goal is not decoration. It gives the artist a sense of the kind of cultural space they are entering.

**E. Application action**

Use a clear “Apply to this exhibition” action. It should take the visitor to a focused application section or a dedicated step. Preserve the selected cycle ID through login and back again.

**F. Application form**

Retain the practical fields, but make the form feel like a distinct process rather than the whole page. A compact three-part structure would be sufficient:

1. About you
2. Your work
3. Review and submit

A short progress indicator and a clear summary of the selected exhibition would help. Avoid turning this into an elaborate multi-screen app if a single page with grouped sections is easier to maintain.

### 4.4 Dashboard: what to preserve and what to improve

The dashboard's four destinations are a reasonable architecture:

- HOME
- EXPLORE
- MY ACTIVITY
- PROFILE

A member dashboard should be more functional than the public homepage. It does not need to imitate the exhibition landing page or become a second editorial magazine.

The current four-tab direction should be preserved. The main improvements are:

- Reduce repeated “Dashboard Sections” directory blocks. The same destination directory appears in each of the four sections (`frontend/dashboard.html` around lines 858, 1003, 1175 and 1296). A single clear tab/navigation system should do most of this work.
- Render a separate status for each active exhibition cycle instead of collapsing the user's exhibition activity into one generic status.
- Keep cards and actions visually quieter than the public site's artwork-led sections, while retaining typography, colour and spacing tokens.
- Move dynamically generated inline card styles into shared CSS classes over time.

The dashboard's visual direction is not the main issue. Its data presentation and repeated navigation are more important.

---

## 5. Exhibition workflow: confirmed functional defects

These findings are connected. They should be corrected together and covered by end-to-end tests.

### 5.1 Cycle ID is sent under the wrong query parameter

The dashboard creates links like:

`exhibition.html?cycle=<cycle-id>`

Locations: `frontend/src/dashboard.js:731-745` and `:757-760`.

The exhibition client interprets:

- `id` as the exhibition database ID
- `cycle` as the exhibition title

Location: `frontend/src/exhibition.js:416-428`.

The API's config handler follows the same contract: `id` is used for an ID, while `cycle` is matched against the title (`backend/src/routes/exhibitions.ts:9-34`). A numeric ID passed as `cycle` therefore fails the title lookup and the page falls back to the first active cycle.

**Recommended fix:** standardise on `?id=<cycle-id>` for links and selection. Keep title-based `cycle` only for backward compatibility if necessary. Add a test that opens the second active cycle from the dashboard and verifies the exact cycle is selected.

### 5.2 Invalid cycle IDs silently fall back to the first active cycle

The apply handler tries to resolve `exhibition_id` or `exhibition_cycle`. If it cannot resolve the supplied value, it selects the first active cycle (`backend/src/routes/exhibitions.ts:128-154`).

That is unsafe behaviour for a multi-cycle system. A bad or stale cycle ID should not silently submit an application to a different show.

**Recommended fix:** if the request explicitly includes an ID or title and it does not resolve to an active cycle, return a clear `400` response. Only use the first-active-cycle default for legacy callers that omit both identifiers entirely, and plan to remove that compatibility path once clients are updated.

### 5.3 Dashboard status handling is not genuinely multi-cycle

The `/exhibitions/my-status` endpoint returns `statuses_by_cycle` for all of the user's exhibition applications (`backend/src/routes/exhibitions.ts:229-323`). The dashboard calls the endpoint without an ID or cycle (`frontend/src/dashboard.js:688-700`) and then uses only `data.status` and `data.registration_status` to render the activity panel (`frontend/src/dashboard.js:768-800`).

This loses the multi-cycle information the API already supplies. In addition, the API's no-cycle default selects the first active show and can fall back to the user's most recent application when there is no matching application for that first show (`backend/src/routes/exhibitions.ts:287-307`). The resulting single status is not a reliable representation of all active cycles.

**Recommended fix:** render a status row/card per cycle using `statuses_by_cycle`, and make each action carry the cycle ID. If the dashboard needs an overall summary, derive it from those individual cycle records rather than relying on the endpoint's default status.

### 5.4 Registration finalisation targets the first active cycle

The shared finalisation handler selects the first active exhibition and finds an approved application for that title (`backend/src/routes/exhibitions.ts:325-369`). It does not accept an exhibition ID. With concurrent active cycles, an approved participant in a later cycle may be unable to complete registration correctly.

**Recommended fix:** require `exhibition_id` in the finalisation request, resolve that cycle, and verify the current user has an approved application for that exact cycle. Add tests for finalising an approved application in the second active cycle.

---

## 6. Security, privacy and safeguarding findings

### Critical: exhibition and payment uploads can bypass private R2 access controls

The exhibition client uploads to Cloudinary first, using the public client-side upload preset, then tries R2 only if the Cloudinary calls fail (`frontend/src/exhibition.js:148-208`). The dashboard payment-proof flow also uploads directly to Cloudinary (`frontend/src/dashboard.js:883-900`).

The backend has a more controlled R2 path: `/exhibitions/upload-portfolio` requires authentication, writes to the R2 bucket and returns a vault URL (`backend/src/routes/exhibitions.ts:61-105`). The vault retrieval route requires authentication and checks ownership for non-admin users (`backend/src/routes/vault.ts:108-174`).

The Cloudinary path does not pass through those application-level ownership checks. A Cloudinary `secure_url` is an HTTPS delivery URL; it does not, by itself, establish private access. Whether these assets are publicly retrievable depends on the Cloudinary asset type and upload-preset configuration, which are not enforceable in this application code.

**Recommended fix:** make authenticated R2 upload the only path for portfolios and payment evidence, or implement an authenticated server-side Cloudinary signing and delivery strategy with access controls. Do not use a public unsigned upload as a fallback for files containing personal or payment information. Verify the current Cloudinary preset's access mode and remove any public exposure that is not intentional.

### High: youth exhibition flow has no visible guardian-consent process

The youth cycle accepts participants under 18. The form asks for the participant's name, age, location and WhatsApp number (`frontend/exhibition.html:330-353`). The youth client hides the adult age-confirmation checkbox and treats it as automatically checked (`frontend/src/exhibition.js:315-328`). The backend validates the age range but does not require or record a parent/guardian's identity, permission or contact information (`backend/src/routes/exhibitions.ts:160-177`).

This is a safeguarding and personal-data governance gap. It should not be treated as a normal adult application with a different age range.

**Recommended fix:** before accepting youth applications, add a parent/guardian contact and consent process, record the consent version and timestamp, capture the young participant's assent in an age-appropriate way, and avoid requiring the child's own WhatsApp number when a guardian contact can serve the purpose. Confirm the final process with appropriate legal/safeguarding advice before collecting submissions from children.

### High: general Creative Vault upload has no server-side file size or type limit

The multipart upload path in `backend/src/routes/vault.ts:53-71` writes the submitted file to R2 without a file size cap or an allowlist of file types. The exhibition-specific upload endpoint has a 15 MB limit, but accepts a file based on its declared MIME type or `.pdf` filename (`backend/src/routes/exhibitions.ts:74-82`), rather than validating the actual PDF signature.

**Recommended fix:** set explicit per-type size limits, enforce a small allowlist, validate file signatures server-side, generate storage keys that are unique and user-bound, and reject unexpected files before writing to R2. Consider malware/content scanning for file types that may be downloaded or opened by staff.

### High: server-side application validation is thinner than client-side validation

The browser enforces required fields and checks for an uploaded PDF, but the `/exhibitions/apply` handler does not comprehensively validate the lengths and formats of `full_name`, `address`, `whatsapp`, `genre`, `medium` and `portfolio_url` before inserting them (`backend/src/routes/exhibitions.ts:108-205`). The server accepts the submitted portfolio URL as a string and does not prove that it belongs to the authenticated user's R2 upload.

**Recommended fix:** treat browser validation as convenience only. Validate every required field and length on the server, normalise the phone number, validate URL/storage origin, and bind an uploaded object to the applicant before accepting its URL. Prefer a server-issued upload identifier over trusting a client-supplied URL.

### Medium: rate limiting is isolate-local and has a client-controlled fallback

`backend/src/middleware/rate_limit.ts:15-16` stores rate-limit counters in a process-local `Map`. That state is not a shared counter across Worker isolates and can be lost when an isolate is recycled. If the trusted Cloudflare IP header is absent in production, the code can fall back to the caller-supplied `x-forwarded-for` value (`:31-42`), which is not a trustworthy client identity by itself.

**Recommended fix:** use Cloudflare-level rate limiting or a shared Durable Object / carefully designed shared counter for sensitive routes. In production, trust only platform-provided client identity; do not use a caller-controlled forwarding header as a security key.

### Medium: inline scripts weaken CSP

The main CSP allows `unsafe-inline` scripts (`backend/src/security/headers.ts:38-43`). The static scan found 54 inline event-handler attributes across the 14 HTML source files. This makes it harder to move to nonce- or hash-based script policies and increases the impact of any future HTML injection defect.

**Recommended fix:** gradually move inline event handlers into module scripts and use event listeners. Then tighten `script-src` with hashes or nonces where feasible. Keep the recruitment and research pages isolated while doing this, as required by the repository's own rules.

### Positive security controls already present

- Exact-origin CORS allowlist in `backend/src/index.ts:45-103`.
- HSTS, `nosniff`, clickjacking protection and referrer policy in `backend/src/security/headers.ts:9-17`.
- Path-specific CSP for the recruitment/research surfaces rather than granting `unsafe-eval` to every page (`headers.ts:38-50`).
- Turnstile is designed to fail closed in production when unconfigured or supplied with the dummy pass secret (`backend/src/middleware/rate_limit.ts:95` onward).
- The R2 vault path uses authenticated reads and ownership checks (`backend/src/routes/vault.ts:108-174`).
- The service worker avoids caching API responses, preserving a separation between cached page shells and live user data.

These controls are worth preserving while fixing the gaps above.

---

## 7. Site-wide UX, accessibility and SEO audit

### 7.1 Semantic structure and page metadata

A static scan of the 13 root-level HTML pages found:

- Missing meta descriptions on `404.html`, `admin.html`, `dashboard.html`, `login.html`, `register.html`, `research.html` and `reset.html`.
- No `<h1>` on `admin.html`, `post.html` and `recruit.html`.
- A number of controls without an explicit label association. Examples include exhibition portfolio upload, dashboard profile/payment controls, admin form inputs and the homepage mini curator input. Some checkboxes may use wrapping labels, so this is a flag for manual verification rather than a claim that every control is inaccessible.
- No duplicate IDs and no `<img>` tags missing `alt` text were found by the scan.

**Recommended fix:** add meaningful page titles and descriptions where appropriate, ensure each page has one clear primary heading, and associate every form control with a visible `<label>` or a suitable accessible name. Test keyboard navigation, focus visibility, screen-reader names and error announcements manually.

### 7.2 Mobile and responsive behaviour

The exhibition page's mobile media query only changes the form grid and instruction-panel padding (`frontend/exhibition.html:190-194`). The top navigation is still a logo plus two links with fixed spacing. This needs testing at narrow widths, especially 320–375 px. `overflow-x: hidden` elsewhere should not be used to conceal a layout overflow.

**Recommended fix:** test all important pages at 320, 375, 768 and 1024 px widths. Add a real compact navigation state and review long titles, Urdu text, upload labels, buttons and status panels.

### 7.3 SEO and indexation

No `robots.txt` or `sitemap.xml` was present in the reviewed frontend public directory, and the scan did not find page-level `noindex` metadata.

**Recommended fix:** create a sitemap containing only public, indexable pages. Add a `robots.txt`. Explicitly keep private or operational surfaces such as admin, member dashboard, auth, recruitment and research pages out of search indexing. Give public archive and exhibition pages descriptive metadata and stable canonical URLs.

### 7.4 Performance and external dependencies

- The largest scanned image is `artwork-b012.jpg` at approximately 3.11 MB.
- The same artwork image sets appear in both `frontend/tchandervar/images/` and `frontend/public/tchandervar/images/`; the two copies checked have identical SHA-256 hashes. Each directory is approximately 15 MB. Confirm which path is required and remove redundant copies from the source/build pipeline where safe.
- Google Fonts are imported from CSS (`frontend/global.css:5`), so font delivery is an external dependency.
- Lucide is loaded from unpkg on most pages, while recruitment/research use the Tailwind CDN at runtime.
- The homepage and exhibition header use remote Cloudinary video. Provide a useful poster image and respect `prefers-reduced-motion` so the page does not rely on autoplaying video for its core visual identity.

**Recommended fix:** resize and convert large static images to WebP/AVIF where supported, use responsive image sizes and lazy loading for below-the-fold work, remove verified duplicate assets, and consider bundling or self-hosting critical dependencies. Keep the site's visual quality; optimise delivery rather than stripping the archive of its imagery.

---

## 8. Codebase quality, documentation and verification

### 8.1 Working-tree review: the apparent dashboard edits are line-ending changes

The supplied Git working tree marks six files as modified: `backend/src/config/parameters.json`, `frontend/dashboard.html`, `frontend/public/llms.txt`, `frontend/public/manifest.webmanifest`, `frontend/vite.config.js` and `tests/events_clubs.test.ts`. However, `git diff --ignore-space-at-eol` returns no substantive diff. In particular, the apparent `dashboard.html` modification is a line-ending change, not a new dashboard implementation. The latest commit already contains the dashboard layout correction and restoration of the direct exhibition submission form.

This matters because the audit should assess the code that is actually present, not attribute a visual defect to an uncommitted change that is only a newline conversion. No source-code edits were made during this audit.

### 8.2 Documentation has drifted from the source

The documentation should be reconciled before it is treated as the authoritative system map.

Examples:

- `PROJECT.md` describes the initial migration sequence only through `0005`, while the snapshot includes `0006_remediate_email_verification.sql`.
- `PROJECT.md` cites 27/28 tables and 84 endpoints in different sections.
- `SYSTEM_AUDIT.md` is dated 3 November 2026, labels the endpoint directory as 81 active endpoints, but its table rows continue through 83.
- The migration directory contains six migration files. Across those migrations, 29 distinct `CREATE TABLE` names occur, including migration-era names. This is not a verified count of the active production schema.
- `backend/src/security/headers.ts:4-6` still says the security headers are duplicated into `frontend/public/_headers`, while the current worker configuration intentionally applies the headers through the Worker and the `_headers` file is absent. This comment should be reconciled with the actual deployment strategy.

**Recommended fix:** generate the route, migration and page inventories from the repository instead of maintaining manually counted totals. Clearly distinguish current active routes from legacy aliases and current schema tables from tables mentioned only in migration history.

### 8.3 Repository snapshot hygiene

The uploaded ZIP contains generated and local material that should not be included in a source handoff: `.git`, `.wrangler` state, root and frontend `node_modules`, `coverage`, `frontend/dist`, and `.agents` content. The repository `.gitignore` excludes many of these, but the archive itself includes them.

The ZIP also contains a non-empty `.dev.vars` file with values that resemble application secrets. No secret values are reproduced in this report. The archive also includes `frontend/.env`, which contains client-side configuration values.

**Action:** if this ZIP was shared outside a trusted private workspace, review and rotate any valid server secrets in `.dev.vars` and review the Cloudinary unsigned upload preset and other client configuration. Do not place secret files, local databases, local storage state, or generated dependencies in future project archives. Use `.dev.vars.example` with placeholders instead.

### 8.4 Automated verification results

| Check | Result | Explanation |
|---|---|---|
| TypeScript check | Passed | `tsc --noEmit` completed successfully |
| Vitest suite | Not completed | The bundled `vitest` executable had permission issues; direct invocation then failed because the Rollup Linux native optional package was missing from the supplied `node_modules` |
| Vite production build | Not completed | Same missing Rollup native optional package in the supplied dependency tree |
| Browser / live visual audit | Not completed | The supplied environment could not resolve the live `.org` host, and a reliable local browser rendering was not available |
| Static markup scan | Completed | 14 HTML source files examined, including the Tchandervar page |
| Repository / workflow inspection | Completed | Key frontend and backend flows, routes, migrations, worker configuration and tests inspected |

The test and build results are **environment blockers**, not evidence that the source code itself fails those commands. Reinstall dependencies from the lockfile in a clean environment, then run:

```bash
npm ci
npm run typecheck
npm test
npm run test:hardening
npm run build
```

Before a deployment, also run a browser pass against the actual Cloudflare deployment on desktop and mobile, and verify the storage access mode of both portfolios and payment proof.

---

## 9. Prioritised remediation plan

### P0: resolve before the next public exhibition intake

1. **Make submission files private by design.** Remove the direct unsigned Cloudinary upload path for portfolios and payment proof, or replace it with an access-controlled strategy. Prefer the authenticated R2 vault path.
2. **Add youth safeguarding and guardian consent.** Capture guardian contact and permission, participant assent and an appropriate data-handling notice before accepting under-18 applications.
3. **Repair the multi-cycle contract end-to-end.** Standardise links on `?id=`, reject invalid explicit IDs, make dashboard status cycle-aware, and pass the selected cycle into registration finalisation.
4. **Harden upload validation.** Add server-side size, type, signature, URL ownership and required-field checks. Add the same limits to the general Creative Vault upload.
5. **Review archive-exposed secrets.** Rotate valid `.dev.vars` credentials if the uploaded archive was accessible outside the trusted workspace.

### P1: exhibition and member experience

1. Rebuild the exhibition page hierarchy as an open-call / exhibition landing page, with artwork, curatorial context, show facts, practical requirements and a separate application action.
2. Allow anonymous visitors to read public exhibition information. Gate only application actions and authenticated status information.
3. Render multiple cycles and their individual application statuses clearly in the dashboard.
4. Reduce repeated dashboard directory navigation and preserve the current four-destination model.
5. Complete a responsive and accessible-form pass across the public pages, dashboard and exhibition form.

### P2: site-wide consistency and maintainability

1. Define reusable page patterns and component classes from existing design tokens.
2. Move inline event handlers to module event listeners and tighten CSP incrementally.
3. Replace the isolate-local limiter with platform/shared rate limiting for sensitive endpoints.
4. Optimise and deduplicate large assets; add video posters and reduced-motion behaviour.
5. Add robots/sitemap and finish page-level metadata and heading cleanup.
6. Reconcile `PROJECT.md`, `SYSTEM_AUDIT.md` and code comments with the real repository state.
7. Clean project archives so generated files, local state and secret files are never included.

---

## 10. Test cases that should be added

The following tests would protect the most important exhibition behaviour:

1. Dashboard link to the second active cycle opens that exact cycle, not the first active one.
2. Explicit unknown or inactive exhibition ID is rejected; it never silently falls back to another cycle.
3. A user with applications in two cycles sees two independent statuses on the dashboard.
4. An approved application in the second active cycle can complete registration for that same cycle.
5. Finalisation rejects an exhibition ID for which the user has no approved application.
6. Under-18 submission is rejected unless the required guardian-consent record is present.
7. Portfolio URL cannot be an arbitrary external URL and must resolve to the applicant's own uploaded object.
8. Payment proof is stored privately and cannot be retrieved by another participant.
9. Oversized and non-PDF files are rejected by the server even when the browser-side validation is bypassed.
10. The public exhibition configuration and open-call details render without an authentication token; the application action still requires authentication.

---

## 11. Final direction

Alfaaz should not become a generic SaaS interface with a cultural colour palette. The public site should continue to feel like a living collective: an editorial space for art, literature, ideas, people and gatherings. The member dashboard can remain quiet and functional. The administration console can remain operational. The exhibition page is where those two worlds meet, and that is why its current form-first design feels out of place.

The right next move is not to add more decoration. It is to put the exhibition back at the centre of the page: the work, the invitation, the curatorial idea, the people it is for and the place where it will live. Then make applying straightforward.

**Audit boundary:** this report reflects the supplied source snapshot. It does not certify the live production deployment, Cloudinary account settings, production D1 schema, DNS, browser rendering or external service configuration. Those require a clean deployment/test environment and access to the corresponding live systems.
