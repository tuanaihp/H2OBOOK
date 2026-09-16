import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BOOK_STATUSES = new Set(["draft", "published", "archived"]);

/**
 * Flips a book's status by its client key without touching pages/elements — publishing or
 * archiving is a one-column operation, while cloud-save rewrites the whole document. Roles match
 * the "books editor write" RLS policy so the database stays the second gate.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { bookId } = await params;
  const body = await request.json().catch(() => null) as { organizationId?: string; status?: string } | null;
  if (!bookId || !body?.status || !BOOK_STATUSES.has(body.status)) {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }
  const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner", "admin", "designer", "partner"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  if (auth.user!.demo || !isSupabaseConfigured()) return NextResponse.json({ mode: "demo", updated: false });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  const { data, error } = await supabase
    .from("books")
    .update({
      status: body.status,
      archived_at: body.status === "archived" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", access.organizationId)
    .eq("client_key", bookId)
    .is("deleted_at", null)
    .select("id,status")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "BOOK_STATUS_FAILED", message: "Không cập nhật được trạng thái sách.", retryable: true }, { status: 500 });
  if (!data) return NextResponse.json({ error: "BOOK_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ mode: "cloud", updated: true, book: data });
}
