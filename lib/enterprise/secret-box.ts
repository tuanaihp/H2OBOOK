import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  const material = process.env.WEBHOOK_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY;
  if (!material) throw new Error("WEBHOOK_ENCRYPTION_KEY_REQUIRED");
  return createHash("sha256").update(material).digest();
}
export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map(buffer => buffer.toString("base64url")).join(".");
}
export function decryptSecret(value: string) {
  const [ivRaw, tagRaw, dataRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error("INVALID_SECRET_BOX");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]).toString("utf8");
}
