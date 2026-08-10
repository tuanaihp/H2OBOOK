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

const box = { padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e9ee", background: "#fff", marginBottom: 10 } as const;
const field = { padding: 8, borderRadius: 8, border: "1px solid #dfe3e8", fontSize: 13, width: "100%" } as const;
const labelStyle = { fontSize: 12, fontWeight: 600, marginBottom: 6, display: "flex", gap: 6, alignItems: "center" } as const;

/**
 * Renders one Mission Workspace block for a student and autosaves its value on change (debounced
 * 800ms, matching CLAUDE_INTEGRATION_PROMPT.md §14 "autosave with debounce"). Reference blocks
 * (resource/tool/assignment) and evidence/result/AI blocks are read-only or navigational here —
 * their real data/actions live in Tab 1 (resolved bindings), Tab 3 (evidence engine) and Tab 4
 * (Result summary), see mission-workspace-client.tsx.
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

  if (block.type === "note") return <div style={{ ...box, background: "#f7f9fb" }}>
    <p style={labelStyle}>{block.label}</p>
    <p style={{ fontSize: 13, color: "#3d4a5a", margin: 0, whiteSpace: "pre-wrap" }}>{noteText || "—"}</p>
  </div>;

  if (REFERENCE_TYPES.has(block.type)) {
    const options = block.type === "resource" ? resourceBindings : block.type === "tool" ? toolBindings : [];
    const match = options.find((b) => b.id === block.bindingId);
    return <div style={box}>
      <p style={labelStyle}>{block.label}</p>
      {match ? <Link href="/student/library" style={{ fontSize: 13, color: "#2563eb" }}>{match.title}</Link> : <p style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có tài liệu liên kết.</p>}
    </div>;
  }

  if (NAV_TYPES.has(block.type)) return <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
    <div><p style={labelStyle}>{block.label}</p><p style={{ fontSize: 12, color: "#6b7a89", margin: 0 }}>Nộp bằng chứng và xem kết quả ở tab riêng.</p></div>
    <button type="button" onClick={() => onNavigate(block.type === "evidence" ? "evidence" : "result")} className="h2o-student-primary" style={{ padding: "6px 12px", fontSize: 12 }}>
      {block.type === "evidence" ? "Đi tới Evidence" : "Đi tới Kết quả"}
    </button>
  </div>;

  if (AI_TYPES.has(block.type)) return <div style={{ ...box, background: "#f8f7ff", color: "#6b7a89" }}>
    <p style={labelStyle}>{block.label}</p>
    <p style={{ fontSize: 12, margin: 0 }}>H2O Mentor tạm thời không khả dụng.</p>
  </div>;

  return <div style={box}>
    <p style={labelStyle}>{block.label}{block.required && <span style={{ color: "#b42318", fontSize: 11 }}>* bắt buộc</span>}</p>

    {block.type === "text" && <input disabled={disabled} value={(local as string) ?? ""} onChange={(e) => debouncedSave(e.target.value)} style={field} />}
    {block.type === "textarea" && <textarea disabled={disabled} value={(local as string) ?? ""} onChange={(e) => debouncedSave(e.target.value)} style={{ ...field, minHeight: 70 }} />}
    {block.type === "number" && <input disabled={disabled} type="number" value={(local as number) ?? ""} onChange={(e) => debouncedSave(e.target.value === "" ? null : Number(e.target.value))} style={field} />}
    {block.type === "date" && <input disabled={disabled} type="date" value={(local as string) ?? ""} onChange={(e) => debouncedSave(e.target.value)} style={field} />}
    {block.type === "checkbox" && <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><input disabled={disabled} type="checkbox" checked={Boolean(local)} onChange={(e) => debouncedSave(e.target.checked)} /> Đã hoàn thành</label>}
    {block.type === "link" && <input disabled={disabled} type="url" placeholder="https://..." value={(local as string) ?? ""} onChange={(e) => debouncedSave(e.target.value)} style={field} />}
    {(block.type === "file" || block.type === "image" || block.type === "video") && <>
      <input disabled={disabled} type="url" placeholder="Dán link file/ảnh/video (upload trực tiếp sẽ có ở bản sau)" value={(local as string) ?? ""} onChange={(e) => debouncedSave(e.target.value)} style={field} />
    </>}

    {block.type === "select" && !items.length && <p style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có lựa chọn nào được cấu hình.</p>}
    {block.type === "select" && items.length > 0 && <select disabled={disabled} value={(local as string) ?? ""} onChange={(e) => debouncedSave(e.target.value)} style={field}>
      <option value="">— chọn —</option>
      {items.map((it) => <option key={it} value={it}>{it}</option>)}
    </select>}

    {block.type === "multi_select" && <div style={{ display: "grid", gap: 4 }}>
      {!items.length && <p style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có lựa chọn nào được cấu hình.</p>}
      {items.map((it) => {
        const selected = Array.isArray(local) ? (local as string[]) : [];
        return <label key={it} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input disabled={disabled} type="checkbox" checked={selected.includes(it)} onChange={(e) => debouncedSave(e.target.checked ? [...selected, it] : selected.filter((s) => s !== it))} /> {it}
        </label>;
      })}
    </div>}

    {block.type === "checklist" && <div style={{ display: "grid", gap: 4 }}>
      {!items.length && <p style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có mục nào được cấu hình.</p>}
      {items.map((it) => {
        const done = Array.isArray(local) ? (local as string[]) : [];
        return <label key={it} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input disabled={disabled} type="checkbox" checked={done.includes(it)} onChange={(e) => debouncedSave(e.target.checked ? [...done, it] : done.filter((s) => s !== it))} /> {it}
        </label>;
      })}
    </div>}

    {block.type === "action_plan" && <div style={{ display: "grid", gap: 6 }}>
      {!items.length && <p style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có bước nào được cấu hình.</p>}
      {items.map((step) => {
        const notes = (local && typeof local === "object" ? (local as Record<string, string>) : {});
        return <div key={step} style={{ display: "grid", gap: 2 }}>
          <span style={{ fontSize: 12 }}>{step}</span>
          <input disabled={disabled} placeholder="Ghi chú của bạn" value={notes[step] ?? ""} onChange={(e) => debouncedSave({ ...notes, [step]: e.target.value })} style={field} />
        </div>;
      })}
    </div>}

    {block.type === "kpi" && <div style={{ display: "grid", gap: 6 }}>
      {!items.length && <p style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có chỉ số nào được cấu hình.</p>}
      {items.map((metric) => {
        const values = (local && typeof local === "object" ? (local as Record<string, number>) : {});
        return <label key={metric} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <span style={{ minWidth: 120 }}>{metric}</span>
          <input disabled={disabled} type="number" value={values[metric] ?? ""} onChange={(e) => debouncedSave({ ...values, [metric]: e.target.value === "" ? undefined : Number(e.target.value) })} style={{ ...field, width: 120 }} />
        </label>;
      })}
    </div>}

    {block.type === "calculator" && <div style={{ display: "grid", gap: 6 }}>
      {!items.length && <p style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có trường số liệu nào được cấu hình.</p>}
      {items.map((f) => {
        const values = (local && typeof local === "object" ? (local as Record<string, number>) : {});
        return <label key={f} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <span style={{ minWidth: 120 }}>{f}</span>
          <input disabled={disabled} type="number" value={values[f] ?? ""} onChange={(e) => debouncedSave({ ...values, [f]: e.target.value === "" ? undefined : Number(e.target.value) })} style={{ ...field, width: 120 }} />
        </label>;
      })}
      <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>Công thức tính tự động chưa được xây — số liệu bạn nhập được lưu lại nguyên trạng.</p>
    </div>}

    {block.type === "table" && <TableInput items={items} value={local} disabled={disabled} onChange={debouncedSave} />}

    {block.type === "kanban" && <div style={{ display: "grid", gap: 6, gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, 1fr)` }}>
      {!items.length && <p style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có cột nào được cấu hình.</p>}
      {items.map((col) => {
        const values = (local && typeof local === "object" ? (local as Record<string, string>) : {});
        return <div key={col}>
          <p style={{ fontSize: 11, fontWeight: 600, margin: "0 0 4px" }}>{col}</p>
          <textarea disabled={disabled} placeholder="Mỗi dòng một việc" value={values[col] ?? ""} onChange={(e) => debouncedSave({ ...values, [col]: e.target.value })} style={{ ...field, minHeight: 70 }} />
        </div>;
      })}
    </div>}

    {!KNOWN_DIRECT_TYPES.has(block.type) && <p style={{ fontSize: 12, color: "#94a3b8" }}>Loại block &quot;{block.type}&quot; chưa hỗ trợ hiển thị.</p>}
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
  function addRow() { onChange([...rows, Array(cols).fill("")]); }
  function removeRow(index: number) { onChange(rows.filter((_, i) => i !== index)); }

  if (!items.length) return <p style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có cột nào được cấu hình.</p>;
  return <div style={{ overflowX: "auto" }}>
    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
      <thead><tr>{items.map((c) => <th key={c} style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #e5e9ee" }}>{c}</th>)}<th /></tr></thead>
      <tbody>
        {(rows.length ? rows : [Array(cols).fill("")]).map((row, ri) => <tr key={ri}>
          {items.map((_, ci) => <td key={ci} style={{ padding: 4 }}><input disabled={disabled} value={row[ci] ?? ""} onChange={(e) => setCell(ri, ci, e.target.value)} style={{ ...field, padding: 6 }} /></td>)}
          <td>{rows.length > 0 && <button type="button" disabled={disabled} onClick={() => removeRow(ri)} style={{ border: "none", background: "none", cursor: "pointer", color: "#b42318", fontSize: 11 }}>Xóa</button>}</td>
        </tr>)}
      </tbody>
    </table>
    <button type="button" disabled={disabled} onClick={addRow} style={{ marginTop: 6, fontSize: 12, border: "1px dashed #dfe3e8", borderRadius: 8, padding: "4px 10px", background: "#fff", cursor: "pointer" }}>+ Thêm dòng</button>
  </div>;
}
