# Future Page Upgrade Contract

Every page that is redesigned later must keep:

1. Its route from `lib/operations/routes.ts`.
2. Its domain types from `types/operations.ts` or a backwards-compatible extension.
3. Its role boundary from `lib/operations/permissions.ts`.
4. Loading, empty, error, permission and success states.
5. Feature-flag rollback.
6. Audit/event hooks for mutating actions.
7. No direct dependency on optional AI.
8. No cross-workspace data access.

Future page modules may replace UI components and data adapters, but should not create duplicate route spaces or a second admissions/support/approval system.
