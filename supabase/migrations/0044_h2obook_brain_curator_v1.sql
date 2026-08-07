-- H2OBOOK — H2O Brain Curator V1: a review queue between the asset library and the curriculum
--
-- Adapted from v5/24-H2OBOOK_H2O_BRAIN_CURATOR_V1 after the audit in
-- docs/module-24-brain-curator-audit.md, where the user chose the narrowest of four options:
-- build the queue and the deterministic rule engine now, leave AI as a pluggable source later.
--
-- Two of the source module's six tables are deliberately NOT created:
--
--   brain_provider_settings — it stores third-party API keys AES-GCM-encrypted in Postgres. Every
--     other third-party credential in this repo lives in an environment variable and none live in
--     the database (lib/email/provider.ts, lib/payments/provider.ts), and the module's own
--     alternative `env_ref` mode matches that. With no AI provider implemented yet, the table would
--     have no reader at all; when AI does land it needs its own usage/cost columns anyway.
--
--   brain_runs — it records one row per AI call, with usage/error columns. Rule evaluation is
--     synchronous and deterministic: it cannot half-fail, and the suggestion row already carries
--     which rules matched and when. A table whose only writer always writes "succeeded" is not an
--     audit trail; capture_domain_event already provides that one.
--
-- What remains is the part that works today without any AI, any API key, or any per-call cost:
-- queue an asset, get a suggested placement from rules the owner wrote and from what the admin
-- approved before, review it, approve it into career_stage_resources.

begin;

-- 1. The queue ------------------------------------------------------------------------------------
-- One row per asset waiting to be filed into the curriculum. source_asset_id is a real FK to
-- public.assets — the asset itself is never copied, and deleting it releases the queue row rather
-- than leaving it pointing at nothing.

create table if not exists public.brain_inbox_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_asset_id uuid references public.assets(id) on delete cascade,
  title text not null,
  status text not null default 'review' check (status in ('review','approved','rejected','archived')),
  admin_context jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An asset already waiting in the queue must not be queued a second time.
  unique (organization_id, source_asset_id)
);

create index if not exists brain_inbox_items_org_status_idx on public.brain_inbox_items (organization_id, status, created_at desc);

-- 2. Deterministic classification rules -------------------------------------------------------------
-- conditions/actions are jsonb because the shape is authored in the admin UI, but they are not
-- free-form: lib/brain/rules.ts defines and validates the exact shape, and anything it does not
-- recognise is ignored rather than guessed at.

create table if not exists public.brain_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brain_rules_org_priority_idx on public.brain_rules (organization_id, enabled, priority);

-- 3. Suggestions ------------------------------------------------------------------------------------
-- `source` is the point of the whole design: a suggestion is independent of what produced it. Today
-- that is 'rule' or 'memory'; 'ai' is listed so adding a provider later needs no migration, and
-- 'manual' covers an admin filing something with no suggestion at all.

create table if not exists public.brain_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inbox_item_id uuid not null references public.brain_inbox_items(id) on delete cascade,
  source text not null default 'rule' check (source in ('rule','memory','manual','ai')),
  suggested_stage_id uuid references public.career_stages(id) on delete set null,
  suggested_node_id uuid references public.academy_stage_nodes(id) on delete set null,
  surface text check (surface is null or surface in ('learn','create','business','coaching')),
  confidence numeric(5,4) not null default 0 check (confidence >= 0 and confidence <= 1),
  reason text not null default '',
  decision text not null default 'pending' check (decision in ('pending','approved','edited','rejected')),
  reviewer_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  applied_resource_id uuid references public.career_stage_resources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brain_suggestions_review_idx on public.brain_suggestions (organization_id, decision, confidence desc, created_at desc);
create index if not exists brain_suggestions_item_idx on public.brain_suggestions (inbox_item_id);

-- 4. What the admin has decided before ---------------------------------------------------------------
-- The substitute for AI in this release. Approving "every video in folder X goes to Stage 2 / Learn"
-- three times makes that the suggestion the fourth time — the admin's own decisions become the
-- classifier, with no model, no API key and no per-call cost. signal_key is computed in
-- lib/brain/rules.ts (e.g. `subtype:video`, `mime:application/pdf`, `folder:<uuid>`).

create table if not exists public.brain_memory_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  signal_key text not null,
  stage_id uuid references public.career_stages(id) on delete cascade,
  node_id uuid references public.academy_stage_nodes(id) on delete set null,
  surface text check (surface is null or surface in ('learn','create','business','coaching')),
  evidence_count integer not null default 1 check (evidence_count > 0),
  last_confirmed_by uuid references public.profiles(id) on delete set null,
  last_confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- One row per (signal, destination): approving the same pairing again raises its evidence count
  -- rather than adding a duplicate, which is what makes "most confirmed wins" meaningful.
  unique (organization_id, signal_key, stage_id, node_id, surface)
);

create index if not exists brain_memory_signals_lookup_idx on public.brain_memory_signals (organization_id, signal_key, evidence_count desc);

-- 5. RLS ---------------------------------------------------------------------------------------------
-- Admin and owner both curate. Rules are owner-only to write: a rule silently redirects where every
-- future document lands, which is a different level of authority from filing one document.

alter table public.brain_inbox_items enable row level security;
alter table public.brain_rules enable row level security;
alter table public.brain_suggestions enable row level security;
alter table public.brain_memory_signals enable row level security;

drop policy if exists "brain inbox admin all" on public.brain_inbox_items;
create policy "brain inbox admin all" on public.brain_inbox_items for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop policy if exists "brain rules admin read" on public.brain_rules;
create policy "brain rules admin read" on public.brain_rules for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop policy if exists "brain rules owner write" on public.brain_rules;
create policy "brain rules owner write" on public.brain_rules for all to authenticated
using (public.has_org_role(organization_id, array['owner']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner']::public.member_role[]));

drop policy if exists "brain suggestions admin all" on public.brain_suggestions;
create policy "brain suggestions admin all" on public.brain_suggestions for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop policy if exists "brain memory admin all" on public.brain_memory_signals;
create policy "brain memory admin all" on public.brain_memory_signals for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop trigger if exists brain_inbox_items_domain_event on public.brain_inbox_items;
create trigger brain_inbox_items_domain_event after insert or update or delete on public.brain_inbox_items
for each row execute function public.capture_domain_event();

drop trigger if exists brain_suggestions_domain_event on public.brain_suggestions;
create trigger brain_suggestions_domain_event after insert or update or delete on public.brain_suggestions
for each row execute function public.capture_domain_event();

commit;

-- Rollback:
--   drop trigger if exists brain_suggestions_domain_event on public.brain_suggestions;
--   drop trigger if exists brain_inbox_items_domain_event on public.brain_inbox_items;
--   drop table if exists public.brain_memory_signals;
--   drop table if exists public.brain_suggestions;
--   drop table if exists public.brain_rules;
--   drop table if exists public.brain_inbox_items;
-- Nothing outside these four tables is touched: assets, career_stages, academy_stage_nodes and
-- career_stage_resources are only ever read or written through their existing paths.
