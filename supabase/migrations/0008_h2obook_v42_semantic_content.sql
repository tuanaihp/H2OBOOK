-- H2OBOOK 4.2 Semantic Content & Asset Architecture

create table if not exists public.book_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null unique references public.books(id) on delete cascade,
  title text not null,
  language text not null default 'vi',
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.book_documents(id) on delete cascade,
  parent_id uuid references public.content_nodes(id) on delete cascade,
  node_type text not null check (node_type in ('chapter','section','heading','paragraph','list','list_item','image','table','quote','quiz','footnote','citation','divider','callout','interactive')),
  position integer not null default 0,
  text_content jsonb not null default '[]'::jsonb,
  attrs jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_node_versions (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  node_id uuid not null references public.content_nodes(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(node_id,version)
);

create table if not exists public.content_styles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  name text not null,
  style_type text not null check (style_type in ('paragraph','character','table','object')),
  properties jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,book_id,name,style_type)
);

create table if not exists public.layout_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  name text not null,
  profile_type text not null check (profile_type in ('web','mobile','print_a4','print_a5','square','workbook','presenter','epub_reflow','epub_fixed')),
  page_width numeric(12,3) not null,
  page_height numeric(12,3) not null,
  unit text not null default 'px' check (unit in ('px','pt','mm')),
  margins jsonb not null default '{"top":0,"right":0,"bottom":0,"left":0}'::jsonb,
  bleed jsonb not null default '{"top":0,"right":0,"bottom":0,"left":0}'::jsonb,
  columns integer not null default 1 check (columns between 1 and 12),
  column_gap numeric(12,3) not null default 0,
  settings jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  layout_profile_id uuid not null references public.layout_profiles(id) on delete cascade,
  name text not null,
  page_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flow_chains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  layout_profile_id uuid not null references public.layout_profiles(id) on delete cascade,
  name text not null,
  content_node_id uuid references public.content_nodes(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.layout_frames (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  layout_profile_id uuid not null references public.layout_profiles(id) on delete cascade,
  page_id uuid references public.book_pages(id) on delete cascade,
  master_page_id uuid references public.master_pages(id) on delete set null,
  frame_type text not null check (frame_type in ('text','image','decoration','header','footer')),
  x numeric(12,3) not null,
  y numeric(12,3) not null,
  width numeric(12,3) not null,
  height numeric(12,3) not null,
  flow_chain_id uuid references public.flow_chains(id) on delete set null,
  content_node_id uuid references public.content_nodes(id) on delete set null,
  style_id uuid references public.content_styles(id) on delete set null,
  locked boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.citations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.book_documents(id) on delete cascade,
  node_id uuid references public.content_nodes(id) on delete cascade,
  citation_key text not null,
  citation_style text not null default 'apa',
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(document_id,citation_key)
);

create table if not exists public.footnotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.book_documents(id) on delete cascade,
  node_id uuid references public.content_nodes(id) on delete cascade,
  marker text not null,
  content jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.asset_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  variant_type text not null check (variant_type in ('thumbnail','editor','reader','print','webp','avif')),
  storage_key text not null,
  mime_type text not null,
  width integer,
  height integer,
  size_bytes bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(asset_id,variant_type)
);

create index if not exists content_nodes_document_tree_idx on public.content_nodes(document_id,parent_id,position);
create index if not exists layout_profiles_book_idx on public.layout_profiles(book_id,profile_type);
create index if not exists layout_frames_profile_page_idx on public.layout_frames(layout_profile_id,page_id);
create index if not exists asset_variants_asset_idx on public.asset_variants(asset_id,variant_type);

alter table public.book_documents enable row level security;
alter table public.content_nodes enable row level security;
alter table public.content_node_versions enable row level security;
alter table public.content_styles enable row level security;
alter table public.layout_profiles enable row level security;
alter table public.master_pages enable row level security;
alter table public.flow_chains enable row level security;
alter table public.layout_frames enable row level security;
alter table public.citations enable row level security;
alter table public.footnotes enable row level security;
alter table public.asset_variants enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['book_documents','content_nodes','content_node_versions','content_styles','layout_profiles','master_pages','flow_chains','layout_frames','citations','footnotes','asset_variants'] loop
    execute format('drop policy if exists %I_member_select on public.%I',table_name,table_name);
    execute format('create policy %I_member_select on public.%I for select using (public.is_org_member(organization_id))',table_name,table_name);
    execute format('drop policy if exists %I_editor_write on public.%I',table_name,table_name);
    execute format('create policy %I_editor_write on public.%I for all using (public.has_org_role(organization_id,array[''owner'',''admin'',''designer'']::public.member_role[])) with check (public.has_org_role(organization_id,array[''owner'',''admin'',''designer'']::public.member_role[]))',table_name,table_name);
  end loop;
end $$;

create or replace function public.capture_content_node_version()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and (old.text_content is distinct from new.text_content or old.attrs is distinct from new.attrs or old.parent_id is distinct from new.parent_id or old.position is distinct from new.position) then
    insert into public.content_node_versions(organization_id,node_id,version,snapshot,created_by)
    values(old.organization_id,old.id,old.version,to_jsonb(old),auth.uid())
    on conflict(node_id,version) do nothing;
    new.version=old.version+1;
  end if;
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists content_nodes_version_trigger on public.content_nodes;
create trigger content_nodes_version_trigger before update on public.content_nodes for each row execute function public.capture_content_node_version();

create or replace function public.save_book_semantic_document(
  p_organization_id uuid,
  p_book_id uuid,
  p_title text,
  p_language text,
  p_metadata jsonb,
  p_version integer,
  p_nodes jsonb
) returns uuid language plpgsql security invoker set search_path=public as $$
declare
  v_document_id uuid;
  item jsonb;
begin
  if not public.has_org_role(p_organization_id,array['owner','admin','designer']::public.member_role[]) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists(select 1 from public.books where id=p_book_id and organization_id=p_organization_id) then
    raise exception 'BOOK_NOT_FOUND';
  end if;
  insert into public.book_documents(organization_id,book_id,title,language,metadata,version,created_by)
  values(p_organization_id,p_book_id,p_title,coalesce(p_language,'vi'),coalesce(p_metadata,'{}'::jsonb),greatest(coalesce(p_version,1),1),auth.uid())
  on conflict(book_id) do update set title=excluded.title,language=excluded.language,metadata=excluded.metadata,version=excluded.version,updated_at=now()
  returning id into v_document_id;

  delete from public.content_nodes where document_id=v_document_id;
  for item in select value from jsonb_array_elements(coalesce(p_nodes,'[]'::jsonb)) loop
    insert into public.content_nodes(id,organization_id,document_id,parent_id,node_type,position,text_content,attrs,version)
    values(
      (item->>'id')::uuid,p_organization_id,v_document_id,nullif(item->>'parentId','')::uuid,
      item->>'type',coalesce((item->>'position')::integer,0),coalesce(item->'text','[]'::jsonb),
      coalesce(item->'attrs','{}'::jsonb),greatest(coalesce((item->>'version')::integer,1),1)
    );
  end loop;
  return v_document_id;
end;
$$;

grant execute on function public.save_book_semantic_document(uuid,uuid,text,text,jsonb,integer,jsonb) to authenticated;
