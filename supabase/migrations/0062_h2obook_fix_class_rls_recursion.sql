-- ===========================================================================
-- 0062 — Fix "infinite recursion detected in policy for relation classes"
-- ---------------------------------------------------------------------------
-- 0002 defined two RLS policies that reference each other:
--   public.classes       "classes org read"        -> EXISTS(... class_members ...)
--   public.class_members  "class members scoped read" -> EXISTS(... classes ...)
-- Any authenticated SELECT / INSERT ... RETURNING on either table recurses.
--
-- Fix: move the cross-table lookups into SECURITY DEFINER helpers so RLS on the
-- referenced table is NOT re-evaluated, then rebuild the offending policies.
-- Downstream policies (class_books / class_sessions / assignments) that nest
-- these lookups start working again automatically once the cycle is gone.
-- Idempotent: safe to re-run.
-- ===========================================================================

-- current user is an enrolled member of the class (RLS on class_members skipped)
create or replace function public.is_class_member(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_members cm
    where cm.class_id = target_class_id
      and cm.user_id  = auth.uid()
      and cm.status in ('active', 'completed')
  );
$$;

-- organization that owns the class (RLS on classes skipped)
create or replace function public.class_org_id(target_class_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.organization_id
  from public.classes c
  where c.id = target_class_id;
$$;

grant execute on function public.is_class_member(uuid) to authenticated, anon, service_role;
grant execute on function public.class_org_id(uuid)   to authenticated, anon, service_role;

-- --- rebuild the 3 policies in the recursion cycle -----------------------
drop policy if exists "classes org read"            on public.classes;
drop policy if exists "class members scoped read"   on public.class_members;
drop policy if exists "class members teacher write" on public.class_members;

create policy "classes org read" on public.classes
for select
using (
  public.is_org_member(organization_id)
  or public.is_class_member(id)
);

create policy "class members scoped read" on public.class_members
for select
using (
  user_id = auth.uid()
  or public.has_org_role(
       public.class_org_id(class_id),
       array['owner', 'admin', 'teacher']::public.member_role[]
     )
);

create policy "class members teacher write" on public.class_members
for all
using (
  public.has_org_role(
    public.class_org_id(class_id),
    array['owner', 'admin', 'teacher']::public.member_role[]
  )
)
with check (
  public.has_org_role(
    public.class_org_id(class_id),
    array['owner', 'admin', 'teacher']::public.member_role[]
  )
);
