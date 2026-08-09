import "server-only";
import { createHash } from "node:crypto";
import { readStoredObject } from "@/lib/storage/r2";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

// Files above this size are not hashed. readStoredObject buffers the whole object into memory — an
// accepted pattern here (app/api/input/html/preview already does it for arbitrary uploads), but the
// malware scan step deliberately avoids it by delegating to an external scanner over a signed URL
// instead of reading the object into this process. Doing the same for every upload up to the
// 250 MB ceiling (MAX_UPLOAD_BYTES) would add real memory pressure to a serverless function for the
// large end of the range — video/audio, mainly — where a missed duplicate is a low-severity, disclosed
// limitation, not a correctness bug: the asset still uploads and works, it just isn't deduplicated.
export const HASHABLE_MAX_BYTES = 64 * 1024 * 1024;

/** SHA-256 of a stored object's bytes, or null if it's over HASHABLE_MAX_BYTES. */
export async function hashStoredObject(key: string, sizeBytes: number): Promise<string | null> {
  if (sizeBytes > HASHABLE_MAX_BYTES) return null;
  const bytes = await readStoredObject(key);
  return createHash("sha256").update(bytes).digest("hex");
}

export interface DuplicateAssetMatch {
  id: string;
  originalName: string;
  createdAt: string;
}

/**
 * The organization's existing asset with this exact content, if any. Scoped to organization_id, so
 * this can never reveal that another tenant already has a matching file — dedup is a same-org
 * convenience (reuse instead of re-upload), not a cross-tenant content index.
 */
export async function findDuplicateAsset(supabase: SupabaseServerClient, organizationId: string, checksum: string): Promise<DuplicateAssetMatch | null> {
  const { data } = await supabase
    .from("assets")
    .select("id,original_name,created_at")
    .eq("organization_id", organizationId)
    .eq("checksum", checksum)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  const row = data as { id: string; original_name: string; created_at: string } | null;
  return row ? { id: row.id, originalName: row.original_name, createdAt: row.created_at } : null;
}
