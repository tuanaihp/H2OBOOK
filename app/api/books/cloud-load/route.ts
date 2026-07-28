import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { H2OElement, H2OPage } from "@/types/editor";

export async function GET(request: Request) {
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  const url = new URL(request.url); const clientKey = url.searchParams.get("clientKey");
  if (!clientKey) return NextResponse.json({ error: "CLIENT_KEY_REQUIRED" }, { status: 400 });
  const access = await resolveOrganizationAccess(auth.user!, url.searchParams.get("organizationId") ?? undefined);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient(); if (!supabase) return NextResponse.json({ mode: "demo", book: null });
  const { data: book, error } = await supabase.from("books").select("id,client_key,title,subtitle,description,author,status,cover,updated_at").eq("organization_id", access.organizationId).eq("client_key", clientKey).is("deleted_at", null).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!book) return NextResponse.json({ mode: "cloud", book: null });
  const { data: pages, error: pageError } = await supabase.from("book_pages").select("id,client_key,name,position,width,height,background,metadata,revision").eq("book_id", book.id).order("position", { ascending: true });
  if (pageError) return NextResponse.json({ error: pageError.message }, { status: 400 });
  const pageIds = (pages ?? []).map(page => page.id);
  const { data: elements, error: elementError } = pageIds.length ? await supabase.from("page_elements").select("id,page_id,client_key,element_type,name,position_index,transform,content,style,binding,permissions,locked,hidden,revision").in("page_id", pageIds).order("position_index", { ascending: true }) : { data: [], error: null };
  if (elementError) return NextResponse.json({ error: elementError.message }, { status: 400 });
  const mappedPages: H2OPage[] = (pages ?? []).map(page => {
    const background = page.background as { value?: string } | null; const metadata = (page.metadata ?? {}) as Record<string, unknown>;
    const mappedElements: H2OElement[] = (elements ?? []).filter(element => element.page_id === page.id).map(element => {
      const transform = (element.transform ?? {}) as Record<string, number>; const content = (element.content ?? {}) as Record<string, string>; const style = (element.style ?? {}) as Record<string, unknown>; const binding = (element.binding ?? {}) as Record<string, unknown>;
      return {
        id: element.client_key ?? element.id, type: element.element_type as H2OElement["type"], name: element.name,
        x: Number(transform.x ?? 0), y: Number(transform.y ?? 0), width: Number(transform.width ?? 100), height: Number(transform.height ?? 100), rotation: Number(transform.rotation ?? 0), opacity: Number(transform.opacity ?? 1),
        locked: Boolean(element.locked), hidden: Boolean(element.hidden), text: content.text, sourceText: content.sourceText, imageUrl: content.imageUrl, qrValue: content.qrValue, sourceQrValue: content.sourceQrValue,
        fill: style.fill as string | undefined, stroke: style.stroke as string | undefined, strokeWidth: style.strokeWidth as number | undefined, dash: style.dash as number[] | undefined,
        fontSize: style.fontSize as number | undefined, fontFamily: style.fontFamily as string | undefined, fontWeight: style.fontWeight as number | undefined,
        fontStyle: style.fontStyle as H2OElement["fontStyle"], textDecoration: style.textDecoration as H2OElement["textDecoration"], lineHeight: style.lineHeight as number | undefined, letterSpacing: style.letterSpacing as number | undefined,
        align: style.align as H2OElement["align"], verticalAlign: style.verticalAlign as H2OElement["verticalAlign"], imageFit: style.imageFit as H2OElement["imageFit"], cornerRadius: style.cornerRadius as number | undefined, shadow: style.shadow as H2OElement["shadow"],
        bindingKey: binding.key as string | undefined, bindingFallback: binding.fallback as string | undefined, sourceElementId: binding.sourceElementId as string | undefined, sourceRevision: binding.sourceRevision as number | undefined, localRevision: Number(binding.localRevision ?? element.revision ?? 1),
        permissions: element.permissions as H2OElement["permissions"]
      };
    });
    return { id: page.client_key ?? page.id, name: page.name, width: page.width, height: page.height, background: background?.value ?? "#ffffff", pageType: metadata.pageType as H2OPage["pageType"], chapter: metadata.chapter as string | undefined, notes: metadata.notes as string | undefined, hidden: metadata.hidden as boolean | undefined, masterPageId: metadata.masterPageId as string | undefined, elements: mappedElements };
  });
  const cover = book.cover as { value?: string } | null;
  return NextResponse.json({ mode: "cloud", book: { id: book.client_key ?? clientKey, title: book.title, subtitle: book.subtitle, description: book.description, author: book.author, cover: cover?.value ?? "linear-gradient(135deg,#6f1d46,#b45f83)", status: book.status === "published" ? "published" : "draft", pages: mappedPages, updatedAt: book.updated_at } });
}
