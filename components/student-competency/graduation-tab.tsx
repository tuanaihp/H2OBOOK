"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import styles from "@/components/operations/operations.module.css";
import formStyles from "./student-competency.module.css";

type Requirement = "passing_evaluation_ratio" | "required_criteria" | "course_completion" | "evidence_profile" | "final_assessment";
interface GraduationResult {
  passingEvaluationRatio: number; avgScore: number; evaluationCount: number;
  missingRequirements: Requirement[]; graduationStatus: "graduated" | "not_ready"; recommendedSupplementSessions: number;
}
const REQUIREMENT_LABEL: Record<Requirement, string> = {
  passing_evaluation_ratio: "Tối thiểu 50% số lần đánh giá đạt ≥ 90/100",
  required_criteria: "Hoàn thành đầy đủ tiêu chí bắt buộc",
  course_completion: "Hoàn thành đầy đủ khung 60 buổi của lớp",
  evidence_profile: "Đầy đủ hồ sơ ảnh/video/ghi chép",
  final_assessment: "Đạt đánh giá cuối khóa (buổi thực hành cuối ≥ 90/100)"
};

export function GraduationTab({ classId, roster, initialStudentId }: { classId: string; roster: { studentId: string; name: string }[]; initialStudentId?: string }) {
  const [studentId, setStudentId] = useState(initialStudentId ?? "");
  const [supplementOverride, setSupplementOverride] = useState<string>("");
  const [result, setResult] = useState<GraduationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (initialStudentId) setStudentId(initialStudentId); }, [initialStudentId]);

  useEffect(() => {
    if (!studentId) { setResult(null); return; }
    setLoading(true);
    const query = supplementOverride ? `&supplementSessions=${supplementOverride}` : "";
    fetch(`/api/teaching/classes/${classId}/graduation?studentId=${studentId}${query}`)
      .then((res) => res.json()).then((json) => setResult(json.graduation ?? null))
      .finally(() => setLoading(false));
  }, [classId, studentId, supplementOverride]);

  return <div className={styles.card}>
    <div className={styles.cardHead}><div><h2>Điều kiện tốt nghiệp</h2><p>≥50% đánh giá ≥90/100 · đủ tiêu chí bắt buộc · đủ hồ sơ · đạt đánh giá cuối khóa</p></div></div>
    <div className={styles.cardBody}>
      <div className={formStyles.pickerRow}>
        <label>Học viên
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">— Chọn học viên —</option>
            {roster.map((r) => <option key={r.studentId} value={r.studentId}>{r.name}</option>)}
          </select>
        </label>
        <label>Số buổi bổ sung nếu chưa đạt (5–15, mặc định 10)
          <input type="number" min={5} max={15} placeholder="10" value={supplementOverride} onChange={(e) => setSupplementOverride(e.target.value)} />
        </label>
      </div>

      {loading && <p>Đang tính…</p>}
      {!loading && result && <>
        <div className={styles.metrics} style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
          <div className={styles.metric}><div><strong>{result.avgScore}</strong><span>Điểm trung bình</span></div></div>
          <div className={styles.metric}><div><strong>{Math.round(result.passingEvaluationRatio * 100)}%</strong><span>Tỷ lệ đánh giá ≥90</span></div></div>
          <div className={styles.metric}><div><strong>{result.evaluationCount}</strong><span>Số lần đánh giá</span></div></div>
        </div>

        <div style={{ marginTop: 14 }}>
          {result.graduationStatus === "graduated"
            ? <span className={styles.badge} data-tone="success">Đủ điều kiện tốt nghiệp</span>
            : <span className={styles.badge} data-tone="warning">Chưa đủ điều kiện — đề xuất học bổ sung {result.recommendedSupplementSessions} buổi</span>}
        </div>

        <div className={formStyles.requirementList}>
          {(Object.keys(REQUIREMENT_LABEL) as Requirement[]).map((key) => {
            const met = !result.missingRequirements.includes(key);
            return <div key={key} className={formStyles.requirementItem} data-met={met}>
              {met ? <CheckCircle2 size={14} /> : <XCircle size={14} />}{REQUIREMENT_LABEL[key]}
            </div>;
          })}
        </div>
      </>}
    </div>
  </div>;
}
