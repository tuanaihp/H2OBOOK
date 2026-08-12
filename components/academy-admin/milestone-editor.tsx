"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import styles from "@/components/operations/operations.module.css";

const field = { padding: 8, borderRadius: 8, border: "1px solid #dfe3e8", fontSize: 12, width: "100%" } as const;

export interface MilestoneEditorData {
  id: string; title: string; description: string; position: number; missionCount: number;
}

// v5/35-.../CLAUDE_INTEGRATION_PROMPT.md §5 "Chỉnh sửa Chặng".
export function MilestoneEditorPanel(props: {
  milestone: MilestoneEditorData;
  isDraft: boolean; busy: boolean;
  dataLink: { missionsWithResources: number; missionsTotal: number } | null;
  stageId: string;
  onSave: (patch: { title: string; description: string }) => void;
  onAddMission: () => void;
  onDelete: () => void;
}) {
  const { milestone } = props;
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description);

  return <div style={{ padding: 16, display: "grid", gap: 12, fontSize: 12 }}>
    <div>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6d28d9" }}>Chỉnh sửa Chặng</span>
      <h2 style={{ margin: "4px 0 0", fontSize: 18 }}>{milestone.title}</h2>
    </div>

    <label>Tên Chặng
      <input value={title} disabled={!props.isDraft} onChange={(e) => setTitle(e.target.value)} style={{ ...field, marginTop: 4 }} />
    </label>
    <label>Mô tả
      <textarea value={description} disabled={!props.isDraft} onChange={(e) => setDescription(e.target.value)} style={{ ...field, marginTop: 4, minHeight: 80 }} />
    </label>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <label>Thứ tự
        <input value={milestone.position + 1} disabled style={{ ...field, marginTop: 4, background: "#f8fafc", color: "#94a3b8" }} />
      </label>
      <div style={{ background: "#f8fafc", borderRadius: 10, padding: 10 }}>
        <div style={{ fontSize: 10, color: "#6b7a89", textTransform: "uppercase" }}>Số Nhiệm vụ</div>
        <strong>{milestone.missionCount}</strong>
      </div>
    </div>

    {props.dataLink && <div style={{ border: "1px solid #eef1f4", borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7a89", textTransform: "uppercase" }}>Liên kết dữ liệu</div>
      <p style={{ margin: "4px 0 0" }}>{props.dataLink.missionsWithResources}/{props.dataLink.missionsTotal} Nhiệm vụ trong Chặng này đã có học liệu liên kết.</p>
      <a href={`/academy-admin/data-link?stageId=${props.stageId}`} style={{ color: "#2563eb", fontWeight: 600 }}>Xem chi tiết ở Liên kết dữ liệu →</a>
    </div>}

    {props.isDraft && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={props.busy} onClick={() => props.onSave({ title, description })}>Lưu thay đổi</button>
      <button className={styles.button} disabled={props.busy} onClick={props.onAddMission}><Plus size={14} />Thêm Nhiệm vụ</button>
      <button className={styles.button} disabled={props.busy} style={{ color: "#b42318" }} onClick={props.onDelete}><Trash2 size={14} />Xóa Chặng</button>
    </div>}
  </div>;
}
