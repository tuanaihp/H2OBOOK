# Owner Checklist — H2OBOOK 4.13.6

1. Install pnpm and run `pnpm install`; commit the generated `pnpm-lock.yaml`.
2. Run `pnpm validate:input-phase6`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.
3. Apply Supabase migrations `0001` through `0021` to a clean staging project.
4. Configure R2, Redis, ClamAV, Python document processor and worker secrets.
5. Verify that two clicks with the same idempotency key create only one session/commit.
6. Test create-new, append-chapter, replace-document and design-page destinations.
7. Interrupt a PDF/OCR worker, refresh the browser and verify Recovery resumes from the same session.
8. Test cancellation for queued jobs and soft cancellation behavior for running jobs.
9. Test a conflicting book version and confirm `INPUT_VERSION_CONFLICT` prevents overwrite.
10. Do not remove the legacy quick import until Phase 7 parity/E2E tests pass.
