-- H2OBOOK Business Growth & Commerce Engine V1
-- Adapted from v5/13-h2obook-business-growth-commerce-engine-v1. The reference migration
-- proposed 5 new tables (h2o_business_goals, h2o_business_opportunities, h2o_business_tasks,
-- h2o_business_feature_grants, h2o_business_provenance_events) plus a has_business_feature()
-- helper.
--
-- Audit result: this repo already has real, live commerce tables — public.products/orders/
-- order_items (0002) and public.memberships/entitlements (0001/0002, hardened by
-- public.mark_order_paid() in 0005) — already wired to the real payment webhook
-- (app/api/payments/webhook/[provider]/route.ts). Nothing here duplicates those. The prompt's
-- Admin Business Operations routes (/store, /orders, /membership, /analytics,
-- /marketplace-studio, /licensing, /white-label, /growth-reader) are explicitly untouched by
-- this migration and this module's code.
--
-- h2o_business_tasks was NOT ported: the reference module's own buildBusinessTasks() is a pure
-- function of already-real metrics (lead count, published content count, booking count) — same
-- "derive, don't persist" pattern already used for the Today Task Planner (0028's header
-- comment) and the Teaching Command Center (0029). See lib/business/command-center.ts.
--
-- h2o_business_provenance_events was NOT ported as a separate table: the only real target this
-- pass has is business_opportunities (no Offer/Campaign entity exists yet — see the integration
-- report's Risks/TODO), so provenance is two inline columns on business_opportunities instead of
-- a whole extra table.
--
-- business_feature_grants IS a new table: the generic public.entitlements table requires a uuid
-- resource_id (it grants access to real content resources like books/templates), which does not
-- fit a fixed text feature-slug vocabulary (e.g. "lead_tracker", "pricing_builder"). Renamed from
-- the reference module's h2o_business_feature_grants (dropped the h2o_ prefix — no other table in
-- this repo uses it) and organization_id instead of workspace_id, matching this repo's convention.

begin;

create table public.business_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  unit text not null check (unit in ('lead','booking','revenue','content','repeat_customer')),
  target_value numeric not null check (target_value >= 0),
  current_value numeric not null default 0 check (current_value >= 0),
  due_at timestamptz,
  status text not null default 'active' check (status in ('active','completed','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index business_goals_owner_idx on public.business_goals(owner_id, organization_id, status);

create table public.business_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  customer_name text not null,
  customer_contact jsonb not null default '{}'::jsonb,
  service_name text not null,
  estimated_value numeric not null default 0 check (estimated_value >= 0),
  status text not null default 'new' check (status in ('new','contacted','consulting','proposal','booked','won','lost')),
  source text,
  next_action_at timestamptz,
  notes text,
  -- Learn -> Create -> Business provenance (CLAUDE_INTEGRATION_PROMPT.md §7): which lesson/skill
  -- or Create Outcome project this opportunity/offer grew out of, if any. No paid content is
  -- copied here — only reference IDs and the minimal snapshot needed to show provenance in the UI.
  source_domain text not null default 'manual' check (source_domain in ('learn','create','teach','manual')),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index business_opportunities_owner_idx on public.business_opportunities(owner_id, organization_id, status);

create table public.business_feature_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_slug text not null,
  source_type text not null check (source_type in ('membership','purchase','stage','manual_grant')),
  source_id uuid,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, feature_slug, source_type, source_id)
);
create index business_feature_grants_user_idx on public.business_feature_grants(user_id, organization_id, feature_slug);

alter table public.business_goals enable row level security;
alter table public.business_opportunities enable row level security;
alter table public.business_feature_grants enable row level security;

-- Learners own their personal goals/pipeline outright. Staff read access reuses the same
-- has_org_role() helper as every other table in this repo (0001) instead of a new admin check.
create policy "business goals owner all"
on public.business_goals for all
to authenticated
using (owner_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (owner_id = auth.uid() and public.is_org_member(organization_id));

create policy "business opportunities owner all"
on public.business_opportunities for all
to authenticated
using (owner_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (owner_id = auth.uid() and public.is_org_member(organization_id));

-- Feature grants: a learner can only ever read their own active grants. Only Admin/Owner (or
-- trusted server code using the service-role key, e.g. a future payment webhook extension) may
-- insert/update/delete — "user không tự cấp feature" (CLAUDE_INTEGRATION_PROMPT.md §13).
create policy "business feature grants self read"
on public.business_feature_grants for select
to authenticated
using (
  (user_id = auth.uid() and revoked_at is null and (expires_at is null or expires_at > now()))
  or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
);

create policy "business feature grants admin write"
on public.business_feature_grants for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create policy "business feature grants admin update"
on public.business_feature_grants for update
to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create policy "business feature grants admin delete"
on public.business_feature_grants for delete
to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create trigger business_goals_touch_updated_at before update on public.business_goals
for each row execute function public.touch_updated_at();
create trigger business_opportunities_touch_updated_at before update on public.business_opportunities
for each row execute function public.touch_updated_at();

-- Full change history (CLAUDE_INTEGRATION_PROMPT.md §9 "notes/history") comes for free from the
-- existing domain-event audit trail (0007) instead of a bespoke opportunity-history table.
create trigger business_goals_domain_event after insert or update or delete on public.business_goals
for each row execute function public.capture_domain_event();
create trigger business_opportunities_domain_event after insert or update or delete on public.business_opportunities
for each row execute function public.capture_domain_event();

commit;
