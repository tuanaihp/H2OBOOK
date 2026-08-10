"use client";
import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";
import styles from "@/components/operations/operations.module.css";

type MissionBlockType = string;
type MissionBlock = { id: string; type: MissionBlockType; label: string; required: boolean; position: number; bindingId?: string; options?: Record<string, unknown> };
type WorkspaceConfig = { blocks: MissionBlock[] } | null;
type BindingOption = { id: string; label: string };

const GROUPS: { label: string; types: MissionBlockType[] }[] = [
  { label: "Nhập liệu", types: ["text", "textarea", "number", "select", "multi_select", "checkbox", "date"] },
  { label: "Cấu trúc", types: ["note", "checklist", "table", "kpi", "action_plan", "kanban"] },
  { label: "Tham chiếu canonical", types: ["resource", "tool", "assignment"] },
  { label: "Bằng chứng", types: ["file", "image", "video", "link", "evidence"] },
  { label: "Thông minh", types: ["calculator", "ai_question", "ai_analysis"] },
  { label: "Kết quả", types: ["result_summary", "result_metric", "result_card"] }
];
const REFERENCE_TYPES = new Set(["resource", "tool", "assignment"]);
// Mirrors lib/mission-workspace/types.ts's ITEMS_CONFIG_TYPES — kept as a literal copy since this
// component only imports types, not runtime values, from a server-only module.
const ITEMS_CONFIG_TYPES = new Set(["select", "multi_select", "checklist", "table", "kpi", "action_plan", "kanban", "calculator"]);
const ITEMS_HINT: Record<string, string> = {
  select: "Các lựa chọn", multi_select: "Các lựa chọn", checklist: "Các việc cần làm", table: "Tên cột",
  kpi: "Tên chỉ số", action_plan: "Các bước", kanban: "Tên cột (VD: Cần làm / Đang làm / Xong)", calculator: "Tên trường số liệu"
};
const field = { padding: 8, borderRadius: 8, border: "1px solid #dfe3e8", fontSize: 12, width: "100%" } as const;

/**
 * The "Mission Workspace" section of the Mission Inspector (docs/smart-learning Release 1). Reads
 * canonical binding options straight from the mission's own resource/tool/assignment bindings (props
 * from the parent, already loaded there) rather than fetching them again — a reference block can
 * only point at a binding the mission already has, never a fresh id typed by hand.
 */
export function MissionWorkspaceBuilder({ journeyVersionId, missionId, isDraft, resourceBindings, toolBindings, assignmentBindings }: {
  journeyVersionId: string; missionId: string; isDraft: boolean;
  resourceBindings: BindingOption[]; toolBindings: BindingOption[]; assignmentBindings: BindingOption[];
}) {
  const [config, setConfig] = useState<WorkspaceConfig>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newType, setNewType] = useState<MissionBlockType>("text");
  const [newLabel, setNewLabel] = useState("");
  const [newBindingId, setNewBindingId] = useState("");
  const [newItemsText, setNewItemsText] = useState("");
  const [newNoteText, setNewNoteText] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/academy-admin/mission-workspace?journeyVersionId=${journeyVersionId}&missionId=${missionId}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setConfig(json?.config ?? { blocks: [] });
    setLoading(false);
  }
  useEffect(() => { load(); }, [journeyVersionId, missionId]);

  async function call(body: unknown) {
    setBusy(true);
    await fetch("/api/academy-admin/mission-workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ journeyVersionId, missionId, ...(body as object) }) });
    await load();
    setBusy(false);
  }

  const bindingOptionsFor = (type: string): BindingOption[] => type === "resource" ? resourceBindings : type === "tool" ? toolBindings : type === "assignment" ? assignmentBindings : [];

  if (loading) return <p style={{ fontSize: 12, color: "#6b7a89" }}>Đang tải Workspace...</p>;
  const blocks = (config?.blocks ?? []).sort((a, b) => a.position - b.position);

  return <div>
    <strong style={{ fontSize: 12 }}>Mission Workspace (tab &quot;Làm việc&quot;)</strong>
    <div style={{ display: "grid", gap: 6, margin: "6px 0" }}>
      {blocks.length === 0 && <p style={{ fontSize: 11, color: "#6b7a89" }}>Chưa có block nào — học viên sẽ chỉ thấy Tab 1/3/4, chưa có nội dung &ldquo;Làm việc&rdquo;.</p>}
      {blocks.map((block, index) => <div key={block.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", border: "1px solid #eef1f4", borderRadius: 8, fontSize: 11 }}>
        <span style={{ flex: 1 }}>
          <strong>{block.label}</strong> <span style={{ color: "#94a3b8" }}>({block.type}{block.required ? " · bắt buộc" : ""})</span>
          {REFERENCE_TYPES.has(block.type) && <div style={{ color: block.bindingId ? "#16a34a" : "#b42318" }}>{block.bindingId ? `Đã gắn: ${bindingOptionsFor(block.type).find((b) => b.id === block.bindingId)?.label ?? block.bindingId}` : "⚠ Chưa gắn binding"}</div>}
          {ITEMS_CONFIG_TYPES.has(block.type) && <div style={{ color: "#6b7a89" }}>{(block.options?.items as string[] | undefined)?.length ? (block.options!.items as string[]).join(" · ") : "⚠ Chưa cấu hình danh sách"}</div>}
          {block.type === "note" && <div style={{ color: "#6b7a89" }}>{(block.options?.text as string | undefined) || "⚠ Chưa có nội dung ghi chú"}</div>}
        </span>
        {isDraft && <>
          <button disabled={busy || index === 0} onClick={() => call({ action: "reorder", orderedBlockIds: [...blocks.map((b) => b.id).slice(0, index - 1), block.id, blocks[index - 1]?.id, ...blocks.map((b) => b.id).slice(index + 1)].filter(Boolean) })} style={{ border: "none", background: "none", cursor: "pointer" }}><ChevronUp size={13} /></button>
          <button disabled={busy || index === blocks.length - 1} onClick={() => call({ action: "reorder", orderedBlockIds: [...blocks.map((b) => b.id).slice(0, index), blocks[index + 1]?.id, block.id, ...blocks.map((b) => b.id).slice(index + 2)].filter(Boolean) })} style={{ border: "none", background: "none", cursor: "pointer" }}><ChevronDown size={13} /></button>
          <button disabled={busy} onClick={() => call({ action: "removeBlock", blockId: block.id })} style={{ border: "none", background: "none", cursor: "pointer", color: "#b42318" }}><Trash2 size={13} /></button>
        </>}
      </div>)}
    </div>

    {isDraft && <form onSubmit={(e) => {
      e.preventDefault(); if (!newLabel.trim()) return;
      const options = ITEMS_CONFIG_TYPES.has(newType)
        ? { items: newItemsText.split("\n").map((s) => s.trim()).filter(Boolean) }
        : newType === "note" ? { text: newNoteText.trim() } : undefined;
      call({ action: "addBlock", block: { type: newType, label: newLabel.trim(), bindingId: newBindingId || undefined, options } });
      setNewLabel(""); setNewBindingId(""); setNewItemsText(""); setNewNoteText("");
    }} style={{ display: "grid", gap: 6, marginTop: 6 }}>
      <div style={{ display: "grid", gap: 6, gridTemplateColumns: REFERENCE_TYPES.has(newType) ? "1fr 1fr 1fr auto" : "1fr 1fr auto" }}>
        <select value={newType} onChange={(e) => { setNewType(e.target.value); setNewBindingId(""); }} style={field}>
          {GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.types.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>)}
        </select>
        <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Nhãn block" style={field} />
        {REFERENCE_TYPES.has(newType) && <select value={newBindingId} onChange={(e) => setNewBindingId(e.target.value)} style={field}>
          <option value="">— chọn binding —</option>
          {bindingOptionsFor(newType).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>}
        <button type="submit" disabled={busy} className={styles.button} style={{ whiteSpace: "nowrap" }}><Plus size={12} /> Thêm block</button>
      </div>
      {ITEMS_CONFIG_TYPES.has(newType) && <textarea value={newItemsText} onChange={(e) => setNewItemsText(e.target.value)} placeholder={`${ITEMS_HINT[newType] ?? "Danh sách"} — mỗi dòng một mục`} style={{ ...field, minHeight: 50 }} />}
      {newType === "note" && <textarea value={newNoteText} onChange={(e) => setNewNoteText(e.target.value)} placeholder="Nội dung ghi chú hiển thị cho học viên" style={{ ...field, minHeight: 50 }} />}
    </form>}
  </div>;
}
