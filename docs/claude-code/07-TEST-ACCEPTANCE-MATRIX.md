# Input Test and Acceptance Matrix

| Fixture | Mode | Expected output | Required assertion |
|---|---|---|---|
| DOCX headings/paragraphs | semantic | heading and paragraph nodes | order and Vietnamese text preserved |
| DOCX rich formatting | semantic | marks/lists/links | no raw-text flattening |
| DOCX table/image | semantic | table nodes + asset IDs | no Base64 |
| Corrupt DOCX | semantic | failure | `DOCX_PARSE_FAILED` |
| Native text PDF | semantic | text nodes | OCR not invoked by default |
| Scanned PDF | OCR | OCR nodes + confidence | `vie+eng` result preview |
| PDF design | fixed | locked page backgrounds | exact page order/aspect |
| Password PDF | any | failure | `PDF_PASSWORD_PROTECTED` |
| PNG transparent | asset | image asset | alpha preserved |
| JPEG EXIF | asset | corrected preview | orientation preserved |
| JPE | asset | accepted | MIME/extension consistency |
| HTML file basic | semantic | headings/paragraphs/links | scripts removed |
| HTML relative asset | semantic | localized asset | URL resolution works |
| HTML malicious | semantic | sanitized preview | no active script/event handler |
| SSRF URL | semantic | blocked | `HTML_SSRF_BLOCKED` |

## Required fixture naming

Store synthetic, redistributable fixtures under `tests/fixtures/input/`.

Never use customer documents in automated tests.

## Acceptance evidence

Each progress report must include:

- Fixture names.
- Command run.
- Pass/fail count.
- Screenshots or JSON snapshots where useful.
- Any test skipped and why.

Phase 3 fixture generator: `python tests/fixtures/input/generate-pdf-fixtures.py` creates native-text, scanned, mixed and password-protected PDF cases.
