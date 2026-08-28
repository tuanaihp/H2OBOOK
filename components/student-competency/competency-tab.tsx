"use client";
import { useEffect, useState } from "react";
import styles from "@/components/operations/operations.module.css";
import formStyles from "./student-competency.module.css";

interface CompetencySkillPoint { key: string; label: string; latestScore: number | null; trend30: number | null; trend60: number | null; trend90: number | null; evidenceCount: number }
const READINESS_LABEL = { san_sang: "Sẵn sàng nhận khách", gan_san_sang: "Gần sẵn sàng", can_luyen_them: "Cần luyện thêm" } as const;

function estimateReadiness(profile: CompetencySkillPoint[]): keyof typeof READINESS_LABEL {
  const scored = profile.filter((s) => s.latestScore != null);
  if (!scored.length) return "can_luyen_them";
  const avg = scored.reduce((sum, s) => sum + (s.latestScore ?? 0), 0) / scored.length;
  const weakCount = scored.filter((s) => (s.latestScore ?? 0) < 70).length;
  if (avg >= 85 && weakCount === 0) return "san_sang";
  if (avg >= 70 && weakCount <= 2) return "gan_san_sang";
  return "can_luyen_them";
}

export function CompetencyTab({ classId, roster, initialStudentId }: { classId: string; roster: { studentId: string; name: string }[]; initialStudentId?: string }) {
  const [studentId, setStudentId] = useState(initialStudentId ?? "");
  const [profile, setProfile] = useState<CompetencySkillPoint[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (initialStudentId) setStudentId(initialStudentId); }, [initialStudentId]);

  useEffect(() => {
    if (!studentId) { setProfile(null); return; }
    setLoading(true);
    fetch(`/api/teaching/classes/${classId}/competency?studentId=${studentId}`)
      .then((res) => res.json()).then((json) => setProfile(json.profile ?? null))
      .finally(() => setLoading(false));
  }, [classId, studentId]);

  const strengths = (profile ?? []).filter((s) => (s.latestScore ?? 0) >= 85).sort((a, b) => (b.latestScore ?? 0) - (a.latestScore ?? 0));
  const weaknesses = (profile ?? []).filter((s) => s.latestScore != null && s.latestScore < 60).sort((a, b) => (a.latestScore ?? 0) - (b.latestScore ?? 0));

  return <div className={styles.card}>
    <div className={styles.cardHead}><div><h2>Hồ sơ năng lực</h2><p>13 kỹ năng theo dõi · tiến bộ 30/60/90 ngày (spec §G)</p></div></div>
    <div className={styles.cardBody}>
      <div className={formStyles.pickerRow}>
        <label>Học viên
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">— Chọn học viên —</option>
            {roster.map((r) => <option key={r.studentId} value={r.studentId}>{r.name}</option>)}
          </select>
        </label>
      </div>

      {loading && <p>Đang tải…</p>}
      {!loading && profile && <>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14, fontSize: 12 }}>
          <span className={styles.badge} data-tone="purple">{READINESS_LABEL[estimateReadiness(profile)]}</span>
          {strengths.length > 0 && <span>💪 Điểm mạnh: {strengths.slice(0, 3).map((s) => s.label).join(", ")}</span>}
          {weaknesses.length > 0 && <span style={{ color: "#a05a13" }}>⚠️ Điểm yếu: {weaknesses.slice(0, 3).map((s) => s.label).join(", ")}</span>}
        </div>

        <div className={formStyles.skillGrid}>
          {profile.map((skill) => <div key={skill.key} className={formStyles.skillCard}>
            <strong>{skill.label}</strong>
            {skill.latestScore == null ? <small style={{ color: "#9aa4b2" }}>Chưa có dữ liệu</small> : (
              <div className={formStyles.skillTrendRow}>
                <div><b>{skill.latestScore}</b>gần nhất</div>
                <div><b>{skill.trend30 ?? "—"}</b>30 ngày</div>
                <div><b>{skill.trend60 ?? "—"}</b>60 ngày</div>
                <div><b>{skill.trend90 ?? "—"}</b>90 ngày</div>
              </div>
            )}
          </div>)}
        </div>
      </>}
    </div>
  </div>;
}
