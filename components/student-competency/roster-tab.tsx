"use client";
import { Users } from "lucide-react";
import styles from "@/components/operations/operations.module.css";

interface RosterMember { studentId: string; name: string; avatarUrl: string | null; joinedAt: string | null; status: string }

/**
 * Spec §B student list. Selecting a row is how the Training/Makeup/Hair/Graduation/Competency
 * tabs pick "which học viên" — those tabs also carry their own student selector, so a roster
 * click here is a convenience jump, not the only way in.
 */
export function RosterTab({ roster, loading, selectedStudentId, onSelect }: {
  roster: RosterMember[]; loading: boolean; selectedStudentId: string; onSelect: (studentId: string) => void;
}) {
  return <div className={styles.card}>
    <div className={styles.cardHead}><div><h2>Học viên</h2><p>{roster.length} học viên</p></div></div>
    <div className={styles.cardBody}>
      {loading ? <p>Đang tải…</p> : !roster.length ? (
        <div className={styles.empty}><Users /><strong>Chưa có học viên</strong><p>Lớp này chưa có học viên nào trong class_members.</p></div>
      ) : (
        <div className={styles.list}>
          {roster.map((member) => <button key={member.studentId} type="button" onClick={() => onSelect(member.studentId)}
            className={styles.listItem} style={{ width: "100%", textAlign: "left", cursor: "pointer", border: member.studentId === selectedStudentId ? "1px solid #8bdfea" : undefined }}>
            <span className={styles.listItemIcon}><Users size={16} /></span>
            <div><strong>{member.name}</strong><small>{member.joinedAt ? `Nhập học ${new Date(member.joinedAt).toLocaleDateString("vi-VN")}` : "Chưa rõ ngày nhập học"}</small></div>
            <div className={styles.listItemMeta}><span className={styles.badge} data-tone={member.status === "active" ? "success" : undefined}>{member.status}</span></div>
          </button>)}
        </div>
      )}
    </div>
  </div>;
}
