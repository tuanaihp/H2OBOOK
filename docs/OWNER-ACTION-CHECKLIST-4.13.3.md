# Owner Action Checklist — 4.13.3 PDF Dual Import

1. Configure R2, Supabase, Redis, ClamAV and the Python document processor.
2. Install Tesseract language packs `vie` and `eng` in the processor image.
3. Run migrations 0001–0019.
4. Run `pnpm install`, commit `pnpm-lock.yaml`, then use frozen installs in CI.
5. Run `pnpm validate:input-phase3`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.
6. Test at least: native text PDF, mixed text/scan PDF, scanned Vietnamese PDF, password PDF, 200+ page PDF, table-heavy PDF, image-heavy PDF.
7. Review OCR corrections before production import; OCR is deterministic but not infallible.
