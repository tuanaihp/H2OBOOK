import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const isPrivateV4 = (ip: string) => {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || p[0] >= 224
    || (p[0] === 169 && p[1] === 254)
    || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)
    || (p[0] === 192 && p[1] === 168)
    || (p[0] === 100 && p[1] >= 64 && p[1] <= 127)
    || (p[0] === 192 && p[1] === 0 && p[2] === 0)
    || (p[0] === 192 && p[1] === 0 && p[2] === 2)
    || (p[0] === 198 && (p[1] === 18 || p[1] === 19))
    || (p[0] === 198 && p[1] === 51 && p[2] === 100)
    || (p[0] === 203 && p[1] === 0 && p[2] === 113);
};

const normalizeIpHost = (value: string) => value.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();

const mappedV4 = (ip: string) => {
  const dotted = /^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(ip)?.[1];
  if (dotted) return dotted;
  const hex = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip);
  if (!hex) return null;
  const first = Number.parseInt(hex[1], 16); const second = Number.parseInt(hex[2], 16);
  return `${first >> 8}.${first & 255}.${second >> 8}.${second & 255}`;
};

const isPrivateV6 = (raw: string) => {
  const ip = normalizeIpHost(raw);
  const mapped = mappedV4(ip);
  if (mapped) return isPrivateV4(mapped);
  return ip === "::1" || ip === "::"
    || ip.startsWith("fc") || ip.startsWith("fd")
    || /^fe[89ab]/.test(ip)
    || ip.startsWith("ff")
    || ip.startsWith("2001:db8:");
};

export async function validatePublicTarget(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("UNSUPPORTED_PROTOCOL");
  if (url.username || url.password) throw new Error("URL_CREDENTIALS_NOT_ALLOWED");
  const host = normalizeIpHost(url.hostname);
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("PRIVATE_HOST_BLOCKED");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("HOST_NOT_RESOLVED");
  if (addresses.some(({ address }) => isIP(address) === 4 ? isPrivateV4(address) : isPrivateV6(address))) throw new Error("PRIVATE_ADDRESS_BLOCKED");
}

function googleDocsExport(url: URL) {
  const match = /\/document\/d\/([^/]+)/.exec(url.pathname);
  if (url.hostname === "docs.google.com" && match) return new URL(`https://docs.google.com/document/d/${match[1]}/export?format=html`);
  return url;
}

async function fetchWithRedirects(input: {
  rawUrl: string;
  accept: string;
  maxBytes: number;
  allowedContentTypes: (contentType: string) => boolean;
  redirects?: number;
  googleDocs?: boolean;
}) {
  const redirects = input.redirects ?? 0;
  if (redirects > 3) throw new Error("TOO_MANY_REDIRECTS");
  let url = new URL(input.rawUrl);
  if (input.googleDocs) url = googleDocsExport(url);
  await validatePublicTarget(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "H2OBOOK-Ingestion/4.13.7", accept: input.accept },
      cache: "no-store",
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("REDIRECT_WITHOUT_LOCATION");
      await response.body?.cancel();
      return fetchWithRedirects({ ...input, rawUrl: new URL(location, url).toString(), redirects: redirects + 1, googleDocs: false });
    }
    if (!response.ok) throw new Error(`UPSTREAM_${response.status}`);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > input.maxBytes) throw new Error("SOURCE_TOO_LARGE");
    const contentType = (response.headers.get("content-type") ?? "application/octet-stream").split(";")[0].toLowerCase();
    if (!input.allowedContentTypes(contentType)) throw new Error("UNSUPPORTED_CONTENT_TYPE");
    return { response, url: url.toString(), contentType };
  } finally {
    clearTimeout(timer);
  }
}

export async function safeFetchDocument(rawUrl: string): Promise<{ url: string; contentType: string; body: string; title?: string; charset: string }> {
  const result = await fetchWithRedirects({
    rawUrl,
    googleDocs: true,
    accept: "text/html,application/xhtml+xml,application/rss+xml,application/xml,text/plain,text/markdown;q=0.9,*/*;q=0.1",
    maxBytes: 5_000_000,
    allowedContentTypes: (contentType) => ["text/html", "application/xhtml+xml", "application/rss+xml", "application/xml", "text/xml", "text/plain", "text/markdown", "text/csv", "application/csv", "application/vnd.ms-excel"].includes(contentType),
  });
  const buffer = new Uint8Array(await result.response.arrayBuffer());
  if (buffer.byteLength > 5_000_000) throw new Error("SOURCE_TOO_LARGE");
  const header = result.response.headers.get("content-type") ?? "";
  const probe = new TextDecoder("windows-1252").decode(buffer.slice(0, 4096));
  let charset = /charset\s*=\s*([^;\s]+)/i.exec(header)?.[1]?.replace(/["']/g, "").toLowerCase()
    || /<meta[^>]+charset\s*=\s*["']?([^\s"'/>]+)/i.exec(probe)?.[1]?.toLowerCase()
    || /<meta[^>]+content=["'][^"']*charset=([^\s"';]+)/i.exec(probe)?.[1]?.toLowerCase()
    || "utf-8";
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) charset = "utf-8";
  if (buffer[0] === 0xff && buffer[1] === 0xfe) charset = "utf-16le";
  if (buffer[0] === 0xfe && buffer[1] === 0xff) charset = "utf-16be";
  if (charset === "iso-8859-1") charset = "windows-1252";
  let body: string;
  try { body = new TextDecoder(charset).decode(buffer); } catch { charset = "utf-8"; body = new TextDecoder("utf-8").decode(buffer); }
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return { url: result.url, contentType: result.contentType, body, title, charset };
}

export async function safeFetchBinary(rawUrl: string, input?: { maxBytes?: number; allowedMime?: RegExp }) {
  const maxBytes = input?.maxBytes ?? 15_000_000;
  const allowedMime = input?.allowedMime ?? /^image\/(png|jpeg|webp|avif)$/i;
  const result = await fetchWithRedirects({
    rawUrl,
    accept: "image/png,image/jpeg,image/webp,image/avif;q=0.9,*/*;q=0.1",
    maxBytes,
    allowedContentTypes: (contentType) => allowedMime.test(contentType),
  });
  const bytes = new Uint8Array(await result.response.arrayBuffer());
  if (!bytes.length || bytes.length > maxBytes) throw new Error("SOURCE_TOO_LARGE");
  const disposition = result.response.headers.get("content-disposition") ?? "";
  const dispositionName = /filename\*?=(?:UTF-8''|["']?)([^"';]+)/i.exec(disposition)?.[1];
  const urlName = decodeURIComponent(new URL(result.url).pathname.split("/").pop() || "remote-image");
  return { url: result.url, contentType: result.contentType, bytes, fileName: dispositionName ? decodeURIComponent(dispositionName) : urlName };
}
