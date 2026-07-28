# H2OBOOK 4.13.5 — HTML Import 2.0

## Highlights

H2OBOOK now accepts HTML/HTM/XHTML files and public HTML URLs through one server-side reconstruction engine.

### Input

- `.html`, `.htm`, `.xhtml`
- `text/html`
- `application/xhtml+xml`
- Public HTTP/HTTPS URL
- Google Docs public HTML export through the existing safe URL path

### Reconstruction

- Article/main/section hierarchy
- H1–H6
- Rich paragraphs and basic inline marks
- Hyperlinks
- Nested ordered/unordered lists
- Tables with headers, colspan and rowspan
- Figure/image/figcaption
- Blockquotes, dividers, preformatted code
- Audio/video and controlled embeds

### Security

- JSDOM parsing with script execution disabled
- Active elements and event handlers removed
- Dangerous schemes blocked
- SSRF-safe remote asset fetch
- File MIME/extension/content sniffing
- Production source scan requirement
- Sandboxed preview

### Asset localization

Remote images are fetched by a controlled server endpoint and then uploaded through H2OBOOK Asset Engine. The BookDocument stores `assetId` instead of embedding remote binary data.
