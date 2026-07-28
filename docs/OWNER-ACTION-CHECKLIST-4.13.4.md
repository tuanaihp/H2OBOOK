# Owner Action Checklist — 4.13.4 Image Smart Import

1. Configure R2, Supabase, Redis, ClamAV and the Python document processor.
2. Install Tesseract language packs `vie` and `eng` in the processor image.
3. Run migrations 0001–0020.
4. Run `pnpm install`, commit `pnpm-lock.yaml`, then use frozen installs in CI.
5. Run `pnpm validate:input-phase4`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.
6. Test PNG transparency, JPG/JPEG, `.jpe`, EXIF rotations 3/6/8, missing DPI, 72-DPI images, 300-DPI images and very large images.
7. Test all four modes on desktop, tablet and mobile pointer/touch input.
8. Review OCR results before commit; Tesseract is deterministic but can misread stylized, curved or low-contrast text.
9. Verify effective-DPI thresholds with the print provider before production rollout.
