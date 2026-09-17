import type { ImportDocument } from "@h2obook/input-core";
import type { SemanticContentNode } from "@h2obook/content-core";

const TEXT_NODE_TYPES = new Set(["heading", "paragraph", "quote", "list_item"]);

function collectText(nodes: SemanticContentNode[], output: string[]) {
  for (const node of nodes) {
    if (TEXT_NODE_TYPES.has(node.type)) {
      const line = (node.text ?? []).map((span) => span.text).join("").replace(/[ \t]+/g, " ").trim();
      if (line && line !== output[output.length - 1]) output.push(line);
    }
    collectText(node.children, output);
  }
}

export function extractStudentNoteText(result: ImportDocument, maxLength = 12_000) {
  const lines: string[] = [];
  collectText(result.document.root, lines);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").slice(0, maxLength).trim();
}

export function getStudentNoteConfidence(result: ImportDocument): number | null {
  const raw = result.metadata.averageConfidence ?? result.document.metadata.averageConfidence;
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}
