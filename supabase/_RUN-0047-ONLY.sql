-- H2OBOOK — stop the public read policy on career_stage_resources from exposing paid curriculum
--
-- Found by the H2O Engineering Standard V2 audit (docs/h2o-audit/H2O_ENGINEERING_AUDIT_V2.md, P1-2),
-- and confirmed against production rather than inferred: issuing a REST read with the anon key — the
-- key that ships in every browser bundle by design — returned all 102 rows of
-- career_stage_resources, including title_override and summary.
--
-- The policy from migration 0033 was:
--
--   create policy "career stage resources public read"
--     on public.career_stage_resources for select using (status <> 'archived');
--
-- It filters on status and never looks at `access`, which is the column that actually decides
-- whether a resource is a free taster or paid material. Today that leaks nothing, because every row
-- is deliberately access='free_preview' while the curriculum is being reviewed. The moment those
-- rows are switched to 'stage_locked' or 'entitlement_only' — the stated plan once review finishes —
-- the application layer would hide them correctly while anyone calling PostgREST directly kept
-- reading every title and summary. The app's resolver is not a security boundary for a client that
-- simply does not call the app.
--
-- Splitting the policy by role rather than tightening the single one, because "anonymous visitor"
-- and "signed-in student" are genuinely different questions:
--
--   anon          -> only free_preview, which is exactly what the public marketing pages advertise.
--   authenticated -> unchanged (status <> 'archived'); per-student entitlement is resolved in
--                    lib/content-access/resolver.ts, which needs to see a locked row exists in order
--                    to report it as locked and count it.
--
-- Every server-side read in the app goes through the service-role client (lib/supabase/admin.ts),
-- which bypasses RLS entirely, so no page, API route or student surface changes behaviour here.
-- Verified before writing this: no client component reads career_stage* directly.

begin;

drop policy if exists "career stage resources public read" on public.career_stage_resources;

create policy "career stage resources anon free preview" on public.career_stage_resources
  for select to anon
  using (status <> 'archived' and access = 'free_preview');

create policy "career stage resources member read" on public.career_stage_resources
  for select to authenticated
  using (status <> 'archived');

commit;

-- Rollback:
--   drop policy if exists "career stage resources member read" on public.career_stage_resources;
--   drop policy if exists "career stage resources anon free preview" on public.career_stage_resources;
--   create policy "career stage resources public read" on public.career_stage_resources
--     for select using (status <> 'archived');
