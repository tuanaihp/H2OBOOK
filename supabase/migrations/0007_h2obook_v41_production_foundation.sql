-- H2OBOOK 4.1 Production Foundation
-- Domain events, optimistic revisions, consistent updated_at and realtime publication.

create table if not exists public.domain_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  resource_type text not null,
  resource_id uuid,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists domain_events_org_time_idx on public.domain_events(organization_id, occurred_at desc);
create index if not exists domain_events_resource_idx on public.domain_events(resource_type, resource_id, occurred_at desc);

alter table public.domain_events enable row level security;

drop policy if exists domain_events_select on public.domain_events;
create policy domain_events_select on public.domain_events for select using (public.is_org_member(organization_id));
drop policy if exists domain_events_insert on public.domain_events;
create policy domain_events_insert on public.domain_events for insert with check (public.is_org_member(organization_id));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'brand_profiles','templates','classes','assignments','quizzes','review_requests',
    'automation_rules','license_agreements','white_label_portals','learning_goals',
    'flashcards','knowledge_sources','reusable_blocks'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function public.capture_domain_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  org_id uuid;
  row_id uuid;
  event_kind text;
begin
  org_id := coalesce((to_jsonb(new)->>'organization_id')::uuid, (to_jsonb(old)->>'organization_id')::uuid);
  row_id := coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid);
  event_kind := lower(tg_op);
  if org_id is not null then
    insert into public.domain_events(organization_id, actor_id, resource_type, resource_id, event_name, payload)
    values(org_id, auth.uid(), tg_table_name, row_id, event_kind, jsonb_build_object('new', to_jsonb(new), 'old', to_jsonb(old)));
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'brand_profiles','templates','book_clones','classes','assignments','quizzes','review_requests',
    'automation_rules','license_agreements','royalty_payouts','white_label_portals','notifications',
    'learning_goals','flashcards','knowledge_sources','reusable_blocks'
  ] loop
    execute format('drop trigger if exists %I_domain_event on public.%I', table_name, table_name);
    execute format('create trigger %I_domain_event after insert or update or delete on public.%I for each row execute function public.capture_domain_event()', table_name, table_name);
  end loop;
end $$;

-- Realtime is optional; duplicate_object is ignored when a table is already published.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'brand_profiles','templates','book_clones','classes','assignments','quizzes','review_requests',
    'automation_rules','license_agreements','royalty_payouts','white_label_portals','notifications',
    'learning_goals','flashcards','knowledge_sources','reusable_blocks','domain_events'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
