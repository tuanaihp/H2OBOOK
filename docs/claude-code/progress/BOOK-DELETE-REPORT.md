# Book Permanent Delete — Implementation Report

## Request

Permanent book deletion (no trash) with two confirmations, and a truthful answer to whether
deletion also removes Supabase rows and Cloudflare R2 objects.

## Prior state (verified)

- `/books` had **Archive only** — `archiveBook` set `archivedAt` locally and PATCHed
  `status=archived`. No trash concept, no delete action, no `DELETE /api/books` route.
- `assets.deleted_at` existed and `DELETE /api/assets/[id]` soft-deleted the row — but
  `public.assets` has **no UPDATE/DELETE RLS policy**, so that update was silently a no-op
  under the user-scoped client, and the R2 object was never touched either way.
- `lib/storage/r2.ts` had no `DeleteObjectCommand`.
- `save_book_document()` wrote `page_elements.content` without `assetId` — cloud-loaded books
  lost every image reference (only a dead `blob:` `imageUrl` survived), which was also the root
  cause of imported books reloading to blank pages.

## Files changed

- `supabase/migrations/0074_h2obook_book_permanent_delete.sql`
  - `save_book_document` now persists `assetId`, `altText`, `caption` in element content.
  - `book_clones.source_book_id` → `on delete cascade` (lineage row removed; clone book survives).
  - `import_jobs.source_asset_id` → `on delete set null` (audit row kept, pointer cleared).
  - New `delete_book_permanently(org, client_key)` security-definer RPC: role check
    (owner/admin/designer/partner/teacher), resolves book by client_key or slug, deletes the book
    (children cascade), sweeps assets no other element/page-thumbnail/brand/source-child still
    references, collects `asset_variants` storage keys, cleans `image_import_regions`, and returns
    the R2 keys for the caller to delete.
- `lib/storage/r2.ts` — `deleteStoredObject(key)` (S3 delete is idempotent for missing keys).
- `app/api/books/[id]/route.ts` — `DELETE`: auth + org role check, calls the RPC, deletes the
  returned keys from R2 (best-effort; failures reported as `r2ObjectsFailed`, not a 500, because
  the database delete has already committed).
- `store/app-store.ts` — `removeBook(bookId)`: calls the API in production (404 counts as
  already-gone → local delete still proceeds), removes the record, clears
  `h2obook-document:`/`h2obook-semantic-`/`h2obook-reader-`/`h2obook-remix-` keys, and deletes
  `local:` IndexedDB assets that no remaining book still references.
- `app/books/page.tsx` — trash button per row + Modal requiring the user to type `XÓA`
  (second confirmation; the row click is the first). "Đã lưu trữ" status filter added so archived
  books remain reachable for permanent deletion; archive button hidden on archived rows.
- `app/globals.css` — `.icon-btn.danger`, `.btn-danger-solid`, `.delete-confirm*`.
- `app/api/books/cloud-load/route.ts` — maps `assetId`/`altText`/`caption` back onto elements.
- `tests/unit/book-delete.test.ts` — demo-mode local delete, cloud failure keeps the record,
  404 still deletes locally.

## Data flow

```
Trash icon (confirm 1) → modal, type "XÓA" (confirm 2) → store.removeBook
  → DELETE /api/books/<clientKey>?organizationId
      → delete_book_permanently RPC (role + org scope inside SQL)
      → books row deleted (pages/elements/versions/documents cascade)
      → orphan asset rows deleted; their storage_keys returned
      → R2 DeleteObjectCommand per key (best-effort)
  → local record removed, localStorage keys cleared, unshared local:* assets dropped from IndexedDB
```

## Honest limits

- **Migration not yet applied** — `0074` must run on the Supabase project before the API works;
  until then the route returns `BOOK_DELETE_FAILED` and the local record is kept (UI shows the
  error inside the modal).
- Books saved **before** this fix have no `assetId` in `page_elements.content` — the orphan sweep
  cannot find their assets, so their R2 objects stay behind (still billed). Re-saving those books
  once (open in editor → save) restores the references for future deletes.
- `local:` assets on *other* browsers/devices are unreachable — IndexedDB cleanup is per-browser.
- R2 failures leave orphan objects; `r2ObjectsFailed`/`r2Pending` in the response report the gap.

## Validation

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 errors (51 pre-existing warnings).
- `pnpm test` — 311 passed / 1 skipped (includes 3 new delete tests).
- `pnpm test:sql` — policy check passed.
- `pnpm validate:imports`, `pnpm validate:editor412` — pass.
- Not verified against a live Supabase/R2 — requires applying migration 0074 and a signed-in
  production session.
