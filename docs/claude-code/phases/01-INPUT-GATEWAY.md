# Phase 1 — Unified Input Gateway

## Objective

Replace disconnected entry points with one shared detection, validation, mode selection and session contract while preserving current quick-import behavior.

## Current files to inspect

- `components/editor/editor-workspace.tsx`
- `app/ingestion/page.tsx`
- `app/api/jobs/route.ts`
- `lib/security/uploads.ts`
- `lib/assets/asset-client.ts`
- `lib/queue/document-queue.ts`
- `packages/ingestion-core/src/types.ts`

## Required additions

Suggested structure:

```text
packages/input-core/src/types.ts
packages/input-core/src/detect.ts
packages/input-core/src/modes.ts
packages/input-core/src/errors.ts
lib/input/client.ts
lib/input/orchestrator.ts
app/input/page.tsx
app/api/input/sessions/route.ts
```

## Shared types

Define at minimum:

```ts
type InputFormat = 'docx' | 'pdf' | 'png' | 'jpeg' | 'html' | 'markdown' | 'text' | 'url';
type ImportMode = 'fixed_layout' | 'semantic_editable' | 'asset_only' | 'ocr_editable';
type InputSessionStatus =
  | 'created' | 'validating' | 'uploading' | 'quarantined'
  | 'queued' | 'processing' | 'preview_ready' | 'committing'
  | 'completed' | 'validation_failed' | 'scan_blocked'
  | 'processing_failed' | 'commit_failed' | 'cancelled';
```

`InputSession` must include workspace ID, requester ID, source descriptor, selected mode, progress, warnings, diagnostics, output reference and idempotency key.

## Detection rules

Detection must compare:

1. File extension.
2. Browser MIME.
3. Magic bytes/server inspection.
4. Optional content sniffing for HTML/text.

A mismatch must fail with `INPUT_MIME_MISMATCH` unless a safe normalization rule explicitly permits it.

## Format/mode matrix

| Format | Fixed layout | Semantic editable | Asset only | OCR editable |
|---|---:|---:|---:|---:|
| DOCX | Optional | Yes | No | No |
| PDF | Yes | Yes | No | Yes |
| PNG/JPEG | Full-page | No | Yes | Yes |
| HTML | No | Yes | No | No |
| Markdown/TXT | No | Yes | No | No |

## Compatibility requirement

The current editor quick import may temporarily call the gateway with defaults:

- PDF -> `fixed_layout`.
- DOCX -> `semantic_editable`.
- Image -> `asset_only`.

Do not delete old code until the new route passes parity tests.

## Security requirements

- Server resolves workspace membership.
- Storage key prefix is server-generated.
- File size and type limits are server-owned.
- HTML/URL fetch remains behind SSRF protection.
- Session access is scoped to requester/workspace.
- Idempotency key prevents duplicate sessions.

## UI requirements

The Input Gateway page must show:

- Drop zone and URL field.
- Detected format.
- Available import modes with explanations.
- Expected preservation level.
- Security/scan state.
- Processing progress.
- Preview link.

## Tests

- Detect DOCX, PDF, PNG, JPG, JPEG, JPE, HTML, HTM, Markdown and TXT.
- Reject mismatched extension/MIME.
- Reject unsupported executable/archive.
- Enforce workspace scope.
- Retry with same idempotency key returns same session.
- Existing quick-import behavior still works.

## Acceptance criteria

- One shared contract is used by UI and API.
- `.jpe`, `.html`, `.htm` are recognized by the gateway.
- Existing import paths can delegate to the gateway.
- No format parser is duplicated in this phase.
- All failures return stable error codes.
