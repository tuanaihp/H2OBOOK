-- H2OBOOK Student Management & Competency V1: immutable grading audit trail.
-- The v6 source brief requires every score change to be logged.  class_evaluations is an
-- upserted current-state table, so updated_at alone cannot answer who changed which score or
-- restore an earlier evaluation.  This trigger records the complete before/after snapshot inside
-- the database; it therefore covers API, admin-console and future mobile writes equally.

begin;

create table public.class_evaluation_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evaluation_id uuid not null references public.class_evaluations(id) on delete cascade,
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('created', 'updated')),
  previous_total_score numeric(6,2),
  current_total_score numeric(6,2) not null,
  previous_criterion_scores jsonb,
  current_criterion_scores jsonb not null,
  previous_notes text,
  current_notes text not null,
  previous_asset_ids uuid[],
  current_asset_ids uuid[] not null,
  created_at timestamptz not null default now()
);

create index class_evaluation_audit_evaluation_idx
  on public.class_evaluation_audit(evaluation_id, created_at desc);
create index class_evaluation_audit_student_idx
  on public.class_evaluation_audit(student_id, created_at desc);

alter table public.class_evaluation_audit enable row level security;

-- The same people who can read an evaluation can read its history.  Students remain limited to
-- their own records, while teachers are limited to classes assigned to them.
create policy "class evaluation audit read scope" on public.class_evaluation_audit for select
  using (
    public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
    or student_id = auth.uid()
    or exists (
      select 1
      from public.class_sessions cs
      join public.classes c on c.id = cs.class_id
      where cs.id = class_evaluation_audit.class_session_id and c.teacher_id = auth.uid()
    )
  );

-- No client write policy is deliberately supplied.  Entries are inserted only by the trigger
-- below, and are never updated or deleted through the application.
create or replace function public.log_class_evaluation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.class_evaluation_audit (
      organization_id, evaluation_id, class_session_id, student_id, changed_by, action,
      current_total_score, current_criterion_scores, current_notes, current_asset_ids
    ) values (
      new.organization_id, new.id, new.class_session_id, new.student_id, new.graded_by, 'created',
      new.total_score, new.criterion_scores, new.notes, new.asset_ids
    );
  else
    insert into public.class_evaluation_audit (
      organization_id, evaluation_id, class_session_id, student_id, changed_by, action,
      previous_total_score, current_total_score, previous_criterion_scores, current_criterion_scores,
      previous_notes, current_notes, previous_asset_ids, current_asset_ids
    ) values (
      new.organization_id, new.id, new.class_session_id, new.student_id, new.graded_by, 'updated',
      old.total_score, new.total_score, old.criterion_scores, new.criterion_scores,
      old.notes, new.notes, old.asset_ids, new.asset_ids
    );
  end if;
  return new;
end;
$$;

create trigger class_evaluations_audit_trigger
after insert or update on public.class_evaluations
for each row execute function public.log_class_evaluation_change();

commit;
