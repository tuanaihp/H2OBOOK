import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadCareerStages } from "@/lib/career-stages/service";
import { factsForResource, loadStudentAccessContext } from "@/lib/content-access/facts";
import { resolveResourceAccess } from "@/lib/content-access/resolver";

// Reads one curriculum document for one student, and decides whether they may see it.
//
// Access is not re-derived here. The document is reachable from the curriculum only through a
// career_stage_resources placement, so the question "may this student read it" is the same question
// the library grid already answers, and it goes through the same resolver. Anything else would let
// the reader and the library disagree — the exact failure where a locked card is hidden from the
// list but still opens if the URL is known.

export interface DocumentStructuredContent {
  objectives?: string[];
  principles?: string[];
  workflow?: string[];
  case?: string;
  studentAction?: string;
  evidence?: string[];
  kpis?: string[];
  mistakes?: string[];
  coach?: string[];
  teacherNote?: string;
  estimatedMinutes?: number;
  completionPolicy?: { requiresEvidence?: boolean; requiresReflection?: boolean; minimumEvidenceCount?: number };
}

export interface CurriculumDocumentView {
  id: string;
  title: string;
  summary: string;
  docType: string;
  bodyMarkdown: string;
  contentVersion: number;
  structured: DocumentStructuredContent;
  stageTitle: string;
  stageIndexLabel: string;
  requirementType: string;
}

export type DocumentReadResult =
  | { status: "ok"; document: CurriculumDocumentView }
  | { status: "locked"; reason: string; stageTitle: string }
  | { status: "not_found" };

export async function loadCurriculumDocumentForStudent(
  userId: string, organizationId: string, documentId: string
): Promise<DocumentReadResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "not_found" };

  // A UUID-shaped id is required before it reaches the query — resource_id is a text column, so a
  // malformed value would otherwise reach Postgres as a literal and match nothing in a way that
  // reads identically to "does not exist".
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)) return { status: "not_found" };

  const { data: docRow } = await admin
    .from("curriculum_documents")
    .select("id,title,summary,doc_type,body_markdown,content_version,structured_content,status")
    .eq("organization_id", organizationId)
    .eq("id", documentId)
    .maybeSingle();
  if (!docRow || docRow.status === "archived") return { status: "not_found" };

  const stages = await loadCareerStages(organizationId);
  let placementStage: { title: string; indexLabel: string } | null = null;
  let placement: { resourceType: string; resourceId: string; requirementType: string } | null = null;
  for (const stage of stages) {
    const match = stage.resources.find((resource) => resource.resourceType === "document" && resource.resourceId === documentId);
    if (match) {
      placementStage = { title: stage.title, indexLabel: stage.indexLabel };
      placement = { resourceType: match.resourceType, resourceId: match.resourceId, requirementType: match.requirementType };
      break;
    }
  }
  // Not placed in any stage means it is not part of the curriculum a student navigates — the
  // document may exist in the admin's catalog, but there is no route by which a student is entitled
  // to it, so this is a 404 for them rather than a lock they could resolve.
  if (!placement || !placementStage) return { status: "not_found" };

  const accessContext = await loadStudentAccessContext(userId, organizationId);
  const decision = accessContext ? resolveResourceAccess(factsForResource(accessContext, placement)) : null;
  if (decision?.access !== "granted") {
    return { status: "locked", reason: decision?.reason ?? "STAGE_LOCKED", stageTitle: placementStage.title };
  }

  return {
    status: "ok",
    document: {
      id: String(docRow.id),
      title: String(docRow.title),
      summary: String(docRow.summary ?? ""),
      docType: String(docRow.doc_type ?? "article"),
      bodyMarkdown: String(docRow.body_markdown ?? ""),
      contentVersion: Number(docRow.content_version ?? 1),
      structured: (docRow.structured_content ?? {}) as DocumentStructuredContent,
      stageTitle: placementStage.title,
      stageIndexLabel: placementStage.indexLabel,
      requirementType: placement.requirementType
    }
  };
}
