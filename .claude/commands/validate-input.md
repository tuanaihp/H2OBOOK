Validate the H2OBOOK input engine and produce a release-readiness report.

Run, where dependencies are available:
- pnpm audit:input
- pnpm validate:claude-guides
- pnpm validate
- pnpm validate:imports
- pnpm validate:professional
- pnpm validate:editor412
- pnpm typecheck
- pnpm test
- pnpm test:sql
- pnpm build
- pnpm test:e2e

Compare results with `docs/claude-code/07-TEST-ACCEPTANCE-MATRIX.md`.
Clearly separate passed, failed, skipped and unverified checks. Do not mark production-ready when build/E2E or real worker/storage tests were not run.
