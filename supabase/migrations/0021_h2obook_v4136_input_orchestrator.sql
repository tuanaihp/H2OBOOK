-- H2OBOOK 4.13.6 — Unified Input Orchestrator, Preview, Commit, Retry and Recovery

create table if not exists public.input_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null,
  source_format text not null check (source_format in ('docx','pdf','png','jpeg','html','markdown','txt','url')),
  import_mode text not null check (import_mode in ('fixed_layout','editable_content','asset','full_page','ocr','manual_regions')),
  status text not null default 'created' check (status in ('created','detected','validating','uploading','scanning','queued','processing','preview','correcting','committing','completed','recovery_required','failed','cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  source jsonb not null default '{}'::jsonb,
  destination jsonb not null default '{"type":"new_book"}'::jsonb,
  preview_document jsonb,
  corrections jsonb not null default '[]'::jsonb,
  design_payload jsonb,
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  attempt integer not null default 0 check (attempt between 0 and 10),
  cancellation_requested boolean not null default false,
  retryable boolean not null default true,
  last_error_code text,
  last_error_message text,
  external_job_id text,
  target_book_id uuid references public.books(id) on delete set null,
  expected_document_version integer,
  commit_result jsonb,
  recovery_token_hash text,
  expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,idempotency_key)
);

create table if not exists public.input_session_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.input_sessions(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  status text not null,
  progress integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists input_sessions_org_updated_idx on public.input_sessions(organization_id,updated_at desc);
create index if not exists input_sessions_status_idx on public.input_sessions(organization_id,status,updated_at desc);
create index if not exists input_sessions_job_idx on public.input_sessions(external_job_id) where external_job_id is not null;
create index if not exists input_session_events_session_idx on public.input_session_events(session_id,occurred_at);

alter table public.input_sessions enable row level security;
alter table public.input_session_events enable row level security;

drop policy if exists input_sessions_member_select on public.input_sessions;
create policy input_sessions_member_select on public.input_sessions for select using (public.is_org_member(organization_id));
drop policy if exists input_sessions_editor_write on public.input_sessions;
create policy input_sessions_editor_write on public.input_sessions for all
  using (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]));
drop policy if exists input_session_events_member_select on public.input_session_events;
create policy input_session_events_member_select on public.input_session_events for select using (public.is_org_member(organization_id));
drop policy if exists input_session_events_editor_insert on public.input_session_events;
create policy input_session_events_editor_insert on public.input_session_events for insert
  with check (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]));

-- Semantic parsers already emit table row/cell nodes. Keep database constraints aligned.
alter table public.content_nodes drop constraint if exists content_nodes_node_type_check;
alter table public.content_nodes add constraint content_nodes_node_type_check check (node_type in (
  'chapter','section','heading','paragraph','list','list_item','image','table','table_row','table_cell',
  'quote','quiz','footnote','citation','divider','callout','interactive'
));

create or replace function public.log_input_session_event(
  p_session_id uuid,
  p_event_name text,
  p_payload jsonb default '{}'::jsonb
) returns bigint language plpgsql security invoker set search_path=public as $$
declare v_session public.input_sessions; v_id bigint;
begin
  select * into v_session from public.input_sessions where id=p_session_id;
  if v_session.id is null or not public.is_org_member(v_session.organization_id) then raise exception 'INPUT_SESSION_NOT_FOUND'; end if;
  insert into public.input_session_events(organization_id,session_id,actor_id,event_name,status,progress,payload)
  values(v_session.organization_id,v_session.id,auth.uid(),p_event_name,v_session.status,v_session.progress,coalesce(p_payload,'{}'::jsonb)) returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_input_session_event(uuid,text,jsonb) to authenticated;

create or replace function public.commit_input_session(
  p_session_id uuid,
  p_title text,
  p_language text,
  p_metadata jsonb,
  p_version integer,
  p_nodes jsonb,
  p_design_payload jsonb default null,
  p_client_key text default null,
  p_slug text default null
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_session public.input_sessions;
  v_book_id uuid;
  v_document_id uuid;
  v_document_version integer;
  v_destination text;
  v_client_key text;
  v_result jsonb;
  item jsonb;
begin
  select * into v_session from public.input_sessions where id=p_session_id for update;
  if v_session.id is null then raise exception 'INPUT_SESSION_NOT_FOUND'; end if;
  if not public.has_org_role(v_session.organization_id,array['owner','admin','designer']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if v_session.status='completed' then return coalesce(v_session.commit_result,'{}'::jsonb) || jsonb_build_object('alreadyCommitted',true); end if;
  if v_session.status not in ('preview','correcting','committing','recovery_required','failed') then raise exception 'INPUT_SESSION_NOT_COMMITTABLE'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(v_session.warnings,'[]'::jsonb)) w where w->>'severity'='error') then raise exception 'IMPORT_PREVIEW_BLOCKED'; end if;

  update public.input_sessions set status='committing',progress=95,updated_at=now(),last_error_code=null,last_error_message=null where id=v_session.id;
  v_destination:=coalesce(v_session.destination->>'type','new_book');
  v_client_key:=coalesce(nullif(p_client_key,''),'import-'||replace(v_session.id::text,'-',''));

  if v_destination='new_book' then
    insert into public.books(organization_id,owner_id,client_key,title,slug,status,current_version,updated_at)
    values(v_session.organization_id,auth.uid(),v_client_key,coalesce(nullif(p_title,''),'Tài liệu nhập'),coalesce(nullif(p_slug,''),'import-'||left(replace(v_session.id::text,'-',''),18)),'draft',1,now())
    on conflict(organization_id,client_key) where client_key is not null do update set updated_at=now()
    returning id into v_book_id;
  else
    v_book_id:=coalesce(v_session.target_book_id,nullif(v_session.destination->>'targetBookId','')::uuid);
    if v_book_id is null then raise exception 'INPUT_TARGET_BOOK_REQUIRED'; end if;
    if not exists(select 1 from public.books where id=v_book_id and organization_id=v_session.organization_id and deleted_at is null) then raise exception 'BOOK_NOT_FOUND'; end if;
  end if;

  if p_design_payload is not null then
    select public.save_book_document(v_session.organization_id,v_client_key,coalesce(nullif(p_slug,''),'import-'||left(replace(v_session.id::text,'-',''),18)),p_design_payload) into v_book_id;
    v_result:=jsonb_build_object('sessionId',v_session.id,'bookId',v_book_id,'clientKey',v_client_key,'destination',v_destination,'committedAt',now(),'openPath','/editor/'||v_client_key);
  else
    select version into v_document_version from public.book_documents where book_id=v_book_id for update;
    if v_session.expected_document_version is not null and coalesce(v_document_version,0)<>v_session.expected_document_version then raise exception 'INPUT_VERSION_CONFLICT'; end if;

    insert into public.book_documents(organization_id,book_id,title,language,metadata,version,created_by)
    values(v_session.organization_id,v_book_id,coalesce(nullif(p_title,''),'Tài liệu nhập'),coalesce(nullif(p_language,''),'vi'),coalesce(p_metadata,'{}'::jsonb),greatest(coalesce(p_version,1),coalesce(v_document_version,0)+1),auth.uid())
    on conflict(book_id) do update set title=excluded.title,language=excluded.language,metadata=excluded.metadata,version=excluded.version,updated_at=now()
    returning id,version into v_document_id,v_document_version;

    delete from public.content_nodes where document_id=v_document_id;
    for item in select value from jsonb_array_elements(coalesce(p_nodes,'[]'::jsonb)) loop
      insert into public.content_nodes(id,organization_id,document_id,parent_id,node_type,position,text_content,attrs,version)
      values((item->>'id')::uuid,v_session.organization_id,v_document_id,nullif(item->>'parentId','')::uuid,item->>'type',coalesce((item->>'position')::integer,0),coalesce(item->'text','[]'::jsonb),coalesce(item->'attrs','{}'::jsonb),greatest(coalesce((item->>'version')::integer,1),1));
    end loop;
    update public.books set title=coalesce(nullif(p_title,''),title),updated_at=now() where id=v_book_id;
    v_result:=jsonb_build_object('sessionId',v_session.id,'bookId',v_book_id,'clientKey',coalesce((select client_key from public.books where id=v_book_id),v_client_key),'documentId',v_document_id,'documentVersion',v_document_version,'destination',v_destination,'committedAt',now(),'openPath','/editor/'||coalesce((select client_key from public.books where id=v_book_id),v_book_id::text)||'?mode=compose');
  end if;

  update public.input_sessions set status='completed',progress=100,target_book_id=v_book_id,commit_result=v_result,completed_at=now(),updated_at=now(),retryable=false where id=v_session.id;
  insert into public.input_session_events(organization_id,session_id,actor_id,event_name,status,progress,payload)
  values(v_session.organization_id,v_session.id,auth.uid(),'session.completed','completed',100,v_result);
  insert into public.domain_events(organization_id,actor_id,resource_type,resource_id,event_name,payload)
  values(v_session.organization_id,auth.uid(),'input_session',v_session.id,'input.committed',v_result);
  insert into public.analytics_events(event_id,organization_id,user_id,event_name,resource_type,resource_id,resource_client_key,properties,occurred_at)
  values(gen_random_uuid(),v_session.organization_id,auth.uid(),'input_committed','book',v_book_id,coalesce(v_result->>'clientKey',v_book_id::text),jsonb_build_object('format',v_session.source_format,'mode',v_session.import_mode,'destination',v_destination,'sessionId',v_session.id),now());
  return v_result;
exception when others then
  update public.input_sessions set status='recovery_required',progress=95,retryable=true,last_error_code=sqlstate,last_error_message=sqlerrm,updated_at=now() where id=p_session_id and status<>'completed';
  insert into public.input_session_events(organization_id,session_id,actor_id,event_name,status,progress,payload)
  select organization_id,id,auth.uid(),'session.commit_recovery_required','recovery_required',95,jsonb_build_object('code',sqlstate,'message',sqlerrm) from public.input_sessions where id=p_session_id;
  return jsonb_build_object('error',sqlerrm,'code',sqlstate,'recoveryRequired',true,'sessionId',p_session_id);
end;
$$;

grant execute on function public.commit_input_session(uuid,text,text,jsonb,integer,jsonb,jsonb,text,text) to authenticated;

-- Realtime enables recovery from another tab/device.
do $$ begin
  begin alter publication supabase_realtime add table public.input_sessions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.input_session_events; exception when duplicate_object then null; end;
end $$;
