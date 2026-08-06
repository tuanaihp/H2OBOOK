"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, FolderOpen, FolderPlus, Inbox, Search, Tag, Trash2 } from "lucide-react";
import type { FolderNode } from "@/lib/assets/organization-rules";
import type { AssetQuery } from "@/lib/assets/governance";

export interface TagRow { id: string; name: string; slug: string; color: string | null; assetCount: number }
export interface SavedView { id: string; name: string; filters: Record<string, unknown>; isShared: boolean; canEdit: boolean }

// The organisation rail: views, folder tree and tags. Long Vietnamese labels are the norm here
// ("Chưa liên kết lộ trình"), so every row wraps rather than truncating — a folder called
// "Ảnh cô dâu mùa cưới 2026" that renders as "Ảnh cô dâu mùa c…" is a folder nobody can tell apart
// from its neighbour.

export const SECONDARY_VIEWS: { id: string; label: string; filters: Partial<AssetQuery>; trashed?: boolean }[] = [
  { id: "all", label: "Tất cả tài sản", filters: {} },
  { id: "inbox", label: "Hộp thư đầu vào", filters: { classificationStatus: "unclassified" } },
  { id: "unfiled", label: "Chưa xếp thư mục", filters: { unfiled: true } },
  { id: "review", label: "Cần duyệt", filters: { reviewStatus: "pending" } },
  { id: "archived", label: "Lưu trữ", filters: { lifecycleStatus: "archived" } },
  { id: "retired", label: "Ngừng dùng", filters: { lifecycleStatus: "retired" } },
  // Trash is not a lifecycle_status — it is assets.deleted_at, a separate axis from
  // active/archived/retired, so it is its own view rather than a fifth lifecycle value.
  { id: "trash", label: "Thùng rác", filters: {}, trashed: true }
];

// Renders its own row plus a nested <ul> of children — never its own <li>, so the caller (either
// the top-level folder list or a recursive call one level up) is always the one that supplies the
// <li>. That is what keeps <li> a direct child of <ul>/<ol> at every depth instead of nesting one
// inside a <div> inside another <li>, which is invalid HTML and unpredictable in a screen reader's
// list semantics.
function FolderBranch({ node, activeId, depth, canManage, onSelect, onReorder }: {
  node: FolderNode; activeId?: string; depth: number; canManage: boolean; onSelect: (id: string) => void;
  onReorder: (siblings: FolderNode[], fromIndex: number, direction: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  return <>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 4, paddingLeft: depth * 12 }}>
      {hasChildren
        ? <button type="button" aria-label={open ? `Thu gọn ${node.name}` : `Mở rộng ${node.name}`} aria-expanded={open} onClick={() => setOpen(!open)}
            style={{ border: 0, background: "none", padding: 2, cursor: "pointer", color: "#6b7a89", flex: "none" }}>
            {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          </button>
        : <span style={{ width: 17, flex: "none" }} />}
      <button type="button" onClick={() => onSelect(node.id)} aria-current={activeId === node.id ? "true" : undefined}
        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", gap: 6, textAlign: "left", border: 0, borderRadius: 8,
          background: activeId === node.id ? "rgba(141,29,80,.08)" : "none", color: "inherit", padding: "5px 7px", cursor: "pointer", fontSize: 12 }}>
        <FolderOpen size={13} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />
        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{node.name}</span>
        {node.assetCount > 0 && <em style={{ fontStyle: "normal", color: "#6b7a89", flex: "none" }}>{node.assetCount}</em>}
      </button>
    </div>
    {hasChildren && open && <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {node.children.map((child, index) => <li key={child.id} style={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FolderBranch node={child} activeId={activeId} depth={depth + 1} canManage={canManage} onSelect={onSelect} onReorder={onReorder} />
        </div>
        {/* Up/down rather than drag-and-drop: `position` already exists on the row, a swap is one
            API call, and this needs no pointer-drag machinery to get right on touch as well as
            mouse. Only shown with more than one sibling, since reordering a list of one does nothing. */}
        {canManage && node.children.length > 1 && <div style={{ display: "flex", flexDirection: "column", paddingTop: 3 }}>
          <button type="button" aria-label={`Đưa ${child.name} lên trước`} disabled={index === 0} onClick={() => onReorder(node.children, index, -1)}
            style={{ border: 0, background: "none", padding: 1, cursor: index === 0 ? "default" : "pointer", color: index === 0 ? "#dfe3e8" : "#6b7a89" }}><ArrowUp size={11} aria-hidden="true" /></button>
          <button type="button" aria-label={`Đưa ${child.name} xuống sau`} disabled={index === node.children.length - 1} onClick={() => onReorder(node.children, index, 1)}
            style={{ border: 0, background: "none", padding: 1, cursor: index === node.children.length - 1 ? "default" : "pointer", color: index === node.children.length - 1 ? "#dfe3e8" : "#6b7a89" }}><ArrowDown size={11} aria-hidden="true" /></button>
        </div>}
      </li>)}
    </ul>}
  </>;
}

export function AssetOrganizationPanel({
  tree, tags, savedViews, activeView, activeFolderId, activeTagId, canManage,
  onSelectView, onSelectFolder, onSelectTag, onCreateFolder, onCreateTag, onDeleteView, onManage, onReorderFolder
}: {
  tree: FolderNode[];
  tags: TagRow[];
  savedViews: SavedView[];
  activeView: string;
  activeFolderId?: string;
  activeTagId?: string;
  canManage: boolean;
  onSelectView: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onSelectTag: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onCreateTag: (name: string) => void;
  onDeleteView: (id: string) => void;
  onManage: () => void;
  onReorderFolder: (folderId: string, newPosition: number) => void;
}) {
  const reorder = (siblings: FolderNode[], fromIndex: number, direction: -1 | 1) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= siblings.length) return;
    // Swap the two positions rather than renumbering the whole list — position only has to be
    // locally ordered among siblings, and a swap is one PATCH per folder instead of N.
    onReorderFolder(siblings[fromIndex].id, siblings[toIndex].position);
    onReorderFolder(siblings[toIndex].id, siblings[fromIndex].position);
  };
  const [tagQuery, setTagQuery] = useState("");
  const visibleTags = tags.filter((tag) => tag.name.toLowerCase().includes(tagQuery.toLowerCase()));

  const heading = { fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase" as const, color: "#6b7a89", margin: "16px 0 6px" };
  const rowButton = { width: "100%", display: "flex", alignItems: "flex-start", gap: 7, textAlign: "left" as const, border: 0, borderRadius: 8, background: "none", color: "inherit", padding: "6px 8px", cursor: "pointer", fontSize: 12 };

  return <aside style={{ width: "100%", maxWidth: 260, minWidth: 0 }}>
    <nav aria-label="Chế độ xem tài sản">
      <p style={heading}>Chế độ xem</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {SECONDARY_VIEWS.map((view) => <li key={view.id}>
          <button type="button" onClick={() => onSelectView(view.id)} aria-current={activeView === view.id ? "page" : undefined}
            style={{ ...rowButton, background: activeView === view.id ? "rgba(141,29,80,.08)" : "none", fontWeight: activeView === view.id ? 700 : 400 }}>
            {view.trashed
              ? <Trash2 size={13} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />
              : <Inbox size={13} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />}
            <span style={{ overflowWrap: "anywhere" }}>{view.label}</span>
          </button>
        </li>)}
      </ul>
    </nav>

    {savedViews.length > 0 && <nav aria-label="Chế độ xem đã lưu">
      <p style={heading}>Đã lưu</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {savedViews.map((view) => <li key={view.id} style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
          <button type="button" onClick={() => onSelectView(`saved:${view.id}`)} aria-current={activeView === `saved:${view.id}` ? "page" : undefined}
            style={{ ...rowButton, background: activeView === `saved:${view.id}` ? "rgba(141,29,80,.08)" : "none" }}>
            <Search size={13} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />
            <span style={{ overflowWrap: "anywhere" }}>{view.name}{view.isShared ? " · chung" : ""}</span>
          </button>
          {view.canEdit && <button type="button" aria-label={`Xóa chế độ xem ${view.name}`} onClick={() => onDeleteView(view.id)}
            style={{ border: 0, background: "none", color: "#b22949", cursor: "pointer", padding: 4, flex: "none" }}><Trash2 size={12} aria-hidden="true" /></button>}
        </li>)}
      </ul>
    </nav>}

    <section aria-label="Thư mục">
      <p style={heading}>Thư mục</p>
      {tree.length === 0
        ? <p style={{ fontSize: 11, color: "#6b7a89", margin: 0 }}>Chưa có thư mục nào.</p>
        : <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {tree.map((node, index) => <li key={node.id} style={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FolderBranch node={node} activeId={activeFolderId} depth={0} canManage={canManage} onSelect={onSelectFolder} onReorder={reorder} />
              </div>
              {canManage && tree.length > 1 && <div style={{ display: "flex", flexDirection: "column", paddingTop: 3 }}>
                <button type="button" aria-label={`Đưa ${node.name} lên trước`} disabled={index === 0} onClick={() => reorder(tree, index, -1)}
                  style={{ border: 0, background: "none", padding: 1, cursor: index === 0 ? "default" : "pointer", color: index === 0 ? "#dfe3e8" : "#6b7a89" }}><ArrowUp size={11} aria-hidden="true" /></button>
                <button type="button" aria-label={`Đưa ${node.name} xuống sau`} disabled={index === tree.length - 1} onClick={() => reorder(tree, index, 1)}
                  style={{ border: 0, background: "none", padding: 1, cursor: index === tree.length - 1 ? "default" : "pointer", color: index === tree.length - 1 ? "#dfe3e8" : "#6b7a89" }}><ArrowDown size={11} aria-hidden="true" /></button>
              </div>}
            </li>)}
          </ul>}
      {canManage && <button type="button" onClick={() => { const name = prompt("Tên thư mục mới"); if (name?.trim()) onCreateFolder(name.trim()); }}
        style={{ ...rowButton, marginTop: 6, color: "#8d1d50", fontWeight: 700 }}>
        <FolderPlus size={13} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />Thêm thư mục
      </button>}
    </section>

    <section aria-label="Thẻ">
      <p style={heading}>Thẻ</p>
      <label style={{ display: "block", position: "relative" }}>
        <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Tìm thẻ</span>
        <input value={tagQuery} onChange={(event) => setTagQuery(event.target.value)} placeholder="Tìm thẻ…" name="tagSearch"
          style={{ width: "100%", boxSizing: "border-box", padding: "7px 9px", borderRadius: 8, border: "1px solid #dfe3e8", fontSize: 12 }} />
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {visibleTags.length === 0
          ? <p style={{ fontSize: 11, color: "#6b7a89", margin: 0 }}>{tags.length === 0 ? "Chưa có thẻ nào." : "Không có thẻ khớp."}</p>
          : visibleTags.map((tag) => <button key={tag.id} type="button" onClick={() => onSelectTag(tag.id)} aria-pressed={activeTagId === tag.id}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "100%", padding: "4px 9px", borderRadius: 999, cursor: "pointer",
                border: `1px solid ${activeTagId === tag.id ? "#8d1d50" : "#dfe3e8"}`, background: activeTagId === tag.id ? "rgba(141,29,80,.08)" : "#fff", fontSize: 11 }}>
              <Tag size={11} aria-hidden="true" style={{ flex: "none", color: tag.color ?? "#6b7a89" }} />
              <span style={{ overflowWrap: "anywhere" }}>{tag.name}</span>
              <em style={{ fontStyle: "normal", color: "#6b7a89" }}>{tag.assetCount}</em>
            </button>)}
      </div>
      {canManage && <button type="button" onClick={() => { const name = prompt("Tên thẻ mới"); if (name?.trim()) onCreateTag(name.trim()); }}
        style={{ ...rowButton, marginTop: 8, color: "#8d1d50", fontWeight: 700 }}>
        <Tag size={13} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />Thêm thẻ
      </button>}
    </section>

    {canManage && <button type="button" onClick={onManage} style={{ ...rowButton, marginTop: 16, borderTop: "1px solid #eef1f4", paddingTop: 12 }}>
      Quản lý thư mục &amp; thẻ
    </button>}
  </aside>;
}
