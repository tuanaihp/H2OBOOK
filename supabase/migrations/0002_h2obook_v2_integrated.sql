-- H2OBOOK V2 integrated migration
-- Extends V1 in-place. Run after 0001_h2obook_core.sql.

begin;

alter table public.books add column if not exists slug text;
alter table public.books add column if not exists subtitle text;
alter table public.books add column if not exists category text default 'Chưa phân loại';
alter table public.books add column if not exists tags text[] default '{}';
alter table public.books add column if not exists price numeric(14,2) default 0;
alter table public.books add column if not exists visibility text default 'workspace' check (visibility in ('private','workspace','public'));
alter table public.books add column if not exists reading_minutes integer default 0;
alter table public.books add column if not exists version_number integer default 1;
alter table public.books add column if not exists brand_profile_id uuid references public.brand_profiles(id) on delete set null;
alter table public.books add column if not exists published_at timestamptz;
alter table public.books add column if not exists archived_at timestamptz;
create unique index if not exists books_org_slug_unique on public.books(organization_id,slug) where slug is not null and archived_at is null;

alter table public.book_pages add column if not exists page_type text default 'blank';
alter table public.book_pages add column if not exists chapter text;
alter table public.book_pages add column if not exists presenter_notes text;
alter table public.book_pages add column if not exists hidden boolean default false;
alter table public.book_pages add column if not exists master_page_id uuid references public.book_pages(id) on delete set null;

alter table public.page_elements add column if not exists source_element_id uuid references public.page_elements(id) on delete set null;
alter table public.page_elements add column if not exists source_revision integer default 0;
alter table public.page_elements add column if not exists local_revision integer default 0;
alter table public.page_elements add column if not exists hidden boolean default false;

create table if not exists public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  source_book_version_id uuid references public.book_versions(id) on delete set null,
  version_number integer not null,
  release_note text,
  status text not null default 'draft' check (status in ('draft','published','retired')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(template_id,version_number)
);

create table if not exists public.template_bindings (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.template_versions(id) on delete cascade,
  page_element_id uuid not null references public.page_elements(id) on delete cascade,
  variable_key text not null,
  binding_type text not null default 'value',
  fallback_value text,
  required boolean not null default false,
  created_at timestamptz not null default now(),
  unique(template_version_id,page_element_id,variable_key)
);

create table if not exists public.template_element_permissions (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.template_versions(id) on delete cascade,
  page_element_id uuid not null references public.page_elements(id) on delete cascade,
  can_edit_content boolean not null default true,
  can_replace_asset boolean not null default true,
  can_change_color boolean not null default true,
  can_change_font boolean not null default true,
  can_move boolean not null default true,
  can_resize boolean not null default true,
  can_rotate boolean not null default true,
  can_delete boolean not null default true,
  created_at timestamptz not null default now(),
  unique(template_version_id,page_element_id)
);

alter table public.book_clones add column if not exists clone_mode text default 'linked' check (clone_mode in ('linked','independent'));
alter table public.book_clones add column if not exists source_version integer default 1;
alter table public.book_clones add column if not exists current_template_version integer default 1;
alter table public.book_clones add column if not exists sync_status text default 'synced' check (sync_status in ('synced','update_available','conflict','syncing','failed'));
alter table public.book_clones add column if not exists last_synced_at timestamptz;
alter table public.book_clones add column if not exists partner_name text;

create table if not exists public.clone_sync_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_clone_id uuid not null references public.book_clones(id) on delete cascade,
  from_template_version integer not null,
  to_template_version integer not null,
  status text not null default 'queued' check (status in ('queued','preview','applying','completed','failed','rolled_back')),
  conflict_count integer not null default 0,
  change_summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.clone_conflicts (
  id uuid primary key default gen_random_uuid(),
  clone_sync_event_id uuid not null references public.clone_sync_events(id) on delete cascade,
  source_page_id uuid references public.book_pages(id) on delete set null,
  source_element_id uuid references public.page_elements(id) on delete set null,
  target_page_id uuid references public.book_pages(id) on delete set null,
  target_element_id uuid references public.page_elements(id) on delete set null,
  conflict_type text not null,
  source_value jsonb,
  target_value jsonb,
  resolution text check (resolution in ('use_source','keep_target','manual','skip')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  page_id uuid not null references public.book_pages(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique(publication_id,user_id,page_id)
);

create table if not exists public.libraries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'active' check (status in ('active','hidden','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,slug)
);

create table if not exists public.library_publications (
  library_id uuid not null references public.libraries(id) on delete cascade,
  publication_id uuid not null references public.publications(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(library_id,publication_id)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  start_date date,
  end_date date,
  status text not null default 'upcoming' check (status in ('upcoming','active','completed','archived')),
  color text default '#6f1d46',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code)
);

create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'student' check (role in ('teacher','assistant','student')),
  status text not null default 'active' check (status in ('invited','active','paused','completed','removed')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique(class_id,user_id)
);

create table if not exists public.class_books (
  class_id uuid not null references public.classes(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  publication_id uuid references public.publications(id) on delete set null,
  required boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(class_id,book_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  page_id uuid references public.book_pages(id) on delete set null,
  title text not null,
  instructions text,
  due_at timestamptz,
  max_score numeric(8,2) not null default 100,
  status text not null default 'draft' check (status in ('draft','published','closed','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  asset_ids uuid[] not null default '{}',
  score numeric(8,2),
  feedback text,
  status text not null default 'draft' check (status in ('draft','submitted','late','graded','returned')),
  submitted_at timestamptz,
  graded_by uuid references public.profiles(id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(assignment_id,student_id)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_name text,
  title text not null,
  passing_score numeric(5,2) not null default 70,
  time_limit_minutes integer not null default 15,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_type text not null check (question_type in ('single','multiple','true_false','short_text')),
  content text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answers jsonb not null default '[]'::jsonb,
  explanation text,
  score numeric(8,2) not null default 1,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score numeric(8,2),
  passed boolean,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_type text not null check (product_type in ('book','template','membership','bundle')),
  reference_id uuid,
  name text not null,
  slug text not null,
  description text,
  cover_asset_id uuid references public.assets(id) on delete set null,
  price numeric(14,2) not null default 0,
  compare_at_price numeric(14,2),
  currency text not null default 'VND',
  billing_interval text check (billing_interval in ('month','year')),
  status text not null default 'draft' check (status in ('draft','active','hidden','archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,slug)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_code text not null unique,
  buyer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  currency text not null default 'VND',
  payment_method text,
  payment_provider text,
  provider_transaction_id text,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded','cancelled')),
  order_status text not null default 'created' check (order_status in ('created','processing','fulfilled','cancelled','refunded')),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null,
  total numeric(14,2) not null,
  entitlement_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  plan_name text not null,
  price numeric(14,2) not null default 0,
  currency text not null default 'VND',
  billing_interval text not null check (billing_interval in ('month','year')),
  status text not null default 'trial' check (status in ('trial','active','past_due','cancelled','expired')),
  starts_at timestamptz not null default now(),
  renews_at timestamptz,
  expires_at timestamptz,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null default 'system',
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  anonymous_id text,
  event_name text not null,
  resource_type text,
  resource_id uuid,
  session_id text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists template_versions_template_idx on public.template_versions(template_id,version_number desc);
create index if not exists clone_sync_events_clone_idx on public.clone_sync_events(book_clone_id,created_at desc);
create index if not exists class_members_user_idx on public.class_members(user_id,status);
create index if not exists assignments_class_idx on public.assignments(class_id,due_at);
create index if not exists submissions_student_idx on public.assignment_submissions(student_id,status);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts(user_id,started_at desc);
create index if not exists orders_org_created_idx on public.orders(organization_id,created_at desc);
create index if not exists orders_payment_status_idx on public.orders(payment_status);
create index if not exists memberships_user_status_idx on public.memberships(user_id,status);
create index if not exists notifications_user_read_idx on public.notifications(user_id,read_at,created_at desc);
create index if not exists analytics_org_event_time_idx on public.analytics_events(organization_id,event_name,occurred_at desc);

alter table public.template_versions enable row level security;
alter table public.template_bindings enable row level security;
alter table public.template_element_permissions enable row level security;
alter table public.clone_sync_events enable row level security;
alter table public.clone_conflicts enable row level security;
alter table public.bookmarks enable row level security;
alter table public.libraries enable row level security;
alter table public.library_publications enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_books enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.memberships enable row level security;
alter table public.notifications enable row level security;
alter table public.analytics_events enable row level security;

create policy "template versions visible" on public.template_versions for select using (
  exists(select 1 from public.templates t where t.id=template_id and (t.visibility='marketplace' or public.is_org_member(t.organization_id)))
);
create policy "template versions editor write" on public.template_versions for all using (
  exists(select 1 from public.templates t where t.id=template_id and public.has_org_role(t.organization_id,array['owner','admin','designer']::public.member_role[]))
) with check (
  exists(select 1 from public.templates t where t.id=template_id and public.has_org_role(t.organization_id,array['owner','admin','designer']::public.member_role[]))
);
create policy "template bindings visible" on public.template_bindings for select using (
  exists(select 1 from public.template_versions tv join public.templates t on t.id=tv.template_id where tv.id=template_version_id and (t.visibility='marketplace' or public.is_org_member(t.organization_id)))
);
create policy "template bindings editor write" on public.template_bindings for all using (
  exists(select 1 from public.template_versions tv join public.templates t on t.id=tv.template_id where tv.id=template_version_id and public.has_org_role(t.organization_id,array['owner','admin','designer']::public.member_role[]))
) with check (
  exists(select 1 from public.template_versions tv join public.templates t on t.id=tv.template_id where tv.id=template_version_id and public.has_org_role(t.organization_id,array['owner','admin','designer']::public.member_role[]))
);
create policy "template permissions visible" on public.template_element_permissions for select using (
  exists(select 1 from public.template_versions tv join public.templates t on t.id=tv.template_id where tv.id=template_version_id and (t.visibility='marketplace' or public.is_org_member(t.organization_id)))
);
create policy "template permissions editor write" on public.template_element_permissions for all using (
  exists(select 1 from public.template_versions tv join public.templates t on t.id=tv.template_id where tv.id=template_version_id and public.has_org_role(t.organization_id,array['owner','admin','designer']::public.member_role[]))
) with check (
  exists(select 1 from public.template_versions tv join public.templates t on t.id=tv.template_id where tv.id=template_version_id and public.has_org_role(t.organization_id,array['owner','admin','designer']::public.member_role[]))
);
create policy "clone sync org read" on public.clone_sync_events for select using (public.is_org_member(organization_id));
create policy "clone sync editor write" on public.clone_sync_events for all using (public.has_org_role(organization_id,array['owner','admin','designer','partner']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','designer','partner']::public.member_role[]));
create policy "clone conflicts via event" on public.clone_conflicts for all using (
  exists(select 1 from public.clone_sync_events e where e.id=clone_sync_event_id and public.has_org_role(e.organization_id,array['owner','admin','designer','partner']::public.member_role[]))
) with check (
  exists(select 1 from public.clone_sync_events e where e.id=clone_sync_event_id and public.has_org_role(e.organization_id,array['owner','admin','designer','partner']::public.member_role[]))
);
create policy "bookmarks self" on public.bookmarks for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "libraries org read" on public.libraries for select using (public.is_org_member(organization_id));
create policy "libraries admin write" on public.libraries for all using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "library publications via library" on public.library_publications for all using (exists(select 1 from public.libraries l where l.id=library_id and public.is_org_member(l.organization_id))) with check (exists(select 1 from public.libraries l where l.id=library_id and public.has_org_role(l.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "classes org read" on public.classes for select using (public.is_org_member(organization_id) or exists(select 1 from public.class_members cm where cm.class_id=id and cm.user_id=auth.uid() and cm.status in ('active','completed')));
create policy "classes teacher write" on public.classes for all using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "class members scoped read" on public.class_members for select using (user_id=auth.uid() or exists(select 1 from public.classes c where c.id=class_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "class members teacher write" on public.class_members for all using (exists(select 1 from public.classes c where c.id=class_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[]))) with check (exists(select 1 from public.classes c where c.id=class_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "class books scoped" on public.class_books for select using (exists(select 1 from public.classes c where c.id=class_id and (public.is_org_member(c.organization_id) or exists(select 1 from public.class_members cm where cm.class_id=c.id and cm.user_id=auth.uid() and cm.status='active'))));
create policy "class books teacher write" on public.class_books for all using (exists(select 1 from public.classes c where c.id=class_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[]))) with check (exists(select 1 from public.classes c where c.id=class_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "assignments class read" on public.assignments for select using (public.is_org_member(organization_id) or exists(select 1 from public.class_members cm where cm.class_id=class_id and cm.user_id=auth.uid() and cm.status='active'));
create policy "assignments teacher write" on public.assignments for all using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "submissions student read" on public.assignment_submissions for select using (student_id=auth.uid() or exists(select 1 from public.assignments a where a.id=assignment_id and public.has_org_role(a.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "submissions student insert" on public.assignment_submissions for insert with check (student_id=auth.uid());
create policy "submissions teacher update" on public.assignment_submissions for update using (student_id=auth.uid() or exists(select 1 from public.assignments a where a.id=assignment_id and public.has_org_role(a.organization_id,array['owner','admin','teacher']::public.member_role[]))) with check (student_id=auth.uid() or exists(select 1 from public.assignments a where a.id=assignment_id and public.has_org_role(a.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "quizzes scoped read" on public.quizzes for select using (public.is_org_member(organization_id) or exists(select 1 from public.entitlements e where e.user_id=auth.uid() and e.resource_type='book' and e.resource_id=book_id and e.status='active'));
create policy "quizzes teacher write" on public.quizzes for all using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "quiz questions via quiz" on public.quiz_questions for select using (exists(select 1 from public.quizzes q where q.id=quiz_id and (public.is_org_member(q.organization_id) or exists(select 1 from public.entitlements e where e.user_id=auth.uid() and e.resource_type='book' and e.resource_id=q.book_id and e.status='active'))));
create policy "quiz questions teacher write" on public.quiz_questions for all using (exists(select 1 from public.quizzes q where q.id=quiz_id and public.has_org_role(q.organization_id,array['owner','admin','teacher']::public.member_role[]))) with check (exists(select 1 from public.quizzes q where q.id=quiz_id and public.has_org_role(q.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "quiz attempts self" on public.quiz_attempts for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "products public read" on public.products for select using (status='active' or public.is_org_member(organization_id));
create policy "products admin write" on public.products for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "orders buyer or admin read" on public.orders for select using (buyer_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "orders admin write" on public.orders for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "order items via order" on public.order_items for select using (exists(select 1 from public.orders o where o.id=order_id and (o.buyer_id=auth.uid() or public.has_org_role(o.organization_id,array['owner','admin']::public.member_role[]))));
create policy "order items admin write" on public.order_items for all using (exists(select 1 from public.orders o where o.id=order_id and public.has_org_role(o.organization_id,array['owner','admin']::public.member_role[]))) with check (exists(select 1 from public.orders o where o.id=order_id and public.has_org_role(o.organization_id,array['owner','admin']::public.member_role[])));
create policy "memberships self or admin read" on public.memberships for select using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "memberships admin write" on public.memberships for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "notifications self" on public.notifications for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "analytics insert" on public.analytics_events for insert with check (organization_id is null or public.is_org_member(organization_id) or auth.uid() is null);
create policy "analytics admin read" on public.analytics_events for select using (organization_id is not null and public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create or replace function public.mark_order_paid(p_order_id uuid, p_transaction_id text default null)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_expiry timestamptz;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status='paid' then return; end if;
  update public.orders set payment_status='paid',order_status='fulfilled',provider_transaction_id=coalesce(p_transaction_id,provider_transaction_id),paid_at=now(),updated_at=now() where id=p_order_id;
  if v_order.buyer_id is null then return; end if;
  for v_item in select oi.*,p.product_type,p.reference_id,p.billing_interval from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=p_order_id loop
    v_expiry := case when v_item.billing_interval='month' then now()+interval '1 month' when v_item.billing_interval='year' then now()+interval '1 year' else null end;
    insert into public.entitlements(user_id,organization_id,resource_type,resource_id,permission,source_type,source_id,starts_at,expires_at,status)
    values(v_order.buyer_id,v_order.organization_id,v_item.product_type,v_item.reference_id,'access','order',p_order_id,now(),v_expiry,'active')
    on conflict do nothing;
  end loop;
end;
$$;

commit;
