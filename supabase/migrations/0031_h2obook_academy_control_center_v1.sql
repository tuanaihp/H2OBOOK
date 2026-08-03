-- H2OBOOK Academy Control Center V1
-- Adapted from v5/15-h2obook-academy-control-center-v1. The reference module proposes a full
-- parallel content model (ContentAsset, Lesson, Course, CourseModule, Roadmap, EntitlementGrant,
-- Enrollment, QualityIssue — its own types.ts). This repo already has real, live tables that
-- model almost all of it: public.academy_courses/academy_course_modules/academy_course_lessons
-- (0024, with a full draft/published/archived status workflow, video fields, skill_keys,
-- content jsonb) and public.entitlements (0001, resource_type/resource_id/source_type/status).
-- No parallel Course/Lesson/Entitlement tables were created — the Course Builder and Distribution
-- Center this pass ships read/write those tables directly (see lib/academy-admin/*).
--
-- The one real gap: public.entitlements has no admin-facing INSERT/UPDATE RLS policy at all
-- (its only existing policy, "entitlements self read" from 0001, is SELECT-only — every write
-- today happens through mark_order_paid(), a security-definer function that bypasses RLS
-- entirely) and no reason/granted_by columns, both required by the module's own Phase 8 ("Manual
-- grant must require: User, Resource, Start date, Expiry, Reason, Granting actor, Audit event").
-- This migration adds exactly those two additive columns, the missing admin write policies, and
-- an audit trigger reusing the existing capture_domain_event() function (0007) rather than a new
-- audit table.

begin;

alter table public.entitlements add column if not exists reason text;
alter table public.entitlements add column if not exists granted_by uuid references public.profiles(id) on delete set null;

create policy "entitlements admin manual grant insert"
on public.entitlements for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create policy "entitlements admin update"
on public.entitlements for update
to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create trigger entitlements_domain_event after insert or update or delete on public.entitlements
for each row execute function public.capture_domain_event();

commit;
