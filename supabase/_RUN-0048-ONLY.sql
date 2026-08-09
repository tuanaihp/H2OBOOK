-- H2OBOOK — move two asset aggregations from the application into the database
--
-- Found by the H2O Engineering Standard V2 audit (docs/h2o-audit/H2O_ENGINEERING_AUDIT_V2.md, P2-2).
-- Both call sites asked PostgREST for one column of every matching asset row and then reduced the
-- array in Node:
--
--   lib/storage/quota.ts        select size_bytes for every asset a user owns, summed in JS,
--                               on every single upload.
--   lib/assets/organization.ts  select folder_id for every live asset in the organisation, counted
--                               in JS, on every render of the folder tree.
--
-- With an empty assets table that is invisible. At any real size it is the wrong shape twice over:
-- the row transfer grows without bound, and — more seriously — if PostgREST is configured with a
-- max-rows ceiling, the array silently arrives truncated and the storage quota computes a number
-- LOWER than the truth, which fails open and lets a user exceed their quota. A count/sum done by
-- Postgres has neither problem: it returns one row regardless of table size, and cannot be truncated.
--
-- Both functions are security definer so they can aggregate across rows the caller may not be able
-- to SELECT individually, and both take organization_id explicitly and are revoked from anon —
-- a caller can only ever aggregate a tenant it names, and callers are the app's own server code.

begin;

create or replace function public.asset_storage_used_bytes(p_organization_id uuid, p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(size_bytes), 0)::bigint
  from public.assets
  where organization_id = p_organization_id
    and uploaded_by = p_user_id
    and deleted_at is null;
$$;

-- Note: this counts only live assets (deleted_at is null). The JS version it replaces did NOT filter
-- deleted assets, so a user who deleted a file kept paying for it against their quota until the row
-- was hard-deleted. Fixed here rather than faithfully reproduced.

create or replace function public.asset_folder_counts(p_organization_id uuid)
returns table (folder_id uuid, asset_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select a.folder_id, count(*)::bigint
  from public.assets a
  where a.organization_id = p_organization_id
    and a.deleted_at is null
    and a.folder_id is not null
  group by a.folder_id;
$$;

revoke all on function public.asset_storage_used_bytes(uuid, uuid) from public, anon;
revoke all on function public.asset_folder_counts(uuid) from public, anon;
grant execute on function public.asset_storage_used_bytes(uuid, uuid) to authenticated, service_role;
grant execute on function public.asset_folder_counts(uuid) to authenticated, service_role;

-- One index only, and deliberately not two. assets_org_uploader_idx (migration 0023) already covers
-- asset_storage_used_bytes' (organization_id, uploaded_by) equality predicates, so a partial twin of
-- it would be a redundant index to maintain on every write for very little gain.
--
-- The folder count is the case not already covered: assets_folder_idx (migration 0037) is keyed on
-- folder_id alone, so grouping within one organisation cannot use it to skip other tenants' rows.
create index if not exists assets_org_folder_live_idx
  on public.assets(organization_id, folder_id) where deleted_at is null;

commit;

-- Rollback:
--   drop index if exists public.assets_org_folder_live_idx;
--   drop function if exists public.asset_folder_counts(uuid);
--   drop function if exists public.asset_storage_used_bytes(uuid, uuid);
