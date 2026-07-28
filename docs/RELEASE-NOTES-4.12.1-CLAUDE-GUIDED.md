# Release Notes — H2OBOOK Professional Editor 4.12.1 Claude Guided

This patch integrates an executable, phase-by-phase engineering guide for Claude Code.

## Added

- Root `CLAUDE.md`.
- `AGENTS.md` compatibility pointer.
- Input roadmap phases 1–7.
- Claude Code commands: input status, phase execution, error fixing and validation.
- Input error catalog and debugging runbook.
- Acceptance matrix and synthetic fixture policy.
- `audit:input`, `guide:input` and `validate:claude-guides` scripts.
- CI validation for the guidance layer.

## Important

No importer has been falsely marked complete. The capability audit continues to report:

- DOCX rich import: partial/raw-text.
- JPE support: missing.
- HTML/HTM direct upload: missing.
- HTML parser: partial/regex.

The next implementation phase is Unified Input Gateway.
