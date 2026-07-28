# Owner Action Checklist — 4.13.2

1. Install dependencies with `pnpm install` and commit `pnpm-lock.yaml`.
2. Run `pnpm validate:input-phase2`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm test:e2e`.
3. Test representative DOCX fixtures: Vietnamese headings, nested lists, tables, images, captions, hyperlinks, page breaks and footnotes.
4. In Production Mode, configure R2, PostgreSQL, Redis, `DOCUMENT_WORKER_URL` and `DOCUMENT_WORKER_SECRET` before testing Python fallback.
5. Confirm Word image licensing and font replacement policy before commercial import.
6. Continue with Phase 3 PDF Dual Import; do not start HTML/Image phases in the same branch.
