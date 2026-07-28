-- H2OBOOK 4.13.4 — Image Smart Import
-- Stores deterministic image variants and region plans without introducing AI dependencies.

create table if not exists public.asset_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  variant_type text not null check (variant_type in ('thumbnail','preview','crop','print')),
  storage_key text not null unique,
  mime_type text not null,
  size_bytes bigint not null default 0,
  width integer,
  height integer,
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(asset_id, variant_type, storage_key)
);

create table if not exists public.image_import_regions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  book_client_key text,
  region_kind text not null check (region_kind in ('text','image','ignore')),
  reading_order integer not null default 0,
  bounds jsonb not null,
  label text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.asset_variants enable row level security;
alter table public.image_import_regions enable row level security;

create policy "asset variants org read" on public.asset_variants for select
  using (public.is_org_member(organization_id));
create policy "asset variants editor write" on public.asset_variants for all
  using (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]));
create policy "image regions org read" on public.image_import_regions for select
  using (public.is_org_member(organization_id));
create policy "image regions editor write" on public.image_import_regions for all
  using (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]));

create index if not exists asset_variants_asset_idx on public.asset_variants(asset_id,variant_type);
create index if not exists image_import_regions_asset_idx on public.image_import_regions(asset_id,reading_order);

comment on table public.asset_variants is 'Generated image variants such as WebP thumbnails and manual crops.';
comment on table public.image_import_regions is 'Deterministic region plan used by Image Smart Import OCR/crop workflow.';

create or replace function public.replace_image_import_regions(
  p_organization_id uuid,
  p_asset_id uuid,
  p_book_client_key text,
  p_regions jsonb
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if not public.has_org_role(p_organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]) then
    raise exception 'WORKSPACE_FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.assets
    where id = p_asset_id and organization_id = p_organization_id and deleted_at is null
  ) then
    raise exception 'ASSET_NOT_FOUND';
  end if;

  delete from public.image_import_regions
  where organization_id = p_organization_id and asset_id = p_asset_id;

  insert into public.image_import_regions(
    organization_id, asset_id, book_client_key, region_kind, reading_order,
    bounds, label, metadata, created_by
  )
  select
    p_organization_id,
    p_asset_id,
    p_book_client_key,
    case when item->>'kind' in ('text','image','ignore') then item->>'kind' else 'ignore' end,
    greatest(0, coalesce((item->>'order')::integer, ordinal::integer - 1)),
    jsonb_build_object(
      'x', greatest(0, coalesce((item->>'x')::numeric, 0)),
      'y', greatest(0, coalesce((item->>'y')::numeric, 0)),
      'width', greatest(1, coalesce((item->>'width')::numeric, 1)),
      'height', greatest(1, coalesce((item->>'height')::numeric, 1))
    ),
    nullif(left(coalesce(item->>'label',''),200),''),
    jsonb_build_object('clientRegionId', item->>'id'),
    auth.uid()
  from jsonb_array_elements(coalesce(p_regions,'[]'::jsonb)) with ordinality as region(item, ordinal);

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.replace_image_import_regions(uuid,uuid,text,jsonb) to authenticated;
