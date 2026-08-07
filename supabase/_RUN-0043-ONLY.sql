-- H2OBOOK — a program/module/group can declare which student surface it belongs to
--
-- Migration 0041 put `surface` (learn/create/business/coaching) on career_stage_resources only.
-- In practice a whole program belongs to one surface — "Marketing nền tảng" is Business, all
-- twenty of its resources included — so setting it per resource meant repeating the same answer
-- twenty times, and the structure tree could not show which surface a branch belonged to because
-- the branch itself had no opinion.
--
-- surface here is nullable and advisory: a resource with its own surface keeps it, a resource
-- without one inherits from the nearest ancestor node that has one (resolved in
-- lib/academy-control/service.ts, not in SQL — the inheritance walk is three levels at most and
-- belongs where the tree is already being assembled). Nothing is backfilled: every existing row
-- keeps exactly the behaviour it had before this column existed.

begin;

alter table public.academy_stage_nodes add column if not exists surface text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'academy_stage_nodes_surface_check') then
    alter table public.academy_stage_nodes add constraint academy_stage_nodes_surface_check
      check (surface is null or surface in ('learn','create','business','coaching'));
  end if;
end $$;

commit;

-- Rollback:
--   alter table public.academy_stage_nodes drop constraint if exists academy_stage_nodes_surface_check;
--   alter table public.academy_stage_nodes drop column if exists surface;
