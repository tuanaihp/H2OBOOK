"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Users, CalendarCheck, Target } from "lucide-react";
import { SESSION_TYPE_LABEL, type SessionType } from "@/lib/student-competency/types";
import styles from "@/components/operations/operations.module.css";

interface ClassOverview {
  studentCount: number; totalSessions: number; completedSessions: number;
  sessionsByType: Partial<Record<SessionType, number>>; avgScore: number; passingRatioPercent: number;
  attentionCount: number; evidenceMissingCount: number; graduationReadyCount: number;
}

export function OverviewTab({ classId }: { classId: string }) {
  const [overview, setOverview] = useState<ClassOverview | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/teaching/classes/${classId}/overview`);
    const json = await res.json().catch(() => null);
    if (res.ok) setOverview(json.overview);
  }
  useEffect(() => { load(); }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function seedCurriculum() {
    setSeeding(true); setMessage(null);
    const res = await fetch(`/api/teaching/classes/${classId}/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seedCurriculum: true }) });
    const json = await res.json().catch(() => null);
    setSeeding(false);
    if (!res.ok) { setMessage(json?.error ?? "Không khởi tạo được buổi học."); return; }
    setMessage(`Đã tạo ${json.count} buổi học theo khung chương trình chuẩn.`);
    await load();
  }

  if (!overview) return <p>Đang tải…</p>;
  const sessionsTotal = Object.values(overview.sessionsByType).reduce((a, b) => a + (b ?? 0), 0);

  return <div style={{ display: "grid", gap: 16 }}>
    <div className={styles.metrics}>
      <div className={styles.metric}><span className={styles.metricIcon}><Users size={18} /></span><div><strong>{overview.studentCount}</strong><span>Học viên</span></div></div>
      <div className={styles.metric}><span className={styles.metricIcon}><CalendarCheck size={18} /></span><div><strong>{overview.completedSessions}/{overview.totalSessions}</strong><span>Buổi đã hoàn thành</span></div></div>
      <div className={styles.metric}><span className={styles.metricIcon}><Target size={18} /></span><div><strong>{overview.avgScore}</strong><span>Điểm trung bình</span></div></div>
      <div className={styles.metric}><span className={styles.metricIcon}><Target size={18} /></span><div><strong>{overview.passingRatioPercent}%</strong><span>Tỷ lệ đánh giá ≥90</span></div></div>
      <div className={styles.metric}><span className={styles.metricIcon}><Target size={18} /></span><div><strong>{overview.graduationReadyCount}/{overview.studentCount}</strong><span>Đủ điều kiện tốt nghiệp</span></div></div>
    </div>

    {(overview.attentionCount > 0 || overview.evidenceMissingCount > 0) && <div className={styles.card}>
      <div className={styles.cardBody} style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {overview.attentionCount > 0 && <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#a05a13" }}><AlertTriangle size={14} />{overview.attentionCount} học viên cần chú ý (điểm trung bình dưới 70%)</span>}
        {overview.evidenceMissingCount > 0 && <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#a05a13" }}><AlertTriangle size={14} />{overview.evidenceMissingCount} phiếu chấm còn thiếu ảnh/video/ghi chép</span>}
      </div>
    </div>}

    <div className={styles.card}>
      <div className={styles.cardHead}><div><h2>Số buổi theo nhóm</h2><p>{sessionsTotal}/{overview.totalSessions} buổi đã được tạo</p></div>
        {sessionsTotal === 0 && <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={seeding} onClick={seedCurriculum}>{seeding ? "Đang tạo…" : "Khởi tạo 60 buổi mặc định"}</button>}
      </div>
      <div className={styles.cardBody}>
        {sessionsTotal === 0 ? <div className={styles.empty}><strong>Chưa có buổi học nào</strong><p>Bấm &quot;Khởi tạo 60 buổi mặc định&quot; để tạo theo khung chương trình chuẩn (spec §2), sau đó chỉnh ngày/nội dung từng buổi.</p></div> : (
          <div className={styles.list}>
            {(Object.keys(SESSION_TYPE_LABEL) as SessionType[]).map((type) => overview.sessionsByType[type] ? (
              <div key={type} className={styles.listItem}><div><strong>{SESSION_TYPE_LABEL[type]}</strong></div><div className={styles.listItemMeta}><b>{overview.sessionsByType[type]} buổi</b></div></div>
            ) : null)}
          </div>
        )}
        {message && <p style={{ fontSize: 11, color: "#177a54", marginTop: 10 }}>{message}</p>}
      </div>
    </div>
  </div>;
}
