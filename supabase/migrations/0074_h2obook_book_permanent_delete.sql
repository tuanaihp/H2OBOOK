-- H2OBOOK — permanent book deletion + assetId persistence
--
-- Two independent fixes bundled because both are required for delete to be correct:
--
-- 1) save_book_document() never persisted element.assetId into page_elements.content — only
--    imageUrl (a blob: URL that dies with the browser session). Cloud-loaded books therefore lost
--    every image reference, and a delete sweep could not know which assets a book owned.
--    assetId/altText/caption are now written alongside the existing content keys.
--
-- 2) delete_book_permanently() performs a real hard delete: the books row (children cascade),
--    then sweeps assets that no remaining element/brand/page still references and returns their
--    storage keys so the API route can delete the objects from R2. Security definer is required
--    because public.assets intentionally has no UPDATE/DELETE policy.
--
-- FK hardening that makes the hard delete possible:
--   book_clones.source_book_id had NO ACTION — deleting a book that had ever been cloned raised
--   a foreign-key violation. Cascade now removes the lineage row; the clone book itself survives.
--   import_jobs.source_asset_id had NO ACTION — deleting a source asset would fail; set null
--   keeps the audit row while dropping the pointer.

begin;

create or replace function public.save_book_document(p_organization_id uuid, p_client_key text, p_slug text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_book_id uuid;
  v_page_id uuid;
  v_page jsonb;
  v_element jsonb;
  v_page_position integer := 0;
  v_element_position integer;
  v_version integer;
begin
  if not public.has_org_role(p_organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]) then
    raise exception 'Forbidden';
  end if;
  if p_client_key is null or p_client_key='' or coalesce(p_payload->>'title','')='' then raise exception 'Invalid book payload'; end if;

  select id,current_version into v_book_id,v_version from public.books where organization_id=p_organization_id and client_key=p_client_key for update;
  if v_book_id is null then
    insert into public.books(organization_id,owner_id,client_key,title,slug,subtitle,description,author,status,cover,page_width,page_height,current_version,updated_at)
    values(
      p_organization_id,auth.uid(),p_client_key,p_payload->>'title',p_slug,
      coalesce(p_payload->>'subtitle',''),coalesce(p_payload->>'description',''),coalesce(p_payload->>'author',''),
      (case when p_payload->>'status'='published' then 'published' when p_payload->>'status'='archived' then 'archived' else 'draft' end)::public.book_status,
      jsonb_build_object('value',coalesce(p_payload->>'cover','')),
      coalesce(((p_payload->'pages'->0)->>'width')::integer,794),
      coalesce(((p_payload->'pages'->0)->>'height')::integer,1123),1,now()
    ) returning id,current_version into v_book_id,v_version;
  else
    v_version := coalesce(v_version,0) + 1;
    update public.books set
      title=p_payload->>'title',subtitle=coalesce(p_payload->>'subtitle',''),description=coalesce(p_payload->>'description',''),
      author=coalesce(p_payload->>'author',''),status=(case when p_payload->>'status'='published' then 'published' when p_payload->>'status'='archived' then 'archived' else 'draft' end)::public.book_status,
      cover=jsonb_build_object('value',coalesce(p_payload->>'cover','')),
      page_width=coalesce(((p_payload->'pages'->0)->>'width')::integer,page_width),
      page_height=coalesce(((p_payload->'pages'->0)->>'height')::integer,page_height),current_version=v_version,updated_at=now()
    where id=v_book_id;
  end if;

  delete from public.book_pages where book_id=v_book_id;
  for v_page in select value from jsonb_array_elements(coalesce(p_payload->'pages','[]'::jsonb)) loop
    insert into public.book_pages(book_id,client_key,name,position,width,height,background,metadata,revision,updated_at)
    values(
      v_book_id,v_page->>'id',coalesce(v_page->>'name','Trang'),v_page_position,
      coalesce((v_page->>'width')::integer,794),coalesce((v_page->>'height')::integer,1123),
      jsonb_build_object('type','color','value',coalesce(v_page->>'background','#ffffff')),
      jsonb_strip_nulls(jsonb_build_object('pageType',v_page->>'pageType','chapter',v_page->>'chapter','notes',v_page->>'notes','hidden',(v_page->>'hidden')::boolean,'masterPageId',v_page->>'masterPageId')),
      1,now()
    ) returning id into v_page_id;
    v_element_position := 0;
    for v_element in select value from jsonb_array_elements(coalesce(v_page->'elements','[]'::jsonb)) loop
      insert into public.page_elements(page_id,client_key,element_type,name,position_index,transform,content,style,binding,permissions,locked,hidden,revision,updated_at)
      values(
        v_page_id,v_element->>'id',v_element->>'type',coalesce(v_element->>'name','Element'),v_element_position,
        jsonb_build_object('x',coalesce((v_element->>'x')::numeric,0),'y',coalesce((v_element->>'y')::numeric,0),'width',coalesce((v_element->>'width')::numeric,100),'height',coalesce((v_element->>'height')::numeric,100),'rotation',coalesce((v_element->>'rotation')::numeric,0),'opacity',coalesce((v_element->>'opacity')::numeric,1)),
        jsonb_strip_nulls(jsonb_build_object('text',v_element->>'text','sourceText',v_element->>'sourceText','imageUrl',v_element->>'imageUrl','assetId',v_element->>'assetId','altText',v_element->>'altText','caption',v_element->>'caption','qrValue',v_element->>'qrValue','sourceQrValue',v_element->>'sourceQrValue')),
        jsonb_strip_nulls(jsonb_build_object('fill',v_element->>'fill','stroke',v_element->>'stroke','strokeWidth',(v_element->>'strokeWidth')::numeric,'dash',v_element->'dash','fontSize',(v_element->>'fontSize')::numeric,'fontFamily',v_element->>'fontFamily','fontWeight',(v_element->>'fontWeight')::numeric,'fontStyle',v_element->>'fontStyle','textDecoration',v_element->>'textDecoration','lineHeight',(v_element->>'lineHeight')::numeric,'letterSpacing',(v_element->>'letterSpacing')::numeric,'align',v_element->>'align','verticalAlign',v_element->>'verticalAlign','imageFit',v_element->>'imageFit','cornerRadius',(v_element->>'cornerRadius')::numeric,'shadow',v_element->'shadow')),
        jsonb_strip_nulls(jsonb_build_object('key',v_element->>'bindingKey','fallback',v_element->>'bindingFallback','sourceElementId',v_element->>'sourceElementId','sourceRevision',(v_element->>'sourceRevision')::integer,'localRevision',(v_element->>'localRevision')::integer)),
        coalesce(v_element->'permissions','{"canEditContent":true,"canMove":true,"canResize":true,"canDelete":true,"canChangeColor":true}'::jsonb),
        coalesce((v_element->>'locked')::boolean,false),coalesce((v_element->>'hidden')::boolean,false),greatest(1,coalesce((v_element->>'localRevision')::integer,1)),now()
      );
      v_element_position := v_element_position + 1;
    end loop;
    v_page_position := v_page_position + 1;
  end loop;

  insert into public.book_versions(book_id,version_number,change_note,snapshot,created_by)
  values(v_book_id,coalesce(v_version,1),'Cloud save',jsonb_build_object('clientKey',p_client_key,'pageCount',v_page_position,'savedAt',now()),auth.uid());
  return v_book_id;
end;
$$;

alter table public.book_clones drop constraint if exists book_clones_source_book_id_fkey;
alter table public.book_clones add constraint book_clones_source_book_id_fkey
  foreign key (source_book_id) references public.books(id) on delete cascade;

alter table public.import_jobs drop constraint if exists import_jobs_source_asset_id_fkey;
alter table public.import_jobs add constraint import_jobs_source_asset_id_fkey
  foreign key (source_asset_id) references public.assets(id) on delete set null;

-- Hard-deletes one book (resolved by client_key OR slug) inside the caller's organization, then
-- deletes asset rows that became orphaned by that delete and returns every R2 storage key the
-- caller must remove. An asset survives if anything else still references it: another book's
-- elements, a page thumbnail, a brand logo/avatar, or another materialized asset that lists it
-- as its sourceAssetId. `set null`/`cascade` FKs elsewhere handle themselves.
create or replace function public.delete_book_permanently(p_organization_id uuid, p_client_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_book_id uuid;
  v_asset record;
  v_candidate_ids uuid[];
  v_deleted_ids uuid[] := '{}';
  v_source_ids uuid[];
  v_keys text[] := '{}';
begin
  if not public.has_org_role(p_organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]) then
    raise exception 'Forbidden';
  end if;

  select id into v_book_id from public.books
   where organization_id=p_organization_id and deleted_at is null
     and (client_key=p_client_key or slug=p_client_key);
  if v_book_id is null then
    return jsonb_build_object('bookId',null,'storageKeys','{}'::text[],'deletedAssetIds','{}'::uuid[]);
  end if;

  -- Assets referenced by this book's elements (uuid assetIds only; "local:" ids live in the
  -- browser's IndexedDB and are cleaned client-side).
  select coalesce(array_agg(distinct asset_id),'{}'::uuid[]) into v_candidate_ids from (
    select (pe.content->>'assetId')::uuid as asset_id
      from public.page_elements pe join public.book_pages bp on bp.id=pe.page_id
     where bp.book_id=v_book_id
       and (pe.content->>'assetId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) q;

  delete from public.books where id=v_book_id;

  -- Pass 1: element-referenced assets that nothing else in this org still references.
  for v_asset in
    select a.id,a.storage_key from public.assets a
     where a.organization_id=p_organization_id
       and a.id = any(v_candidate_ids)
       and not exists (
         select 1 from public.page_elements pe
           join public.book_pages bp on bp.id=pe.page_id
           join public.books b on b.id=bp.book_id
          where b.organization_id=p_organization_id and b.deleted_at is null
            and pe.content->>'assetId' = a.id::text)
       and not exists (
         select 1 from public.book_pages bp
           join public.books b on b.id=bp.book_id
          where b.organization_id=p_organization_id and bp.thumbnail_asset_id=a.id)
       and not exists (
         select 1 from public.brand_profiles br
          where br.organization_id=p_organization_id and (br.logo_asset_id=a.id or br.avatar_asset_id=a.id))
       and not exists (
         select 1 from public.assets child
          where child.organization_id=p_organization_id and child.deleted_at is null
            and child.metadata->>'sourceAssetId' = a.id::text)
  loop
    v_keys := v_keys || coalesce((select array_agg(v.storage_key) from public.asset_variants v where v.asset_id=v_asset.id),'{}'::text[]);
    v_keys := v_keys || v_asset.storage_key;
    delete from public.assets where id=v_asset.id;
    v_deleted_ids := v_deleted_ids || v_asset.id;
  end loop;

  -- Pass 2: source assets (e.g. the uploaded PDF) that only the just-deleted page assets
  -- pointed at via metadata.sourceAssetId.
  select coalesce(array_agg(distinct (a.metadata->>'sourceAssetId')::uuid),'{}'::uuid[]) into v_source_ids
    from public.assets a
   where a.id = any(v_deleted_ids)
     and (a.metadata->>'sourceAssetId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  for v_asset in
    select a.id,a.storage_key from public.assets a
     where a.organization_id=p_organization_id
       and a.id = any(v_source_ids)
       and not exists (
         select 1 from public.assets child
          where child.organization_id=p_organization_id and child.deleted_at is null
            and child.metadata->>'sourceAssetId' = a.id::text)
       and not exists (
         select 1 from public.page_elements pe
           join public.book_pages bp on bp.id=pe.page_id
           join public.books b on b.id=bp.book_id
          where b.organization_id=p_organization_id and b.deleted_at is null
            and pe.content->>'assetId' = a.id::text)
  loop
    v_keys := v_keys || coalesce((select array_agg(v.storage_key) from public.asset_variants v where v.asset_id=v_asset.id),'{}'::text[]);
    v_keys := v_keys || v_asset.storage_key;
    delete from public.assets where id=v_asset.id;
    v_deleted_ids := v_deleted_ids || v_asset.id;
  end loop;

  delete from public.image_import_regions
   where organization_id=p_organization_id and book_client_key=p_client_key;

  return jsonb_build_object('bookId',v_book_id,'storageKeys',v_keys,'deletedAssetIds',v_deleted_ids);
end;
$$;

revoke all on function public.delete_book_permanently(uuid,text) from public;
grant execute on function public.delete_book_permanently(uuid,text) to authenticated;

commit;
