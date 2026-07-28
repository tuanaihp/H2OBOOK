const allowedMimeTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/html", "application/xhtml+xml", "text/markdown", "audio/mpeg", "audio/wav", "video/mp4"
]);

const extensionByMime: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg", "jpe"], "image/png": ["png"], "image/webp": ["webp"], "image/avif": ["avif"],
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "text/plain": ["txt"], "text/html": ["html", "htm"], "application/xhtml+xml": ["xhtml", "html", "htm"], "text/markdown": ["md", "markdown"], "audio/mpeg": ["mp3"], "audio/wav": ["wav"], "video/mp4": ["mp4"]
};

export function sanitizeFileName(name: string) {
  const base = name.replaceAll("\\", "/").split("/").pop() ?? "upload.bin";
  const normalized = base.normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+/, "")
    .replace(/-+/g, "-")
    .slice(-180);
  return normalized || "upload.bin";
}

export function validateUpload(input: { fileName: string; mimeType: string; sizeBytes: number }) {
  const maxBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 250 * 1024 * 1024);
  if (!allowedMimeTypes.has(input.mimeType)) return { ok: false, error: "Định dạng file chưa được hỗ trợ." } as const;
  if (input.sizeBytes <= 0 || input.sizeBytes > maxBytes) return { ok: false, error: `Dung lượng file vượt giới hạn ${Math.round(maxBytes / 1024 / 1024)} MB.` } as const;
  const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!extensionByMime[input.mimeType]?.includes(extension)) return { ok: false, error: "Phần mở rộng file không khớp với MIME type." } as const;
  return { ok: true, safeName: sanitizeFileName(input.fileName) } as const;
}

export function validateMagicBytes(mimeType: string, bytes: Uint8Array) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  const ascii = (value: string) => [...value].every((char, index) => bytes[index] === char.charCodeAt(0));
  const ok = mimeType === "image/jpeg" ? starts(0xff,0xd8,0xff)
    : mimeType === "image/png" ? starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)
    : mimeType === "image/webp" ? ascii("RIFF") && String.fromCharCode(...bytes.slice(8,12)) === "WEBP"
    : mimeType === "image/avif" ? String.fromCharCode(...bytes.slice(4,12)).includes("ftyp")
    : mimeType === "application/pdf" ? ascii("%PDF-")
    : mimeType.includes("wordprocessingml") ? starts(0x50,0x4b)
    : mimeType === "text/html" || mimeType === "application/xhtml+xml" ? (() => {
      const sample = bytes.slice(0, 4096);
      const encoding = sample[0] === 0xff && sample[1] === 0xfe ? "utf-16le" : sample[0] === 0xfe && sample[1] === 0xff ? "utf-16be" : "utf-8";
      const prefix = new TextDecoder(encoding, { fatal: false }).decode(sample).replace(/^\uFEFF/, "").trimStart();
      if (encoding === "utf-8" && prefix.includes("\u0000")) return false;
      const normalized = prefix.replace(/^(?:<!--[^]*?-->\s*)+/, "");
      return /^(?:<\?xml[^>]*>\s*)?(?:<!doctype\s+html[^>]*>\s*)?<(?:html|head|body|article|main|section|h[1-6]|p|div|table|ul|ol|figure|img)\b/i.test(normalized);
    })()
    : mimeType === "text/markdown" || mimeType === "text/plain" ? !bytes.slice(0, 4096).some((byte) => byte === 0)
    : true;
  return ok ? { ok: true } as const : { ok: false, error: "MAGIC_BYTES_MISMATCH" } as const;
}
