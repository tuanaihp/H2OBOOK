# H2OBOOK Input Engine Rollback Runbook

## Goal

Rollback without deleting imported books, assets, session previews or audit events.

## Fast rollback

1. Set `NEXT_PUBLIC_UNIFIED_INPUT_ENABLED=false`.
2. Redeploy the web service. The editor opens the legacy importer by default.
3. Stop `input-recovery` and `document-worker` only if queue processing is causing damage.
4. Keep Redis and PostgreSQL data intact.
5. Do not delete `input_sessions`, `input_session_events`, `document_jobs` or R2 objects while investigating.

## Application rollback

Version 4.13.7 migration 0022 is additive. Version 4.13.6 may be redeployed without dropping the new columns. The original `commit_input_session` RPC remains available for compatibility.

## Policy rollback

Only use this if the stricter Phase 7 RLS policies block legitimate users:

```sql
begin;
drop policy if exists input_sessions_creator_insert on public.input_sessions;
drop policy if exists input_sessions_owner_update on public.input_sessions;
create policy input_sessions_editor_write on public.input_sessions for all
  using (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]));
commit;
```

Record the incident and restore the hardened policies after the root cause is fixed.

## Worker rollback

- Stop accepting new jobs.
- Let active jobs reach timeout or mark affected sessions `recovery_required`.
- Never force a stale worker result into a `completed` or `cancelled` session.
- Requeue only from the same `inputSessionId` and idempotency key.

## Verification

- Existing books open normally.
- Legacy DOCX/PDF/image import remains available.
- No session changes organization or requester.
- No duplicate book is created after retry.
- R2 assets remain private.
