-- H2OBOOK — make analytics_events.event_id a usable ON CONFLICT target
--
-- Every analytics POST from the browser was answering 400 with
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- so the client queue never drained and retried the same batch on every page.
--
-- Cause: migration 0015 created the uniqueness as a PARTIAL index —
--   create unique index analytics_event_id_unique on analytics_events(event_id) where event_id is not null;
-- PostgreSQL will only infer a partial index as an ON CONFLICT target when the statement repeats
-- the same predicate, and PostgREST's on_conflict never sends one. So the index existed, enforced
-- uniqueness correctly, and was invisible to the upsert.
--
-- The predicate was pointless anyway: app/api/analytics/events always sends event_id, and a plain
-- unique index still permits many NULL rows because Postgres treats NULLs as distinct by default.
-- Dropping the predicate therefore changes nothing about what is allowed and makes the upsert work.
--
-- Safe on existing data: the partial index already enforced uniqueness over every non-null value,
-- so no duplicate can be present for the new index to trip on.

begin;

drop index if exists public.analytics_event_id_unique;
create unique index if not exists analytics_event_id_unique on public.analytics_events(event_id);

commit;

-- Rollback:
--   drop index if exists public.analytics_event_id_unique;
--   create unique index analytics_event_id_unique on public.analytics_events(event_id) where event_id is not null;
-- Restores 0015 exactly — and with it the 400 on every analytics batch.
