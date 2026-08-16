import "server-only";
import { safeFetchDocument } from "@/lib/ingestion/safe-fetch";
import { parseHtml } from "@h2obook/ingestion-core";
import type { SemanticContentNode } from "@h2obook/content-core";

/**
 * Deterministic text extraction — reuses infrastructure that already exists and is already deployed,
 * rather than adding anything new. DOCX uses mammoth (already a project dependency, used today for
 * Word Import 2.0 — extractRawText specifically, not the HTML/formatting path CLAUDE.md forbids as a
 * *final book import*: that prohibition is about losing formatting fidelity when reconstructing a
 * book page-by-page, which does not apply here — a Knowledge Unit's body is reviewed/edited by an
 * admin before publish either way, plain text is the right output shape for it.
 *
 * URL reuses safeFetchDocument (SSRF-guarded fetch, lib/ingestion/safe-fetch.ts) + parseHtml
 * (packages/ingestion-core), the exact same pipeline already used for the "HTML URL" ingestion mode
 * CLAUDE.md's own capability table lists as implemented.
 *
 * Image (OCR) and PDF are NOT implemented here — the codebase's own established OCR path
 * (lib/input/image-import.ts) requires the Python document-processor worker, gated behind
 * DOCUMENT_WORKER_URL, which is unset in this deployment (local and Vercel production both
 * confirmed empty 2026-08-16). Adding a second, client/serverless-bundled OCR engine (e.g.
 * tesseract.js) would fragment that already-planned architecture and carries real operational risk
 * on Vercel serverless (WASM + language data downloaded at cold start) — deferred until the worker
 * is actually deployed, not silently faked here.
 */

function nodeText(node: SemanticContentNode): string {
  return (node.text ?? []).map((span) => span.text).join("");
}

function nodesToMarkdown(nodes: SemanticContentNode[]): string {
  const lines: string[] = [];
  const walk = (list: SemanticContentNode[]) => {
    for (const node of list) {
      const text = nodeText(node).trim();
      switch (node.type) {
        case "chapter": lines.push(`# ${text}`); break;
        case "section": lines.push(`## ${text}`); break;
        case "heading": lines.push(`${"#".repeat(Math.min(6, Number(node.attrs?.level) || 3))} ${text}`); break;
        case "list_item": lines.push(`- ${text}`); break;
        case "quote": lines.push(`> ${text}`); break;
        case "paragraph": if (text) lines.push(text); break;
        default: break;
      }
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return lines.join("\n\n").trim();
}

export interface ExtractionResult { title: string | null; bodyMarkdown: string; sourceUrl?: string }

const MAX_DOCX_BYTES = 15_000_000;

export async function extractTextFromDocx(buffer: Buffer, fileName: string): Promise<ExtractionResult> {
  if (buffer.byteLength > MAX_DOCX_BYTES) throw new Error("FILE_TOO_LARGE");
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const bodyMarkdown = result.value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { title: fileName.replace(/\.docx$/i, ""), bodyMarkdown };
}

export async function extractTextFromUrl(url: string): Promise<ExtractionResult> {
  const fetched = await safeFetchDocument(url);
  const isHtmlLike = ["text/html", "application/xhtml+xml"].includes(fetched.contentType);
  const bodyMarkdown = isHtmlLike ? nodesToMarkdown(parseHtml(fetched.body)) : fetched.body.trim();
  return { title: fetched.title?.trim() || null, bodyMarkdown, sourceUrl: fetched.url };
}
