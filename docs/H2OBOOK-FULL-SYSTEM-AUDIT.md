# H2OBOOK Full Product Audit

Audit date: 2026-09-21
Production URL: https://h2obook-app.vercel.app/
Repository: E:\CLAUDECODE\H2OBOOK\H2OBOOK-UNIFIED-INPUT-4.13.7-PHASE7

## 1. Executive Summary

Status: authenticated production audit in progress. This report records verified evidence so far.

Preliminary readiness:

- UI/public site: 75%
- Functional app shell: 65%
- Data/backend flows: 40%
- Security/permission baseline: 60%
- Production readiness: 52%

Top findings:

1. P1: `/api/readiness` is `503 degraded` in production.
2. P1: Redis/BullMQ queue is missing, so import/export/OCR/automation workers are not production-ready.
3. P1: File scanner is missing, so upload safety is incomplete.
4. P1: Payment provider is missing; commerce cannot be considered production-ready.
5. P1: Email provider is missing; invites/reminders/transactional email cannot be proven.
6. P1: Asset upload fails. Presign API returns 200, but browser PUT to R2 is blocked by CORS.
7. P1: Ingestion creates a local editor draft, but the imported book is not in `/api/books/list` and its document API returns 404.
8. P1: `/classes` creates a QA class in local UI state, but `/api/teaching/classes` returns a different DB source and does not include it.
9. P2: Several Operations modules explicitly say they are demo/browser-only.
10. P2: Same owner account can open owner/admin/instructor/student surfaces; this may be intentional preview behavior but needs role isolation review.

Top working areas:

- Public home renders.
- Public books/courses catalog renders.
- Login works with Supabase password auth.
- Session survives page refresh.
- Protected route redirect works when signed out.
- Owner dashboard renders.
- Operations system health shows real degraded state.
- Academy Admin pages render.
- Markdown parser can create a preview locally.
- Mobile/tablet sampled pages render without blocking HTTP errors.

## 2. System Architecture

Observed stack:

- Next.js 15.5.23, React 19.1.1.
- App version: 4.21.0.
- Supabase Auth and PostgreSQL/RLS.
- Cloudflare R2/S3-compatible private assets.
- Redis/BullMQ queues in code, not configured in production readiness.
- Document worker, publishing worker and webhook worker exist in repository.
- Payment provider: missing/manual only.
- Email provider: missing/console only.
- AI: Smart Core local available; external AI optional and currently not configured.
- Realtime: disabled.
- Multiple major modules are preview-flagged.

Runtime:

Browser -> Next.js App Router -> API routes -> Supabase/PostgreSQL/RLS -> R2 -> Redis/BullMQ workers where configured -> external providers where configured.

## 3. Baseline Commands

- Branch: `main`
- Latest commit: `41b9189 fix: connect book lifecycle flows across tabs — real status sync, cloud book list, no wrong-book fallbacks`
- Node: `v24.16.0`
- pnpm: `11.9.0`
- npm: `11.13.0`

## 4. Tested Account

Owner/Admin account supplied by operator was used. Password is intentionally not stored here.

Evidence:

- Login redirected to `/dashboard`.
- Supabase password grant returned 200.
- `/api/auth/session` returned role `owner`.
- Refresh on `/dashboard` stayed authenticated.

## 5. Routes Tested

Public:

| Route | Status | Notes |
| --- | --- | --- |
| `/` | PASS | Public home renders. |
| `/login` | PASS | Email/password and phone modes visible. |
| `/academy` | PASS | Redirects to public academy home. |
| `/academy/books` | PASS | Public book catalog renders. |
| `/academy/courses` | PASS | Public course catalog renders. |
| `/reader/demo` | PARTIAL | Shows "Không tìm thấy sách". |

Authenticated samples:

| Route | Status | Notes |
| --- | --- | --- |
| `/dashboard` | PASS | Owner workspace renders. |
| `/learn` | PARTIAL | Renders academic overview. |
| `/knowledge` | PARTIAL | Uses local/seed style knowledge list. |
| `/library` | PARTIAL | Renders books; data source needs deeper split. |
| `/assignments` | PARTIAL | Renders assignment dashboard. |
| `/classes` | FAIL data flow | QA class is local; API class list differs. |
| `/students` | PARTIAL | Shows academy application queue. |
| `/reviews` | PARTIAL | Renders review queue. |
| `/assets` | FAIL upload | R2 CORS blocks upload. |
| `/ingestion` | PARTIAL/FAIL | Parser works; cloud persistence fails. |
| `/books` | PARTIAL | Needs cloud/local merge audit. |
| `/operations/system-health` | PASS | Real health endpoint reports degraded. |
| `/operations/import-center` | MOCK | Page says demo/browser-only. |
| `/operations/notifications` | MOCK | Page says demo/browser-only. |
| `/operations/automation-center` | MOCK | Page says demo/browser-only. |
| `/academy-admin` | PASS shell | Admin shell renders. |
| `/academy-admin/brain` | PARTIAL | Empty queue; AI not configured. |
| `/academy-admin/knowledge` | PARTIAL | Shows 102 knowledge items. |
| `/instructor` | PARTIAL | Instructor workspace renders. |
| `/student` | SECURITY REVIEW | Owner session can open student experience. |

## 6. Upload/Input Matrix

Prepared QA files:

- `audit-output/qa-inputs-2026-09-21/H2O_QA_MARKDOWN_IMPORT.md`
- `audit-output/qa-inputs-2026-09-21/H2O_QA_TEXT_IMPORT.txt`
- `audit-output/qa-inputs-2026-09-21/H2O_QA_HTML_IMPORT.html`
- `audit-output/qa-inputs-2026-09-21/H2O_QA_IMAGE_IMPORT.png`

| Type | Status | Evidence |
| --- | --- | --- |
| Markdown | PARTIAL | Preview generated 1 chapter/1 section; opened editor draft. |
| PNG asset upload | FAIL | `/api/storage/presign-upload` 200, R2 PUT blocked by CORS, no DB asset record. |
| TXT | READY / NOT RUN | Prepared. |
| HTML | READY / NOT RUN | Prepared. |
| DOCX | NOT RUN | Needs generated fixture. |
| PDF text | NOT RUN | Needs generated fixture. |
| PDF scan/OCR | BLOCKED | Queue/scanner/processor missing. |
| URL | NOT RUN | Needs safe URL test. |

## 7. Verified Data Flows

Login:

`Login UI -> Supabase auth -> cookies -> /dashboard -> /api/auth/session`

Status: PASS.

Markdown ingestion:

`Textarea -> local parser -> preview -> editor route`

Status: PARTIAL.

Failure:

`editor local draft -> /api/books/[id]/document` returns 404 and `/api/books/list` does not contain QA book.

Asset upload:

`File input -> /api/storage/presign-upload -> R2 PUT`

Status: FAIL.

Failure:

Browser console: R2 preflight lacks `Access-Control-Allow-Origin`; UI shows `Failed to fetch`.

Classes:

`/classes UI -> create QA class -> reload`

Status: PARTIAL local persistence.

Failure:

`/api/teaching/classes` returns a different DB class list and does not include the QA class.

System health:

`/operations/system-health -> /api/operations/health`

Status: PASS, degraded result is real.

## 8. API Evidence

| API | Status | Notes |
| --- | --- | --- |
| `/api/health` | 200 | Web service OK. |
| `/api/readiness` | 503 | Missing queue, scanner, payment, email. |
| `/api/health/input` | 200 partial | Database/storage OK; Redis/processor/scanner missing. |
| `/api/auth/session` | 200 | Authenticated owner session. |
| `/api/operations/health` | 200 | Authenticated health report, degraded. |
| `/api/public/catalog` | 200 | Public catalog JSON. |
| `/api/storage/presign-upload` | 200 | Presign works, but R2 PUT fails CORS. |
| `/api/assets` | 200 | Existing assets listed; QA upload absent. |
| `/api/books/list` | 200 | Existing cloud books listed; QA import absent. |
| `/api/books/[qa]/document` | 404 | Imported local book not in cloud. |
| `/api/teaching/classes` | 200 | DB class list differs from `/classes` UI. |

## 9. Operations Audit

| Surface | Status | Notes |
| --- | --- | --- |
| Admissions | PARTIAL | Real API `/api/operations/leads`; invite buttons present, not clicked to avoid sending external invite/email. |
| Support | PARTIAL | Empty queue, no create button in admin sampled route. |
| Approvals | PARTIAL | Empty queue from API. |
| Import Center | MOCK | Page says data is demo/browser-only. |
| Notifications | MOCK | Page says data is demo/browser-only. |
| Automation Center | MOCK | Page says data is demo/browser-only. |
| Product Config | PARTIAL/MOCK | Displays config, no edit/save controls in sample. |
| System Health | PASS | Real status with missing infra. |

## 10. Security Findings

Positive:

- Signed-out protected routes redirect to login.
- Admin-only route protection exists in middleware.
- Auth/organization role resolution is server-side.
- Security headers/CSP are present.

Needs review:

- Same account can access owner/admin/instructor/student experiences. If intended as owner preview, label it clearly. If not intended, this is a role boundary issue.
- Full RLS bypass testing still needs separate student/instructor/restricted accounts.

## 11. UX Findings

- Asset upload error says only `Failed to fetch`; should say R2 CORS/upload infrastructure is not configured.
- Ingestion/editor shows local save state while cloud persistence is absent. This is risky for users.
- Operations mock pages are labeled, but navigation should mark them as Preview/Mock so admins do not treat them as live operations.
- `/reader/demo` is a weak demo route because it shows no book.

## 12. Mobile/Responsive

Sampled 390px and 1024px on:

- `/dashboard`
- `/assets`
- `/ingestion`
- `/operations/system-health`
- `/student`

Result: no blocking HTTP errors in samples. Deeper table usability is still pending.

## 13. Bugs Fixed

None yet. Per audit instruction, no fixes were made before collecting reproducible evidence.

## 14. Bugs Not Fixed

BUG-H2B-001, P1: Production readiness degraded.

- Evidence: `/api/readiness` 503.
- Root cause: required infra missing.
- Fix: configure Redis/BullMQ, file scanner, payment and email, or disable dependent UI clearly.

BUG-H2B-002, P1: Asset upload fails.

- Evidence: R2 preflight CORS failure after `/api/storage/presign-upload` 200.
- Root cause: R2 bucket CORS does not allow production origin/method/headers.
- Fix: configure R2 CORS for `https://h2obook-app.vercel.app` PUT/GET/HEAD and required headers.

BUG-H2B-003, P1: Ingestion draft is local-only but looks saved.

- Evidence: editor opens, reload works locally, `/api/books/[id]/document` 404, `/api/books/list` lacks QA book.
- Root cause: create draft path does not complete cloud save or the editor status is misleading.
- Fix: call cloud save immediately after draft creation, or show "Local draft only - not synced".

BUG-H2B-004, P1: Classes UI and teaching API are data silos.

- Evidence: QA class appears in `/classes` after reload, but `/api/teaching/classes` returns a different list.
- Root cause: `/classes` uses app/local store, teaching API uses Supabase tables.
- Fix: migrate `/classes` UI to teaching API or relabel as local planner.

BUG-H2B-005, P2: Operations demo modules look operational.

- Evidence: import-center/notifications/automation-center state "demo/browser-only".
- Fix: add Preview/Mock badges in navigation and block destructive-sounding buttons from implying real execution.

## 15. Recommended Roadmap

NOW:

1. Fix R2 CORS so uploads work.
2. Fix ingestion -> cloud persistence.
3. Align `/classes` UI with backend class API.
4. Configure Redis/BullMQ and file scanner.
5. Mark mock Operations modules clearly in nav.

NEXT:

1. Configure email provider in sandbox mode.
2. Configure payment test provider or label manual mode everywhere.
3. Run full upload matrix: DOCX, PDF text, PDF scan, PNG/JPEG, HTML, Markdown, TXT, URL.
4. Retest publishing artifact generation after queue is configured.
5. Test role isolation with separate student/instructor accounts.

LATER:

1. Full Brain/Agent/Skill pipeline with a controlled knowledge source.
2. Full business checkout -> entitlement -> reader/student access.
3. Full mobile table/card redesign pass for operations-heavy pages.

## 16. Terminal Summary

H2OBOOK FULL PRODUCT AUDIT

Routes tested: 60+ sampled routes and surfaces.
Features tested: login, session refresh, route protection, public catalog, readiness/health, Markdown ingestion, editor draft, asset upload, class create, Operations samples, Academy Admin samples, mobile/tablet smoke.
Buttons tested: login, ingestion analyze/create draft, assets upload, class create, Operations sample CTAs.
Uploads tested: 1 PNG attempted; failed at R2 CORS. Markdown text import tested partially.
API calls checked: `/api/auth/session`, `/api/health`, `/api/readiness`, `/api/health/input`, `/api/public/catalog`, `/api/operations/health`, `/api/books/list`, `/api/books/[id]/document`, `/api/assets`, `/api/storage/presign-upload`, `/api/teaching/classes`.
Database flows verified: existing books/assets/classes readable; new QA book/class/asset persistence failed or was local-only in sampled flows.

PASS:

- Login/session refresh.
- Public home/catalog.
- Protected route redirect.
- Operations system health display.

PARTIAL:

- Dashboard/learn/library/students/reviews render.
- Markdown ingestion preview.
- Academy Admin Brain/Knowledge.
- Student/instructor surfaces.

FAIL:

- Asset upload.
- Ingestion cloud persistence.
- Class UI/backend data sync.
- Production readiness.

NOT CONFIGURED:

- Queue.
- Scanner.
- Payment.
- Email.
- AI gateway.
- Monitoring.

P0: none confirmed yet.
P1: 4.
P2: 3+.
P3: remaining UX/performance follow-up.

Demo/hardcoded surfaces:

- `lib/v2-seed.ts`, `lib/v3-seed.ts`.
- Operations import-center, notifications, automation-center.
- Several local-first UI stores.

Fixes completed: none at audit time. A follow-up fix pass on branch `qa/full-product-audit-fixes` (see below) addresses BUG-H2B-002/003/004/005 in code; R2 bucket CORS and missing services remain operator tasks.

Remaining blockers:

- R2 CORS.
- Missing queue/scanner/payment/email.
- Separate role accounts for permission matrix.
- Approval for public lead/checkout tests if needed.

Production readiness: 52% preliminary.

---

## Follow-up: fix pass on `qa/full-product-audit-fixes`

Code fixes for the four P1 findings. Branch: `qa/full-product-audit-fixes`.

### BUG-H2B-002 — Asset upload `Failed to fetch` (R2 CORS)

Root cause found in code: `app/assets/page.tsx` (and `asset-center-v1.tsx`) implemented their own presign -> R2 PUT -> complete sequence and bypassed the shared `uploadAsset()` helper in `lib/assets/asset-client.ts`, which already contains a same-origin `/api/storage/upload-proxy` fallback for files <= 4 MB. When R2 CORS blocks the browser PUT, that fallback was never reached.

Fix:

- `app/assets/page.tsx` and `components/creative-publishing-v1/pages/asset-center-v1.tsx` now call `uploadAsset()` — presign -> direct R2 PUT -> proxy fallback (<=4 MB) -> `/api/storage/complete`.
- `lib/assets/asset-client.ts` now surfaces the 422 blocked-scan verdict (`UPLOAD_BLOCKED: <reason>`) instead of a bare `COMPLETE_422`, returns `scanReason`, and gives an actionable error for >4 MB files when CORS is still missing.

Remaining blocker (infrastructure, not code): the R2 bucket CORS rule itself is still not applied — local env has no `R2_*` credentials. Operator action required:

```bash
node scripts/configure-r2-cors.mjs --apply
```

with `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` set, or set AllowedOrigins in Cloudflare Dashboard. Until then uploads >4 MB will still fail on the direct PUT; <=4 MB uploads work through the proxy.

### BUG-H2B-003 — Ingestion persisted locally only

Root cause: `app/ingestion/page.tsx` `createDraft` called `store.createBook()` + `localStorage.setItem()` and navigated — no cloud write. Additionally, writers store semantic documents under `h2obook-semantic-<id>` while Compose read `h2obook-document:<id>`, so even local drafts could load empty.

Fix:

- `createDraft` now: creates the local book, builds the `BookDocument`, mirrors it into both localStorage keys, then in production POSTs `/api/books/cloud-save` (upserts the `books` row via `client_key`) and PUTs `/api/books/[id]/document`. Cloud failures are logged and the draft still opens locally (offline-first rule preserved).
- `components/editor/compose-workspace.tsx` falls back to `h2obook-semantic-<id>` when `h2obook-document:<id>` is absent.
- `components/editor/editor-workspace.tsx` `commitSemantic` now upserts the book via `cloud-save` before the document PUT — the PUT resolves books by `client_key` and previously 404'd for never-saved local books.

### BUG-H2B-004 — `/classes` data silo

Root cause: `/classes` used only the Zustand local store; `/api/teaching/classes` reads `public.classes`. Two sources of truth.

Fix:

- `lib/teaching/classes.ts`: `TeachingClassSummary` extended with `teacherName`, `startDate`, `endDate`, `color`, `bookCount`; `getTeachingClasses` now joins class members, class_books, teacher profiles and progress. `createTeachingClass` accepts code/status/dates/color/bookIds, resolves book client_keys to server uuids inside the caller's organization, and inserts `class_books` rows.
- `app/api/teaching/classes/route.ts` POST accepts the extended payload; `code` is now optional (server generates one) — `name` is still required.
- `app/classes/page.tsx` rewritten: loads from `GET /api/teaching/classes`, creates via `POST`, shows a visible "dữ liệu thiết bị" badge for local-only records and a notice when the backend is unreachable. Local `store.createClass` remains as the offline fallback.

### BUG-H2B-005 — Mock Operations surfaces looked live

- `lib/operations/routes.ts`: Notifications, Data Import Center, Automation Center carry `preview: true`.
- `operations-shell.tsx` renders a "Preview" badge in the sidebar nav; `center-page.tsx` shows "Preview — dữ liệu demo" in the page header. Existing `DemoNotice` retained.

### Verification so far

- `pnpm typecheck` — pass.
- `pnpm test` — 304 passed, 1 skipped (r2-storage-live skipped: no R2 env).
- `pnpm build` — pass (pre-existing lint warnings only).
- `pnpm test:sql` — pass (19 domain tables).
- `pnpm validate:imports`, `validate:editor412`, `validate:input-phase2`, `validate:input-phase3`, `audit:input`, `validate:claude-guides`, `validate`, `validate:professional` — pass.
- `pnpm validate:input-phase4` — fails on this machine: `tesseract` binary not installed (environment dependency, runs `generate-image-fixtures.py` + pytesseract). Not a code regression; needs a machine with Tesseract or CI.
- `pnpm test:e2e` (chromium) — 14/16 pass when the dev server runs `NEXT_PUBLIC_APP_MODE=demo`. Two `input-orchestrator` specs fail with `INPUT_SESSION_CREATE_FAILED`: the gateway calls `/api/input/sessions`, which needs a Supabase-backed organization the demo user cannot resolve against the production project this `.env.local` points at. Pre-existing environment issue; no edited file is in that path. Note: with `NEXT_PUBLIC_APP_MODE=production` the whole suite redirects to `/login` — the specs assume demo mode.

Not yet verified: authenticated production retest of upload/import/class flows against `https://h2obook-app.vercel.app` — requires redeploy of this branch. Redis/BullMQ, file scanner, payment, email, AI gateway remain unconfigured (`/api/readiness` will still report degraded).
