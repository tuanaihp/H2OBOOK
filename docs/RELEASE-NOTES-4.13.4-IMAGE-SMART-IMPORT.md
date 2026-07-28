# H2OBOOK 4.13.4 — Image Smart Import

- Added a unified Image Smart Import experience instead of immediate image insertion.
- Added asset, full-page, OCR and manual-region modes.
- Added official `.jpe` support alongside PNG, JPG and JPEG.
- Added PNG/JPEG metadata inspection for dimensions, transparency, EXIF orientation, DPI and color profile.
- Added stored-object magic-byte verification and SHA-256 metadata.
- Added Tesseract region OCR with bounding boxes, confidence and reading order.
- Added manual text/image/ignore regions and editable OCR preview.
- Added crop-and-materialize flow for selected image regions.
- Added effective-DPI and upscale warnings to editor preflight.
- Added asset variants, image-region persistence and RLS migration 0020.
- Added Phase 4 tests, fixtures, validator and Claude progress report.
- AI remains optional and is not used by Image Smart Import.
