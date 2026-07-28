begin;

drop policy if exists "snapshots org read" on public.workspace_snapshots;
drop policy if exists "snapshots org insert" on public.workspace_snapshots;
drop policy if exists "snapshots admin delete" on public.workspace_snapshots;
create policy "snapshots admin read" on public.workspace_snapshots for select using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "snapshots admin insert" on public.workspace_snapshots for insert with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]) and created_by=auth.uid());
create policy "snapshots admin delete" on public.workspace_snapshots for delete using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create unique index if not exists entitlements_active_source_unique
on public.entitlements(user_id,resource_type,resource_id,source_type,source_id)
where status='active';

create index if not exists entitlements_user_active_idx on public.entitlements(user_id,status,expires_at);
create index if not exists orders_provider_transaction_idx on public.orders(payment_provider,provider_transaction_id);
create index if not exists publications_access_idx on public.publications(status,access_type,published_at desc);

alter table public.books add column if not exists client_key text;
alter table public.book_pages add column if not exists client_key text;
alter table public.book_pages add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.page_elements add column if not exists client_key text;
create unique index if not exists books_org_client_key_unique on public.books(organization_id,client_key) where client_key is not null;
create unique index if not exists pages_book_client_key_unique on public.book_pages(book_id,client_key) where client_key is not null;
create unique index if not exists elements_page_client_key_unique on public.page_elements(page_id,client_key) where client_key is not null;

alter table public.assets add column if not exists checksum text;
alter table public.assets add column if not exists quarantine_status text not null default 'clean' check (quarantine_status in ('pending','clean','blocked'));
alter table public.assets add column if not exists deleted_at timestamptz;
alter table public.books add column if not exists deleted_at timestamptz;
alter table public.templates add column if not exists deleted_at timestamptz;

create table if not exists public.pending_access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email=lower(email)),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  permission text not null default 'access',
  source_type text not null,
  source_id uuid,
  expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending','claimed','revoked','expired')),
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(email,resource_type,resource_id,source_type,source_id)
);
create index if not exists pending_access_email_status_idx on public.pending_access_grants(email,status,created_at desc);
alter table public.pending_access_grants enable row level security;
create policy "pending grants admin read" on public.pending_access_grants for select using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "pending grants admin manage" on public.pending_access_grants for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

-- Replace the V1 profile trigger function so a public owner signup receives an isolated workspace automatically.
-- Existing invited accounts are not allowed to join an organization through untrusted signup metadata.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_org_id uuid;
  v_name text;
  v_slug text;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name','')), '');
  insert into public.profiles(id,full_name,avatar_url)
  values(new.id,coalesce(v_name,''),new.raw_user_meta_data->>'avatar_url')
  on conflict(id) do update set full_name=excluded.full_name,avatar_url=excluded.avatar_url,updated_at=now();

  if coalesce(new.raw_user_meta_data->>'role','owner')='owner' and not exists(select 1 from public.organization_members where user_id=new.id) then
    v_slug := trim(both '-' from regexp_replace(lower(coalesce(v_name,split_part(new.email,'@',1),'h2obook')), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(new.id::text,'-',''),1,8);
    insert into public.organizations(name,slug,owner_id)
    values(coalesce(v_name,'H2OBOOK Workspace'),v_slug,new.id) returning id into v_org_id;
    insert into public.organization_members(organization_id,user_id,role,status) values(v_org_id,new.id,'owner','active');
  end if;
  return new;
end;
$$;

create or replace function public.can_access_publication(p_publication_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.publications p
    where p.id=p_publication_id and p.status='published' and (
      p.access_type='public' or
      public.is_org_member(p.organization_id) or
      exists(select 1 from public.entitlements e where e.user_id=auth.uid() and e.status='active' and (e.expires_at is null or e.expires_at>now()) and ((e.resource_type='publication' and e.resource_id=p.id) or (e.resource_type='book' and e.resource_id=p.book_id)))
    )
  );
$$;



create or replace function public.mark_order_paid(p_order_id uuid, p_transaction_id text default null)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_expiry timestamptz;
  v_resource_id uuid;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status='paid' then return; end if;
  update public.orders set payment_status='paid',order_status='fulfilled',provider_transaction_id=coalesce(p_transaction_id,provider_transaction_id),paid_at=now(),updated_at=now() where id=p_order_id;
  for v_item in select oi.*,p.product_type,p.reference_id,p.billing_interval,p.name as plan_name from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=p_order_id loop
    v_expiry := case when v_item.billing_interval='month' then now()+interval '1 month' when v_item.billing_interval='year' then now()+interval '1 year' else null end;
    v_resource_id := coalesce(v_item.reference_id,v_item.product_id);
    if v_order.buyer_id is null then
      insert into public.pending_access_grants(email,organization_id,resource_type,resource_id,permission,source_type,source_id,expires_at,status)
      values(lower(v_order.customer_email),v_order.organization_id,v_item.product_type,v_resource_id,'access','order',p_order_id,v_expiry,'pending')
      on conflict(email,resource_type,resource_id,source_type,source_id) do nothing;
    else
      insert into public.entitlements(user_id,organization_id,resource_type,resource_id,permission,source_type,source_id,starts_at,expires_at,status)
      values(v_order.buyer_id,v_order.organization_id,v_item.product_type,v_resource_id,'access','order',p_order_id,now(),v_expiry,'active')
      on conflict do nothing;
      if v_item.product_type='membership' then
        insert into public.memberships(organization_id,user_id,product_id,plan_name,price,currency,billing_interval,status,starts_at,renews_at,expires_at)
        values(v_order.organization_id,v_order.buyer_id,v_item.product_id,v_item.plan_name,v_item.unit_price,v_order.currency,coalesce(v_item.billing_interval,'month'),'active',now(),v_expiry,v_expiry)
        on conflict do nothing;
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.claim_my_pending_access()
returns integer language plpgsql security definer set search_path=public as $$
declare
  v_email text;
  v_grant record;
  v_count integer := 0;
  v_product record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select lower(email) into v_email from auth.users where id=auth.uid();
  if v_email is null then return 0; end if;
  for v_grant in select * from public.pending_access_grants where lower(email)=v_email and status='pending' for update loop
    insert into public.entitlements(user_id,organization_id,resource_type,resource_id,permission,source_type,source_id,starts_at,expires_at,status)
    values(auth.uid(),v_grant.organization_id,v_grant.resource_type,v_grant.resource_id,v_grant.permission,v_grant.source_type,v_grant.source_id,now(),v_grant.expires_at,'active')
    on conflict do nothing;
    if v_grant.resource_type='membership' and v_grant.source_id is not null then
      select p.id,p.name,p.price,p.currency,p.billing_interval into v_product
      from public.order_items oi join public.products p on p.id=oi.product_id
      where oi.order_id=v_grant.source_id and coalesce(p.reference_id,p.id)=v_grant.resource_id limit 1;
      if found then
        insert into public.memberships(organization_id,user_id,product_id,plan_name,price,currency,billing_interval,status,starts_at,renews_at,expires_at)
        values(v_grant.organization_id,auth.uid(),v_product.id,v_product.name,v_product.price,v_product.currency,coalesce(v_product.billing_interval,'month'),'active',now(),v_grant.expires_at,v_grant.expires_at)
        on conflict do nothing;
      end if;
    end if;
    update public.pending_access_grants set status='claimed',claimed_by=auth.uid(),claimed_at=now() where id=v_grant.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

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
        jsonb_strip_nulls(jsonb_build_object('text',v_element->>'text','sourceText',v_element->>'sourceText','imageUrl',v_element->>'imageUrl','qrValue',v_element->>'qrValue','sourceQrValue',v_element->>'sourceQrValue')),
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

create or replace function public.audit_critical_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(organization_id,actor_id,action,resource_type,resource_id,metadata)
  values(coalesce(new.organization_id,old.organization_id),auth.uid(),tg_op||'_'||tg_table_name,tg_table_name,coalesce(new.id,old.id),jsonb_build_object('old',to_jsonb(old),'new',to_jsonb(new)));
  return coalesce(new,old);
end;
$$;

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='audit_orders_critical') then
    create trigger audit_orders_critical after update on public.orders for each row when (old.payment_status is distinct from new.payment_status) execute function public.audit_critical_change();
  end if;
  if not exists(select 1 from pg_trigger where tgname='audit_memberships_critical') then
    create trigger audit_memberships_critical after update on public.memberships for each row when (old.status is distinct from new.status) execute function public.audit_critical_change();
  end if;
end $$;

commit;
