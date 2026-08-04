import type { H2OPage } from "@/types/editor";
import { buildFullPageImage, inspectImage, uploadInspectedImage } from "./image-import";

// H2OBOOK Image Book & Teaching Upgrade V1 — "Tạo sách từ nhiều ảnh" / "Tải ZIP trang sách".
// Reuses the exact same inspect -> upload -> full-page pipeline as the single-image Smart Import
// panel (components/editor/image-smart-import.tsx's commitFullPage) in a loop — no second image
// engine, no second asset/R2 pipeline. Each image becomes exactly one full-page book page, in
// the order the caller provides (already naturally sorted upstream for ZIP/multi-file sources).
const MAX_PAGES_PER_BATCH = 300;

export interface BuildPagesFromImagesInput {
  files: File[];
  organizationId?: string;
  onProgress?: (done: number, total: number, fileName: string) => void;
}

export interface BuildPagesFromImagesResult {
  pages: H2OPage[];
  failures: { fileName: string; reason: string }[];
}

export function naturalSortImageFiles(files: File[]): File[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  return [...files].sort((a, b) => collator.compare(a.name, b.name));
}

export async function buildPagesFromImages(input: BuildPagesFromImagesInput): Promise<BuildPagesFromImagesResult> {
  if (input.files.length > MAX_PAGES_PER_BATCH) throw new Error(`IMAGE_BATCH_TOO_LARGE: tối đa ${MAX_PAGES_PER_BATCH} trang mỗi lần nhập.`);
  const pages: H2OPage[] = [];
  const failures: BuildPagesFromImagesResult["failures"] = [];
  for (let index = 0; index < input.files.length; index += 1) {
    const file = input.files[index];
    input.onProgress?.(index, input.files.length, file.name);
    try {
      const inspection = await inspectImage(file);
      const asset = await uploadInspectedImage(inspection, { organizationId: input.organizationId, category: "book-pages-from-images", assetType: "full-page-image" });
      pages.push(buildFullPageImage(asset, inspection.metadata));
    } catch (error) {
      failures.push({ fileName: file.name, reason: error instanceof Error ? error.message : "Không xác định" });
    }
  }
  input.onProgress?.(input.files.length, input.files.length, "");
  return { pages, failures };
}
