import type { BookDocument, SemanticContentNode } from "@h2obook/content-core";

export type IngestionSourceType = "plain_text" | "markdown" | "html" | "url" | "google_docs" | "notion" | "transcript" | "youtube_transcript" | "audio_transcript" | "video_transcript" | "podcast_rss";
export type IngestionWarning = { code: string; message: string; line?: number; severity: "info" | "warning" | "error" };
export type IngestionSource = { type: IngestionSourceType; title?: string; content: string; sourceUrl?: string; language?: string; metadata?: Record<string, unknown> };
export type IngestionPreview = {
  title: string;
  sourceType: IngestionSourceType;
  nodes: SemanticContentNode[];
  warnings: IngestionWarning[];
  statistics: { chapters: number; headings: number; paragraphs: number; lists: number; words: number };
  metadata: Record<string, unknown>;
};
export type IngestionResult = IngestionPreview & { document: BookDocument };
