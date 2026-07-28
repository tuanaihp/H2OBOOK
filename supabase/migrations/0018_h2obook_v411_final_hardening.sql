-- H2OBOOK 4.11 final integration hardening
-- Encrypted webhook secrets, transactional delivery enqueue and public API usage accounting.

alter table public.webhook_endpoints add column if not exists secret_ciphertext text;
alter table public.webhook_deliveries add column if not exists last_error text;
alter table public.webhook_deliveries add column if not exists request_id uuid not null default gen_random_uuid();
alter table public.webhook_deliveries add column if not exists domain_event_id bigint references public.domain_events(id) on delete cascade;
create unique index if not exists webhook_delivery_endpoint_domain_event_unique on public.webhook_deliveries(endpoint_id,domain_event_id) where domain_event_id is not null;

create or replace function public.enqueue_domain_webhook_delivery()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.webhook_deliveries(organization_id,endpoint_id,domain_event_id,event_type,payload,status,next_attempt_at)
  select new.organization_id,e.id,new.id,
         case when position('.' in new.event_name)>0 then new.event_name else new.resource_type||'.'||new.event_name end,
         jsonb_build_object(
           'id',new.id,
           'organizationId',new.organization_id,
           'actorId',new.actor_id,
           'resourceType',new.resource_type,
           'resourceId',new.resource_id,
           'eventName',new.event_name,
           'payload',new.payload,
           'occurredAt',new.occurred_at
         ),
         'queued',now()
  from public.webhook_endpoints e
  where e.organization_id=new.organization_id
    and e.enabled=true
    and e.secret_ciphertext is not null
    and (
      '*'=any(e.events)
      or new.event_name=any(e.events)
      or (new.resource_type||'.'||new.event_name)=any(e.events)
    )
  on conflict(endpoint_id,domain_event_id) where domain_event_id is not null do nothing;
  return new;
end;
$$;

drop trigger if exists domain_event_webhook_enqueue on public.domain_events;
create trigger domain_event_webhook_enqueue after insert on public.domain_events
for each row execute function public.enqueue_domain_webhook_delivery();

create or replace function public.claim_webhook_deliveries(p_limit integer default 10)
returns setof public.webhook_deliveries
language plpgsql security definer set search_path=public as $$
begin
  return query
  with candidates as (
    select id from public.webhook_deliveries
    where status in ('queued','retry') and next_attempt_at<=now()
    order by next_attempt_at,created_at
    for update skip locked
    limit greatest(1,least(p_limit,100))
  )
  update public.webhook_deliveries d
  set status='sending',attempt_count=d.attempt_count+1
  from candidates c
  where d.id=c.id
  returning d.*;
end;
$$;

revoke all on function public.claim_webhook_deliveries(integer) from public,anon,authenticated;
grant execute on function public.claim_webhook_deliveries(integer) to service_role;
