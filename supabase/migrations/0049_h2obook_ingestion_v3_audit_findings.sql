-- H2OBOOK — findings from the Ingestion Fabric V3 audit (docs/ingestion-v3/01-current-ingestion-audit.md)
--
-- The audit for v5/27-H2OBOOK_INGESTION_FABRIC_V3 found the real duplicate-detection gap the source
-- package describes, but found it in a different place than the package assumed. It proposed four new
-- tables (Source Registry / Version / Run / Artifact) to unify five ingestion mechanisms. Audited
-- against the real repo and real production data first: two of those five mechanisms
-- (Document Queue, Word/PDF Import) are already one system — the production Input Gateway
-- (`input_sessions`, migration 0021) — and a third ("Universal Ingestion", migration 0011) has zero
-- rows in production and zero callers anywhere in app/lib/components. Building four more tables on
-- top would have been a second parallel content store, which both this migration's source package and
-- CLAUDE.md explicitly forbid.
--
-- What the audit confirmed as a genuine, unfilled gap: nothing in the repository computes a real
-- content hash server-side. `assets.checksum` (migration 0005) exists but is only ever a
-- client-supplied, unverified, unindexed optional field — no code path checks it for duplicates.
-- This migration adds the index that capability needs; lib/storage/hash.ts and the updated
-- /api/storage/complete route (same PR) do the actual hashing and lookup.

begin;

-- Partial + excludes soft-deleted rows, matching the same shape as the other "live rows only"
-- indexes added for assets in migration 0048.
create index if not exists assets_org_checksum_idx
  on public.assets(organization_id, checksum) where checksum is not null and deleted_at is null;

-- The four "Universal Ingestion" (v4.5) tables below are not deleted — deleting a legacy mechanism in
-- the first release is exactly what both the audit's own source package and this project's established
-- practice forbid. They are marked so the next person who greps the schema does not read "exists" as
-- "in use": zero rows in production since creation, and zero readers/writers anywhere in the app for
-- three of the four (ingestion_sources, ingestion_segments, ingestion_mappings). ingestion_runs has one
-- writer, app/api/ingestion/jobs/route.ts, which itself has no caller in any page or component — see
-- the audit doc for the grep evidence.
comment on table public.ingestion_sources is
  'DEPRECATED (2026-08-09) — v4.5 Universal Ingestion. Zero rows in production, zero readers anywhere in the app. See docs/ingestion-v3/01-current-ingestion-audit.md. Not dropped: first-release policy is deprecate, not delete.';
comment on table public.ingestion_runs is
  'DEPRECATED (2026-08-09) — v4.5 Universal Ingestion. Written by app/api/ingestion/jobs/route.ts, which has no caller in the app (the live /ingestion page only calls /api/ingestion/url). Zero rows in production. See docs/ingestion-v3/01-current-ingestion-audit.md.';
comment on table public.ingestion_segments is
  'DEPRECATED (2026-08-09) — v4.5 Universal Ingestion. Zero rows in production, zero readers anywhere in the app. See docs/ingestion-v3/01-current-ingestion-audit.md.';
comment on table public.ingestion_mappings is
  'DEPRECATED (2026-08-09) — v4.5 Universal Ingestion. Zero rows in production, zero readers anywhere in the app. See docs/ingestion-v3/01-current-ingestion-audit.md.';

commit;

-- Rollback:
--   comment on table public.ingestion_mappings is null;
--   comment on table public.ingestion_segments is null;
--   comment on table public.ingestion_runs is null;
--   comment on table public.ingestion_sources is null;
--   drop index if exists public.assets_org_checksum_idx;
