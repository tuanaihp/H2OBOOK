# Phase 3 — PDF Dual Import

## Objective

Support two explicit PDF workflows: visual preservation and editable reconstruction.

## Mode A — Fixed Layout

Current foundation:

```text
PDF.js
-> render page to image
-> upload asset
-> create locked full-page background
```

Required upgrades:

- Page size/aspect preservation.
- Configurable DPI/quality.
- Thumbnail generation.
- Password-protected PDF error handling.
- Retry/idempotency.
- Source PDF provenance.
- Optional text-search overlay when text layer is available.

## Mode B — Semantic Editable

Deterministic pipeline:

```text
PDF
-> inspect text layer
-> extract blocks/spans/fonts/coordinates
-> detect reading order
-> extract images
-> detect tables where reliable
-> normalize semantic nodes
-> show confidence/warnings
-> preview and commit
```

Use OCR only when:

- No usable text layer exists.
- The user selects OCR mode.
- Text-layer coverage is below a documented threshold.

## Scan/OCR path

```text
render page
-> Tesseract vie+eng
-> bounding boxes
-> layout grouping
-> reading-order correction UI
-> semantic nodes
```

## Reconstruction rules

- Preserve text content before visual fidelity in semantic mode.
- Preserve visual fidelity before editability in fixed-layout mode.
- Never claim perfect editable reconstruction.
- Surface confidence per page/block.
- Allow users to reorder blocks before commit.

## Errors

- `PDF_PASSWORD_PROTECTED`
- `PDF_PAGE_LIMIT_EXCEEDED`
- `PDF_NO_TEXT_LAYER`
- `PDF_OCR_FAILED`
- `PDF_RECONSTRUCTION_LOW_CONFIDENCE`

## Tests

- Text-native PDF.
- Scanned Vietnamese PDF.
- Mixed image/text PDF.
- Rotated pages.
- Password-protected PDF.
- 500+ page limit.
- Malformed PDF.

## Acceptance criteria

- User explicitly chooses fixed or editable mode.
- Text-native PDF does not unnecessarily go through OCR.
- Fixed mode keeps page dimensions and order.
- Editable mode creates semantic nodes with diagnostics.
- Preview supports page/block correction before commit.
