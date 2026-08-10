"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type StudentMissionBlock = { id: string; type: string; label: string; required: boolean; position: number; bindingId?: string; options?: Record<string, unknown> };
export type StudentBlockValue = { blockId: string; value: unknown; status: "draft" | "saved"; updatedAt: string };
type ResolvedBinding = { id: string; title: string };

const REFERENCE_TYPES = new Set(["resource", "tool", "assignment"]);
// "evidence" and result_* blocks point students at Tab 3/4, which own the real data (mission state,
// not a workspace value) — see lib/mission-workspace/student.ts's comment on why Tab 2 does not
// fork a second evidence-submission path.
const NAV_TYPES = new Set(["evidence", "result_summary", "result_metric", "result_card"]);
const AI_TYPES = new Set(["ai_question", "ai_analysis"]);
const KNOWN_DIRECT_TYPES = new Set(["text", "textarea", "number", "date", "checkbox", "link", "file", "image", "video", "select", "multi_select", "checklist", "action_plan", "kpi", "calculator", "table", "kanban"]);

/**
 * Renders one Mission Workspace block for a student and autosaves its value on change (debounced
 * 800ms, matching CLAUDE_INTEGRATION_PROMPT.md §14 "autosave with debounce"). Reference blocks
 * (resource/tool/assignment) and evidence/result/AI blocks are read-only or navigational here —
 * their real data/actions live in Tab 1 (resolved bindings), Tab 3 (evidence engine) and Tab 4
 * (Result card), see mission-workspace-client.tsx.
 */
export function MissionBlockField({ block, value, onSave, onNavigate, resourceBindings, toolBindings, disabled }: {
  block: StudentMissionBlock; value: unknown; onSave: (blockId: string, value: unknown) => void; onNavigate: (tab: "evidence" | "result") => void;
  resourceBindings: ResolvedBinding[]; toolBindings: ResolvedBinding[]; disabled: boolean;
}) {
  const [local, setLocal] = useState<unknown>(value ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setLocal(value ?? null); }, [value]);

  function debouncedSave(next: unknown) {
    setLocal(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(block.id, next), 800);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const items = ((block.options?.items as string[] | undefined) ?? []).filter(Boolean);
  const noteText = (block.options?.text as string | undefined) ?? "";
  const label = <label>{block.label}{block.required && <span style={{ color: "#b42318" }}> *</span>}</label>;
  const empty = (text: string) => <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{text}</p>;

  if (block.type === "note") return <div className="h2o-sr-doc" style={{ gridTemplateColumns: "34px 1fr" }}>
    <div className="h2o-sr-docicon">📝</div>
    <div><b>{block.label}</b><small style={{ whiteSpace: "pre-wrap", display: "block", marginTop: 2 }}>{noteText || "—"}</small></div>
  </div>;

  if (REFERENCE_TYPES.has(block.type)) {
    const options = block.type === "resource" ? resourceBindings : block.type === "tool" ? toolBindings : [];
    const match = options.find((b) => b.id === block.bindingId);
    return <Link href="/student/library" className="h2o-sr-doc">
      <div className="h2o-sr-docicon">{block.type === "tool" ? "🧮" : block.type === "assignment" ? "📝" : "📘"}</div>
      <div><b>{match?.title || block.label}</b><small>{block.type === "tool" ? "Công cụ" : block.type === "assignment" ? "Bài tập" : "Tài liệu"}</small></div>
      <span>→</span>
    </Link>;
  }

  if (NAV_TYPES.has(block.type)) return <div className="h2o-sr-doc" style={{ gridTemplateColumns: "34px 1fr auto" }}>
    <div className="h2o-sr-docicon">{block.type === "evidence" ? "📤" : "🏁"}</div>
    <div><b>{block.label}</b><small>{block.type === "evidence" ? "Nộp ở tab Evidence" : "Xem ở tab Kết quả"}</small></div>
    <button type="button" className="h2o-sr-btn" onClick={() => onNavigate(block.type === "evidence" ? "evidence" : "result")}>Đi tới</button>
  </div>;

  if (AI_TYPES.has(block.type)) return <div className="h2o-sr-doc" style={{ gridTemplateColumns: "34px 1fr" }}>
    <div className="h2o-sr-docicon">✦</div>
    <div><b>{block.label}</b><small>H2O Mentor tạm thời không khả dụng.</small></div>
  </div>;

  return <div className="h2o-sr-field">
    {label}

    {block.type === "text" && <input disabled={disabled} value={(local as string) ?? ""} onChange={(e) => debouncedSave(e.target.value)} />}
    {block.type === "textarea" && <textarea disabled={disabled} value={(local as string) ?? ""} onChange={(e) => debouncedSave(e.target.value)} />}
    {block.type === "number" && <input disabled={disabled} type="number" value={(local as number) ?? ""} onChange={(e) => debouncedSave(e.target.value === "" ? null : Number(e.target.value))} />}
    {block.type === "date" && <input disabled={disabled} type="date" value={(local as string) ?? ""} onChange={(e) => debouncedSave(e.target.value)} />}
    {block.type === "checkbox" && <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 400 }}><input type="checkbox" disabled={disabled} checked={Boolean(local)} onChange={(e) => debouncedSave(e.target.checked)} style={{ width: "auto" }} /> Đã hoàn thành</label>}
    {block.type === "link" && <input disabled={disabled} type="url" placeholder="https://..." value={(local as string) ?? ""} onChange={(e) => debouncedSave(e.target.value)} />}
    {(block.type === "file" || block.type === "image" || block.type === "video") &&
      <input disabled={disabled} type="url" placeholder="Dán link file/ảnh/video" value={(local as string) ?? ""} onChange={(e) => debouncedSave(e.target.value)} />}

    {block.type === "select" && (items.length
      ? <select disabled={disabled} value={(local as string) ?? ""} onChange={(e) => debouncedSave(e.target.value)}>
          <option value="">— chọn —</option>
          {items.map((it) => <option key={it} value={it}>{it}</option>)}
        </select>
      : empty("Chưa có lựa chọn nào được cấu hình."))}

    {block.type === "multi_select" && (items.length
      ? <div style={{ display: "grid", gap: 4 }}>{items.map((it) => {
          const selected = Array.isArray(local) ? (local as string[]) : [];
          return <label key={it} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 400 }}>
            <input type="checkbox" disabled={disabled} checked={selected.includes(it)} style={{ width: "auto" }}
              onChange={(e) => debouncedSave(e.target.checked ? [...selected, it] : selected.filter((s) => s !== it))} /> {it}
          </label>;
        })}</div>
      : empty("Chưa có lựa chọn nào được cấu hình."))}

    {block.type === "checklist" && (items.length
      ? <div style={{ display: "grid", gap: 4 }}>{items.map((it) => {
          const done = Array.isArray(local) ? (local as string[]) : [];
          return <label key={it} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 400 }}>
            <input type="checkbox" disabled={disabled} checked={done.includes(it)} style={{ width: "auto" }}
              onChange={(e) => debouncedSave(e.target.checked ? [...done, it] : done.filter((s) => s !== it))} />
            <span style={{ textDecoration: done.includes(it) ? "line-through" : "none", color: done.includes(it) ? "#94a3b8" : undefined }}>{it}</span>
          </label>;
        })}</div>
      : empty("Chưa có mục nào được cấu hình."))}

    {block.type === "action_plan" && (items.length
      ? <div style={{ display: "grid", gap: 8 }}>{items.map((step) => {
          const notes = (local && typeof local === "object" && !Array.isArray(local) ? (local as Record<string, string>) : {});
          return <div key={step}>
            <span style={{ fontSize: 12, display: "block", marginBottom: 4 }}>{step}</span>
            <input disabled={disabled} placeholder="Ghi chú của bạn" value={notes[step] ?? ""} onChange={(e) => debouncedSave({ ...notes, [step]: e.target.value })} />
          </div>;
        })}</div>
      : empty("Chưa có bước nào được cấu hình."))}

    {(block.type === "kpi" || block.type === "calculator") && (items.length
      ? <div style={{ display: "grid", gap: 6 }}>
          {items.map((metric) => {
            const values = (local && typeof local === "object" && !Array.isArray(local) ? (local as Record<string, number>) : {});
            return <label key={metric} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 400 }}>
              <span style={{ minWidth: 130 }}>{metric}</span>
              <input disabled={disabled} type="number" value={values[metric] ?? ""} style={{ width: 130 }}
                onChange={(e) => debouncedSave({ ...values, [metric]: e.target.value === "" ? undefined : Number(e.target.value) })} />
            </label>;
          })}
          {block.type === "calculator" && <small style={{ fontSize: 11, color: "#94a3b8" }}>Số liệu được lưu nguyên trạng — công thức tính tự động chưa được xây.</small>}
        </div>
      : empty(block.type === "kpi" ? "Chưa có chỉ số nào được cấu hình." : "Chưa có trường số liệu nào được cấu hình."))}

    {block.type === "table" && <TableInput items={items} value={local} disabled={disabled} onChange={debouncedSave} />}

    {block.type === "kanban" && (items.length
      ? <div style={{ display: "grid", gap: 8, gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, minmax(0,1fr))` }}>
          {items.map((col) => {
            const values = (local && typeof local === "object" && !Array.isArray(local) ? (local as Record<string, string>) : {});
            return <div key={col}>
              <span style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>{col}</span>
              <textarea disabled={disabled} placeholder="Mỗi dòng một việc" value={values[col] ?? ""} style={{ minHeight: 80 }}
                onChange={(e) => debouncedSave({ ...values, [col]: e.target.value })} />
            </div>;
          })}
        </div>
      : empty("Chưa có cột nào được cấu hình."))}

    {!KNOWN_DIRECT_TYPES.has(block.type) && empty(`Loại block "${block.type}" chưa hỗ trợ hiển thị.`)}
  </div>;
}

function TableInput({ items, value, disabled, onChange }: { items: string[]; value: unknown; disabled: boolean; onChange: (v: string[][]) => void }) {
  const rows = Array.isArray(value) ? (value as string[][]) : [];
  const cols = items.length || 1;
  function setCell(rowIndex: number, colIndex: number, cellValue: string) {
    const next = rows.map((r) => [...r]);
    while (next.length <= rowIndex) next.push(Array(cols).fill(""));
    next[rowIndex][colIndex] = cellValue;
    onChange(next);
  }

  if (!items.length) return <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Chưa có cột nào được cấu hình.</p>;
  return <div style={{ overflowX: "auto" }}>
    <table className="h2o-sr-table">
      <thead><tr>{items.map((c) => <th key={c}>{c}</th>)}<th /></tr></thead>
      <tbody>
        {(rows.length ? rows : [Array(cols).fill("")]).map((row, ri) => <tr key={ri}>
          {items.map((_, ci) => <td key={ci}><input disabled={disabled} value={row[ci] ?? ""} onChange={(e) => setCell(ri, ci, e.target.value)} style={{ width: "100%", border: "1px solid #dfe7ee", borderRadius: 8, padding: 6, font: "inherit", fontSize: 12 }} /></td>)}
          <td>{rows.length > 0 && <button type="button" disabled={disabled} onClick={() => onChange(rows.filter((_, i) => i !== ri))} style={{ border: "none", background: "none", cursor: "pointer", color: "#b42318", fontSize: 11 }}>Xóa</button>}</td>
        </tr>)}
      </tbody>
    </table>
    <button type="button" className="h2o-sr-btn" disabled={disabled} onClick={() => onChange([...rows, Array(cols).fill("")])} style={{ marginTop: 8 }}>+ Thêm dòng</button>
  </div>;
}
