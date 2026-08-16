-- H2OBOOK AI Provider Gateway V1 ("Cổng API")
--
-- One new table, additive only. Reuses lib/enterprise/secret-box.ts's exact AES-256-GCM mechanism
-- (already live for webhook_endpoints.secret_ciphertext, migration 0018) rather than inventing a
-- second encryption scheme — same ENCRYPTION_KEY/WEBHOOK_ENCRYPTION_KEY env var, same organization-
-- scoped owner/admin RLS shape public_api_keys and webhook_endpoints already use (migration 0017).
--
-- Unlike public_api_keys (which only ever stores a one-way hash — a key H2OBOOK ISSUES to outside
-- callers, never read back), this table stores an outbound credential H2OBOOK itself must later
-- DECRYPT and use to call Gemini/OpenAI/Grok/etc. on the organization's behalf — hence ciphertext,
-- not a hash, mirroring webhook_endpoints' secret_ciphertext column exactly.

begin;

create table if not exists public.ai_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('gemini','openai','xai')),
  label text not null default '',
  api_key_ciphertext text not null,
  -- Last 4 characters of the real key, stored in the clear purely so the admin can tell two saved
  -- keys apart in the UI ("...aB3d" vs "...9kLp") without ever re-displaying the full secret.
  api_key_last4 text not null,
  capabilities text[] not null default '{}',
  status text not null default 'untested' check (status in ('untested','connected','failed')),
  last_tested_at timestamptz,
  last_test_error text,
  enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_provider_credentials_org_idx on public.ai_provider_credentials(organization_id, provider);

alter table public.ai_provider_credentials enable row level security;

drop policy if exists "ai provider credentials owner admin read" on public.ai_provider_credentials;
create policy "ai provider credentials owner admin read" on public.ai_provider_credentials for select to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop policy if exists "ai provider credentials owner admin write" on public.ai_provider_credentials;
create policy "ai provider credentials owner admin write" on public.ai_provider_credentials for all to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

commit;

-- Rollback:
--   drop table if exists public.ai_provider_credentials;
