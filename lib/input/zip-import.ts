import JSZip from "jszip";

// H2OBOOK Image Book & Teaching Upgrade V1 — "Tải ZIP trang sách". Extracts only PNG/JPEG
// entries from a page-per-image ZIP, in natural (numeric-aware) filename order, with the same
// safety posture the module's own prompt requires: reject path traversal, cap entry count/total
// uncompressed size (zip-bomb protection), and require every extracted entry to actually be a
// PNG/JPEG (magic-byte sniffed downstream by parseImageMetadata in packages/input-core/src/
// image.ts — this function does not trust the file extension alone).
const MAX_ENTRIES = 300;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;
const MAX_SINGLE_UNCOMPRESSED_BYTES = 60 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;

export type ZipExtractionWarning = { entryName: string; reason: string };

export interface ZipExtractionResult {
  files: File[];
  warnings: ZipExtractionWarning[];
}

function naturalCompare(a: string, b: string): number {
  const chunk = /(\d+|\D+)/g;
  const partsA = a.match(chunk) ?? [a];
  const partsB = b.match(chunk) ?? [b];
  const length = Math.max(partsA.length, partsB.length);
  for (let index = 0; index < length; index += 1) {
    const partA = partsA[index] ?? "";
    const partB = partsB[index] ?? "";
    const numA = Number(partA);
    const numB = Number(partB);
    if (!Number.isNaN(numA) && !Number.isNaN(numB) && /^\d+$/.test(partA) && /^\d+$/.test(partB)) {
      if (numA !== numB) return numA - numB;
    } else if (partA !== partB) {
      return partA < partB ? -1 : 1;
    }
  }
  return 0;
}

export function isSafeEntryName(name: string): boolean {
  if (!name || name.includes("\0")) return false;
  if (name.startsWith("/") || name.startsWith("\\")) return false;
  if (name.split(/[\\/]/).some((segment) => segment === "..")) return false;
  return true;
}

export async function extractImagesFromZip(zipFile: File): Promise<ZipExtractionResult> {
  // Load via ArrayBuffer rather than handing JSZip the File/Blob directly — JSZip's Blob support
  // detection depends on FileReader, which is not present in every JS runtime (e.g. this
  // project's Node-based unit tests), so this is also the more portable choice, not just a
  // test-environment workaround.
  const archive = await JSZip.loadAsync(await zipFile.arrayBuffer());
  const entries = Object.values(archive.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_ENTRIES) throw new Error(`ZIP_TOO_MANY_ENTRIES: tối đa ${MAX_ENTRIES} trang mỗi lần nhập.`);

  const warnings: ZipExtractionWarning[] = [];
  const candidateNames = entries
    .filter((entry) => {
      if (!isSafeEntryName(entry.name)) { warnings.push({ entryName: entry.name, reason: "Đường dẫn không an toàn (path traversal) — đã bỏ qua." }); return false; }
      if (!/\.(png|jpe?g)$/i.test(entry.name)) { warnings.push({ entryName: entry.name, reason: "Không phải PNG/JPEG — đã bỏ qua." }); return false; }
      return true;
    })
    .map((entry) => entry.name)
    .sort(naturalCompare);

  // Decompress one entry at a time and check its real, decompressed size before keeping it —
  // bounds peak memory to roughly one entry rather than trusting the archive's own (spoofable)
  // central-directory size fields, which is the actual zip-bomb attack surface.
  const files: File[] = [];
  let totalUncompressed = 0;
  for (const name of candidateNames) {
    const entry = archive.files[name];
    const compressedSize = (entry as unknown as { _data?: { compressedSize?: number } })._data?.compressedSize ?? zipFile.size;
    const blob = await entry.async("blob");
    if (blob.size > MAX_SINGLE_UNCOMPRESSED_BYTES) { warnings.push({ entryName: name, reason: "Vượt quá kích thước tối đa mỗi trang — đã bỏ qua." }); continue; }
    if (compressedSize > 0 && blob.size / compressedSize > MAX_COMPRESSION_RATIO) { warnings.push({ entryName: name, reason: "Tỉ lệ nén bất thường (nghi ZIP bomb) — đã bỏ qua." }); continue; }
    totalUncompressed += blob.size;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) throw new Error("ZIP_TOTAL_SIZE_TOO_LARGE: tổng dung lượng giải nén vượt giới hạn an toàn.");
    const baseName = name.split(/[\\/]/).pop() || name;
    const mimeType = /\.png$/i.test(baseName) ? "image/png" : "image/jpeg";
    files.push(new File([blob], baseName, { type: mimeType }));
  }
  return { files, warnings };
}
