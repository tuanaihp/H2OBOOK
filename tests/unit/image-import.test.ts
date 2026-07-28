import { describe, expect, it } from "vitest";
import { detectInputFormat, imageMetadataWarnings, parseImageMetadata } from "@h2obook/input-core";
import { validateMagicBytes, validateUpload } from "@/lib/security/uploads";

function pngFixture() {
  const bytes = new Uint8Array(8 + 25 + 21 + 12);
  bytes.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a], 0);
  const view = new DataView(bytes.buffer);
  let offset = 8;
  view.setUint32(offset, 13); bytes.set([..."IHDR"].map((c) => c.charCodeAt(0)), offset + 4);
  view.setUint32(offset + 8, 1200); view.setUint32(offset + 12, 800); bytes[offset + 16] = 8; bytes[offset + 17] = 6; offset += 25;
  view.setUint32(offset, 9); bytes.set([..."pHYs"].map((c) => c.charCodeAt(0)), offset + 4);
  view.setUint32(offset + 8, 11811); view.setUint32(offset + 12, 11811); bytes[offset + 16] = 1; offset += 21;
  view.setUint32(offset, 0); bytes.set([..."IEND"].map((c) => c.charCodeAt(0)), offset + 4);
  return bytes;
}

function jpegFixture() {
  const values: number[] = [0xff,0xd8];
  const segment = (marker: number, data: number[]) => values.push(0xff, marker, ((data.length + 2) >> 8) & 0xff, (data.length + 2) & 0xff, ...data);
  segment(0xe0, [..."JFIF\0"].map((c) => c.charCodeAt(0)).concat([1,1,1,1,44,1,44,0,0]));
  segment(0xc0, [8,0x03,0x20,0x04,0xb0,3,1,0x11,0,2,0x11,0,3,0x11,0]);
  values.push(0xff,0xd9);
  return new Uint8Array(values);
}

describe("Image Smart Import metadata", () => {
  it("reads PNG size, alpha and physical DPI", () => {
    const bytes = pngFixture();
    const result = parseImageMetadata(bytes.buffer, { fileName: "transparent.png", mimeType: "image/png", sizeBytes: bytes.length });
    expect(result.pixelWidth).toBe(1200);
    expect(result.pixelHeight).toBe(800);
    expect(result.hasAlpha).toBe(true);
    expect(Math.round(result.dpiX ?? 0)).toBe(300);
    expect(validateMagicBytes("image/png", bytes).ok).toBe(true);
  });

  it("accepts jpg, jpeg and jpe consistently", () => {
    const bytes = jpegFixture();
    const result = parseImageMetadata(bytes.buffer, { fileName: "portrait.jpe", mimeType: "image/jpeg", sizeBytes: bytes.length });
    expect(result.pixelWidth).toBe(1200);
    expect(result.pixelHeight).toBe(800);
    expect(Math.round(result.dpiX ?? 0)).toBe(300);
    expect(detectInputFormat({ fileName: "portrait.jpe", mimeType: "image/jpeg" })).toBe("jpeg");
    expect(validateUpload({ fileName: "portrait.jpe", mimeType: "image/jpeg", sizeBytes: bytes.length }).ok).toBe(true);
    expect(validateMagicBytes("image/jpeg", bytes).ok).toBe(true);
  });

  it("warns about missing DPI without blocking semantic import", () => {
    const bytes = jpegFixture();
    const result = parseImageMetadata(bytes.buffer, { fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: bytes.length });
    result.dpiX = undefined; result.dpiY = undefined;
    expect(imageMetadataWarnings(result).some((warning) => warning.code === "IMAGE_DPI_MISSING")).toBe(true);
  });

  it("rejects a MIME-confused image header", () => {
    const bytes = new Uint8Array([0x25,0x50,0x44,0x46,0x2d]);
    expect(validateMagicBytes("image/jpeg", bytes).ok).toBe(false);
  });
});
