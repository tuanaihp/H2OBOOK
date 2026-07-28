import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { H2OBook } from "@/types/editor";

function slug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "untitled-book";
}

export async function POST(request: Request) {
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  const body = await request.json() as { organizationId?: string; book?: H2OBook };
  if (!body.book?.id || !body.book.title || !Array.isArray(body.book.pages)) return NextResponse.json({ error: "INVALID_BOOK" }, { status: 400 });
  const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner", "admin", "designer", "partner", "teacher"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ mode: "demo", saved: true, clientKey: body.book.id, savedAt: new Date().toISOString() });
  const suffix = body.book.id.slice(-8).toLowerCase().replace(/[^a-z0-9]/g, "") || crypto.randomUUID().slice(0, 8);
  const { data, error } = await supabase.rpc("save_book_document", { p_organization_id: access.organizationId, p_client_key: body.book.id, p_slug: `${slug(body.book.title)}-${suffix}`, p_payload: body.book });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ mode: "cloud", saved: true, bookId: data, clientKey: body.book.id, pages: body.book.pages.length, savedAt: new Date().toISOString() });
}
