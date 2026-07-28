Implement exactly one H2OBOOK input phase: $ARGUMENTS

Mandatory workflow:
1. Read `CLAUDE.md`.
2. Find the matching phase specification under `docs/claude-code/phases/`.
3. Run baseline audit and validators.
4. Inspect current code before proposing changes.
5. Implement the smallest coherent end-to-end slice for this phase.
6. Add unit/integration tests and stable error codes.
7. Preserve no-AI-first, workspace isolation, assetId storage and legacy data.
8. Run all relevant validators/tests.
9. Create/update the phase progress report from the template.
10. Stop after this phase and report blockers; do not silently start the next phase.
