# H2OBOOK Image Book & Teaching Upgrade V1 — Integration Report

Branch: `feature/image-book-teaching-upgrade-v1`
Source module: `v5/16-h2obook-image-book-teaching-upgrade-v1`
Status: **READY_FOR_VERCEL_PREVIEW**

This module touches the most sensitive, actively-governed part of the repository — the Unified
Input & Document Reconstruction Engine, which has its own separate governance process
(`CLAUDE.md`, `docs/claude-code/CURRENT-PHASE.md`, `docs/claude-code/input-roadmap.yaml`,
phase-specific validators). Per `CLAUDE.md`'s own instruction, that process was followed before
writing any code: read `CLAUDE.md`, read `CURRENT-PHASE.md`, read `input-roadmap.yaml`, and run
`pnpm audit:input` + the phase-specific validators before and after changing anything.

## 1. Audit summary + consistency findings

- **`input-roadmap.yaml` shows Phases 0–6 already `completed` and Phase 7 `source_completed_external_validation_pending`.** This contradicts `CLAUDE.md`'s own stale checkpoint note ("active phase is Phase 5 HTML Import 2.0") — the roadmap YAML is the authoritative, more current source per the file's own documented precedence, and `pnpm audit:input` independently confirms 24/24 capability signals present (DOCX rich import, PDF dual-mode + OCR, Image Smart Import's 4 modes, HTML semantic parser + sanitization, the full Orchestrator/session/recovery/idempotent-commit stack). **The entire foundation this module's prompt asks to "not duplicate" already exists and is production-grade.**
- **The single-file Unified Input Gateway (`components/input/unified-input-gateway.tsx`, `/input` route) is explicitly the default import flow "from 4.13.7"** per its own on-screen copy; `components/editor/editor-workspace.tsx`'s inline file input is explicitly labelled "legacy — chỉ dùng khi cần tương thích." New capability was added to the Gateway, not the legacy path, to stay on the maintained flow.
- **Presentation Mode already exists and is fully built** in the Reader (`app/reader/[slug]/page.tsx`): fullscreen-oriented "Trình chiếu" toggle, presenter notes panel reading `page.notes` (already mapped from `book_pages.presenter_notes`, migration 0002), dark mode, print. This is 90%+ of the module's "Bước 5 Teaching Mode" ask already shipped under a different name — **not rebuilt**, and documented here so it isn't mistaken for a gap in a future pass.
- **Page reorder (up/down), duplicate and delete already exist** in the editor (`editor-workspace.tsx`'s `store.reorderPage/duplicatePage/deletePage`, wired to `.thumb-actions-v2`). Bulk drag-and-drop reordering, replace-image-keep-page-ID, lock/hide-per-page, and page versioning from the module's "Bulk Page Manager" ask are **not** built this pass — real net-new editor surface, deferred (§5), not confused with what already exists.
- **`book_pages` (migration 0002) already has `page_type`, `chapter`, `presenter_notes`, `hidden`, `master_page_id` columns** — the data model for most of "Bulk Page Manager" already exists; only the bulk-management UI is missing.
- **`bookmarks`, `reader_notes`, `reading_progress` tables already exist (0001/0002) with real RLS**, but the Reader currently persists bookmarks/notes to `localStorage` only (`storageKey` in `app/reader/[slug]/page.tsx`), not to these tables. This is a real, separate, pre-existing gap (cross-device sync) — noted but **not fixed this pass** (out of the bounded scope actually shipped; see §5).
- **The editor is a local-first architecture**: books are authored client-side (Zustand `useAppStore`/`useEditorStore`, IndexedDB) and synced to real Supabase (`books`/`book_pages`/`page_elements`) via an existing `client_key`-matched cloud-save/cloud-load bridge (`app/api/books/cloud-save`, `cloud-load`). New book-creation flows must produce output that flows through this same bridge, not a second, parallel Supabase-writing path — confirmed by reusing `makeDesignBook()` (already used by the PDF fixed-layout import path) as the integration point.
- **No parallel image engine, asset engine or R2 pipeline was created.** The new "create book from N images" / "ZIP of page images" flows are a loop over the *exact same* `inspectImage` → `uploadInspectedImage` → `buildFullPageImage` functions the existing single-image Smart Import panel's "Dùng làm toàn trang" mode already uses (`lib/input/image-import.ts`, unchanged) — same asset pipeline, same MIME/magic-byte validation, same SHA-256 checksum, same R2 upload path, same scan-status gate.
- **Curriculum book assignment to roadmap/stage/level (Bước 6) was not built** — no roadmap table exists (same finding independently made during modules 13 and 15's audits: `studentCareerStages` is static demo data, not a real per-user or admin-editable table).
- **Entitlement-tier-gated signed URLs (Bước 7) already exist** for books generally (`entitlements` resource_type checks used elsewhere, e.g. quiz RLS) — no new tier-gating logic was needed or added for this pass since no new *reader-facing* surface was built (only the *authoring/import* side).

## 2. Files added/changed

**New library code**
- `lib/input/zip-import.ts` — `extractImagesFromZip()`: loads a ZIP (via `ArrayBuffer`, not the browser `File`/`Blob` object directly, for cross-runtime robustness), keeps only safely-named PNG/JPEG entries (rejects path traversal, absolute paths, embedded NUL), decompresses one entry at a time and checks its *real* decompressed size before keeping it (bounds peak memory to ~1 entry and doesn't trust the archive's own spoofable central-directory size fields — the actual zip-bomb attack surface), caps entry count/total size/per-entry size, natural-sorts by filename. `isSafeEntryName` and the natural-sort comparator are exported/tested directly.
- `lib/input/image-batch-import.ts` — `buildPagesFromImages()`: loops the *existing* `inspectImage`/`uploadInspectedImage`/`buildFullPageImage` functions over an array of files (capped at 300 pages/batch), collecting per-file failures instead of aborting the whole batch; `naturalSortImageFiles()` for the plain multi-file-select case (no ZIP).

**Changed**
- `components/input/unified-input-gateway.tsx` — `SourceState` gained a third variant (`{ kind: "images"; files: File[]; zipWarnings? }`) alongside the existing `file`/`url` kinds. A new source card ("Nhiều ảnh / ZIP trang sách", behind `NEXT_PUBLIC_IMAGE_BOOK_IMPORT_V1`) accepts either multiple PNG/JPEG files or one `.zip`. A new `processImageBatch()` function (parallel to the existing `process()`, which now explicitly excludes the `"images"` source kind rather than being made to understand it) builds pages, wraps them via the *existing* `makeDesignBook()` helper (the same one the PDF fixed-layout path already uses), and reuses the *existing* session/stage/preview/commit lifecycle (`createOrResumeInputSession`, `patchStage`, `stagePreview`) — so retry, recovery and cancel all work identically to every other source type, for free.
- `app/books/page.tsx` — one additive link next to the existing "Sách mới"/"Tạo từ template" buttons: "Tạo từ ảnh / ZIP / PDF / Word" → `/input`. The existing blank-book modal and creation flow are completely untouched.

**Tests**
- `tests/unit/image-book-teaching-upgrade.test.ts` — natural sort ordering (`page2` before `page10`), ZIP extraction (only PNG/JPEG kept, natural order), and `isSafeEntryName` path-traversal/absolute-path rejection (tested directly since JSZip's own writer API normalizes `../` away when *creating* an archive, so a traversal attempt can't be round-tripped through JSZip's own writer to exercise the read-side guard end-to-end — a hand-crafted or third-party-tool-built ZIP could still carry a literal unsafe entry name, which is exactly what this guards against).

**No database migration.** Every table this pass needed (`books`, `book_pages`, `page_elements`, `assets`) already exists and is already reused by the existing single-image import path.

## 3. Security implementation

- MIME is never trusted from a file extension alone: every extracted image still goes through `inspectImage()`'s real magic-byte PNG/JPEG header parsing (`packages/input-core/src/image.ts`) before anything is uploaded — the ZIP extractor's own `.png`/`.jpe?g` extension filter is just a first-pass filter to avoid wasting decompression work on obviously-non-image entries, not the actual trust boundary.
- Path traversal: every ZIP entry name is checked (`isSafeEntryName`) before extraction — rejects `..` segments, absolute paths (`/`, `\`), and embedded NUL bytes.
- Zip-bomb protection: per-entry decompressed-size cap (60 MB), running total cap (500 MB) checked incrementally (aborts mid-batch rather than after decompressing everything), max 300 entries, and a compression-ratio sanity check.
- Workspace isolation: `uploadInspectedImage()` (unchanged, existing function) is always called with the caller's real `organizationId`, exactly as the existing single-image path already does — no new code path bypasses this.
- No service-role key or R2 secret is ever referenced client-side; all of this runs through the existing `uploadAsset()` client helper, which itself calls signed, server-authorized upload endpoints (unchanged).

## 4. Tests executed

| Command | Result |
|---|---|
| `pnpm audit:input` | ✅ 24/24 capability signals present (baseline, confirms nothing regressed) |
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors, 51 pre-existing warnings (1 pre-existing `FileImage` unused-import warning in the touched file, present before this change) |
| `pnpm test` (vitest) | ✅ 22 files / 72 tests passed (69 pre-existing + 3 new), no regressions |
| `pnpm validate:imports` | ✅ 677 source files |
| `pnpm validate:input-phase2` | ✅ DOCX regression protection passed |
| `pnpm validate:input-phase3` | ✅ PDF regression protection passed |
| `pnpm validate:input-phase4` | ⚠️ not verified — fails in this sandbox because the `tesseract` binary is not installed locally (pytesseract `TesseractNotFoundError`); this is a pre-existing local-environment limitation unrelated to this change (nothing in this pass touches OCR) |
| `pnpm test:sql` | ✅ passed |
| `pnpm validate:migrations` | ✅ 31 sequential migrations (unchanged — no new migration) |
| `pnpm smoke` | ✅ passed |
| `pnpm build` | ✅ compiled successfully; `/books`, `/input`, `/editor/[bookId]/compose` all present, `/editor/[bookId]/compose` bundle size unchanged (149 kB) confirming the legacy/compose editor path was not touched |

Not executed: live multi-role click-through, Playwright E2E, real 100–300 page import against production R2/Supabase — no browser or live infrastructure in this session.

## 5. Risks / TODO (explicitly deferred, not silently dropped)

- **Bulk Page Manager (Bước 4) beyond what already existed was not built** — no new drag-and-drop reorder UI, no "replace image keep page ID" action, no per-page lock/hide toggle UI, no page version history UI. `book_pages` already has the columns (`hidden`, `presenter_notes`, `chapter`, `master_page_id`) to support most of this; only the management UI is missing.
- **Teaching Mode enhancements beyond the existing Presentation Mode were not built**: pen/highlighter/laser annotation layers, "video liên quan"/"bài tập liên quan" links, and "lưu trang gần nhất theo lớp" (last-page-per-class memory) are not implemented. The existing Reader's presenter mode (fullscreen, presenter notes, dark mode) already covers the core of what was asked; see §1.
- **Reader bookmarks/notes/progress remain `localStorage`-only**, not synced to the existing `bookmarks`/`reader_notes`/`reading_progress` tables — a real, bounded, separate follow-up (migrating an already-built UI to already-existing tables, same pattern as several earlier modules this session) that was not in scope for this pass.
- **Curriculum assignment (book → roadmap/stage/level/course/lesson with sort order, unlock mode, unlock value, access tier) was not built** — no roadmap table exists yet (confirmed absent in modules 13 and 15's audits too).
- **No idempotency/resume support specific to a partially-completed image/ZIP batch** — `buildPagesFromImages()` runs as one synchronous client-side loop per commit attempt; a page that already uploaded successfully will be re-uploaded (as a new asset) if the browser is closed mid-batch and the import is retried. The existing session/retry/recovery machinery still applies at the *session* level (the whole import can be retried/recovered), just not at the *individual-page* level within one batch.
- **Signed-URL / entitlement-tier gating nuances for newly-imported books were not changed** — new books get exactly the same access-control treatment as any other book created via the existing flows; no new tier logic was added or needed since no new *reader-facing* surface was shipped.
- No Playwright E2E was run (no browser available in this session); a real 100–300-page ZIP import against live R2/Supabase has not been exercised end-to-end.

## 6. Rollback

- Revert the merge commit on `main`, or `git revert` this module's commit range.
- Database: no migration was added — nothing to roll back at the database layer.
- The new source card in `/input` is gated by `NEXT_PUBLIC_IMAGE_BOOK_IMPORT_V1` (default enabled); setting it to `false` hides the new UI entry point without any code change. The `/books` page's new link is a plain, always-visible additive link (not flagged) since it only routes to the already-existing, already-flagged `/input` page.
