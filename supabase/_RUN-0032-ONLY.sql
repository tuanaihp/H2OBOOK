-- H2OBOOK — Safe signup default for handle_new_user()
--
-- Root cause of the live incident this migration fixes: handle_new_user() (0024) auto-creates a
-- brand-new organization and makes the signer its Owner whenever
-- coalesce(new.raw_user_meta_data->>'role','owner') = 'owner' — which is true both when role is
-- explicitly "owner" AND whenever role is absent entirely. The public /signup page's own bug
-- (fixed separately, application-layer, in feature/student-self-signup-stage-lock) always sent
-- role:"owner" explicitly, which is what actually fired in production — but the *coalesce
-- default* was never safe on its own: any future signup path that does not explicitly set
-- raw_user_meta_data.role (a magic link, an admin-invited user whose invite call forgot the
-- field, and — the immediate reason this is being fixed now — Google/OAuth sign-in, which does
-- not let the client control raw_user_meta_data the way supabase.auth.signUp() does) would hit
-- the exact same bug: a brand-new Owner workspace, silently, for anyone who signs up.
--
-- Fix: require role to be the literal string 'owner' — no default. Any other value, or no role
-- at all (the case for every OAuth/Google sign-in and every other future signup path), now
-- creates no organization at all. lib/auth/current-user.ts's getCurrentUser() already treats a
-- session with no organization_members row as role "student" (a pre-existing, already-safe
-- fallback — unchanged), and app/auth/callback/route.ts now completes a real academy-student
-- join for exactly that case (see the accompanying application-layer change). No table changed,
-- no data touched — this only replaces the function body.

begin;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_org_id uuid;
  v_name text;
  v_slug text;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name','')), '');
  insert into public.profiles(id,email,full_name,avatar_url)
  values(new.id,lower(new.email),coalesce(v_name,''),new.raw_user_meta_data->>'avatar_url')
  on conflict(id) do update set email=excluded.email,full_name=excluded.full_name,avatar_url=excluded.avatar_url,updated_at=now();
  if new.raw_user_meta_data->>'role'='owner' and not exists(select 1 from public.organization_members where user_id=new.id) then
    v_slug := trim(both '-' from regexp_replace(lower(coalesce(v_name,split_part(new.email,'@',1),'h2obook')), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(new.id::text,'-',''),1,8);
    insert into public.organizations(name,slug,owner_id) values(coalesce(v_name,'H2OBOOK Workspace'),v_slug,new.id) returning id into v_org_id;
    insert into public.organization_members(organization_id,user_id,role,status) values(v_org_id,new.id,'owner','active');
  end if;
  return new;
end;
$$;

commit;

-- Rollback: re-run 0024's original create-or-replace of public.handle_new_user() (restores the
-- coalesce(...,'owner') default). Not recommended — that is the exact behavior that caused the
-- live incident.
