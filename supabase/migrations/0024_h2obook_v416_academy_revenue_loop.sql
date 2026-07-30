-- H2OBOOK V4.16 Academy revenue loop
-- Public application -> admin approval -> Auth invite -> entitlement -> lesson progress.
begin;

alter table public.profiles add column if not exists email text;
create unique index if not exists profiles_email_unique on public.profiles(lower(email)) where email is not null;

alter table public.products drop constraint if exists products_product_type_check;
alter table public.products add constraint products_product_type_check
  check (product_type in ('book','template','course','membership','bundle'));

create table if not exists public.academy_courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  category text not null default '',
  level text not null default '',
  duration_label text not null default '',
  format text not null default 'Online',
  price numeric(14,2) not null default 0,
  currency text not null default 'VND',
  accent text not null default '',
  outcomes text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','active','hidden','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,slug)
);

create table if not exists public.academy_course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id,slug)
);

create table if not exists public.academy_course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.academy_course_modules(id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  video_provider text not null default 'cloudflare_stream' check (video_provider in ('cloudflare_stream','direct','embed','none')),
  video_playback_id text,
  video_url text,
  transcript_asset_id uuid references public.assets(id) on delete set null,
  content jsonb not null default '{}'::jsonb,
  skill_keys text[] not null default '{}',
  is_preview boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(module_id,slug)
);

create table if not exists public.academy_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_type text not null check (target_type in ('course','membership')),
  target_slug text not null,
  target_name text not null,
  name text not null,
  email text not null check (email=lower(email)),
  phone text,
  message text,
  status text not null default 'new' check (status in ('new','approved','invited','converted','rejected')),
  source text not null default 'academy_public',
  utm jsonb not null default '{}'::jsonb,
  consent jsonb not null default '{}'::jsonb,
  auth_user_id uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.academy_course_lessons(id) on delete cascade,
  completed boolean not null default false,
  watch_seconds integer not null default 0 check (watch_seconds >= 0),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  started_at timestamptz not null default now(),
  last_watched_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,lesson_id)
);

create table if not exists public.academy_skill_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  skill_key text not null,
  progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100),
  evidence_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id,course_id,skill_key)
);

create table if not exists public.transactional_email_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  recipient text not null,
  template_key text not null,
  dedupe_key text not null,
  provider text,
  provider_message_id text,
  status text not null default 'sent' check (status in ('sent','failed','skipped')),
  error_message text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(template_key,dedupe_key)
);

create index if not exists academy_applications_org_status_idx on public.academy_applications(organization_id,status,created_at desc);
create index if not exists academy_applications_email_idx on public.academy_applications(lower(email),created_at desc);
create unique index if not exists academy_applications_open_unique on public.academy_applications(organization_id,lower(email),target_type,target_slug)
  where status in ('new','approved','invited');
create index if not exists academy_modules_course_position_idx on public.academy_course_modules(course_id,position);
create index if not exists academy_lessons_module_position_idx on public.academy_course_lessons(module_id,position);
create index if not exists academy_progress_user_recent_idx on public.academy_lesson_progress(user_id,last_watched_at desc);
create index if not exists academy_skill_user_idx on public.academy_skill_progress(user_id,updated_at desc);
create index if not exists transactional_email_recipient_idx on public.transactional_email_log(recipient,sent_at desc);

alter table public.academy_courses enable row level security;
alter table public.academy_course_modules enable row level security;
alter table public.academy_course_lessons enable row level security;
alter table public.academy_applications enable row level security;
alter table public.academy_lesson_progress enable row level security;
alter table public.academy_skill_progress enable row level security;
alter table public.transactional_email_log enable row level security;

create policy "academy courses public read" on public.academy_courses for select
  using (status='active' or public.is_org_member(organization_id));
create policy "academy courses admin write" on public.academy_courses for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "academy modules public read" on public.academy_course_modules for select
  using (status='published' or exists(select 1 from public.academy_courses c where c.id=course_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "academy modules admin write" on public.academy_course_modules for all
  using (exists(select 1 from public.academy_courses c where c.id=course_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])))
  with check (exists(select 1 from public.academy_courses c where c.id=course_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "academy lessons entitled read" on public.academy_course_lessons for select using (
  is_preview or exists(
    select 1 from public.academy_course_modules m join public.academy_courses c on c.id=m.course_id
    where m.id=module_id and (
      public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[]) or
      exists(select 1 from public.entitlements e where e.user_id=auth.uid() and e.organization_id=c.organization_id and e.status='active' and (e.expires_at is null or e.expires_at>now()) and ((e.resource_type='course' and e.resource_id=c.id) or e.resource_type='membership'))
    )
  )
);
create policy "academy lessons admin write" on public.academy_course_lessons for all
  using (exists(select 1 from public.academy_course_modules m join public.academy_courses c on c.id=m.course_id where m.id=module_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])))
  with check (exists(select 1 from public.academy_course_modules m join public.academy_courses c on c.id=m.course_id where m.id=module_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "academy applications admin read" on public.academy_applications for select
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "academy applications admin manage" on public.academy_applications for all
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "academy progress self read" on public.academy_lesson_progress for select
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "academy progress self write" on public.academy_lesson_progress for all
  using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "academy skill self read" on public.academy_skill_progress for select
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "academy skill self write" on public.academy_skill_progress for all
  using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "transactional email admin read" on public.transactional_email_log for select
  using (organization_id is not null and public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create or replace function public.refresh_academy_skill_progress()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_user_id uuid;
  v_lesson_id uuid;
  v_org_id uuid;
  v_course_id uuid;
  v_skill text;
  v_total integer;
  v_completed integer;
begin
  if tg_op='DELETE' then
    v_user_id := old.user_id;
    v_lesson_id := old.lesson_id;
  else
    v_user_id := new.user_id;
    v_lesson_id := new.lesson_id;
  end if;
  select c.organization_id,c.id into v_org_id,v_course_id
  from public.academy_course_lessons l
  join public.academy_course_modules m on m.id=l.module_id
  join public.academy_courses c on c.id=m.course_id
  where l.id=v_lesson_id;
  if v_course_id is null then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  for v_skill in select distinct unnest(l.skill_keys) from public.academy_course_lessons l where l.id=v_lesson_id loop
    select count(*) into v_total from public.academy_course_lessons l
      join public.academy_course_modules m on m.id=l.module_id
      where m.course_id=v_course_id and v_skill=any(l.skill_keys) and l.status='published';
    select count(*) into v_completed from public.academy_lesson_progress p
      join public.academy_course_lessons l on l.id=p.lesson_id
      join public.academy_course_modules m on m.id=l.module_id
      where p.user_id=v_user_id and p.completed and m.course_id=v_course_id and v_skill=any(l.skill_keys);
    insert into public.academy_skill_progress(organization_id,user_id,course_id,skill_key,progress_percent,evidence_count,updated_at)
      values(v_org_id,v_user_id,v_course_id,v_skill,case when v_total=0 then 0 else round(v_completed::numeric*100/v_total,2) end,v_completed,now())
      on conflict(user_id,course_id,skill_key) do update set progress_percent=excluded.progress_percent,evidence_count=excluded.evidence_count,updated_at=now();
  end loop;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists refresh_academy_skill_progress_trigger on public.academy_lesson_progress;
create trigger refresh_academy_skill_progress_trigger
after insert or update of completed or delete on public.academy_lesson_progress
for each row execute function public.refresh_academy_skill_progress();

-- Keep profile email in sync so reminders and CRM joins never need direct auth schema access.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_org_id uuid;
  v_name text;
  v_slug text;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name','')), '');
  insert into public.profiles(id,email,full_name,avatar_url)
  values(new.id,lower(new.email),coalesce(v_name,''),new.raw_user_meta_data->>'avatar_url')
  on conflict(id) do update set email=excluded.email,full_name=excluded.full_name,avatar_url=excluded.avatar_url,updated_at=now();
  if coalesce(new.raw_user_meta_data->>'role','owner')='owner' and not exists(select 1 from public.organization_members where user_id=new.id) then
    v_slug := trim(both '-' from regexp_replace(lower(coalesce(v_name,split_part(new.email,'@',1),'h2obook')), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(new.id::text,'-',''),1,8);
    insert into public.organizations(name,slug,owner_id) values(coalesce(v_name,'H2OBOOK Workspace'),v_slug,new.id) returning id into v_org_id;
    insert into public.organization_members(organization_id,user_id,role,status) values(v_org_id,new.id,'owner','active');
  end if;
  return new;
end;
$$;

update public.profiles p set email=lower(u.email) from auth.users u where u.id=p.id and p.email is null;

commit;
