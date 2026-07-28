-- H2OBOOK 4.13.7 — Production Validation & Hardening

alter table public.input_sessions add column if not exists trace_id text;
alter table public.input_sessions add column if not exists heartbeat_at timestamptz;
alter table public.input_sessions add column if not exists processing_deadline_at timestamptz;
alter table public.input_sessions add column if not exists lease_owner text;
alter table public.input_sessions add column if not exists metrics jsonb not null default '{}'::jsonb;
alter table public.input_sessions add column if not exists security_summary jsonb not null default '{}'::jsonb;
alter table public.input_session_events add column if not exists trace_id text;

update public.input_sessions
set trace_id = coalesce(trace_id, 'itr_' || replace(id::text,'-','')),
    heartbeat_at = coalesce(heartbeat_at, updated_at),
    processing_deadline_at = coalesce(processing_deadline_at, updated_at + interval '45 minutes')
where trace_id is null or heartbeat_at is null or processing_deadline_at is null;

alter table public.input_sessions alter column trace_id set not null;
create unique index if not exists input_sessions_trace_id_idx on public.input_sessions(trace_id);
create index if not exists input_sessions_recovery_idx on public.input_sessions(status,heartbeat_at,processing_deadline_at)
  where status in ('queued','processing','committing');
create index if not exists input_session_events_trace_idx on public.input_session_events(trace_id,occurred_at desc) where trace_id is not null;

alter table public.input_sessions drop constraint if exists input_sessions_attempt_hardened_check;
alter table public.input_sessions add constraint input_sessions_attempt_hardened_check check (attempt between 0 and 5) not valid;
alter table public.input_sessions drop constraint if exists input_sessions_preview_size_check;
alter table public.input_sessions add constraint input_sessions_preview_size_check check (preview_document is null or pg_column_size(preview_document) <= 31457280) not valid;
alter table public.input_sessions drop constraint if exists input_sessions_corrections_size_check;
alter table public.input_sessions add constraint input_sessions_corrections_size_check check (pg_column_size(corrections) <= 6291456) not valid;
alter table public.input_sessions drop constraint if exists input_sessions_design_size_check;
alter table public.input_sessions add constraint input_sessions_design_size_check check (design_payload is null or pg_column_size(design_payload) <= 62914560) not valid;
alter table public.input_sessions drop constraint if exists input_sessions_metadata_size_check;
alter table public.input_sessions add constraint input_sessions_metadata_size_check check (pg_column_size(metadata) <= 3145728) not valid;
alter table public.input_sessions drop constraint if exists input_sessions_warning_size_check;
alter table public.input_sessions add constraint input_sessions_warning_size_check check (pg_column_size(warnings) <= 2097152) not valid;

create or replace function public.guard_input_session_payload()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op = 'UPDATE' and (new.organization_id <> old.organization_id or new.requested_by <> old.requested_by or new.idempotency_key <> old.idempotency_key) then
    raise exception 'INPUT_SESSION_IDENTITY_IMMUTABLE';
  end if;
  new.updated_at := now();
  new.trace_id := coalesce(nullif(new.trace_id,''), 'itr_' || replace(new.id::text,'-',''));
  new.heartbeat_at := coalesce(new.heartbeat_at, now());
  if new.processing_deadline_at is null then new.processing_deadline_at := now() + interval '45 minutes'; end if;
  if length(coalesce(new.idempotency_key,'')) > 240 then raise exception 'INPUT_IDEMPOTENCY_KEY_TOO_LONG'; end if;
  if pg_column_size(new.source) > 2097152 then raise exception 'INPUT_SOURCE_METADATA_TOO_LARGE'; end if;
  if pg_column_size(new.destination) > 65536 then raise exception 'INPUT_DESTINATION_TOO_LARGE'; end if;
  if jsonb_typeof(new.corrections) <> 'array' then raise exception 'INPUT_CORRECTIONS_INVALID'; end if;
  if jsonb_array_length(new.corrections) > 5000 then raise exception 'INPUT_CORRECTION_LIMIT_EXCEEDED'; end if;
  return new;
end;
$$;

drop trigger if exists guard_input_session_payload_trigger on public.input_sessions;
create trigger guard_input_session_payload_trigger before insert or update on public.input_sessions
for each row execute function public.guard_input_session_payload();

-- Do not allow browser clients to mutate another member's sessions or change organization/requester fields.
drop policy if exists input_sessions_editor_write on public.input_sessions;
drop policy if exists input_sessions_creator_insert on public.input_sessions;
create policy input_sessions_creator_insert on public.input_sessions for insert
  with check (
    requested_by = auth.uid()
    and public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[])
  );
drop policy if exists input_sessions_owner_update on public.input_sessions;
create policy input_sessions_owner_update on public.input_sessions for update
  using (
    public.has_org_role(organization_id,array['owner','admin']::public.member_role[])
    or (requested_by = auth.uid() and public.has_org_role(organization_id,array['designer','partner','teacher']::public.member_role[]))
  )
  with check (
    public.has_org_role(organization_id,array['owner','admin']::public.member_role[])
    or (requested_by = auth.uid() and public.has_org_role(organization_id,array['designer','partner','teacher']::public.member_role[]))
  );

drop policy if exists input_session_events_editor_insert on public.input_session_events;
create policy input_session_events_editor_insert on public.input_session_events for insert
  with check (
    actor_id = auth.uid()
    and public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[])
    and exists(select 1 from public.input_sessions s where s.id=session_id and s.organization_id=organization_id)
  );

create or replace function public.touch_input_session(
  p_session_id uuid,
  p_progress integer default null,
  p_metrics jsonb default '{}'::jsonb,
  p_lease_owner text default null
) returns boolean language plpgsql security invoker set search_path=public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.input_sessions where id=p_session_id;
  if v_org is null then return false; end if;
  if auth.role() <> 'service_role' and not public.has_org_role(v_org,array['owner','admin','designer','partner','teacher']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  update public.input_sessions
  set heartbeat_at=now(), progress=coalesce(greatest(progress,least(99,greatest(0,p_progress))),progress),
      metrics=coalesce(metrics,'{}'::jsonb)||coalesce(p_metrics,'{}'::jsonb), lease_owner=coalesce(p_lease_owner,lease_owner), updated_at=now()
  where id=p_session_id and status not in ('completed','cancelled');
  return found;
end;
$$;
grant execute on function public.touch_input_session(uuid,integer,jsonb,text) to authenticated,service_role;

create or replace function public.commit_input_session_hardened(
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
begin
  if length(coalesce(p_title,'')) > 500 then raise exception 'INPUT_TITLE_TOO_LONG'; end if;
  if jsonb_typeof(coalesce(p_nodes,'[]'::jsonb)) <> 'array' then raise exception 'IMPORT_NODES_INVALID'; end if;
  if jsonb_array_length(coalesce(p_nodes,'[]'::jsonb)) > 50000 then raise exception 'IMPORT_NODE_LIMIT_EXCEEDED'; end if;
  if pg_column_size(coalesce(p_nodes,'[]'::jsonb)) > 31457280 then raise exception 'IMPORT_NODES_TOO_LARGE'; end if;
  if pg_column_size(coalesce(p_metadata,'{}'::jsonb)) > 2097152 then raise exception 'IMPORT_METADATA_TOO_LARGE'; end if;
  if p_design_payload is not null and pg_column_size(p_design_payload) > 62914560 then raise exception 'INPUT_DESIGN_PAYLOAD_TOO_LARGE'; end if;
  return public.commit_input_session(p_session_id,p_title,p_language,p_metadata,p_version,p_nodes,p_design_payload,p_client_key,p_slug);
end;
$$;
grant execute on function public.commit_input_session_hardened(uuid,text,text,jsonb,integer,jsonb,jsonb,text,text) to authenticated;

create or replace function public.recover_stale_input_sessions(p_limit integer default 100)
returns table(session_id uuid, organization_id uuid, previous_status text, error_code text)
language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  return query
  with candidates as (
    select id,organization_id,status
    from public.input_sessions
    where status in ('queued','processing','committing')
      and (
        processing_deadline_at < now()
        or heartbeat_at < now() - interval '5 minutes'
      )
    order by updated_at
    limit least(greatest(p_limit,1),500)
    for update skip locked
  ), updated as (
    update public.input_sessions s
    set status='recovery_required', retryable=true, lease_owner=null,
        last_error_code=case when s.processing_deadline_at < now() then 'INPUT_PROCESSING_TIMEOUT' else 'INPUT_HEARTBEAT_STALE' end,
        last_error_message='Phiên nhập bị gián đoạn và đã được chuyển sang trạng thái khôi phục.', updated_at=now()
    from candidates c where s.id=c.id
    returning s.id,s.organization_id,c.status,s.last_error_code,s.trace_id,s.progress
  ), events as (
    insert into public.input_session_events(organization_id,session_id,event_name,status,progress,trace_id,payload)
    select u.organization_id,u.id,'session.recovery_required','recovery_required',u.progress,u.trace_id,jsonb_build_object('errorCode',u.last_error_code,'source','stale-session-sweeper')
    from updated u returning session_id
  )
  select u.id,u.organization_id,u.status,u.last_error_code from updated u;
end;
$$;
revoke all on function public.recover_stale_input_sessions(integer) from public,anon,authenticated;
grant execute on function public.recover_stale_input_sessions(integer) to service_role;

comment on function public.recover_stale_input_sessions(integer) is 'Service-role sweeper for timed-out or heartbeat-stale input sessions.';
