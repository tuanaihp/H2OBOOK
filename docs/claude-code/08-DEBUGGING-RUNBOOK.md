# Input Debugging Runbook

## 1. Identify the layer

Classify the failure before changing code:

1. Client selection/accept filter.
2. Detection/MIME validation.
3. Presigned upload.
4. R2 object verification.
5. Quarantine/scan.
6. Queue insertion.
7. Worker claim.
8. Format parser.
9. Normalization.
10. Preview rendering.
11. Commit transaction.
12. Compose/Design load.

## 2. Collect identifiers

Collect only safe identifiers:

- `traceId`
- `inputSessionId`
- `documentJobId`
- `assetId`
- workspace ID
- error code
- worker attempt count

Do not paste secrets or signed URLs into reports.

## 3. Reproduce with a synthetic fixture

Use the smallest synthetic fixture that reproduces the issue. Add it to `tests/fixtures/input/` if safe and redistributable.

## 4. Run capability audit

```bash
pnpm audit:input
```

This catches regressions such as missing `.jpe/.html` allowlists, fallback to raw DOCX text or missing worker handlers.

## 5. Check API response shape

Errors should use stable codes. If an endpoint only returns an arbitrary exception string, fix the boundary before the parser internals.

## 6. Check idempotency

Repeat the same request with the same key. Confirm no duplicate asset, session, job, page or semantic node is created.

## 7. Check workspace isolation

Try reading the session/job from another authorized test workspace. Expect 403/404 without leaking metadata.

## 8. Parser-specific checks

### DOCX

- Confirm ZIP signature.
- Confirm Mammoth path and python-docx fallback.
- Inspect style map and media relationships.
- Check sanitized HTML before semantic conversion.

### PDF

- Confirm password state.
- Measure text-layer coverage.
- Confirm OCR is used only when appropriate.
- Check page rotation and crop box.

### Image

- Confirm EXIF orientation.
- Confirm magic bytes.
- Confirm asset variant and effective DPI.

### HTML

- Confirm final URL after redirects.
- Confirm SSRF checks for every redirect.
- Inspect sanitized DOM and resolved relative URLs.

## 9. Fix scope

Prefer the smallest correct fix in the owning layer. Do not add format-specific conditionals to unrelated UI components.

## 10. Completion

Run:

```bash
pnpm validate:claude-guides
pnpm validate:imports
pnpm typecheck
pnpm test
pnpm build
```

Update the phase report with root cause, fix and regression test.
