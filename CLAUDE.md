# H2OBOOK Claude Code Project Instructions

## Mission

H2OBOOK is an offline-first, professional authoring, publishing, learning and knowledge-commerce platform. The core product MUST work without AI and without any AI API. AI is optional assistance only.

This repository is currently based on **H2OBOOK Professional Editor 4.12**. The next implementation track is **Unified Input & Document Reconstruction Engine**.

## Non-negotiable product rules

1. **No-AI-first:** DOCX, PDF, image and HTML import must have deterministic/manual paths. Never make an AI provider a required dependency.
2. **Do not break old projects:** Preserve legacy books, pages, elements, semantic node IDs, `assetId`, storage keys and migrations.
3. **Do not store new binary images as Base64 in book JSON or localStorage.** Use local object URLs/IndexedDB for temporary preview and R2 `assetId` in production.
4. **One input orchestrator:** Do not add another disconnected importer. New work must converge into the shared Input Gateway and Semantic Content Model.
5. **Security before parsing:** Validate extension, MIME, magic bytes, size, workspace scope, malware status and ZIP safety before processing.
6. **Preview before commit:** Imported content must be previewable and editable before it becomes a book.
7. **Idempotent jobs:** A retry must not create duplicate assets, pages or semantic nodes.
8. **Workspace isolation:** Every server-side operation must verify organization membership and storage key scope.
9. **Local fallback:** Demo/offline mode must remain useful even when Supabase, R2, Redis or workers are unavailable.
10. **Report honestly:** A UI screen or schema is not the same as an end-to-end engine. State what is foundation, implemented, tested and production-verified.

## Start every input task this way

1. Read this file.
2. Read `docs/claude-code/00-MASTER-EXECUTION-PLAN.md`.
3. Read `docs/claude-code/CURRENT-PHASE.md`.
4. Read the matching phase file under `docs/claude-code/phases/`.
5. Run:

```bash
pnpm audit:input
pnpm validate:claude-guides
pnpm validate:imports
pnpm validate:editor412
```

6. Inspect current code before editing. Do not assume the documentation is newer than the code.
7. Implement only the current phase unless a prerequisite bug blocks it.
8. Run phase-specific tests and update the progress report.
9. Do not mark a phase complete unless all acceptance criteria pass.

## Current input capability truth

| Input | Current state | Important code |
|---|---|---|
| DOCX | Accepted; quick editor path uses Mammoth raw text and loses formatting; Python worker extracts heading/table JSON | `components/editor/editor-workspace.tsx`, `services/document-processor/app/processors.py` |
| PDF fixed-layout | Strong foundation; PDF.js rasterizes each page to a locked image background | `components/editor/editor-workspace.tsx` |
| PDF editable | Partial; OCR and worker foundation exist, reconstruction is incomplete | `services/document-processor/app/processors.py` |
| PNG/JPG/JPEG | Good asset pipeline with IndexedDB/R2/assetId | `lib/assets/*`, `lib/security/uploads.ts` |
| JPE | Not officially accepted yet | `lib/security/uploads.ts`, editor input `accept` |
| HTML URL | Partial rule-based semantic parser with safe fetch | `packages/ingestion-core/src/parser.ts`, `lib/ingestion/safe-fetch.ts` |
| HTML/HTM file upload | Not implemented | Input Gateway phase |

## Target architecture

```text
Input source
  -> Input Gateway
  -> Type detection + security validation
  -> Import mode selection
  -> Asset upload / quarantine
  -> Processing job
  -> Format adapter
  -> Normalized ImportDocument
  -> Semantic Content Model
  -> Preview + warnings
  -> Commit transaction
  -> Compose Editor / Design Editor
```

## Canonical result types

Do not let each parser invent its own output. Converge on a shared normalized result:

```ts
interface ImportDocument {
  id: string;
  source: ImportSourceDescriptor;
  metadata: ImportMetadata;
  nodes: SemanticContentNode[];
  assets: ImportedAssetReference[];
  warnings: ImportWarning[];
  diagnostics: ImportDiagnostics;
}
```

The exact type may evolve, but the architecture must remain one normalized intermediate document before `BookDocument` creation.

## Required phase order

1. Input Gateway and shared types.
2. Word Import 2.0.
3. PDF Dual Import.
4. Image Smart Import.
5. HTML Import 2.0.
6. Orchestrator, preview, commit and recovery.
7. Production test matrix and hardening.

See `docs/claude-code/input-roadmap.yaml` for machine-readable status.

## Forbidden shortcuts

- Do not keep `mammoth.extractRawText()` as the final DOCX import implementation.
- Do not call OCR for PDFs that already have a usable text layer without first checking it.
- Do not parse complex HTML with regex as the final implementation.
- Do not trust client-provided MIME, workspace ID, file size or storage key.
- Do not write arbitrary external image URLs directly into final books without controlled import/proxy rules.
- Do not commit imported pages one-by-one without a rollback strategy.
- Do not silently discard unsupported formatting. Surface warnings in preview.
- Do not use AI to reconstruct layout unless the user explicitly enables it; deterministic reconstruction must exist first.

## Validation commands

```bash
pnpm audit:input
pnpm validate:claude-guides
pnpm validate
pnpm validate:imports
pnpm validate:professional
pnpm validate:editor412
pnpm typecheck
pnpm test
pnpm test:sql
pnpm build
pnpm test:e2e
```

When dependencies are unavailable, run the repository's static validators and clearly report that semantic typecheck/build/E2E remain unverified.

## Progress reporting

After each phase, create or update:

`docs/claude-code/progress/PHASE-XX-REPORT.md`

Use the template in `docs/claude-code/progress/REPORT-TEMPLATE.md` and include:

- Files changed.
- Data flow implemented.
- Tests run and exact result.
- Known limitations.
- Migration/rollback notes.
- Whether production services were actually exercised.
- Next phase blockers.

## Error handling contract

Use stable machine-readable error codes from `docs/claude-code/09-ERROR-CATALOG.md`. API responses should prefer:

```json
{
  "error": "DOCX_PARSE_FAILED",
  "message": "Human-readable Vietnamese message",
  "details": {},
  "retryable": false,
  "traceId": "..."
}
```

Never expose secrets, storage credentials, raw stack traces or another workspace's identifiers.

## Documentation hierarchy

1. `CLAUDE.md` — mandatory project rules.
2. `docs/claude-code/CURRENT-PHASE.md` — what to implement now.
3. Phase document — detailed implementation contract.
4. `input-roadmap.yaml` — machine-readable status/dependencies.
5. Progress report — evidence of completion.
6. Source code and tests — final source of truth.

## Current implementation checkpoint — 4.13.4

- Phase 1 has been accepted by the product owner.
- Phase 2 Word Import 2.0 is implemented; do not restore `mammoth.extractRawText()`.
- Phase 3 PDF Dual Import is implemented; do not collapse the three PDF modes or run OCR before checking native text.
- Phase 4 Image Smart Import is implemented; preserve all four modes, `.jpe`, stored-object magic validation, region order and deterministic Tesseract fallback.
- The active phase is Phase 5 HTML Import 2.0.
- Before changing input code, run `pnpm validate:input-phase2`, `pnpm validate:input-phase3` and `pnpm validate:input-phase4` to protect DOCX/PDF/image regression behavior.
