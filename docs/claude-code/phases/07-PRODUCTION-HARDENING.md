# Phase 7 — Production Validation and Hardening

## Objective

Prove the input system works under malformed, large, concurrent and hostile inputs.

## Required test layers

### Unit

- Type detection.
- MIME/magic mismatch.
- Format adapters.
- Semantic normalization.
- Warning generation.
- Idempotency keys.

### Integration

- Upload -> scan -> queue -> processor -> preview.
- Preview -> atomic commit.
- Asset localization.
- Workspace isolation.
- Retry after worker failure.

### E2E

- Import DOCX into Compose Mode.
- Import PDF fixed-layout into Design Mode.
- Import scanned PDF through OCR.
- Import image asset/background/OCR.
- Import HTML file and URL.
- Cancel and retry.

### Security

- Malware/quarantine behavior.
- ZIP bomb.
- SSRF.
- Path traversal.
- MIME confusion.
- Oversized file.
- Cross-workspace session access.

### Performance

- Large DOCX.
- 300-page PDF.
- Concurrent jobs.
- Memory usage during preview.
- Worker timeout and retry.

## Observability

Capture:

- Trace ID.
- Session/job ID.
- Format and mode.
- Processing duration.
- Page/node/asset counts.
- Warning count.
- Failure code.
- Worker retry count.

Do not log document content or sensitive personal data by default.

## Release gate

- All supported-format happy paths pass.
- Required malformed fixtures return expected error codes.
- No cross-workspace access.
- No Base64 regression.
- No mandatory AI calls.
- Build, unit, integration and E2E pass with locked dependencies.
- Rollback procedure is documented and tested.
