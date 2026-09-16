import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Workspace book list for the signed-in member. Returns cloud metadata only — pages stay behind
 * /api/books/cloud-load so this stays cheap enough to run on every /books visit. Local seeds are
 * filtered out upstream by the client merge (a stub with no pages always defers to cloud-load).
 */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const access = await resolveOrganizationAccess(auth.user!, url.searchParams.get("organizationId") ?? undefined);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ mode: "demo", books: [] });

  const { data, error } = await supabase
    .from("books")
    .select("id,client_key,slug,title,subtitle,description,author,status,cover,current_version,page_width,page_height,updated_at,book_pages(count)")
    .eq("organization_id", access.organizationId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: "BOOK_LIST_FAILED", message: "Không tải được danh sách sách.", retryable: true }, { status: 500 });

  const books = (data ?? []).map((book) => ({
    id: book.client_key ?? book.id,
    serverId: book.id,
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle ?? "",
    description: book.description ?? "",
    author: book.author ?? "",
    status: book.status === "published" ? "published" : book.status === "archived" ? "archived" : "draft",
    cover: (book.cover as { value?: string } | null)?.value ?? "",
    version: book.current_version ?? 1,
    pageCount: (book.book_pages as { count: number }[] | null)?.[0]?.count ?? 0,
    pageSize: { width: book.page_width ?? 794, height: book.page_height ?? 1123 },
    updatedAt: book.updated_at
  }));
  return NextResponse.json({ mode: "cloud", books });
}
