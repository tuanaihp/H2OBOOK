import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { extractTextFromDocx, extractTextFromUrl } from "@/lib/curriculum/document-extraction";
import { suggestKnowledgeFromText } from "@/lib/curriculum/knowledge-ai-assist";

const MAX_UPLOAD_BYTES = 15_000_000;

/**
 * Draft-only extraction — never writes to curriculum_documents/curriculum_document_versions itself.
 * Returns { title, summary, docType, skillCode, bodyMarkdown, usedAi } for the admin's "Viết trực
 * tiếp" form to prefill; the admin still reviews and explicitly saves + publishes (§10 "AI không tự
 * publish"). Accepts either a DOCX file (multipart `file` field) or a URL (`url` field) — never both.
 */
export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "INVALID_FORM" }, { status: 400 });
  const file = form.get("file");
  const url = form.get("url");

  let extracted: { title: string | null; bodyMarkdown: string; sourceUrl?: string };
  try {
    if (file instanceof File) {
      if (!file.name.toLowerCase().endsWith(".docx")) return NextResponse.json({ error: "ONLY_DOCX_SUPPORTED" }, { status: 400 });
      if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
      const buffer = Buffer.from(await file.arrayBuffer());
      extracted = await extractTextFromDocx(buffer, file.name);
    } else if (typeof url === "string" && url.trim()) {
      extracted = await extractTextFromUrl(url.trim());
    } else {
      return NextResponse.json({ error: "FILE_OR_URL_REQUIRED" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "EXTRACTION_FAILED" }, { status: 400 });
  }

  if (!extracted.bodyMarkdown.trim()) return NextResponse.json({ error: "NO_TEXT_FOUND" }, { status: 400 });

  const suggestion = await suggestKnowledgeFromText(access!.organizationId, extracted.bodyMarkdown);
  if (suggestion) {
    return NextResponse.json({ title: suggestion.title, summary: suggestion.summary, docType: suggestion.docType, skillCode: suggestion.skillCode, bodyMarkdown: suggestion.bodyMarkdown, sourceUrl: extracted.sourceUrl, usedAi: true });
  }
  return NextResponse.json({ title: extracted.title ?? "", summary: "", docType: "article", skillCode: null, bodyMarkdown: extracted.bodyMarkdown, sourceUrl: extracted.sourceUrl, usedAi: false });
}
