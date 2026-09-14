-- Organization settings (audit BUG-4).
--
-- /settings and /smart-settings used to live only in the browser (Zustand localStorage), with a
-- whole-store snapshot pushed to workspace_snapshots on a 15s debounce. A save followed by closing
-- the tab could be lost, and another device's older snapshot could overwrite it. This table is the
-- authoritative, per-organization copy of those two settings groups; the API writes it immediately
-- on save and the admin shell applies it on load.
--
-- Plan and storage quota are deliberately NOT stored here: they are billing/server facts, never
-- client-editable settings.

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  workspace jsonb not null default '{}'::jsonb,
  smart_settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_settings enable row level security;

drop policy if exists "organization settings members read" on public.organization_settings;
create policy "organization settings members read" on public.organization_settings for select
  using (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]));

drop policy if exists "organization settings staff manage" on public.organization_settings;
create policy "organization settings staff manage" on public.organization_settings for all
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

-- Reuses public.touch_updated_at(), defined in 0007_h2obook_v41_production_foundation.sql.
drop trigger if exists organization_settings_touch_updated_at on public.organization_settings;
create trigger organization_settings_touch_updated_at before update on public.organization_settings
for each row execute function public.touch_updated_at();
