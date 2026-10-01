import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteStoredObject } from "@/lib/storage/r2";
import { isR2Configured } from "@/lib/runtime-config";

/**
 * Permanent book deletion — no trash. The book row hard-deletes (pages, elements, versions and
 * documents cascade in Postgres); delete_book_permanently() then sweeps asset rows that became
 * orphaned and returns their storage keys, which this route removes from R2 best-effort.
 *
 * R2 cleanup failure does NOT fail the request: the database delete has already committed by the
 * time objects are removed, so a failed delete is reported in `r2ObjectsFailed` for follow-up
 * sweeping rather than pretending the book still exists.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { bookId } = await params;
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  // Same role set the save path uses — anyone who can write a book may delete one.
  const access = await resolveOrganizationAccess(auth.user!, organizationId, ["owner", "admin", "designer", "partner", "teacher"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  // Demo sessions have no real organization — local deletion only, nothing to clean server-side.
  if (auth.user!.demo) return NextResponse.json({ mode: "demo", deleted: false });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ mode: "demo", deleted: false });

  const { data, error } = await supabase.rpc("delete_book_permanently", {
    p_organization_id: access.organizationId,
    p_client_key: bookId
  });
  if (error) {
    return NextResponse.json({ error: "BOOK_DELETE_FAILED", message: "Không xóa được sách. Thử lại sau.", retryable: true }, { status: 500 });
  }
  const result = data as { bookId?: string | null; storageKeys?: string[] } | null;
  if (!result?.bookId) return NextResponse.json({ error: "BOOK_NOT_FOUND", message: "Sách không tồn tại hoặc đã bị xóa." }, { status: 404 });

  const keys = (result.storageKeys ?? []).filter((key) => key.startsWith(`${access.organizationId}/`));
  let r2ObjectsDeleted = 0;
  let r2ObjectsFailed = 0;
  if (isR2Configured()) {
    for (const key of keys) {
      try {
        await deleteStoredObject(key);
        r2ObjectsDeleted += 1;
      } catch {
        r2ObjectsFailed += 1;
      }
    }
  }
  return NextResponse.json({
    mode: "cloud",
    deleted: true,
    bookId: result.bookId,
    r2ObjectsDeleted,
    r2ObjectsFailed,
    r2Pending: isR2Configured() ? 0 : keys.length
  });
}
