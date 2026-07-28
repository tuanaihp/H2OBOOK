# Phase 6 — Orchestrator, Preview, Commit and Recovery

## Objective

Join all format adapters into one end-to-end product flow and remove duplicate import behavior.

## Orchestrator responsibilities

- Create session.
- Detect format and available modes.
- Validate/security scan.
- Upload source.
- Enqueue processing.
- Poll or subscribe to progress.
- Load normalized preview.
- Allow corrections.
- Commit atomically.
- Retry/cancel/recover.

## Preview model

Preview must include:

- Source metadata.
- Page/outline tree.
- Semantic nodes.
- Asset list.
- Warnings/errors.
- Confidence/coverage diagnostics.
- Formatting substitutions.
- Destination choice: new book, append chapter, replace document.

## Commit rules

- Stable semantic node IDs are assigned before commit.
- Asset IDs are final and clean.
- Existing book append uses version checks.
- A failed commit remains retryable.
- Completed session is immutable except audit metadata.
- Commit emits domain and analytics events.

## Offline mode

- Image asset-only and simple TXT/Markdown/DOCX preview may use local adapters.
- Queue unavailable state must be explicit.
- Local session can later sync/upgrade to cloud.
- Never falsely show cloud-completed status.

## Migration/deprecation

After parity is achieved:

- Editor upload button opens the Input Gateway.
- Universal Ingestion page redirects or embeds the shared gateway.
- Processing page displays the shared sessions/jobs.
- Old parser helpers remain only behind adapters or are removed with tests.

## Acceptance criteria

- One UI flow handles all supported formats.
- Worker outputs automatically reach preview.
- Preview commits directly to Compose/Design without manual JSON transfer.
- Retry/cancel/recovery works.
- Duplicate imports are prevented.
- Legacy quick import parity tests pass before old code is removed.
