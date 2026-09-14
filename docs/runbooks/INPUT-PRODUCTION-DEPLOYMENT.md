# Input Engine Production Deployment

## Mandatory release gates

1. Generate the real `pnpm-lock.yaml` on a networked machine and commit it.
2. Run `pnpm install --frozen-lockfile`.
3. Run `pnpm check` and Playwright E2E.
4. Apply migrations 0001–0022 to a clean Supabase project.
5. Run the real RLS integration test with two users in different organizations.
6. Test R2, Redis/BullMQ, ClamAV and document processor together.
7. Test cancellation, timeout, stale-session recovery and idempotent commit.

## R2 browser upload CORS

Preview the managed H2OBOOK rule, then apply it to the configured private bucket:

```bash
pnpm configure:r2-cors
pnpm configure:r2-cors -- --apply
```

The rule permits signed `GET`, `PUT` and `HEAD` requests from `NEXT_PUBLIC_APP_URL` and
`http://localhost:3000`. Set `R2_CORS_ADDITIONAL_ORIGINS` to a comma-separated list to replace the
local-development default. Existing R2 CORS rules with other IDs are preserved. Applying through
the script requires credentials with R2 Admin Read & Write; an object-only token can upload files
but cannot change bucket CORS. In that case, copy the previewed rule into Cloudflare Dashboard →
R2 → bucket → Settings → CORS Policy.

## Deployment order

1. Database migration 0022.
2. Document processor 4.13.7.
3. Document worker 4.13.7.
4. Web 4.13.7 with `NEXT_PUBLIC_UNIFIED_INPUT_ENABLED=false`.
5. Run smoke tests.
6. Start `input-recovery`.
7. Enable Unified Input for internal workspace, then staged cohorts.

## Monitoring

Alert on:

- error rate by format/mode;
- p95 processing duration;
- stale or recovery-required sessions;
- worker stalled count;
- scanner pending/blocked rate;
- commit version conflicts;
- duplicate idempotency attempts.
