import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { naturalSortImageFiles } from "@/lib/input/image-batch-import";
import { extractImagesFromZip, isSafeEntryName } from "@/lib/input/zip-import";

function pngBytes() {
  // Minimal but structurally valid 1x1 PNG (matches the fixture style used in image-import.test.ts).
  const bytes = new Uint8Array(8 + 25 + 12);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  let offset = 8;
  view.setUint32(offset, 13); bytes.set([..."IHDR"].map((c) => c.charCodeAt(0)), offset + 4);
  view.setUint32(offset + 8, 1); view.setUint32(offset + 12, 1); bytes[offset + 16] = 8; bytes[offset + 17] = 6; offset += 25;
  view.setUint32(offset, 0); bytes.set([..."IEND"].map((c) => c.charCodeAt(0)), offset + 4);
  return bytes;
}

describe("Image Book & Teaching Upgrade — multi-image/ZIP batch import", () => {
  it("sorts filenames in natural (numeric-aware) order, not lexical order", () => {
    const files = ["page10.jpg", "page2.jpg", "page1.jpg"].map((name) => new File([new Uint8Array(1)], name));
    const sorted = naturalSortImageFiles(files).map((file) => file.name);
    expect(sorted).toEqual(["page1.jpg", "page2.jpg", "page10.jpg"]);
  });

  it("extracts only PNG/JPEG entries from a ZIP, in natural order", async () => {
    const zip = new JSZip();
    zip.file("trang-2.png", pngBytes());
    zip.file("trang-1.png", pngBytes());
    zip.file("readme.txt", "not an image");
    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    const zipFile = new File([new Uint8Array(zipBytes)], "sach.zip", { type: "application/zip" });

    const result = await extractImagesFromZip(zipFile);
    expect(result.files.map((file) => file.name)).toEqual(["trang-1.png", "trang-2.png"]);
    expect(result.warnings.some((warning) => warning.entryName === "readme.txt")).toBe(true);
  });

  // JSZip's own writer (zip.file()) normalizes "../" segments away when *creating* an archive,
  // so a path-traversal entry can't be round-tripped through JSZip itself to test the read path
  // end-to-end. A ZIP built by another tool (or a hand-crafted malicious archive) can still carry
  // a literal ".." entry name, which is exactly what isSafeEntryName guards against on read —
  // tested directly here as the real, exported safety check extractImagesFromZip relies on.
  it("flags path-traversal and absolute entry names as unsafe", () => {
    expect(isSafeEntryName("../../etc/evil.png")).toBe(false);
    expect(isSafeEntryName("assets/../../evil.png")).toBe(false);
    expect(isSafeEntryName("/etc/evil.png")).toBe(false);
    expect(isSafeEntryName("\\windows\\evil.png")).toBe(false);
    expect(isSafeEntryName("trang-1.png")).toBe(true);
    expect(isSafeEntryName("chapter-1/trang-1.png")).toBe(true);
  });
});
