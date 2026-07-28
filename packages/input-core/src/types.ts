import type { BookDocument, SemanticContentNode } from "@h2obook/content-core";

export type InputFormat = "docx" | "pdf" | "png" | "jpeg" | "html" | "markdown" | "txt" | "url";
export type ImportSeverity = "info" | "warning" | "error";
export type ImportWarning = { code: string; message: string; severity: ImportSeverity; context?: Record<string, unknown> };
export type ImportedAsset = { assetId: string; previewUrl: string; fileName: string; mimeType: string; sourceRelationshipId?: string };
export type ImportStatistics = {
  nodes: number;
  headings: number;
  paragraphs: number;
  lists: number;
  tables: number;
  images: number;
  footnotes: number;
  words: number;
};
export type ImportDocument = {
  format: InputFormat;
  sourceFileName: string;
  title: string;
  document: BookDocument;
  nodes: SemanticContentNode[];
  assets: ImportedAsset[];
  warnings: ImportWarning[];
  statistics: ImportStatistics;
  metadata: Record<string, unknown>;
  previewHtml?: string;
};
