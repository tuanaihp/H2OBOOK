# Phase 7 Report — Production Validation & Hardening

## Source status

Completed in source as H2OBOOK 4.13.7 Release Candidate.

## Implemented

- Input payload, node, asset, correction and design-payload limits.
- Trace IDs and privacy-safe structured observability.
- Normalized API errors with retryability.
- Request-body limits on session, preview, commit and job APIs.
- Worker heartbeat, timeout, cancellation polling, stalled-job policy and session callback.
- Queue idempotency and bounded exponential retry.
- DOCX ZIP bomb, path traversal, symlink, encrypted archive and structure checks.
- Stronger IPv4/IPv6 SSRF blocking.
- Stale-session recovery RPC and scheduled recovery service.
- Stricter Input Session RLS ownership policies.
- Hardened atomic commit wrapper with database payload limits.
- Feature-flag rollback to legacy import.
- Security, performance, migration-chain and storage-regression tests.
- Production health endpoint and rollback/incident runbooks.

## Validated in packaging environment

- TypeScript syntax/transpile.
- Pure Input hardening runtime.
- SSRF runtime.
- Python archive hardening runtime.
- 20,001-node preview validation.
- 5,000-paragraph DOCX, 300-page PDF and 6000×4000 image fixture benchmark.
- Sequential migration chain 0001–0022.
- No persistent Base64 image regression in input/editor state paths.

## External gates not proven here

- Real dependency installation and lockfile.
- Semantic typecheck, Vitest, Next.js build and Playwright.
- Clean Supabase migration execution.
- Real two-user RLS denial.
- Redis/R2/ClamAV outage and recovery tests.
- Concurrent production jobs and browser-refresh recovery.

Phase 7 is therefore source-complete but remains a release candidate until these external gates pass.

## 2026-10-02 — Imported image/PDF blank-page regression

- Cloud assets now persist a same-origin `/api/assets/:id/raw` display URL instead of a temporary
  `blob:` URL or expiring cross-origin R2 URL.
- Editor canvas and Reader resolve `assetId` first and retry the legacy `imageUrl` as fallback.
- Cloud load recovers image references dropped by older `save_book_document()` versions from the
  organization-scoped Input Session design payload; the editor also merges a same-browser local
  copy so already-imported books can recover without being re-uploaded.
- Multi-image imports use WebP quality 80% while retaining the source pixel dimensions and aspect
  ratio. Disabling compression continues to preserve the original file bytes.
- Verified: TypeScript typecheck and production build passed; 314 unit tests passed with one R2-live
  test intentionally skipped; Phase 3 and Phase 7 validators passed. Phase 4 source checks reached
  its external Tesseract runtime gate and stopped because the Tesseract executable is not installed
  on this Windows host.
- Demo mode now remains local even when `.env.local` contains Supabase credentials, and its commit
  state machine follows `preview -> committing -> completed` like the production database RPC.
- Local Playwright passed all four gateway cases, including a two-PNG import with WebP 80%
  compression, commit, editor navigation, two persisted pages, and non-empty rendered canvas pixels.
- Production Supabase/R2 and the signed-in browser flow were not exercised from this environment;
  the same-origin cloud asset route is covered by typecheck, unit tests, and the production build.

## 2026-10-02 — Existing-book image append follow-up

- Fixed `BOOK_NOT_FOUND` when a signed-in user appends imported image pages to a book that still
  exists only in the browser library: the explicit commit now materializes the target in Supabase,
  stores its UUID on the Input Session, then continues through the hardened commit RPC.
- Recovery restores the saved design payload as well as the semantic preview, so an interrupted
  image-book commit remains recoverable after refresh.
- Small files now use the same-origin upload proxy immediately. The current R2 token cannot manage
  bucket CORS, so this avoids one failed browser preflight per imported page while retaining the
  direct-to-R2 requirement and explicit diagnostic for files above the 4 MiB proxy limit.
- Playwright passed 5/5 gateway cases, including append-and-commit into a current local-only book.
