-- H2OBOOK 4.14.1 — Per-student storage quota for self-service Design Library

alter table public.organization_members add column if not exists storage_quota_bytes bigint;

create index if not exists assets_org_uploader_idx on public.assets (organization_id, uploaded_by);

comment on column public.organization_members.storage_quota_bytes is
  'Optional per-membership storage cap in bytes. Null falls back to the role-based default in lib/storage/quota.ts (students only; other roles remain unlimited).';
