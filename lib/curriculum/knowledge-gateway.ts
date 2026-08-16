import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AcademyAdminAccess } from "@/lib/academy-admin/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
type Sb = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export type KnowledgeAuthority = "h2o_official" | "external_reference" | "ai_suggestion";
export type KnowledgeEditorialStatus = "draft" | "review" | "published" | "archived";
export type KnowledgeDocType = "article" | "checklist" | "rubric" | "practice" | "worksheet" | "template" | "assessment" | "case_study" | "sop" | "script" | "tool_guide" | "playbook" | "assignment";

export interface KnowledgeUnitSummary {
  id: string; title: string; summary: string; docType: KnowledgeDocType; tags: string[];
  authority: KnowledgeAuthority; skillCode: string | null; editorialStatus: KnowledgeEditorialStatus;
  currentPublishedVersionNumber: number | null; updatedAt: string;
}
export interface KnowledgeUnitDetail extends KnowledgeUnitSummary {
  bodyMarkdown: string; latestDraft: { versionId: string; versionNumber: number; bodyMarkdown: string; changeNote: string } | null;
}

/**
 * "Cổng nạp kiến thức" — Admin Knowledge Gateway V1 (docs/knowledge-gateway-v1). curriculum_documents
 * (migration 0045) IS the Knowledge Unit table; this only adds the editorial workflow this feature
 * needs on top of it (draft -> review -> published -> archived, tracked via editorial_status —
 * separate from the pre-existing `status` visibility toggle, which keeps its exact old meaning).
 */
export async function listKnowledgeUnits(access: AcademyAdminAccess, filters?: { q?: string; docType?: string; editorialStatus?: KnowledgeEditorialStatus }): Promise<KnowledgeUnitSummary[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let query = supabase.from("curriculum_documents")
    .select("id,title,summary,doc_type,tags,authority,skill_code,editorial_status,updated_at,current_published_version_id")
    .eq("organization_id", access.organizationId).order("updated_at", { ascending: false }).limit(200);
  if (filters?.docType) query = query.eq("doc_type", filters.docType);
  if (filters?.editorialStatus) query = query.eq("editorial_status", filters.editorialStatus);
  if (filters?.q?.trim()) query = query.ilike("title", `%${filters.q.trim()}%`);
  const { data } = await query;
  const rows = (data ?? []) as { id: string; title: string; summary: string; doc_type: KnowledgeDocType; tags: string[]; authority: KnowledgeAuthority; skill_code: string | null; editorial_status: KnowledgeEditorialStatus; updated_at: string; current_published_version_id: string | null }[];

  const versionIds = rows.map((r) => r.current_published_version_id).filter((v): v is string => Boolean(v));
  const versionNumberById = new Map<string, number>();
  if (versionIds.length) {
    const { data: versions } = await supabase.from("curriculum_document_versions").select("id,version_number").in("id", versionIds);
    for (const v of (versions ?? []) as { id: string; version_number: number }[]) versionNumberById.set(v.id, v.version_number);
  }

  return rows.map((r) => ({
    id: r.id, title: r.title, summary: r.summary, docType: r.doc_type, tags: r.tags ?? [], authority: r.authority,
    skillCode: r.skill_code, editorialStatus: r.editorial_status,
    currentPublishedVersionNumber: r.current_published_version_id ? versionNumberById.get(r.current_published_version_id) ?? null : null,
    updatedAt: r.updated_at
  }));
}

export async function getKnowledgeUnitDetail(access: AcademyAdminAccess, id: string): Promise<KnowledgeUnitDetail | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: doc } = await supabase.from("curriculum_documents").select("id,title,summary,body_markdown,doc_type,tags,authority,skill_code,editorial_status,updated_at,current_published_version_id").eq("organization_id", access.organizationId).eq("id", id).maybeSingle();
  if (!doc) return null;
  const row = doc as { id: string; title: string; summary: string; body_markdown: string; doc_type: KnowledgeDocType; tags: string[]; authority: KnowledgeAuthority; skill_code: string | null; editorial_status: KnowledgeEditorialStatus; updated_at: string; current_published_version_id: string | null };

  const { data: latest } = await supabase.from("curriculum_document_versions").select("id,version_number,body_markdown,change_note").eq("organization_id", access.organizationId).eq("document_id", id).eq("status", "draft").order("version_number", { ascending: false }).limit(1).maybeSingle();
  const draftRow = latest as { id: string; version_number: number; body_markdown: string; change_note: string } | null;

  let currentPublishedVersionNumber: number | null = null;
  if (row.current_published_version_id) {
    const { data: pv } = await supabase.from("curriculum_document_versions").select("version_number").eq("id", row.current_published_version_id).maybeSingle();
    currentPublishedVersionNumber = (pv as { version_number: number } | null)?.version_number ?? null;
  }

  return {
    id: row.id, title: row.title, summary: row.summary, bodyMarkdown: row.body_markdown, docType: row.doc_type,
    tags: row.tags ?? [], authority: row.authority, skillCode: row.skill_code, editorialStatus: row.editorial_status,
    currentPublishedVersionNumber, updatedAt: row.updated_at,
    latestDraft: draftRow ? { versionId: draftRow.id, versionNumber: draftRow.version_number, bodyMarkdown: draftRow.body_markdown, changeNote: draftRow.change_note } : null
  };
}

export interface CreateKnowledgeUnitInput {
  title: string; summary?: string; bodyMarkdown: string; docType: KnowledgeDocType; tags?: string[];
  authority?: KnowledgeAuthority; skillCode?: string;
}

/** "Viết trực tiếp" / "Từ thư viện" (paste text once linked) mode — a real curriculum_documents row, status='hidden' (invisible to students/Reader until an admin places it) + editorial_status='draft' (invisible to Coach until published), plus its v1 draft version. */
export async function createKnowledgeUnit(access: AcademyAdminAccess, input: CreateKnowledgeUnitInput): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  if (!input.title.trim() || !input.bodyMarkdown.trim()) return { ok: false, error: "TITLE_AND_BODY_REQUIRED" };

  const { data: doc, error } = await supabase.from("curriculum_documents").insert({
    organization_id: access.organizationId, title: input.title.trim(), summary: input.summary?.trim() ?? "",
    body_markdown: input.bodyMarkdown, doc_type: input.docType, tags: input.tags ?? [],
    authority: input.authority ?? "h2o_official", skill_code: input.skillCode?.trim() || null,
    editorial_status: "draft", status: "hidden", created_by: access.userId
  }).select("id").single();
  if (error || !doc) return { ok: false, error: error?.message ?? "CREATE_FAILED" };

  const { error: versionError } = await supabase.from("curriculum_document_versions").insert({
    organization_id: access.organizationId, document_id: doc.id, version_number: 1, title: input.title.trim(),
    summary: input.summary?.trim() ?? "", body_markdown: input.bodyMarkdown, status: "draft", created_by: access.userId
  });
  if (versionError) return { ok: false, error: versionError.message };
  return { ok: true, data: { id: doc.id } };
}

/** Edits (or creates, if none exists yet) the ONE draft version for a Knowledge Unit — publishing is a separate explicit action, never implicit in a save. */
export async function saveKnowledgeDraft(access: AcademyAdminAccess, documentId: string, input: { title?: string; summary?: string; bodyMarkdown?: string; changeNote?: string; skillCode?: string; authority?: KnowledgeAuthority }): Promise<Result<{ versionId: string; versionNumber: number }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const org = access.organizationId;

  const { data: doc } = await supabase.from("curriculum_documents").select("id,title,summary,skill_code,authority").eq("organization_id", org).eq("id", documentId).maybeSingle();
  if (!doc) return { ok: false, error: "DOCUMENT_NOT_FOUND" };
  const current = doc as { id: string; title: string; summary: string; skill_code: string | null; authority: KnowledgeAuthority };

  const { data: existingDraft } = await supabase.from("curriculum_document_versions").select("id,version_number").eq("organization_id", org).eq("document_id", documentId).eq("status", "draft").order("version_number", { ascending: false }).limit(1).maybeSingle();

  const title = input.title?.trim() || current.title;
  const summary = input.summary ?? current.summary;

  if (existingDraft) {
    const row = existingDraft as { id: string; version_number: number };
    const { error } = await supabase.from("curriculum_document_versions").update({ title, summary, body_markdown: input.bodyMarkdown ?? undefined, change_note: input.changeNote ?? "" }).eq("id", row.id);
    if (error) return { ok: false, error: error.message };
    await syncDraftMetadata(supabase, org, documentId, { title, summary, skillCode: input.skillCode ?? current.skill_code ?? undefined, authority: input.authority ?? current.authority });
    return { ok: true, data: { versionId: row.id, versionNumber: row.version_number } };
  }

  const { data: latest } = await supabase.from("curriculum_document_versions").select("version_number").eq("organization_id", org).eq("document_id", documentId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const nextNumber = latest ? Number((latest as { version_number: number }).version_number) + 1 : 1;
  const { data: created, error } = await supabase.from("curriculum_document_versions").insert({
    organization_id: org, document_id: documentId, version_number: nextNumber, title, summary,
    body_markdown: input.bodyMarkdown ?? "", change_note: input.changeNote ?? "", status: "draft", created_by: access.userId
  }).select("id").single();
  if (error || !created) return { ok: false, error: error?.message ?? "DRAFT_CREATE_FAILED" };
  await syncDraftMetadata(supabase, org, documentId, { title, summary, skillCode: input.skillCode ?? current.skill_code ?? undefined, authority: input.authority ?? current.authority });
  return { ok: true, data: { versionId: created.id, versionNumber: nextNumber } };
}

/** Metadata (title/summary/skill_code/authority) lives once on curriculum_documents, not duplicated per version except for change history — keep it in sync with whatever the latest draft says. */
async function syncDraftMetadata(supabase: Sb, org: string, documentId: string, patch: { title: string; summary: string; skillCode?: string; authority?: KnowledgeAuthority }) {
  await supabase.from("curriculum_documents").update({ title: patch.title, summary: patch.summary, skill_code: patch.skillCode || null, authority: patch.authority, updated_at: new Date().toISOString() }).eq("organization_id", org).eq("id", documentId);
}

/**
 * Publish — the only action that makes a Knowledge Unit's content usable as real Coach grounding
 * (getKnowledgeContext() only ever reads editorial_status='published'). Copies the draft version's
 * body onto curriculum_documents.body_markdown (what every existing reader of that column already
 * expects to find there) and marks the version itself published, mirroring the exact pattern this
 * session has now used 3 times for other versioned tables.
 */
export async function publishKnowledgeUnit(access: AcademyAdminAccess, documentId: string, versionId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const org = access.organizationId;

  const { data: version } = await supabase.from("curriculum_document_versions").select("id,title,summary,body_markdown").eq("organization_id", org).eq("id", versionId).eq("document_id", documentId).maybeSingle();
  if (!version) return { ok: false, error: "VERSION_NOT_FOUND" };
  const v = version as { id: string; title: string; summary: string; body_markdown: string };

  const publishedAt = new Date().toISOString();
  const { error: versionError } = await supabase.from("curriculum_document_versions").update({ status: "published", published_at: publishedAt }).eq("id", versionId);
  if (versionError) return { ok: false, error: versionError.message };

  const { error: docError } = await supabase.from("curriculum_documents").update({
    title: v.title, summary: v.summary, body_markdown: v.body_markdown,
    editorial_status: "published", current_published_version_id: versionId, updated_at: publishedAt
  }).eq("organization_id", org).eq("id", documentId);
  if (docError) return { ok: false, error: docError.message };
  return { ok: true, data: null };
}

export async function archiveKnowledgeUnit(access: AcademyAdminAccess, documentId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("curriculum_documents").update({ editorial_status: "archived", updated_at: new Date().toISOString() }).eq("organization_id", access.organizationId).eq("id", documentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
