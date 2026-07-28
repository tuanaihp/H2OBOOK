# Synthetic Input Fixtures

Only synthetic, redistributable documents belong here. Never add real customer books, personal data or licensed publications.

Expected fixture groups:

```text
docx/
  basic-headings.docx
  rich-formatting.docx
  table-image.docx
  corrupt.docx
pdf/
  native-text.pdf
  scanned-vietnamese.pdf
  rotated-pages.pdf
  password-protected.pdf
images/
  transparent.png
  exif-rotated.jpg
  sample.jpe
html/
  basic.html
  malformed.html
  malicious.html
  relative-assets.html
```

A fixture generator may be added, but generated binaries must remain small and deterministic.
