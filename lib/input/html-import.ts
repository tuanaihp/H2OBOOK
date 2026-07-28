import type { ImportDocument, ImportedAsset, ImportWarning } from "@h2obook/input-core";
import type { SemanticContentNode } from "@h2obook/content-core";
import { uploadAsset } from "@/lib/assets/asset-client";

function htmlMime(file: File) {
  if (file.type === "application/xhtml+xml" || /\.xhtml$/i.test(file.name)) return "application/xhtml+xml";
  return "text/html";
}

export async function previewHtmlFile(file: File, input: { bookId: string; organizationId?: string }): Promise<ImportDocument> {
  const normalized = file.type === htmlMime(file) ? file : new File([file], file.name, { type: htmlMime(file), lastModified: file.lastModified });
  if (process.env.NEXT_PUBLIC_APP_MODE === "production") {
    const source = await uploadAsset(normalized, { organizationId: input.organizationId, category: "html-sources", assetType: "html-source", metadata: { importEngine: "html-2.0" } });
    if (source.assetId.startsWith("local:")) throw new Error("HTML production import cần R2 và PostgreSQL được cấu hình.");
    if (source.scanStatus !== "clean") throw new Error(source.scanStatus === "blocked" ? "ASSET_SCAN_BLOCKED" : "ASSET_SCAN_PENDING");
    const response = await fetch("/api/input/html/preview", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: input.organizationId, bookId: input.bookId, assetId: source.assetId, sourceFileName: file.name }),
    });
    const payload = await response.json() as { result?: ImportDocument; error?: string };
    if (!response.ok || !payload.result) throw new Error(payload.error || "HTML_IMPORT_FAILED");
    return payload.result;
  }
  const form = new FormData();
  form.set("file", normalized); form.set("bookId", input.bookId);
  if (input.organizationId) form.set("organizationId", input.organizationId);
  const response = await fetch("/api/input/html/preview", { method: "POST", body: form });
  const payload = await response.json() as { result?: ImportDocument; error?: string };
  if (!response.ok || !payload.result) throw new Error(payload.error || "HTML_IMPORT_FAILED");
  return payload.result;
}

export async function previewHtmlUrl(url: string, input: { bookId: string; organizationId?: string }): Promise<ImportDocument> {
  const response = await fetch("/api/input/html/preview", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ organizationId: input.organizationId, bookId: input.bookId, url }),
  });
  const payload = await response.json() as { result?: ImportDocument; error?: string };
  if (!response.ok || !payload.result) throw new Error(payload.error || "HTML_URL_IMPORT_FAILED");
  return payload.result;
}

function remoteName(response: Response, sourceUrl: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const fromHeader = /filename=["']?([^"';]+)/i.exec(disposition)?.[1];
  return fromHeader || decodeURIComponent(new URL(sourceUrl).pathname.split("/").pop() || "remote-image.jpg");
}

async function localizeNode(node: SemanticContentNode, input: { organizationId?: string; assets: ImportedAsset[]; warnings: ImportWarning[]; progress?: (done: number, total: number, url: string) => void; counter: { done: number; total: number } }): Promise<SemanticContentNode> {
  const children = [] as SemanticContentNode[];
  for (const child of node.children) children.push(await localizeNode(child, input));
  if (node.type !== "image") return { ...node, children };
  const sourceUrl = String(node.attrs.sourceUrl ?? "");
  if (!/^https?:/i.test(sourceUrl) || node.attrs.assetId) return { ...node, children };
  try {
    const response = await fetch("/api/input/html/fetch-asset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: sourceUrl }) });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error || `HTTP_${response.status}`);
    }
    const blob = await response.blob();
    const fileName = remoteName(response, sourceUrl);
    const file = new File([blob], fileName, { type: blob.type || response.headers.get("content-type") || "image/jpeg" });
    const asset = await uploadAsset(file, { organizationId: input.organizationId, category: "html-images", assetType: "html-image", metadata: { sourceUrl, importedBy: "html-2.0" } });
    if (process.env.NEXT_PUBLIC_APP_MODE === "production" && asset.scanStatus !== "clean") throw new Error(asset.scanStatus === "blocked" ? "ASSET_SCAN_BLOCKED" : "ASSET_SCAN_PENDING");
    input.assets.push({ assetId: asset.assetId, previewUrl: asset.previewUrl, fileName, mimeType: file.type });
    return { ...node, children, attrs: { ...node.attrs, assetId: asset.assetId, previewUrl: asset.previewUrl, legacyUrl: asset.previewUrl, localizationStatus: "localized", originalSourceUrl: sourceUrl } };
  } catch (error) {
    input.warnings.push({ code: "HTML_REMOTE_ASSET_FAILED", message: `Không thể lưu ảnh ${sourceUrl}: ${error instanceof Error ? error.message : "Lỗi không xác định"}`, severity: "warning", context: { sourceUrl } });
    return { ...node, children, attrs: { ...node.attrs, localizationStatus: "failed" } };
  } finally {
    input.counter.done += 1;
    input.progress?.(input.counter.done, input.counter.total, sourceUrl);
  }
}

export async function localizeHtmlAssets(source: ImportDocument, input: { organizationId?: string; progress?: (done: number, total: number, url: string) => void }): Promise<ImportDocument> {
  const countRemote = (nodes: SemanticContentNode[]): number => nodes.reduce((sum, node) => sum + (node.type === "image" && /^https?:/i.test(String(node.attrs.sourceUrl ?? "")) ? 1 : 0) + countRemote(node.children), 0);
  const total = countRemote(source.nodes);
  if (!total) return source;
  const assets = [...source.assets];
  const warnings = source.warnings.filter((warning) => warning.code !== "HTML_REMOTE_ASSETS_PENDING");
  const counter = { done: 0, total };
  const nodes: SemanticContentNode[] = [];
  for (const node of source.nodes) nodes.push(await localizeNode(node, { organizationId: input.organizationId, assets, warnings, progress: input.progress, counter }));
  const document = { ...source.document, root: nodes, metadata: { ...source.document.metadata, remoteAssetsLocalizedAt: new Date().toISOString(), remoteAssetsLocalized: assets.length } };
  return { ...source, nodes, document, assets, warnings, metadata: document.metadata };
}
