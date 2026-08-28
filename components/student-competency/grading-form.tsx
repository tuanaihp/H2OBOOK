"use client";
import { useEffect, useMemo, useState } from "react";
import { uploadAsset, resolveAssetUrl } from "@/lib/assets/asset-client";
import { SESSION_TYPE_LABEL, type SessionType } from "@/lib/student-competency/types";
import styles from "@/components/operations/operations.module.css";
import formStyles from "./student-competency.module.css";

interface RosterMember { studentId: string; name: string }
interface RubricCriterionView { id: string; title: string; description: string; maxScore: number; position: number; required: boolean }
interface RubricView { id: string; title: string; updatedAt: string; criteria: RubricCriterionView[] }
interface ClassSession { id: string; sessionNo: number; sessionType: SessionType; title: string; status: string }
interface ClassEvaluation { id: string; classSessionId: string; rubricId: string; totalScore: number; maxScore: number; criterionScores: Record<string, number>; notes: string; assetIds: string[]; updatedAt: string }

const MAX_EVIDENCE = 4;

/**
 * Shared grading form + history behind the Training/Makeup/Hair tabs (spec §4: chọn học viên +
 * buổi → nhập điểm từng tiêu chí → tick lỗi/ghi chú → đính kèm ảnh/video → lưu → xem lịch sử ngay
 * cùng màn hình). Evidence upload reuses lib/assets/asset-client.ts's uploadAsset/resolveAssetUrl
 * — the same pipeline components/student/mission-workspace/daily-practice-logger.tsx already uses
 * for student practice photos, not a new upload path.
 */
export function GradingForm({ classId, roster, category, sessionTypeFilter, emptyRubricHint, initialStudentId }: {
  classId: string; roster: RosterMember[]; category: "training" | "makeup" | "hair"; sessionTypeFilter: SessionType[]; emptyRubricHint: string; initialStudentId?: string;
}) {
  const [rubric, setRubric] = useState<RubricView | null | undefined>(undefined);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [studentId, setStudentId] = useState(initialStudentId ?? "");

  // Roster tab "click to jump": re-syncs whenever the shared selection changes, so opening this
  // tab after picking a student on the Roster tab lands pre-selected instead of empty.
  useEffect(() => { if (initialStudentId) setStudentId(initialStudentId); }, [initialStudentId]);
  const [sessionId, setSessionId] = useState("");
  const [evaluations, setEvaluations] = useState<ClassEvaluation[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/teaching/rubrics?category=${category}`);
      const json = await res.json().catch(() => null);
      const rubrics = (json?.rubrics ?? []) as RubricView[];
      setRubric(rubrics[0] ?? null);
    })();
  }, [category]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/teaching/classes/${classId}/sessions`);
      const json = await res.json().catch(() => null);
      const all = (json?.sessions ?? []) as ClassSession[];
      setSessions(all.filter((s) => sessionTypeFilter.includes(s.sessionType)));
    })();
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!studentId) { setEvaluations([]); return; }
    (async () => {
      const res = await fetch(`/api/teaching/classes/${classId}/evaluations?studentId=${studentId}`);
      const json = await res.json().catch(() => null);
      setEvaluations((json?.evaluations ?? []) as ClassEvaluation[]);
    })();
  }, [classId, studentId]);

  const currentEvaluation = useMemo(() => evaluations.find((e) => e.classSessionId === sessionId), [evaluations, sessionId]);

  useEffect(() => {
    setScores(currentEvaluation?.criterionScores ?? {});
    setNotes(currentEvaluation?.notes ?? "");
    setAssetIds(currentEvaluation?.assetIds ?? []);
  }, [currentEvaluation]);

  const totalScore = useMemo(() => (rubric?.criteria ?? []).reduce((sum, c) => sum + (scores[c.id] ?? 0), 0), [rubric, scores]);
  const maxScore = useMemo(() => (rubric?.criteria ?? []).reduce((sum, c) => sum + c.maxScore, 0), [rubric]);

  async function onPickEvidence(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const room = MAX_EVIDENCE - assetIds.length;
    if (room <= 0) { setMessage(`Tối đa ${MAX_EVIDENCE} minh chứng.`); return; }
    setUploading(true);
    try {
      for (const file of files.slice(0, room)) {
        const asset = await uploadAsset(file, { category: "student-competency", assetType: file.type.startsWith("video/") ? "video" : "image", compress: file.type.startsWith("image/") });
        setAssetIds((v) => [...v, asset.assetId]);
      }
    } catch {
      setMessage("Tải minh chứng thất bại — thử lại.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!studentId || !sessionId || !rubric) return;
    setSaving(true); setMessage(null);
    const res = await fetch(`/api/teaching/classes/${classId}/evaluations`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ classSessionId: sessionId, studentId, rubricId: rubric.id, criterionScores: scores, notes, assetIds })
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) { setMessage(json?.error ?? "Không lưu được điểm."); return; }
    setMessage("Đã lưu điểm.");
    const refreshed = await fetch(`/api/teaching/classes/${classId}/evaluations?studentId=${studentId}`);
    const refreshedJson = await refreshed.json().catch(() => null);
    setEvaluations((refreshedJson?.evaluations ?? []) as ClassEvaluation[]);
  }

  if (rubric === undefined) return <p>Đang tải rubric…</p>;
  if (rubric === null) return <div className={styles.empty}><strong>Chưa có rubric</strong><p>{emptyRubricHint}</p></div>;

  return <div style={{ display: "grid", gap: 14 }}>
    <div className={styles.card}>
      <div className={styles.cardHead}><div><h2>Phiếu chấm điểm</h2><p>{rubric.title} · tối đa {maxScore} điểm</p></div></div>
      <div className={styles.cardBody}>
        <div className={formStyles.pickerRow}>
          <label>Học viên
            <select value={studentId} onChange={(e) => { setStudentId(e.target.value); }}>
              <option value="">— Chọn học viên —</option>
              {roster.map((r) => <option key={r.studentId} value={r.studentId}>{r.name}</option>)}
            </select>
          </label>
          <label>Buổi học
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              <option value="">— Chọn buổi —</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>Buổi {s.sessionNo} · {SESSION_TYPE_LABEL[s.sessionType]}{s.title ? ` — ${s.title}` : ""}</option>)}
            </select>
          </label>
        </div>

        {studentId && sessionId && rubric.criteria.length > 0 && <>
          <div className={formStyles.criteriaList}>
            {rubric.criteria.map((c) => <div key={c.id} className={formStyles.criterionRow}>
              <div>
                <strong>{c.title}{c.required && <em className={formStyles.requiredTag}>bắt buộc</em>}</strong>
                {c.description && <small>{c.description}</small>}
              </div>
              <input type="number" min={0} max={c.maxScore} step={0.5} value={scores[c.id] ?? 0}
                onChange={(e) => setScores((prev) => ({ ...prev, [c.id]: Math.min(c.maxScore, Math.max(0, Number(e.target.value))) }))} />
              <span className={formStyles.maxScore}>/ {c.maxScore}</span>
            </div>)}
          </div>

          <div className={formStyles.totalRow}><strong>Tổng điểm: {totalScore.toFixed(1)} / {maxScore}</strong>{totalScore / maxScore >= 0.9 && <span className={styles.badge} data-tone="success">Đạt ≥90</span>}</div>

          <label className={formStyles.notesLabel}>Ghi chú
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Lỗi lặp lại, điểm cần lưu ý…" />
          </label>

          <div className={formStyles.evidenceRow}>
            {assetIds.map((id) => <EvidenceLink key={id} assetId={id} onRemove={() => setAssetIds((v) => v.filter((x) => x !== id))} />)}
            {assetIds.length < MAX_EVIDENCE && <label className={formStyles.evidenceAdd}>{uploading ? "Đang tải…" : "+ Ảnh/video minh chứng"}
              <input type="file" accept="image/*,video/mp4" multiple disabled={uploading} onChange={onPickEvidence} style={{ display: "none" }} />
            </label>}
          </div>

          {message && <p className={formStyles.message}>{message}</p>}
          <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={saving} onClick={save}>{saving ? "Đang lưu…" : "Lưu điểm"}</button>
        </>}
      </div>
    </div>

    {studentId && evaluations.length > 0 && <div className={styles.card}>
      <div className={styles.cardHead}><div><h2>Lịch sử chấm điểm</h2><p>{evaluations.length} lần đánh giá</p></div></div>
      <div className={styles.cardBody}>
        <div className={styles.list}>
          {evaluations.map((e) => {
            const session = sessions.find((s) => s.id === e.classSessionId);
            const pct = e.maxScore > 0 ? Math.round((e.totalScore / e.maxScore) * 100) : 0;
            return <div key={e.id} className={styles.listItem}>
              <div><strong>{session ? `Buổi ${session.sessionNo}` : "Buổi học"}</strong><small>{new Date(e.updatedAt).toLocaleDateString("vi-VN")}</small></div>
              <div className={styles.listItemMeta}><b>{e.totalScore}/{e.maxScore}</b><span className={styles.badge} data-tone={pct >= 90 ? "success" : pct >= 70 ? undefined : "warning"}>{pct}%</span></div>
            </div>;
          })}
        </div>
      </div>
    </div>}
  </div>;
}

function EvidenceLink({ assetId, onRemove }: { assetId: string; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; void resolveAssetUrl(assetId).then((u) => { if (!cancelled) setUrl(u); }); return () => { cancelled = true; }; }, [assetId]);
  return <span className={formStyles.evidenceChip}>
    {url ? <a href={url} target="_blank" rel="noreferrer">📎 Xem</a> : <span>📎 …</span>}
    <button type="button" onClick={onRemove} aria-label="Bỏ minh chứng này">✕</button>
  </span>;
}
