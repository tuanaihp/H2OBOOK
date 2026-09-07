-- One atomic database call for assigning different dates to a class's pending sessions.
-- SECURITY INVOKER is intentional: the class_sessions RLS policies from migration 0060
-- continue to decide whether the current admin/teacher may update the class.
create or replace function public.bulk_schedule_class_sessions(
  p_class_id uuid,
  p_session_ids uuid[],
  p_session_dates date[]
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if cardinality(p_session_ids) is distinct from cardinality(p_session_dates)
     or coalesce(cardinality(p_session_ids), 0) = 0
     or cardinality(p_session_ids) > 500 then
    raise exception 'INVALID_BULK_CLASS_SCHEDULE';
  end if;

  update public.class_sessions as session
  set session_date = input.session_date,
      updated_at = now()
  from unnest(p_session_ids, p_session_dates) as input(session_id, session_date)
  where session.id = input.session_id
    and session.class_id = p_class_id
    and session.status = 'scheduled';

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.bulk_schedule_class_sessions(uuid, uuid[], date[]) from public;
grant execute on function public.bulk_schedule_class_sessions(uuid, uuid[], date[]) to authenticated;
