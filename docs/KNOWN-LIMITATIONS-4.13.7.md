# Known Limitations — H2OBOOK 4.13.7

1. The release is a source-complete candidate, not production-approved.
2. A real `pnpm-lock.yaml` must be generated and committed on a networked machine.
3. Semantic typecheck, Vitest, Next.js build and Playwright were not run in the packaging environment.
4. Migration 0022 has structural validation but still requires execution against clean and upgraded Supabase databases.
5. RLS requires real multi-user verification, including cross-workspace denial.
6. Redis, R2, ClamAV and document-processor outage/recovery behavior requires live-service testing.
7. Synthetic load fixtures do not replace sustained concurrent load testing.
8. Unified Input remains behind `NEXT_PUBLIC_UNIFIED_INPUT_ENABLED` for staged rollout and rollback.
9. Legacy Quick Import remains available temporarily until production parity is proven.
10. AI remains optional and is not part of the Input Engine correctness path.
