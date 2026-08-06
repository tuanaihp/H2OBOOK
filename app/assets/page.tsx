"use client";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { AlertTriangle, CheckCircle2, CloudUpload, File, FileImage, FileText, FolderOpen, LayoutGrid, List, LoaderCircle, RotateCcw, Search, ShieldCheck, Tag, Trash2, Upload } from "lucide-react";
import { ASSET_SUBTYPES, ASSET_TYPES, CLASSIFICATION_LABEL, CLASSIFICATION_STATUSES, LIFECYCLE_LABEL, LIFECYCLE_STATUSES, PAGE_SIZE, REVIEW_LABEL, REVIEW_STATUSES, TYPE_LABEL, assetDisplayName, filtersToQuery, type AssetQuery } from "@/lib/assets/governance";
import { AssetOrganizationPanel, SECONDARY_VIEWS, type SavedView, type TagRow } from "@/components/assets/asset-organization-panel";
import type { FolderNode } from "@/lib/assets/organization-rules";

type UploadedAsset = { id: string; title: string | null; fileName: string; assetType: string; assetSubtype: string | null; mimeType: string; sizeBytes: number; key: string; mode: "demo" | "cloud"; createdAt: string; status: string; quarantineStatus: string; classificationStatus: string; reviewStatus: string; lifecycleStatus: string; folderId: string | null; deletedAt: string | null };
const OPTIONAL_COLUMNS = [
  { id: "subtype", label: "Phân loại con" },
  { id: "key", label: "Đường dẫn lưu trữ" },
  { id: "date", label: "Ngày tải lên" }
] as const;
type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number]["id"];
type Folder = { id: string; name: string; parent_id: string | null };
type Counts = { total: number; unclassified: number } | null;

export default function AssetsPage() {
  const workspace = useAppStore(state => state.workspace);
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Chưa có file được tải trong phiên này.");
  const [query, setQuery] = useState("");
  // Filtering moved server-side with Asset Governance V1. Narrowing a list capped at 200 rows in the
  // browser only ever filters the page you happened to receive, which is the opposite of useful once
  // a library runs to thousands of files.
  const [filters, setFilters] = useState<AssetQuery>({});
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [activeView, setActiveView] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [totalMatching, setTotalMatching] = useState(0);
  const [counts, setCounts] = useState<Counts>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [trashed, setTrashed] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [visibleColumns, setVisibleColumns] = useState<OptionalColumn[]>(["subtype"]);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const filtered = assets;

  const loadAssets = async () => {
    const search = filtersToQuery({ ...filters, search: query });
    const trashParam = trashed ? "&trashed=1" : "";
    const response = await fetch(`/api/assets?organizationId=${encodeURIComponent(workspace.id)}${search ? `&${search}` : ""}${trashParam}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    setFolders(payload.folders ?? []);
    setCounts(payload.counts ?? null);
    setTotalMatching(Number(payload.totalMatching ?? 0));
    setAssets((payload.assets ?? []).map((asset: Record<string, unknown>) => ({
      id: String(asset.id), title: asset.title ? String(asset.title) : null, fileName: String(asset.original_name ?? "asset"),
      assetType: String(asset.asset_type ?? "other"), assetSubtype: asset.asset_subtype ? String(asset.asset_subtype) : null,
      mimeType: String(asset.mime_type ?? ""), sizeBytes: Number(asset.size_bytes ?? 0), key: String(asset.storage_key ?? ""),
      mode: payload.mode === "cloud" ? "cloud" : "demo", createdAt: String(asset.created_at ?? new Date().toISOString()),
      status: String(asset.status ?? "ready"), quarantineStatus: String(asset.quarantine_status ?? "clean"),
      classificationStatus: String(asset.classification_status ?? "unclassified"), reviewStatus: String(asset.review_status ?? "not_required"),
      lifecycleStatus: String(asset.lifecycle_status ?? "active"), folderId: asset.folder_id ? String(asset.folder_id) : null,
      deletedAt: asset.deleted_at ? String(asset.deleted_at) : null
    })));
  };
  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => { const timer = window.setTimeout(() => { void loadAssets(); }, 250); return () => window.clearTimeout(timer); }, [workspace.id, query, filters, trashed]);

  const loadOrganization = useCallback(async () => {
    const org = `organizationId=${encodeURIComponent(workspace.id)}`;
    const [foldersRes, tagsRes, viewsRes] = await Promise.all([
      fetch(`/api/assets/folders?${org}`, { cache: "no-store" }),
      fetch(`/api/assets/tags?${org}`, { cache: "no-store" }),
      fetch(`/api/assets/saved-views?${org}`, { cache: "no-store" })
    ]);
    if (foldersRes.ok) { const payload = await foldersRes.json(); setTree(payload.tree ?? []); setCanManage(Boolean(payload.canManage)); }
    if (tagsRes.ok) { const payload = await tagsRes.json(); setTags(payload.tags ?? []); }
    if (viewsRes.ok) { const payload = await viewsRes.json(); setSavedViews(payload.views ?? []); }
  }, [workspace.id]);
  useEffect(() => { void loadOrganization(); }, [loadOrganization]);

  const post = async (path: string, body: unknown, method = "POST") => {
    const response = await fetch(`/api/assets/${path}${path.includes("?") ? "&" : "?"}organizationId=${encodeURIComponent(workspace.id)}`, {
      method, headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) { setMessage(payload?.error === "FOLDER_NOT_EMPTY" ? `Thư mục còn ${payload.assetCount} tài sản — hãy chuyển chúng đi trước.` : payload?.error ?? "Thao tác thất bại."); return false; }
    await Promise.all([loadOrganization(), loadAssets()]);
    return true;
  };

  const applyView = (viewId: string) => {
    setActiveView(viewId);
    setSelected([]);
    if (viewId.startsWith("saved:")) {
      const view = savedViews.find(candidate => `saved:${candidate.id}` === viewId);
      setFilters((view?.filters ?? {}) as AssetQuery);
      setTrashed(false);
      return;
    }
    const secondary = SECONDARY_VIEWS.find(view => view.id === viewId);
    setFilters((secondary?.filters ?? {}) as AssetQuery);
    setTrashed(Boolean(secondary?.trashed));
  };

  const classify = async (assetId: string, patch: Record<string, unknown>) => {
    await fetch(`/api/assets/${assetId}/classify?organizationId=${encodeURIComponent(workspace.id)}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch)
    });
    await loadAssets();
  };

  // Soft delete only: assets.deleted_at, unwound by the restore call below. Neither route touches
  // the R2 object, so a restored asset is exactly the file it was.
  const moveToTrash = async (assetId: string) => {
    if (!confirm("Chuyển tài sản này vào thùng rác? Bạn có thể khôi phục sau.")) return;
    await fetch(`/api/assets/${assetId}?organizationId=${encodeURIComponent(workspace.id)}`, { method: "DELETE" });
    await loadAssets();
  };
  const restoreFromTrash = async (assetId: string) => {
    await fetch(`/api/assets/${assetId}?organizationId=${encodeURIComponent(workspace.id)}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ restore: true })
    });
    await loadAssets();
  };
  const toggleColumn = (id: OptionalColumn) => setVisibleColumns(current => current.includes(id) ? current.filter(c => c !== id) : [...current, id]);

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []); if (!files.length) return;
    setBusy(true);
    try {
      for (const file of files) {
        setMessage(`Đang kiểm tra và tải ${file.name}...`);
        const presignResponse = await fetch("/api/storage/presign-upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: workspace.id, category: "library", fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size }) });
        const presign = await presignResponse.json();
        if (!presignResponse.ok) throw new Error(presign.error ?? `Không thể chuẩn bị upload ${file.name}`);
        if (presign.uploadUrl) {
          const upload = await fetch(presign.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
          if (!upload.ok) throw new Error(`R2 upload thất bại: ${upload.status}`);
        }
        const completeResponse = await fetch("/api/storage/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: workspace.id, key: presign.key, fileName: file.name, mimeType: file.type, sizeBytes: file.size, assetType: file.type.startsWith("image/") ? "image" : "document" }) });
        const complete = await completeResponse.json();
        if (!completeResponse.ok && !complete.asset) throw new Error(complete.error ?? "Không thể ghi metadata file.");
        if (complete.scan?.status === "blocked") setMessage(`${file.name} đã bị chặn: ${complete.scan.reason ?? "không đạt kiểm tra an toàn"}`);
        else if (complete.scan?.status === "pending") setMessage(`${file.name} đã tải xong và đang chờ quét an toàn.`);
        else setMessage(`${file.name} đã sẵn sàng sử dụng.`);
      }
      await loadAssets();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload gặp lỗi.");
    } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">PRIVATE ASSET LIBRARY</span><h1>Kho tài sản production</h1><p>Tải ảnh, PDF, Word, audio và video qua signed URL; file phải vượt kiểm tra workspace và quét an toàn trước khi tải xuống.</p></div><button className="btn btn-primary" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? <LoaderCircle className="spin"/> : <Upload/>}Tải file lên</button><input ref={inputRef} hidden multiple type="file" accept="image/jpeg,image/png,image/webp,image/avif,application/pdf,.docx,.txt,audio/mpeg,audio/wav,video/mp4" onChange={uploadFiles}/></div>
    <section className="asset-upload-hero"><div><CloudUpload/><h2>Direct-to-R2 Upload</h2><p>H2OBOOK kiểm tra tên, MIME, dung lượng, object thực tế, quyền workspace và trạng thái quét file.</p><div><Badge tone="success"><ShieldCheck/>Private by default</Badge><Badge tone="purple">Max 250 MB</Badge></div></div><div className="asset-upload-status"><CheckCircle2/><span><strong>Trạng thái gần nhất</strong><small>{message}</small></span></div></section>
    <div className="asset-governance-layout">
    <AssetOrganizationPanel
      tree={tree} tags={tags} savedViews={savedViews} activeView={activeView}
      activeFolderId={filters.folderId} activeTagId={filters.tagId} canManage={canManage}
      onSelectView={applyView}
      onSelectFolder={id => { setActiveView("all"); setFilters(f => ({ ...f, folderId: f.folderId === id ? undefined : id, unfiled: false, page: 1 })); }}
      onSelectTag={id => setFilters(f => ({ ...f, tagId: f.tagId === id ? undefined : id, page: 1 }))}
      onCreateFolder={name => void post("folders", { name, parentId: filters.folderId ?? null })}
      onCreateTag={name => void post("tags", { name })}
      onDeleteView={id => { if (confirm("Xóa chế độ xem này? Tài sản không bị ảnh hưởng.")) void post(`saved-views/${id}`, {}, "DELETE"); }}
      onManage={() => setMessage("Thư mục và thẻ được tạo, đổi tên và lưu trữ ngay tại thanh bên này.")}
      onReorderFolder={(folderId, newPosition) => void post(`folders/${folderId}`, { position: newPosition }, "PATCH")}
    />
    <div style={{ minWidth: 0 }}>
    {counts && <section className="smart-metric-grid" style={{ marginBottom: 16 }}>
      <article><span><FolderOpen/></span><div><strong>{counts.total}</strong><small>Tổng tài sản</small></div></article>
      <article><span><Tag/></span><div><strong>{counts.unclassified}</strong><small>Chưa phân loại</small></div></article>
      <article><span><File/></span><div><strong>{folders.length}</strong><small>Thư mục</small></div></article>
      <article><span><CheckCircle2/></span><div><strong>{assets.length}</strong><small>Đang hiển thị</small></div></article>
    </section>}

    <section className="section-card">
      <div className="section-head">
        <div><h2>{trashed ? "Thùng rác" : "Tài sản của workspace"}</h2><p>{trashed ? "Tài sản đã xóa mềm. Khôi phục để đưa trở lại danh sách chính; không có gì bị mất trên lưu trữ." : "Lọc theo loại, trạng thái phân loại và thư mục. Bộ lọc chạy trên máy chủ nên áp dụng cho toàn bộ kho, không chỉ trang đang xem."}</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="search-box compact"><Search/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm theo tên hiển thị hoặc tên file..."/></div>
          {/* view_mode is saved with a view (migration 0038); the toggle here is the only place that
              sets it before saving. */}
          <div style={{ display: "flex", border: "1px solid #dfe3e8", borderRadius: 8, overflow: "hidden" }}>
            <button type="button" aria-pressed={viewMode === "table"} aria-label="Xem dạng danh sách" onClick={() => setViewMode("table")}
              style={{ border: 0, padding: "7px 9px", background: viewMode === "table" ? "rgba(141,29,80,.08)" : "#fff", cursor: "pointer" }}><List size={14}/></button>
            <button type="button" aria-pressed={viewMode === "grid"} aria-label="Xem dạng lưới" onClick={() => setViewMode("grid")}
              style={{ border: 0, borderLeft: "1px solid #dfe3e8", padding: "7px 9px", background: viewMode === "grid" ? "rgba(141,29,80,.08)" : "#fff", cursor: "pointer" }}><LayoutGrid size={14}/></button>
          </div>
          {viewMode === "table" && <div style={{ position: "relative" }}>
            <button className="btn btn-secondary" onClick={() => setColumnMenuOpen(open => !open)} aria-expanded={columnMenuOpen}>Cột hiển thị</button>
            {columnMenuOpen && <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 10, background: "#fff", border: "1px solid #dfe3e8", borderRadius: 10, padding: 10, boxShadow: "0 8px 24px rgba(0,0,0,.08)", display: "grid", gap: 6, minWidth: 180 }}>
              {OPTIONAL_COLUMNS.map(column => <label key={column.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                <input type="checkbox" checked={visibleColumns.includes(column.id)} onChange={() => toggleColumn(column.id)} />{column.label}
              </label>)}
            </div>}
          </div>}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 0 14px" }}>
        <select value={filters.assetType ?? ""} onChange={e => setFilters(f => ({ ...f, assetType: e.target.value || undefined }))} className="select">
          <option value="">Mọi loại tài sản</option>
          {ASSET_TYPES.map(type => <option key={type} value={type}>{TYPE_LABEL[type]}</option>)}
        </select>
        <select value={filters.classificationStatus ?? ""} onChange={e => setFilters(f => ({ ...f, classificationStatus: e.target.value || undefined }))} className="select">
          <option value="">Mọi trạng thái phân loại</option>
          {CLASSIFICATION_STATUSES.map(status => <option key={status} value={status}>{CLASSIFICATION_LABEL[status]}</option>)}
        </select>
        <select value={filters.reviewStatus ?? ""} onChange={e => setFilters(f => ({ ...f, reviewStatus: e.target.value || undefined }))} className="select">
          <option value="">Mọi trạng thái duyệt</option>
          {REVIEW_STATUSES.map(status => <option key={status} value={status}>{REVIEW_LABEL[status]}</option>)}
        </select>
        {folders.length > 0 && <select value={filters.folderId ?? ""} onChange={e => setFilters(f => ({ ...f, folderId: e.target.value || undefined, unfiled: false }))} className="select">
          <option value="">Mọi thư mục</option>
          {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>}
        {/* "Unfiled" is how orphaned uploads get found; without it they are invisible in a folder-first view. */}
        <button className="btn btn-secondary" onClick={() => setFilters(f => ({ ...f, unfiled: !f.unfiled, folderId: undefined }))} data-active={filters.unfiled || undefined}>{filters.unfiled ? "Đang xem: chưa xếp thư mục" : "Chưa xếp thư mục"}</button>
        {(filters.assetType || filters.classificationStatus || filters.reviewStatus || filters.folderId || filters.unfiled || query) && <button className="btn btn-secondary" onClick={() => { setFilters({}); setQuery(""); }}>Xóa bộ lọc</button>}
      </div>

      {canManage && selected.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "10px 12px", marginBottom: 12, borderRadius: 10, background: "rgba(141,29,80,.06)" }}>
        <strong style={{ fontSize: 12 }}>Đã chọn {selected.length} tài sản</strong>
        {/* Bulk actions touch only the ids in `selected`; the server scopes the same update by
            organization, so an id from another workspace matches no row. */}
        <select className="select" defaultValue="" onChange={e => { if (!e.target.value) return; void post("bulk", { action: "move", assetIds: selected, folderId: e.target.value === "__none" ? null : e.target.value }).then(() => setSelected([])); e.target.value = ""; }}>
          <option value="">Chuyển vào thư mục…</option>
          <option value="__none">— Bỏ khỏi thư mục —</option>
          {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
        {tags.length > 0 && <select className="select" defaultValue="" onChange={e => { if (!e.target.value) return; void post(`tags/${e.target.value}`, { assetIds: selected, attach: true }).then(() => setSelected([])); e.target.value = ""; }}>
          <option value="">Gắn thẻ hàng loạt…</option>
          {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
        </select>}
        <button className="btn btn-secondary" onClick={() => setSelected([])}>Bỏ chọn</button>
      </div>}

      <div className={viewMode === "grid" ? "asset-grid" : "asset-list"}>{filtered.length ? filtered.map(asset => {
        const icon = asset.mimeType.startsWith("image/") ? <FileImage/> : asset.mimeType.includes("pdf") || asset.mimeType.includes("word") ? <FileText/> : <File/>;
        const name = assetDisplayName({ title: asset.title, original_name: asset.fileName });
        return <article key={asset.id} className={viewMode === "grid" ? "asset-grid-item" : undefined}>
        {canManage && !trashed && <label style={{ display: "flex", alignItems: "center", paddingRight: 4 }}>
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Chọn {name}</span>
          <input type="checkbox" name="selectAsset" checked={selected.includes(asset.id)}
            onChange={e => setSelected(current => e.target.checked ? [...current, asset.id] : current.filter(id => id !== asset.id))} />
        </label>}
        <span className="asset-file-icon">{icon}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong>{name}</strong>
          <small>
            {TYPE_LABEL[asset.assetType] ?? asset.assetType}
            {visibleColumns.includes("subtype") && asset.assetSubtype ? ` · ${asset.assetSubtype}` : ""}
            {` · ${(asset.sizeBytes / 1024 / 1024).toFixed(2)} MB`}
            {visibleColumns.includes("date") ? ` · ${new Date(asset.createdAt).toLocaleDateString("vi-VN")}` : ""}
          </small>
          {visibleColumns.includes("key") && viewMode === "table" && <code>{asset.key}</code>}
          {editing === asset.id && <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 11 }}>Tên hiển thị
              <input className="input" defaultValue={asset.title ?? ""} placeholder={asset.fileName}
                onBlur={e => { if (e.target.value !== (asset.title ?? "")) void classify(asset.id, { title: e.target.value }); }}/>
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <select className="select" value={asset.assetType} onChange={e => void classify(asset.id, { assetType: e.target.value, assetSubtype: null })}>
                {ASSET_TYPES.map(type => <option key={type} value={type}>{TYPE_LABEL[type]}</option>)}
              </select>
              {(ASSET_SUBTYPES[asset.assetType] ?? []).length > 0 && <select className="select" value={asset.assetSubtype ?? ""} onChange={e => void classify(asset.id, { assetSubtype: e.target.value })}>
                <option value="">— Phân loại con —</option>
                {(ASSET_SUBTYPES[asset.assetType] ?? []).map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>}
              <select className="select" value={asset.reviewStatus} onChange={e => void classify(asset.id, { reviewStatus: e.target.value })}>
                {REVIEW_STATUSES.map(status => <option key={status} value={status}>{REVIEW_LABEL[status]}</option>)}
              </select>
              <select className="select" value={asset.lifecycleStatus} onChange={e => void classify(asset.id, { lifecycleStatus: e.target.value })}>
                {LIFECYCLE_STATUSES.map(status => <option key={status} value={status}>{LIFECYCLE_LABEL[status]}</option>)}
              </select>
              {folders.length > 0 && <select className="select" value={asset.folderId ?? ""} onChange={e => void classify(asset.id, { folderId: e.target.value || null })}>
                <option value="">— Chưa xếp thư mục —</option>
                {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>}
            </div>
          </div>}
        </div>
        <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
          {trashed ? (
            canManage && <>
              <button className="btn btn-secondary" onClick={() => void restoreFromTrash(asset.id)}><RotateCcw size={13}/>Khôi phục</button>
            </>
          ) : <>
            <Badge tone={asset.classificationStatus === "classified" ? "success" : "warning"}>{CLASSIFICATION_LABEL[asset.classificationStatus as keyof typeof CLASSIFICATION_LABEL] ?? asset.classificationStatus}</Badge>
            <Badge tone={asset.quarantineStatus === "clean" ? "success" : asset.quarantineStatus === "blocked" ? "danger" : "warning"}>{asset.quarantineStatus === "clean" ? "Đã quét" : asset.quarantineStatus === "blocked" ? <><AlertTriangle/>Bị chặn</> : "Chờ quét"}</Badge>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-secondary" onClick={() => setEditing(editing === asset.id ? null : asset.id)}>{editing === asset.id ? "Đóng" : "Phân loại"}</button>
              {canManage && <button className="btn btn-secondary" aria-label={`Chuyển ${name} vào thùng rác`} onClick={() => void moveToTrash(asset.id)}><Trash2 size={13}/></button>}
            </div>
          </>}
        </div>
      </article>;
      }) : <div className="asset-empty"><CloudUpload/><strong>{trashed ? "Thùng rác trống" : "Không có tài sản nào khớp bộ lọc"}</strong><p>{trashed ? "Chưa có tài sản nào bị chuyển vào thùng rác." : "Thử xóa bộ lọc, hoặc tải một file để kiểm tra luồng signed upload."}</p></div>}</div>
      {totalMatching > PAGE_SIZE && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 12 }}>
        <button className="btn btn-secondary" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters(f => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))}>Trang trước</button>
        <small style={{ color: "#6b7a89" }}>Trang {filters.page ?? 1} · {totalMatching} tài sản khớp bộ lọc</small>
        <button className="btn btn-secondary" disabled={(filters.page ?? 1) * PAGE_SIZE >= totalMatching} onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}>Trang sau</button>
      </div>}

      <div style={{ paddingTop: 12, borderTop: "1px solid #eef1f4", marginTop: 12 }}>
        {/* A saved view stores this filter set, not the rows it currently matches — an asset
            uploaded tomorrow shows up in it without anyone reopening the view. */}
        <button className="btn btn-secondary" onClick={() => {
          const name = prompt("Tên chế độ xem"); if (!name?.trim()) return;
          const shared = canManage && confirm("Chia sẻ chế độ xem này cho cả workspace?\n\nOK = dùng chung · Cancel = chỉ mình bạn");
          void post("saved-views", { name: name.trim(), filters, isShared: shared, sortBy: filters.sortBy, sortDirection: filters.sortDirection, viewMode, visibleColumns });
        }}>Lưu chế độ xem</button>
      </div>
    </section>
    </div>
    </div>
  </AppShell>;
}
