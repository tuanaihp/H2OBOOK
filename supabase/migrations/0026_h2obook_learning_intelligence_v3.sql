-- H2OBOOK Learning Intelligence V3 — Brain Learning Engine (adapter migration)
-- Source module: v5/8-h2obook-learning-intelligence-v3-final. This is an ADDITIVE, adapted
-- migration (Case C in the module's own CLAUDE_MAIN_INTEGRATION_PROMPT.md): it does NOT reuse
-- CONSOLIDATED_SCHEMA_V3.sql wholesale, because this repository already has an equivalent
-- Learning Commerce base (products/orders/order_items/memberships/entitlements from
-- 0002_h2obook_v2_integrated.sql, and academy_courses/academy_course_modules/
-- academy_course_lessons from 0024_h2obook_v416_academy_revenue_loop.sql). Only the genuinely
-- new "Brain Learning" layer (Knowledge Space authoring, Brain Map, Experience Vault, grading,
-- Journal, Result/Share, Brain Assistant search) is added here, wired to the existing schema:
--   ContentItem (V3 concept)  -> public.academy_course_lessons (existing)
--   Roadmap/Product/Membership/Entitlement (V3 concept) -> already implemented, reused as-is
-- pgvector/embedding is deferred (see knowledge_chunks below); keyword search_text ships now.
begin;

create type public.knowledge_space_type as enum (
  'video_course','interactive_checklist','digital_textbook','resource_vault','practice_lab',
  'case_library','tool_workspace','live_program','assessment','coaching_space'
);
create type public.knowledge_space_version_status as enum (
  'draft','review','scheduled','published','superseded','archived'
);
create type public.learning_block_type as enum (
  'mission_brief','rich_text','video','image','gallery','audio','download','expert_insight',
  'warning','flashcards','process','timeline','knowledge_map','case_study','before_after',
  'checklist','quiz','assignment','reflection','tool_embed','result','share_card'
);
create type public.learning_block_visibility as enum ('all_entitled','preview','instructor','admin');
create type public.completion_condition_type as enum (
  'view_block','watch_video_percent','complete_checklist_percent','pass_quiz','submit_assignment','receive_grade','manual'
);
create type public.experience_visibility as enum ('private','instructor','class','community');
create type public.experience_moderation_status as enum ('draft','submitted','approved','rejected');
create type public.submission_status as enum ('draft','submitted','in_review','revision_requested','graded');
create type public.journal_entry_type as enum ('note','bookmark','reflection','experience','result','question');
create type public.share_channel as enum ('facebook','copy','download','portfolio','public_link');

-- ---------------------------------------------------------------------------
-- Knowledge Space authoring
-- ---------------------------------------------------------------------------

create table public.knowledge_spaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.academy_course_lessons(id) on delete cascade,
  code text not null,
  slug text not null,
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  space_type public.knowledge_space_type not null default 'digital_textbook',
  difficulty text not null default 'beginner' check (difficulty in ('beginner','intermediate','advanced','professional')),
  status public.book_status not null default 'draft',
  active_version_id uuid,
  template_id uuid,
  instructor_name text not null default '',
  estimated_minutes integer not null default 0,
  thumbnail_asset_id uuid references public.assets(id) on delete set null,
  hero_style text not null default 'brain' check (hero_style in ('brain','editorial','studio','minimal')),
  assistant_enabled boolean not null default true,
  community_enabled boolean not null default false,
  certificate_enabled boolean not null default false,
  sharing_enabled boolean not null default true,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,slug),
  unique(organization_id,code),
  unique(content_item_id)
);

create table public.knowledge_space_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  version_number integer not null,
  status public.knowledge_space_version_status not null default 'draft',
  title text not null default '',
  changelog text not null default '',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(knowledge_space_id,version_number)
);

alter table public.knowledge_spaces
  add constraint knowledge_spaces_active_version_fk
  foreign key (active_version_id) references public.knowledge_space_versions(id) on delete set null;

create table public.learning_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  icon text not null default '',
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  section_id uuid not null references public.learning_sections(id) on delete cascade,
  block_type public.learning_block_type not null,
  title text not null default '',
  position integer not null default 0,
  visibility public.learning_block_visibility not null default 'all_entitled',
  required boolean not null default true,
  estimated_minutes integer not null default 0,
  completion_weight numeric(6,2) not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  title text not null,
  description text not null default '',
  icon text not null default '',
  position_x numeric(10,3) not null default 0,
  position_y numeric(10,3) not null default 0,
  linked_section_ids uuid[] not null default '{}',
  prerequisite_node_ids uuid[] not null default '{}',
  mastery_weight numeric(6,2) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  source_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  target_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  label text not null default '',
  created_at timestamptz not null default now()
);

create table public.completion_conditions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  condition_type public.completion_condition_type not null,
  target_id uuid,
  threshold numeric(6,2),
  required boolean not null default true,
  label text not null default '',
  created_at timestamptz not null default now()
);

create table public.brain_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  description text not null default '',
  space_type public.knowledge_space_type not null default 'digital_textbook',
  default_blocks jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('draft','published','archived','active')),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code)
);

alter table public.knowledge_spaces
  add constraint knowledge_spaces_template_fk
  foreign key (template_id) references public.brain_templates(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Experience Vault, assignments and grading
-- ---------------------------------------------------------------------------

create table public.experience_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  summary text not null default '',
  knowledge_space_ids uuid[] not null default '{}',
  author_type text not null check (author_type in ('instructor','student','staff')),
  author_id uuid not null references public.profiles(id) on delete cascade,
  visibility public.experience_visibility not null default 'private',
  moderation_status public.experience_moderation_status not null default 'draft',
  context text not null default '',
  challenge text not null default '',
  customer_request text not null default '',
  analysis text not null default '',
  solution text not null default '',
  products_used text[] not null default '{}',
  mistakes text[] not null default '{}',
  lessons_learned text[] not null default '{}',
  before_asset_id uuid references public.assets(id) on delete set null,
  after_asset_id uuid references public.assets(id) on delete set null,
  video_asset_id uuid references public.assets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code)
);

create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rubric_id uuid not null references public.rubrics(id) on delete cascade,
  title text not null,
  description text not null default '',
  max_score numeric(6,2) not null default 10,
  position integer not null default 0
);

create table public.assignment_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  block_id uuid references public.learning_blocks(id) on delete set null,
  title text not null,
  instructions text not null default '',
  submission_types text[] not null default '{text}',
  max_score numeric(6,2) not null default 100,
  passing_score numeric(6,2) not null default 70,
  rubric_id uuid references public.rubrics(id) on delete set null,
  allow_resubmission boolean not null default true,
  peer_sharing_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id uuid not null references public.assignment_definitions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.submission_status not null default 'draft',
  text_response text not null default '',
  asset_ids uuid[] not null default '{}',
  score numeric(6,2),
  instructor_feedback text,
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assignment_submissions_grading_idx on public.assignment_submissions(organization_id,status,submitted_at);

-- ---------------------------------------------------------------------------
-- Learner space: progress, notes, experiences, results, sharing, journal
-- ---------------------------------------------------------------------------

create table public.block_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  block_id uuid not null references public.learning_blocks(id) on delete cascade,
  percent numeric(5,2) not null default 0 check (percent between 0 and 100),
  completed_at timestamptz,
  last_position_seconds integer,
  response jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(user_id,block_id)
);

create table public.knowledge_space_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  percent numeric(5,2) not null default 0 check (percent between 0 and 100),
  mastery_percent numeric(5,2) not null default 0,
  practice_percent numeric(5,2) not null default 0,
  confidence_percent numeric(5,2) not null default 0,
  status text not null default 'not_started' check (status in ('not_started','in_progress','waiting_feedback','completed','needs_review')),
  last_block_id uuid references public.learning_blocks(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id,knowledge_space_id)
);

create table public.learner_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  block_id uuid references public.learning_blocks(id) on delete set null,
  lesson_timestamp_seconds integer,
  title text not null default '',
  body text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learner_experiences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  title text not null,
  performed_at timestamptz not null default now(),
  subject_profile text not null default '',
  condition_analysis text not null default '',
  desired_outcome text not null default '',
  steps_taken text not null default '',
  products_used text[] not null default '{}',
  challenges text not null default '',
  solution text not null default '',
  learning text not null default '',
  next_improvement text not null default '',
  asset_ids uuid[] not null default '{}',
  visibility public.experience_visibility not null default 'private',
  moderation_status public.experience_moderation_status not null default 'draft',
  instructor_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  title text not null,
  summary text not null default '',
  skill_names text[] not null default '{}',
  score numeric(6,2),
  mastery_percent numeric(5,2) not null default 0,
  practice_percent numeric(5,2) not null default 0,
  confidence_percent numeric(5,2) not null default 0,
  instructor_comment text,
  evidence_asset_ids uuid[] not null default '{}',
  badge_code text,
  certificate_code text,
  issued_at timestamptz not null default now()
);

create table public.share_card_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  aspect_ratio text not null default '1:1' check (aspect_ratio in ('1:1','4:5','16:9')),
  brand_theme text not null default 'default',
  background_style text not null default 'gradient',
  show_logo boolean not null default true,
  show_verification_code boolean not null default true,
  default_caption text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.shared_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  result_id uuid not null references public.learning_results(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid references public.share_card_templates(id) on delete set null,
  channel public.share_channel not null default 'copy',
  public_slug text unique,
  caption text not null default '',
  generated_asset_id uuid references public.assets(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  entry_type public.journal_entry_type not null default 'note',
  source_id uuid,
  title text not null default '',
  body text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Brain Assistant search index — keyword tier ships now; embedding is deferred.
-- TODO(learning-intelligence-v3): once the Supabase project has the `vector` extension
-- confirmed available, add an `embedding vector(1536)` column + ivfflat index here and switch
-- learning_match_knowledge_chunks() to similarity search. Until then this uses to_tsvector
-- keyword search, which is fully functional and does not require any extra provider.
-- ---------------------------------------------------------------------------

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  block_id uuid references public.learning_blocks(id) on delete cascade,
  chunk_label text not null default '',
  search_text text not null,
  search_vector tsvector generated always as (to_tsvector('simple', search_text)) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index knowledge_chunks_search_idx on public.knowledge_chunks using gin(search_vector);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index knowledge_spaces_org_status_idx on public.knowledge_spaces(organization_id,status);
create index knowledge_space_versions_space_idx on public.knowledge_space_versions(knowledge_space_id,version_number desc);
create index learning_sections_version_idx on public.learning_sections(version_id,position);
create index learning_blocks_section_idx on public.learning_blocks(section_id,position);
create index knowledge_nodes_version_idx on public.knowledge_nodes(version_id);
create index knowledge_edges_version_idx on public.knowledge_edges(version_id);
create index completion_conditions_version_idx on public.completion_conditions(version_id);
create index experience_cases_org_idx on public.experience_cases(organization_id,moderation_status,visibility);
create index assignment_definitions_space_idx on public.assignment_definitions(knowledge_space_id);
create index block_progress_user_idx on public.block_progress(user_id,updated_at desc);
create index space_progress_user_idx on public.knowledge_space_progress(user_id,status);
create index learner_notes_space_idx on public.learner_notes(knowledge_space_id,user_id,created_at desc);
create index learner_experiences_space_idx on public.learner_experiences(knowledge_space_id,visibility,moderation_status);
create index learning_results_user_idx on public.learning_results(user_id,issued_at desc);
create index journal_entries_user_idx on public.journal_entries(user_id,knowledge_space_id,created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions: entitlement inherited from the existing academy lesson/course chain.
-- ---------------------------------------------------------------------------

create or replace function public.has_lesson_entitlement(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((
    select l.is_preview
      or public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])
      or exists(
        select 1 from public.entitlements e
        where e.user_id=auth.uid() and e.organization_id=c.organization_id and e.status='active'
          and (e.expires_at is null or e.expires_at>now())
          and ((e.resource_type='course' and e.resource_id=c.id) or e.resource_type='membership')
      )
    from public.academy_course_lessons l
    join public.academy_course_modules m on m.id=l.module_id
    join public.academy_courses c on c.id=m.course_id
    where l.id=p_lesson_id
  ), false);
$$;

create or replace function public.has_space_entitlement(p_space_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select public.has_lesson_entitlement(s.content_item_id) from public.knowledge_spaces s where s.id=p_space_id), false);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.knowledge_spaces enable row level security;
alter table public.knowledge_space_versions enable row level security;
alter table public.learning_sections enable row level security;
alter table public.learning_blocks enable row level security;
alter table public.knowledge_nodes enable row level security;
alter table public.knowledge_edges enable row level security;
alter table public.completion_conditions enable row level security;
alter table public.brain_templates enable row level security;
alter table public.experience_cases enable row level security;
alter table public.rubrics enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.assignment_definitions enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.block_progress enable row level security;
alter table public.knowledge_space_progress enable row level security;
alter table public.learner_notes enable row level security;
alter table public.learner_experiences enable row level security;
alter table public.learning_results enable row level security;
alter table public.share_card_templates enable row level security;
alter table public.shared_results enable row level security;
alter table public.journal_entries enable row level security;
alter table public.knowledge_chunks enable row level security;

-- Knowledge Space metadata: staff always; learners once the underlying lesson is entitled or
-- previewable. Draft-only fields stay safe because block payload is a separate table below.
create policy "knowledge spaces read" on public.knowledge_spaces for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or public.has_lesson_entitlement(content_item_id));
create policy "knowledge spaces staff write" on public.knowledge_spaces for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "space versions read" on public.knowledge_space_versions for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or (status='published' and public.has_space_entitlement(knowledge_space_id)));
create policy "space versions staff write" on public.knowledge_space_versions for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "sections read" on public.learning_sections for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or exists(select 1 from public.knowledge_space_versions v where v.id=version_id and v.status='published' and public.has_space_entitlement(v.knowledge_space_id)));
create policy "sections staff write" on public.learning_sections for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

-- Learning blocks: the actual paid payload. Guests/entitled learners only ever see
-- visibility='preview' or ('all_entitled' + entitled); instructor/admin blocks stay staff-only.
create policy "blocks read" on public.learning_blocks for select
  using (
    public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])
    or (
      visibility='preview'
      and exists(select 1 from public.learning_sections s join public.knowledge_space_versions v on v.id=s.version_id where s.id=section_id and v.status='published')
    )
    or (
      visibility='all_entitled'
      and exists(select 1 from public.learning_sections s join public.knowledge_space_versions v on v.id=s.version_id where s.id=section_id and v.status='published' and public.has_space_entitlement(v.knowledge_space_id))
    )
  );
create policy "blocks staff write" on public.learning_blocks for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "nodes read" on public.knowledge_nodes for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or exists(select 1 from public.knowledge_space_versions v where v.id=version_id and v.status='published' and public.has_space_entitlement(v.knowledge_space_id)));
create policy "nodes staff write" on public.knowledge_nodes for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "edges read" on public.knowledge_edges for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or exists(select 1 from public.knowledge_space_versions v where v.id=version_id and v.status='published' and public.has_space_entitlement(v.knowledge_space_id)));
create policy "edges staff write" on public.knowledge_edges for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "conditions read" on public.completion_conditions for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or exists(select 1 from public.knowledge_space_versions v where v.id=version_id and v.status='published' and public.has_space_entitlement(v.knowledge_space_id)));
create policy "conditions staff write" on public.completion_conditions for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "templates visible" on public.brain_templates for select
  using (is_system or (organization_id is not null and public.is_org_member(organization_id)));
create policy "templates staff write" on public.brain_templates for all
  using (organization_id is not null and public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (organization_id is not null and public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "experience cases visible" on public.experience_cases for select
  using (
    public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])
    or author_id=auth.uid()
    or (moderation_status='approved' and visibility in ('class','community'))
  );
create policy "experience cases author write" on public.experience_cases for all
  using (author_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.is_org_member(organization_id) and (author_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])));

create policy "rubrics staff" on public.rubrics for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "rubric criteria staff" on public.rubric_criteria for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "assignment defs read" on public.assignment_definitions for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or public.has_space_entitlement(knowledge_space_id));
create policy "assignment defs staff write" on public.assignment_definitions for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "submissions owner or grader read" on public.assignment_submissions for select
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "submissions owner insert" on public.assignment_submissions for insert
  with check (user_id=auth.uid() and public.is_org_member(organization_id));
create policy "submissions owner or grader update" on public.assignment_submissions for update
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "block progress self" on public.block_progress for all
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "space progress self" on public.knowledge_space_progress for all
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "notes self" on public.learner_notes for all
  using (user_id=auth.uid()) with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "learner experiences visible" on public.learner_experiences for select
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or (visibility in ('class','community') and moderation_status='approved'));
create policy "learner experiences self write" on public.learner_experiences for all
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "results self or staff" on public.learning_results for select
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "results service write" on public.learning_results for insert
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or user_id=auth.uid());

create policy "share templates visible" on public.share_card_templates for select
  using (is_system or (organization_id is not null and public.is_org_member(organization_id)));
create policy "share templates staff write" on public.share_card_templates for all
  using (organization_id is not null and public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (organization_id is not null and public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy "shared results self write" on public.shared_results for all
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "journal self" on public.journal_entries for all
  using (user_id=auth.uid()) with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "knowledge chunks read" on public.knowledge_chunks for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or public.has_space_entitlement(knowledge_space_id));
create policy "knowledge chunks staff write" on public.knowledge_chunks for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

-- Public share pages must never read block payload or private note content; only a narrow
-- SECURITY DEFINER RPC exposes shared_results, mirroring the certificate_issues pattern from
-- 0025_h2obook_operations_foundation.sql. No public SELECT policy is granted on learning_results
-- or shared_results themselves.
create or replace function public.get_public_shared_result(p_slug text)
returns table(title text, summary text, skill_names text[], mastery_percent numeric, practice_percent numeric, confidence_percent numeric, badge_code text, certificate_code text, caption text, issued_at timestamptz)
language sql stable security definer set search_path=public as $$
  select r.title, r.summary, r.skill_names, r.mastery_percent, r.practice_percent, r.confidence_percent, r.badge_code, r.certificate_code, sr.caption, r.issued_at
  from public.shared_results sr join public.learning_results r on r.id=sr.result_id
  where sr.public_slug=p_slug;
$$;
grant execute on function public.get_public_shared_result(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Publishing / versioning RPCs
-- ---------------------------------------------------------------------------

create or replace function public.learning_publish_space_version(p_version_id uuid, p_scheduled_at timestamptz default null)
returns public.knowledge_space_versions
language plpgsql security invoker set search_path=public as $$
declare
  v_version public.knowledge_space_versions;
  v_space public.knowledge_spaces;
begin
  select * into v_version from public.knowledge_space_versions where id=p_version_id for update;
  if v_version.id is null then raise exception 'VERSION_NOT_FOUND'; end if;
  select * into v_space from public.knowledge_spaces where id=v_version.knowledge_space_id for update;
  if not public.has_org_role(v_version.organization_id,array['owner','admin','teacher']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if v_version.status='published' then return v_version; end if;

  if p_scheduled_at is not null and p_scheduled_at>now() then
    update public.knowledge_space_versions set status='scheduled', scheduled_at=p_scheduled_at where id=p_version_id;
    select * into v_version from public.knowledge_space_versions where id=p_version_id;
    return v_version;
  end if;

  update public.knowledge_space_versions set status='superseded' where knowledge_space_id=v_space.id and status='published' and id<>p_version_id;
  update public.knowledge_space_versions set status='published', published_at=now() where id=p_version_id;
  update public.knowledge_spaces set active_version_id=p_version_id, status='published', updated_at=now() where id=v_space.id;

  insert into public.domain_events(organization_id,actor_id,resource_type,resource_id,event_name,payload)
  values(v_version.organization_id,auth.uid(),'knowledge_space_version',p_version_id,'learning.space_version.published',jsonb_build_object('knowledgeSpaceId',v_space.id,'versionNumber',v_version.version_number));

  select * into v_version from public.knowledge_space_versions where id=p_version_id;
  return v_version;
end;
$$;
grant execute on function public.learning_publish_space_version(uuid,timestamptz) to authenticated;

-- Service-role/cron only: publishes versions whose scheduled_at has arrived. Never call from the browser.
create or replace function public.learning_publish_due_space_versions(p_limit integer default 50)
returns setof public.knowledge_space_versions
language plpgsql security definer set search_path=public as $$
declare v_row record;
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  for v_row in
    select id from public.knowledge_space_versions
    where status='scheduled' and scheduled_at<=now()
    order by scheduled_at limit greatest(1,least(p_limit,200))
    for update skip locked
  loop
    update public.knowledge_space_versions set status='superseded'
    where knowledge_space_id=(select knowledge_space_id from public.knowledge_space_versions where id=v_row.id)
      and status='published' and id<>v_row.id;
    update public.knowledge_space_versions set status='published', published_at=now() where id=v_row.id;
    update public.knowledge_spaces s set active_version_id=v_row.id, status='published', updated_at=now()
      from public.knowledge_space_versions v where v.id=v_row.id and s.id=v.knowledge_space_id;
  end loop;
  return query select * from public.knowledge_space_versions where status='published' and published_at>=now()-interval '1 minute';
end;
$$;
revoke all on function public.learning_publish_due_space_versions(integer) from public,anon,authenticated;
grant execute on function public.learning_publish_due_space_versions(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Brain Assistant fallback search (keyword tier — always available, no AI provider required)
-- ---------------------------------------------------------------------------

create or replace function public.learning_match_knowledge_chunks(p_space_id uuid, p_query text, p_limit integer default 6)
returns table(chunk_id uuid, block_id uuid, chunk_label text, search_text text, rank real)
language sql stable security invoker set search_path=public as $$
  select c.id, c.block_id, c.chunk_label, c.search_text, ts_rank(c.search_vector, websearch_to_tsquery('simple', p_query)) as rank
  from public.knowledge_chunks c
  where c.knowledge_space_id=p_space_id
    and public.has_space_entitlement(p_space_id)
    and c.search_vector @@ websearch_to_tsquery('simple', p_query)
  order by rank desc
  limit greatest(1,least(p_limit,20));
$$;
grant execute on function public.learning_match_knowledge_chunks(uuid,text,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at triggers + domain events + realtime, reusing 0007's shared infrastructure.
-- ---------------------------------------------------------------------------

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'knowledge_spaces','knowledge_space_versions','learning_sections','learning_blocks',
    'knowledge_nodes','brain_templates','experience_cases','rubrics','assignment_definitions',
    'assignment_submissions','learner_notes','learner_experiences','journal_entries'
  ] loop
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'knowledge_spaces','knowledge_space_versions','assignment_submissions','learning_results',
    'experience_cases'
  ] loop
    execute format('create trigger %I_domain_event after insert or update or delete on public.%I for each row execute function public.capture_domain_event()', table_name, table_name);
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

commit;
