# Owner Action Checklist — 4.13.7

- [ ] Run `corepack prepare pnpm@9.15.5 --activate` on a networked machine.
- [ ] Run `pnpm install` and commit the real `pnpm-lock.yaml`.
- [ ] Run `pnpm check`.
- [ ] Run `pnpm exec playwright install --with-deps chromium` and `pnpm test:e2e`.
- [ ] Apply migrations 0001–0022 in a clean Supabase project.
- [ ] Configure two test users and run the RLS integration test.
- [ ] Configure R2, Redis, ClamAV and document processor.
- [ ] Test queue outage, timeout, cancellation and stale-session recovery.
- [ ] Test DOCX/PDF/image/HTML happy paths and hostile fixtures.
- [ ] Deploy with Unified Input disabled, smoke-test, then enable progressively.
