# H2OBOOK Unified Input & Document Reconstruction Engine

## Goal

Create one reliable input pipeline for:

- `.docx`
- `.pdf`
- `.png`
- `.jpg`, `.jpeg`, `.jpe`
- `.html`, `.htm`
- Markdown/TXT
- public URL and Google Docs

The final pipeline must support two major outcomes:

1. **Fixed-layout import:** preserve visual appearance as locked or editable page assets.
2. **Semantic import:** reconstruct structured content for Compose Mode, reflowable reader, EPUB and multi-format publishing.

AI is optional and never required.

## Current architecture map

### Quick Editor Import

- File: `components/editor/editor-workspace.tsx`
- PDF: PDF.js -> JPEG per page -> locked background.
- DOCX: `mammoth.extractRawText()` -> text chunks.
- Images: `uploadAsset()` -> `assetId`/preview URL.

### Universal Ingestion

- UI: `app/ingestion/page.tsx`
- Parser: `packages/ingestion-core/src/parser.ts`
- URL security: `lib/ingestion/safe-fetch.ts`
- Supports Markdown, HTML string/URL, public Google Docs, transcript, RSS.

### Production Document Processing

- Queue API: `app/api/jobs/route.ts`
- Queue types: `lib/queue/document-queue.ts`
- Worker: `workers/document-worker/index.mjs`
- Processor: `services/document-processor/app/processors.py`
- Supports `pdf_import`, `docx_import`, `ocr`, thumbnail and export foundations.

## Target package boundaries

```text
packages/input-core/
  src/types.ts
  src/detect.ts
  src/normalize.ts
  src/warnings.ts
  src/index.ts

packages/import-docx/
packages/import-pdf/
packages/import-image/
packages/import-html/

lib/input/
  client.ts
  orchestrator.ts
  commit.ts
  recovery.ts

app/input/
  page.tsx
  [sessionId]/page.tsx

app/api/input/
  sessions/route.ts
  sessions/[id]/route.ts
  sessions/[id]/commit/route.ts
```

Names may be adapted to the existing monorepo, but responsibilities must remain separate.

## Shared state machine

```text
created
-> validating
-> uploading
-> quarantined
-> queued
-> processing
-> preview_ready
-> committing
-> completed

Failure/recovery states:
validation_failed
scan_blocked
processing_failed
commit_failed
cancelled
expired
```

## Shared import modes

```ts
type ImportMode =
  | 'fixed_layout'
  | 'semantic_editable'
  | 'asset_only'
  | 'ocr_editable';
```

Not every source supports every mode. The gateway must present only valid choices.

## Commit transaction

The final commit should be atomic where possible:

1. Verify session belongs to the active workspace.
2. Verify every required asset is clean and available.
3. Create or update `BookDocument`.
4. Create semantic nodes and versions.
5. Create layout/pages/elements if fixed-layout output exists.
6. Link asset IDs.
7. Record source provenance and warnings.
8. Mark import session completed.
9. Emit audit and domain event.

If a transaction fails, no partial book should appear as completed.

## UI flow

```text
Choose source
-> Show detected type
-> Choose import mode
-> Validate and upload
-> Show processing progress
-> Preview structure/pages/assets
-> Show warnings and unsupported features
-> Allow manual correction
-> Commit as new book or append to existing book
```

## Quality levels

Each import returns a quality summary:

- Structure confidence.
- Text extraction coverage.
- Asset extraction coverage.
- Formatting preservation.
- Reading-order confidence.
- OCR confidence when applicable.

These values are diagnostics, not AI scores.

## No silent data loss

Unsupported features must produce warnings, for example:

- Word floating shape not imported.
- PDF font could not be mapped.
- HTML script removed.
- Remote image could not be downloaded.
- Table merged-cell layout simplified.

## Phase completion rule

A phase is complete only when:

- Shared types compile.
- UI and API use the same contract.
- Security checks pass.
- At least one happy-path fixture passes.
- At least one malformed fixture fails with the expected error code.
- Retry is idempotent.
- Documentation and progress report are updated.
