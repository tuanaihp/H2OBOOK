# Phase 2 — Word Import 2.0

## Objective

Convert DOCX into semantic, editable content while preserving useful structure and surfacing unsupported features.

## Current limitation

The editor uses `mammoth.extractRawText()` and loses formatting. The Python worker extracts paragraphs, heading styles and tables, but its result is not yet the canonical end-to-end import path.

## Target deterministic pipeline

```text
DOCX
-> ZIP/magic/security validation
-> Mammoth convertToHtml with styleMap
-> extract media assets
-> sanitize normalized HTML
-> parse to normalized ImportDocument
-> compare/fallback with python-docx structural extraction
-> preview
-> BookDocument commit
```

## Required preservation

Must preserve where available:

- Heading levels.
- Paragraphs.
- Bold, italic, underline and strike.
- Ordered/unordered lists.
- Hyperlinks.
- Tables including basic merged cells.
- Embedded images as imported assets.
- Captions.
- Page/section break warnings.
- Footnotes/endnotes when extractable.

## Mammoth guidance

Replace the final quick path based on `extractRawText()` with `convertToHtml()` and a project-owned style map. Do not send raw Mammoth HTML directly to the editor without sanitization and normalization.

## Python fallback

Use `python-docx` for diagnostics and structures Mammoth misses:

- Style names.
- Table grid.
- Section/page-break metadata.
- Media relationship inventory.

Do not create two conflicting final documents. Merge into one normalized `ImportDocument` with provenance per node.

## Asset handling

- Extract media files.
- Validate each image.
- Create R2 asset records or offline IndexedDB assets.
- Store `assetId`, not Base64.
- Preserve source relationship and original filename.

## Warnings

Examples:

- `DOCX_FLOATING_SHAPE_SIMPLIFIED`
- `DOCX_FONT_SUBSTITUTED`
- `DOCX_SECTION_BREAK_FLATTENED`
- `DOCX_UNSUPPORTED_FIELD`

## Preview requirements

Show:

- Outline.
- Paragraph/list/table count.
- Extracted images.
- Style substitutions.
- Unsupported features.
- Option to map Word styles to H2OBOOK styles.

## Tests

Fixtures must include:

- Basic headings and paragraphs.
- Bold/italic/link/list.
- Table with merged cells.
- Embedded image.
- Vietnamese text.
- Corrupt DOCX.
- ZIP bomb candidate.

## Acceptance criteria

- Quick import no longer uses raw text as the final production path.
- Structure becomes semantic nodes.
- Images become assets.
- Unsupported features are warnings, not silent loss.
- Re-import with same idempotency key does not duplicate assets or nodes.
