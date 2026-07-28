# Phase 5 — HTML Import 2.0

## Objective

Support direct `.html/.htm` upload and public URL import using a real DOM parser, sanitization and asset localization.

## Current limitation

The existing parser is regex-heavy. It works for simple HTML/RSS but is not sufficient as the final parser for complex or malformed documents.

## Target server pipeline

```text
HTML file or safe URL
-> charset detection
-> parse5/JSDOM/Cheerio DOM parsing
-> DOMPurify-equivalent server sanitization
-> select main content
-> resolve relative URLs
-> import permitted images/assets
-> map DOM to normalized semantic nodes
-> preview
```

Choose libraries compatible with Next.js server runtime and document them. Do not parse untrusted HTML in the client as trusted DOM.

## Supported structures

- `article`, `main`, `section`.
- `h1`–`h6`.
- Paragraphs and line breaks.
- Ordered/unordered/nested lists.
- Links.
- Tables.
- Figure/figcaption.
- Blockquote.
- Images.
- Audio/video/embed as controlled interactive nodes.
- Basic inline marks.

## Sanitization

Remove or neutralize:

- Script.
- Event handler attributes.
- Unsafe iframe/embed.
- Dangerous URL schemes.
- Forms unless imported as a supported block.
- CSS that can escape/overlay the application.

## URL handling

- Retain current SSRF defense.
- Resolve relative links against final URL.
- Enforce redirect, size and timeout limits.
- Download remote images through controlled server import.
- Do not preserve authenticated/private URLs as public assets.

## Direct file upload

Add:

- `.html`, `.htm` client accept values.
- `text/html` and optional `application/xhtml+xml` server allowlist.
- Magic/content sniffing.
- Optional ZIP bundle support only in a later, separately secured task.

## Tests

- Basic semantic HTML.
- Nested lists and table.
- Relative images/links.
- Malformed HTML.
- Script/event handler removal.
- Unsafe URL scheme.
- SSRF attempts.
- Oversized response.

## Acceptance criteria

- HTML/HTM file upload works.
- URL and file paths share the same normalized parser.
- Inline formatting and structure survive where supported.
- Remote assets are localized or produce explicit warnings.
- No script or active content executes during preview/import.
