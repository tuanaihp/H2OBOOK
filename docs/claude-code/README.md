# Claude Code Guidance for H2OBOOK Input Engine

This folder converts the H2OBOOK input audit into an executable engineering plan.

## How to use

1. Start Claude Code from the repository root so it automatically reads `CLAUDE.md`.
2. Run `/input-status` to inspect the current implementation.
3. Run `/input-phase 1` to implement one phase at a time.
4. Run `/fix-input-error <error or log>` when a parser/job fails.
5. Run `/validate-input` before declaring completion.

Claude Code supports project-level instructions through `CLAUDE.md`; this repository keeps the mandatory invariants there and the detailed phase contracts here.

## Documents

- `00-MASTER-EXECUTION-PLAN.md` — complete target architecture and workflow.
- `CURRENT-PHASE.md` — current implementation target.
- `input-roadmap.yaml` — machine-readable phases and dependencies.
- `phases/` — phase-by-phase technical specification.
- `07-TEST-ACCEPTANCE-MATRIX.md` — required fixtures and expected outcomes.
- `08-DEBUGGING-RUNBOOK.md` — diagnosis workflow.
- `09-ERROR-CATALOG.md` — stable error codes.
- `progress/REPORT-TEMPLATE.md` — completion evidence template.

## Rule

Do not skip phases because a screen already exists. A phase is complete only when the full pipeline, persistence, error handling and tests pass.
