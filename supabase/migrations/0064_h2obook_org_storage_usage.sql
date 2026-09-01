-- ===========================================================================
-- 0064 — Per-organization storage usage helper
-- ---------------------------------------------------------------------------
-- Feeds the Admin "storage nearly full" banner. Self-metered from assets we
-- store, so it needs no Cloudflare API access. Mirrors asset_storage_used_bytes
-- (per user) — this one is per organization.
-- Idempotent.
-- ===========================================================================

create or replace function public.org_asset_storage_used_bytes(p_organization_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(size_bytes), 0)::bigint
  from public.assets
  where organization_id = p_organization_id
    and deleted_at is null;
$$;

grant execute on function public.org_asset_storage_used_bytes(uuid) to authenticated, service_role;
