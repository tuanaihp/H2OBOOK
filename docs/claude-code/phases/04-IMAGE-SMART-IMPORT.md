# Phase 4 — Image Smart Import

## Objective

Handle PNG/JPG/JPEG/JPE through one secure asset flow and offer deterministic import choices.

## Required extensions

Support:

- `.png`
- `.jpg`
- `.jpeg`
- `.jpe`

Update both client `accept` values and server MIME/extension mapping.

## Import choices

1. Add as image element.
2. Use as full-page locked background.
3. OCR into editable content.
4. Manual region extraction.

No AI is required.

## Asset pipeline

```text
select file
-> local object URL preview
-> validate extension/MIME/magic bytes
-> upload/quarantine
-> scan
-> asset record
-> variants/thumbnail
-> editor element uses assetId
```

## Required metadata

- Width and height.
- EXIF orientation.
- MIME and original filename.
- File size.
- SHA-256/checksum.
- DPI when present.
- Color profile when present.
- OCR language/configuration when requested.

## Manual region extraction

Provide a UI for rectangular regions:

- Text region -> OCR.
- Image region -> crop as asset.
- Ignore region.
- Reading order.

## Preflight integration

- Effective DPI based on printed size.
- Missing alt text.
- Unsupported color profile.
- Excessive upscaling.
- Broken/missing asset variant.

## Tests

- PNG transparency.
- JPEG EXIF rotation.
- `.jpe` extension.
- Corrupt image.
- MIME mismatch.
- Large image.
- Vietnamese OCR.

## Acceptance criteria

- All JPEG extensions are accepted consistently.
- New images never enter book JSON as Base64.
- OCR result is previewed before semantic commit.
- Full-page/background and asset-only modes preserve image fidelity.
