# Integration Guide

1. Open Claude Code in the main H2OBOOK repository.
2. Create a feature branch and backup tag.
3. Copy module files without overwriting `.git`, `.env.local`, lockfile or existing migrations.
4. Merge the sidebar only after role rules are confirmed.
5. Add feature flags to `.env.example`.
6. Run the route demo using local demo mode.
7. Connect `OperationsRole` to the repository's real membership role contract.
8. Keep `NEXT_PUBLIC_PLATFORM_ADMIN_V1=false` until platform authorization exists.
9. Treat `optional/supabase/0023...sql` as a proposal, not an automatic migration.
10. Run validation, typecheck, tests, build and Playwright before preview deployment.

## Suggested navigation integration

Workspace/Admin may receive an `Operations` domain linking to `/operations`.
Teachers should be redirected to `/instructor`.
Customers waiting for enrollment should receive a signed or authenticated `/customer` route.
Students remain on `/student` after account provisioning.
Platform admin must use a separate role and route guard.
