"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp, Crop, FileImage, FileText, Image as ImageIcon, ScanText, Trash2, Upload } from "lucide-react";
import type { SemanticContentNode } from "@h2obook/content-core";
import type { H2OElement, H2OPage } from "@/types/editor";
import type { ImportDocument, ImageImportMode, ImageRegion, ImageRegionKind } from "@h2obook/input-core";
import { useEditorStore } from "@/store/editor-store";
import { useAppStore } from "@/store/app-store";
import {
  buildFullPageImage,
  cropImageRegion,
  inspectImage,
  runImageOcr,
  uploadInspectedImage,
  type ImageInspection,
} from "@/lib/input/image-import";
import { uid } from "@/lib/utils";

export function ImageSmartImport({
  inspection,
  onCancel,
  onStatus,
  onCommitSemantic,
  onCommitAsset,
  onCommitFullPage,
  onModeChange,
  onJobCreated,
}: {
  inspection: ImageInspection;
  onCancel: () => void;
  onStatus: (value: string) => void;
  onCommitSemantic: (preview: ImportDocument, label: string) => Promise<void>;
  onCommitAsset?: (asset: { assetId: string; previewUrl: string; fileName: string; metadata: H2OElement["imageMetadata"] }) => Promise<void>;
  onCommitFullPage?: (page: H2OPage) => Promise<void>;
  onModeChange?: (mode: ImageImportMode) => void;
  onJobCreated?: (jobId: string) => void | Promise<void>;
}) {
  const store = useEditorStore();
  const organizationId = useAppStore((state) => state.workspace.id);
  const [mode, setMode] = useState<ImageImportMode>("asset");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportDocument | null>(null);
  const [regions, setRegions] = useState<ImageRegion[]>([]);
  const [regionKind, setRegionKind] = useState<ImageRegionKind>("text");
  const [draft, setDraft] = useState<ImageRegion | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const editableNodes = useMemo(() => result ? flattenTextNodes(result.document.root).slice(0, 60) : [], [result]);
  useEffect(() => () => URL.revokeObjectURL(inspection.previewUrl), [inspection.previewUrl]);

  const setModeAndReset = (next: ImageImportMode) => { setMode(next); setResult(null); setDraft(null); onModeChange?.(next); };
  const moveRegion = (regionId: string, delta: -1 | 1) => setRegions((items) => {
    const index = items.findIndex((item) => item.id === regionId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= items.length) return items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    return next.map((item, order) => ({ ...item, order }));
  });

  const commitAsset = async () => {
    setBusy(true);
    try {
      const asset = await uploadInspectedImage(inspection, { organizationId, category: "editor-images", assetType: "image" });
      const metadata = buildImageMetadata(inspection);
      if (onCommitAsset) await onCommitAsset({ assetId: asset.assetId, previewUrl: asset.previewUrl, fileName: inspection.metadata.fileName, metadata });
      else store.addImage({ assetId: asset.assetId, previewUrl: asset.previewUrl, fileName: inspection.metadata.fileName, metadata });
      onStatus(`Đã thêm ${inspection.metadata.fileName} thành image element bằng assetId.`);
      onCancel();
    } catch (error) { onStatus(error instanceof Error ? error.message : "Không thể thêm ảnh."); }
    finally { setBusy(false); }
  };

  const commitFullPage = async () => {
    setBusy(true);
    try {
      const asset = await uploadInspectedImage(inspection, { organizationId, category: "full-page-images", assetType: "full-page-image" });
      const page = buildFullPageImage(asset, inspection.metadata);
      if (onCommitFullPage) await onCommitFullPage(page);
      else store.addImportedPage(page);
      onStatus(`Đã tạo trang toàn ảnh ${inspection.metadata.fileName}; background đã khóa.`);
      onCancel();
    } catch (error) { onStatus(error instanceof Error ? error.message : "Không thể tạo trang ảnh."); }
    finally { setBusy(false); }
  };

  const processOcr = async () => {
    setBusy(true); setResult(null);
    try {
      const preview = await runImageOcr(inspection, {
        organizationId, bookId: store.book.id,
        title: inspection.metadata.fileName.replace(/\.[^.]+$/, ""),
        onProgress: (status, progress) => onStatus(`OCR ảnh: ${status} ${Math.round(progress)}%`),
        onJobCreated,
      }, mode === "manual_regions" ? regions : undefined);
      if (mode === "manual_regions") {
        const imageRegions = regions.filter((region) => region.kind === "image").sort((a, b) => a.order - b.order);
        const chapter = preview.document.root[0] ?? makeChapter(inspection);
        const added: SemanticContentNode[] = [];
        for (const region of imageRegions) {
          const cropped = await cropImageRegion(inspection, region);
          const croppedInspection = await inspectImage(cropped);
          const asset = await uploadInspectedImage(croppedInspection, { organizationId, category: "image-regions", assetType: "image-region" });
          added.push({
            id: uid("image"), type: "image", parentId: chapter.id, position: chapter.children.length + added.length,
            attrs: { assetId: asset.assetId, legacyUrl: asset.previewUrl, altText: region.label || `Vùng ảnh ${region.order + 1}`, caption: "", sourceRegion: region, page: 1 },
            children: [], version: 1,
          });
          preview.assets.push({ assetId: asset.assetId, previewUrl: asset.previewUrl, fileName: cropped.name, mimeType: cropped.type });
        }
        chapter.children = [...chapter.children, ...added].map((node, index) => ({ ...node, parentId: chapter.id, position: index }));
        preview.document.root = [chapter];
        preview.nodes = preview.document.root;
        preview.statistics.images += added.length;
        preview.statistics.nodes += added.length;
        preview.metadata.regions = regions;
      }
      setResult(preview);
      onStatus(`Preview sẵn sàng: ${preview.statistics.paragraphs} đoạn OCR, ${preview.statistics.images} vùng ảnh.`);
    } catch (error) { onStatus(error instanceof Error ? error.message : "Không thể OCR ảnh."); }
    finally { setBusy(false); }
  };

  const updateNode = (nodeId: string, value: string) => setResult((current) => {
    if (!current) return current;
    const root = replaceNodeText(current.document.root, nodeId, value);
    return { ...current, nodes: root, document: { ...current.document, root, updatedAt: new Date().toISOString() } };
  });

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== "manual_regions" || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) * inspection.metadata.pixelWidth / rect.width;
    const y = (event.clientY - rect.top) * inspection.metadata.pixelHeight / rect.height;
    setDraft({ id: uid("region"), kind: regionKind, x, y, width: 1, height: 1, order: regions.length, label: "" });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draft || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) * inspection.metadata.pixelWidth / rect.width;
    const y = (event.clientY - rect.top) * inspection.metadata.pixelHeight / rect.height;
    setDraft((current) => current ? { ...current, width: x - current.x, height: y - current.y } : null);
  };
  const pointerUp = () => {
    if (!draft) return;
    const normalized = normalizeRegion(draft, inspection.metadata.pixelWidth, inspection.metadata.pixelHeight);
    if (normalized.width >= 8 && normalized.height >= 8) setRegions((items) => [...items, { ...normalized, order: items.length }]);
    setDraft(null);
  };

  const allRegions = draft ? [...regions, normalizeRegion(draft, inspection.metadata.pixelWidth, inspection.metadata.pixelHeight)] : regions;

  return <section className="image-smart-import" aria-label="Image Smart Import">
    <div className="word-import-preview-head">
      <div><span className="eyebrow">IMAGE SMART IMPORT</span><strong>{inspection.metadata.fileName}</strong><small>{inspection.metadata.pixelWidth}×{inspection.metadata.pixelHeight}px · {(inspection.metadata.sizeBytes / 1024 / 1024).toFixed(2)} MB</small></div>
      <FileImage size={25}/>
    </div>
    <div className="image-metadata-grid">
      <span><strong>{inspection.metadata.mimeType.replace("image/", "").toUpperCase()}</strong> định dạng</span>
      <span><strong>{inspection.metadata.dpiX ? Math.round(inspection.metadata.dpiX) : "—"}</strong> DPI X</span>
      <span><strong>{inspection.metadata.orientation}</strong> EXIF orientation</span>
      <span><strong>{inspection.metadata.hasAlpha ? "Có" : "Không"}</strong> transparency</span>
      <span><strong>{inspection.metadata.colorProfile ?? "Không rõ"}</strong> profile</span>
    </div>
    <div className="image-smart-layout">
      <div className="image-region-stage" ref={stageRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => setDraft(null)}>
        <img src={inspection.previewUrl} alt="Xem trước ảnh nhập" draggable={false}/>
        {mode === "manual_regions" && <div className="image-region-overlay">{allRegions.map((region) => <div key={region.id} className="image-region-box" data-kind={region.kind} style={{ left: `${region.x / inspection.metadata.pixelWidth * 100}%`, top: `${region.y / inspection.metadata.pixelHeight * 100}%`, width: `${region.width / inspection.metadata.pixelWidth * 100}%`, height: `${region.height / inspection.metadata.pixelHeight * 100}%` }}><span>{region.order + 1} · {region.kind}</span></div>)}</div>}
      </div>
      <div className="image-mode-column">
        <div className="image-mode-grid">
          <button data-active={mode === "asset"} onClick={() => setModeAndReset("asset")}><ImageIcon/><strong>Thêm như hình ảnh</strong><small>Asset layer có thể di chuyển, crop và thay thế.</small></button>
          <button data-active={mode === "full_page"} onClick={() => setModeAndReset("full_page")}><FileImage/><strong>Dùng làm toàn trang</strong><small>Tạo trang đúng tỷ lệ và khóa background.</small></button>
          <button data-active={mode === "ocr"} onClick={() => setModeAndReset("ocr")}><ScanText/><strong>OCR lấy nội dung</strong><small>Tesseract vie+eng; không dùng AI API.</small></button>
          <button data-active={mode === "manual_regions"} onClick={() => setModeAndReset("manual_regions")}><Crop/><strong>Tách vùng thủ công</strong><small>Vẽ vùng text, ảnh hoặc vùng bỏ qua.</small></button>
        </div>
        {mode === "manual_regions" && <div className="region-tools">
          <div className="region-kind-switch"><button data-active={regionKind === "text"} onClick={() => setRegionKind("text")}>Text OCR</button><button data-active={regionKind === "image"} onClick={() => setRegionKind("image")}>Ảnh crop</button><button data-active={regionKind === "ignore"} onClick={() => setRegionKind("ignore")}>Bỏ qua</button></div>
          <p>Kéo trực tiếp trên ảnh để tạo vùng. Thứ tự vùng quyết định reading order.</p>
          <div className="region-list">{regions.map((region, index) => <div key={region.id}><b>{index + 1}</b><select value={region.kind} onChange={(event) => setRegions((items) => items.map((item) => item.id === region.id ? { ...item, kind: event.target.value as ImageRegionKind } : item))}><option value="text">Text OCR</option><option value="image">Ảnh crop</option><option value="ignore">Bỏ qua</option></select><input value={region.label ?? ""} placeholder="Nhãn vùng" onChange={(event) => setRegions((items) => items.map((item) => item.id === region.id ? { ...item, label: event.target.value } : item))}/><div className="region-order-actions"><button title="Đưa vùng lên trước" disabled={index === 0} onClick={() => moveRegion(region.id, -1)}><ChevronUp/></button><button title="Đưa vùng xuống sau" disabled={index === regions.length - 1} onClick={() => moveRegion(region.id, 1)}><ChevronDown/></button></div><button className="region-delete" title="Xóa vùng" onClick={() => setRegions((items) => items.filter((item) => item.id !== region.id).map((item, order) => ({ ...item, order })))}><Trash2/></button></div>)}</div>
        </div>}
      </div>
    </div>
    {inspection.warnings.length > 0 && <div className="word-import-warnings">{inspection.warnings.map((warning, index) => <p key={`${warning.code}-${index}`} data-severity={warning.severity}><strong>{warning.code}</strong>{warning.message}</p>)}</div>}
    {result && <div className="pdf-semantic-result">
      <div className="word-import-stats"><span><strong>{result.statistics.headings}</strong> tiêu đề</span><span><strong>{result.statistics.paragraphs}</strong> đoạn</span><span><strong>{result.statistics.images}</strong> vùng ảnh</span><span><strong>{result.statistics.words}</strong> từ</span></div>
      {result.warnings.length > 0 && <div className="word-import-warnings">{result.warnings.map((warning, index) => <p key={`${warning.code}-${index}`} data-severity={warning.severity}><strong>{warning.code}</strong>{warning.message}</p>)}</div>}
      <details className="pdf-correction-panel" open><summary>Kiểm tra và sửa OCR ({editableNodes.length} khối)</summary><div className="pdf-correction-list">{editableNodes.map((node) => <label key={node.id}><span>{node.type}{typeof node.attrs.ocrConfidence === "number" ? ` · ${Math.round(node.attrs.ocrConfidence)}%` : ""}</span><textarea value={node.text?.map((span) => span.text).join("") ?? ""} onChange={(event) => updateNode(node.id, event.target.value)}/></label>)}</div></details>
    </div>}
    <div className="word-import-preview-actions">
      <button className="btn btn-secondary" onClick={onCancel}>Hủy ảnh</button>
      {mode === "asset" && <button className="btn btn-primary" disabled={busy} onClick={commitAsset}><Upload/> {busy ? "Đang tải…" : "Thêm vào trang"}</button>}
      {mode === "full_page" && <button className="btn btn-primary" disabled={busy} onClick={commitFullPage}><FileImage/> {busy ? "Đang tạo…" : "Tạo trang toàn ảnh"}</button>}
      {(mode === "ocr" || mode === "manual_regions") && !result && <button className="btn btn-primary" disabled={busy || (mode === "manual_regions" && !regions.some((region) => region.kind !== "ignore"))} onClick={processOcr}><ScanText/> {busy ? "Đang xử lý…" : "Tạo preview"}</button>}
      {result && <button className="btn btn-primary" disabled={busy || result.warnings.some((warning) => warning.severity === "error")} onClick={() => onCommitSemantic(result, mode === "ocr" ? "OCR ảnh" : "vùng ảnh")}>Nhập vào Compose</button>}
    </div>
  </section>;
}

function normalizeRegion(region: ImageRegion, maxWidth: number, maxHeight: number): ImageRegion {
  const x = region.width < 0 ? region.x + region.width : region.x;
  const y = region.height < 0 ? region.y + region.height : region.y;
  return {
    ...region,
    x: Math.max(0, Math.min(maxWidth, x)), y: Math.max(0, Math.min(maxHeight, y)),
    width: Math.max(0, Math.min(maxWidth - Math.max(0, x), Math.abs(region.width))),
    height: Math.max(0, Math.min(maxHeight - Math.max(0, y), Math.abs(region.height))),
  };
}

function flattenTextNodes(nodes: SemanticContentNode[]): SemanticContentNode[] {
  return nodes.flatMap((node) => [node, ...flattenTextNodes(node.children)]).filter((node) => node.type === "heading" || node.type === "paragraph" || node.type === "quote" || node.type === "list_item");
}
function replaceNodeText(nodes: SemanticContentNode[], nodeId: string, value: string): SemanticContentNode[] {
  return nodes.map((node) => ({ ...node, text: node.id === nodeId ? [{ text: value }] : node.text, children: replaceNodeText(node.children, nodeId, value) }));
}
function makeChapter(inspection: ImageInspection): SemanticContentNode {
  return { id: uid("chapter"), type: "chapter", parentId: null, position: 0, attrs: { page: 1, pageWidth: inspection.metadata.pixelWidth, pageHeight: inspection.metadata.pixelHeight, source: "manual-regions" }, children: [], version: 1 };
}

function buildImageMetadata(inspection: ImageInspection): H2OElement["imageMetadata"] {
  return {
    pixelWidth: inspection.metadata.pixelWidth, pixelHeight: inspection.metadata.pixelHeight,
    orientation: inspection.metadata.orientation, dpiX: inspection.metadata.dpiX, dpiY: inspection.metadata.dpiY,
    colorProfile: inspection.metadata.colorProfile, checksumSha256: inspection.metadata.checksumSha256,
    originalFileName: inspection.metadata.fileName, originalMimeType: inspection.metadata.mimeType,
  };
}
