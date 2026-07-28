begin;

create table if not exists public.smart_core_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  ai_enabled boolean not null default false,
  assist_mode text not null default 'local' check (assist_mode in ('local','external','off')),
  offline_first boolean not null default true,
  auto_generate_study_cards boolean not null default true,
  reduce_motion boolean not null default false,
  high_contrast boolean not null default false,
  focus_mode boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  title text not null,
  description text not null default '',
  progress smallint not null default 0 check (progress between 0 and 100),
  status text not null default 'active' check (status in ('active','completed','paused')),
  target_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  page_id uuid references public.book_pages(id) on delete set null,
  title text not null,
  content text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  page_id uuid references public.book_pages(id) on delete set null,
  front text not null,
  back text not null,
  tags text[] not null default '{}',
  difficulty smallint not null default 2 check (difficulty between 1 and 5),
  next_review_at timestamptz not null default now(),
  interval_days integer not null default 1 check (interval_days between 1 and 3650),
  review_count integer not null default 0,
  correct_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  goal_id uuid references public.learning_goals(id) on delete set null,
  mode text not null check (mode in ('read','review','practice','reflect')),
  duration_minutes integer not null default 0 check (duration_minutes between 0 and 1440),
  completed_items integer not null default 0,
  note text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  source_type text not null check (source_type in ('book','pdf','docx','image','audio','video','url','note')),
  status text not null default 'ready' check (status in ('ready','processing','error')),
  book_id uuid references public.books(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  source_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reusable_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  category text not null check (category in ('lesson','practice','marketing','profile','assessment')),
  description text not null default '',
  block_schema jsonb not null default '{}'::jsonb,
  preview_asset_id uuid references public.assets(id) on delete set null,
  is_system boolean not null default false,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_goals_user_status_idx on public.learning_goals(user_id,status);
create index if not exists learning_notes_book_user_idx on public.learning_notes(book_id,user_id);
create index if not exists flashcards_due_idx on public.flashcards(user_id,next_review_at);
create index if not exists study_sessions_user_started_idx on public.study_sessions(user_id,started_at desc);
create index if not exists knowledge_sources_org_type_idx on public.knowledge_sources(organization_id,source_type);
create index if not exists reusable_blocks_org_category_idx on public.reusable_blocks(organization_id,category);

alter table public.smart_core_settings enable row level security;
alter table public.learning_goals enable row level security;
alter table public.learning_notes enable row level security;
alter table public.flashcards enable row level security;
alter table public.study_sessions enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.reusable_blocks enable row level security;

create policy "smart settings org read" on public.smart_core_settings for select using (public.is_org_member(organization_id));
create policy "smart settings admin write" on public.smart_core_settings for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy "learning goals own" on public.learning_goals for all using (user_id=auth.uid() and public.is_org_member(organization_id)) with check (user_id=auth.uid() and public.is_org_member(organization_id));
create policy "learning notes own" on public.learning_notes for all using (user_id=auth.uid() and public.is_org_member(organization_id)) with check (user_id=auth.uid() and public.is_org_member(organization_id));
create policy "flashcards own" on public.flashcards for all using (user_id=auth.uid() and public.is_org_member(organization_id)) with check (user_id=auth.uid() and public.is_org_member(organization_id));
create policy "study sessions own" on public.study_sessions for all using (user_id=auth.uid() and public.is_org_member(organization_id)) with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "knowledge sources org read" on public.knowledge_sources for select using (public.is_org_member(organization_id));
create policy "knowledge sources editor write" on public.knowledge_sources for all using (public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[]));

create policy "blocks visible" on public.reusable_blocks for select using (is_system or public.is_org_member(organization_id));
create policy "blocks editor write" on public.reusable_blocks for all using (organization_id is not null and public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[])) with check (organization_id is not null and public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[]));

create or replace function public.review_flashcard(p_card_id uuid, p_remembered boolean)
returns public.flashcards
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_card public.flashcards;
  v_interval integer;
begin
  select * into v_card from public.flashcards where id=p_card_id and user_id=auth.uid() for update;
  if v_card.id is null then raise exception 'FLASHCARD_NOT_FOUND'; end if;
  v_interval := case when p_remembered then least(60,greatest(1,round(v_card.interval_days*2.2)::integer)) else 1 end;
  update public.flashcards set
    review_count=review_count+1,
    correct_count=correct_count+case when p_remembered then 1 else 0 end,
    difficulty=case when p_remembered then greatest(1,difficulty-1) else least(5,difficulty+1) end,
    interval_days=v_interval,
    next_review_at=now()+(v_interval||' days')::interval,
    updated_at=now()
  where id=p_card_id returning * into v_card;
  return v_card;
end;
$$;

comment on table public.smart_core_settings is 'H2OBOOK V4 settings. AI remains optional and disabled by default.';
comment on table public.flashcards is 'Offline-first spaced repetition cards; no model API is required.';
comment on table public.reusable_blocks is 'Reusable content blocks inspired by professional authoring systems.';

commit;
