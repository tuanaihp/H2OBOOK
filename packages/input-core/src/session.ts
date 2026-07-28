import type { InputFormat } from "./types";

export type InputMode = "fixed_layout" | "editable_content" | "asset" | "full_page" | "ocr" | "manual_regions";
export type InputSessionStatus = "created" | "detected" | "validating" | "uploading" | "scanning" | "queued" | "processing" | "preview" | "correcting" | "committing" | "completed" | "recovery_required" | "failed" | "cancelled";
export type InputSession = {
  id: string; organizationId?: string; bookId?: string; sourceName: string; mimeType?: string;
  format: InputFormat; mode: InputMode; status: InputSessionStatus; idempotencyKey: string;
  createdAt: string; updatedAt: string; errorCode?: string; metadata: Record<string, unknown>;
};

const extensionMap: Record<string, InputFormat> = { docx: "docx", pdf: "pdf", png: "png", jpg: "jpeg", jpeg: "jpeg", jpe: "jpeg", html: "html", htm: "html", xhtml: "html", md: "markdown", markdown: "markdown", txt: "txt" };
export function detectInputFormat(input: { fileName?: string; mimeType?: string; url?: string }): InputFormat | null {
  if (input.url) return "url";
  const extension = input.fileName?.toLowerCase().split(".").pop() ?? "";
  if (extensionMap[extension]) return extensionMap[extension];
  const mime = input.mimeType?.toLowerCase() ?? "";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpeg";
  if (mime === "text/html" || mime === "application/xhtml+xml") return "html";
  if (mime === "text/markdown") return "markdown";
  if (mime === "text/plain") return "txt";
  return null;
}

export const inputModeMatrix: Record<InputFormat, InputMode[]> = {
  docx: ["editable_content"], pdf: ["fixed_layout", "editable_content", "ocr"], png: ["asset", "full_page", "ocr", "manual_regions"],
  jpeg: ["asset", "full_page", "ocr", "manual_regions"], html: ["editable_content"], markdown: ["editable_content"], txt: ["editable_content"], url: ["editable_content"],
};
