"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import styles from "@/components/operations/operations.module.css";

const field = { padding: 8, borderRadius: 8, border: "1px solid #dfe3e8", fontSize: 12, width: "100%" } as const;

export interface OutcomeEditorData {
  id: string; title: string; description: string; position: number;
  milestoneCount: number; missionCount: number;
}

// v5/35-.../CLAUDE_INTEGRATION_PROMPT.md §4 "Chỉnh sửa Kết quả". Data Link section (§13) is a real
// aggregate over the already-loaded tree (missionsWithResources/missionsTotal), not a new query —
// zero extra requests, so selecting an Outcome never costs an N+1 round trip.
export function OutcomeEditorPanel(props: {
  outcome: OutcomeEditorData;
  isDraft: boolean; busy: boolean;
  dataLink: { missionsWithResources: number; missionsTotal: number } | null;
  stageId: string;
  onSave: (patch: { title: string; description: string }) => void;
  onAddMilestone: () => void;
  onDelete: () => void;
}) {
  const { outcome } = props;
  const [title, setTitle] = useState(outcome.title);
  const [description, setDescription] = useState(outcome.description);

  return <div style={{ padding: 16, display: "grid", gap: 12, fontSize: 12 }}>
    <div>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#a21caf" }}>Chỉnh sửa Kết quả</span>
      <h2 style={{ margin: "4px 0 0", fontSize: 18 }}>{outcome.title}</h2>
    </div>

    <label>Tên Kết quả
      <input value={title} disabled={!props.isDraft} onChange={(e) => setTitle(e.target.value)} style={{ ...field, marginTop: 4 }} />
    </label>
    <label>Mô tả
      <textarea value={description} disabled={!props.isDraft} onChange={(e) => setDescription(e.target.value)} style={{ ...field, marginTop: 4, minHeight: 80 }} />
    </label>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <label>Thứ tự
        <input value={outcome.position + 1} disabled style={{ ...field, marginTop: 4, background: "#f8fafc", color: "#94a3b8" }} />
      </label>
      <div style={{ background: "#f8fafc", borderRadius: 10, padding: 10 }}>
        <div style={{ fontSize: 10, color: "#6b7a89", textTransform: "uppercase" }}>Quy mô</div>
        <strong>{outcome.milestoneCount} Chặng · {outcome.missionCount} Nhiệm vụ</strong>
      </div>
    </div>

    {props.dataLink && <div style={{ border: "1px solid #eef1f4", borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7a89", textTransform: "uppercase" }}>Liên kết dữ liệu</div>
      <p style={{ margin: "4px 0 0" }}>{props.dataLink.missionsWithResources}/{props.dataLink.missionsTotal} Nhiệm vụ trong Kết quả này đã có học liệu liên kết.</p>
      <a href={`/academy-admin/data-link?stageId=${props.stageId}`} style={{ color: "#2563eb", fontWeight: 600 }}>Xem chi tiết ở Liên kết dữ liệu →</a>
    </div>}

    {props.isDraft && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={props.busy} onClick={() => props.onSave({ title, description })}>Lưu thay đổi</button>
      <button className={styles.button} disabled={props.busy} onClick={props.onAddMilestone}><Plus size={14} />Thêm Chặng</button>
      <button className={styles.button} disabled={props.busy} style={{ color: "#b42318" }} onClick={props.onDelete}><Trash2 size={14} />Xóa Kết quả</button>
    </div>}
  </div>;
}
