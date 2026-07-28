Diagnose and fix this H2OBOOK input error: $ARGUMENTS

Follow `docs/claude-code/08-DEBUGGING-RUNBOOK.md` and `09-ERROR-CATALOG.md`.

Requirements:
- Identify the failing layer before editing.
- Reproduce with a synthetic fixture.
- Add a regression test.
- Keep the fix in the owning module.
- Verify idempotency and workspace isolation.
- Do not expose secrets or signed URLs.
- Run relevant validation and update the current phase report.
