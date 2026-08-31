"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SKILL_CATALOG } from "@/lib/student-competency/types";
import styles from "./student-management-workspace.module.css";

type Category = "training" | "makeup" | "hair";
type Criterion = { title: string; description: string; maxScore: number; required: boolean; skillKey: string | null };
type Rubric = { id: string; title: string; category: Category | null; quickIssues: string[]; updatedAt: string; criteria: Array<Criterion & { id: string }> };

export function SettingsTab() {
  const [category, setCategory] = useState<Category>("training");
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [quickIssuesText, setQuickIssuesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const total = useMemo(() => criteria.reduce((sum, criterion) => sum + Number(criterion.maxScore || 0), 0), [criteria]);

  const load = useCallback(async () => {
    const response = await fetch(`/api/teaching/rubrics?category=${category}`); const json = await response.json().catch(() => null);
    const next = (json?.rubrics ?? []) as Rubric[]; setRubrics(next);
    const latest = next[0];
    const baseTitle = latest?.title.replace(/\s*·\s*phiên bản\s+\d+$/i, "") ?? `Rubric ${category}`;
    setTitle(`${baseTitle} · phiên bản ${next.length + 1}`);
    setQuickIssuesText((latest?.quickIssues ?? []).join("\n"));
    setCriteria(latest?.criteria.map((criterion) => ({ title: criterion.title, description: criterion.description, maxScore: criterion.maxScore, required: criterion.required, skillKey: criterion.skillKey ?? null })) ?? []);
  }, [category]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true); setMessage(null);
    const quickIssues = quickIssuesText.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
    const response = await fetch("/api/teaching/rubrics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ category, title, criteria, quickIssues }) });
    const json = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setMessage(json?.error === "ADMIN_REQUIRED" ? "Chỉ Owner/Admin được tạo phiên bản rubric." : json?.error === "RUBRIC_TOTAL_MUST_EQUAL_100" ? "Tổng điểm rubric phải bằng 100." : (json?.error ?? "Không thể tạo rubric.")); return; }
    setMessage("Đã tạo phiên bản rubric mới; dữ liệu chấm cũ vẫn được giữ nguyên."); await load();
  };

  return <section className={styles.section}><div className={styles.sectionHead}><div><h2>Cài đặt tiêu chí</h2><p>Chính sách tốt nghiệp dùng chung và rubric được quản lý theo phiên bản để bảo toàn lịch sử điểm.</p></div><span className={styles.scoreTotal} data-valid={total === 100}>Tổng {total}/100</span></div>
    <div className={styles.courseGrid}><article className={styles.courseCard}><span>Ngưỡng đạt bài</span><strong>90</strong><small>điểm trên thang 100</small></article><article className={styles.courseCard}><span>Tỷ lệ bài đạt để tốt nghiệp</span><strong>50%</strong><small>tối thiểu số lần đánh giá</small></article><article className={styles.courseCard}><span>Buổi bổ sung mặc định</span><strong>10</strong><small>có thể chọn 5–15 theo học viên</small></article></div>
    <div className={styles.sectionHead} style={{ marginTop: 18 }}><div><h2>Cấu hình rubric theo phiên bản</h2><p>Không sửa rubric cũ. Mỗi lần lưu sẽ tạo một phiên bản mới.</p></div></div>
    <article className={styles.card}><div className={styles.cardBody}><div className={styles.settingsToolbar}><label>Nhóm rubric<select value={category} onChange={(event) => setCategory(event.target.value as Category)}><option value="training">Training</option><option value="makeup">Makeup</option><option value="hair">Hair</option></select></label><label>Tên phiên bản<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><span>{rubrics.length} phiên bản hiện có</span></div>
      <label className={styles.quickIssueEditor}>Danh sách lỗi tick nhanh <small>Mỗi dòng hoặc dấu phẩy là một lỗi; danh sách được lưu riêng cho phiên bản rubric mới.</small><textarea rows={3} value={quickIssuesText} onChange={(event) => setQuickIssuesText(event.target.value)} placeholder="Ví dụ: Mắt chưa cân&#10;Khối đậm&#10;Quá thời gian" /></label>
      <div className={styles.criteriaEditor}>{criteria.map((criterion, index) => <div key={`${index}-${criterion.title}`} className={styles.criterionEditorRow}><input aria-label="Tên tiêu chí" value={criterion.title} onChange={(event) => setCriteria((current) => current.map((item, position) => position === index ? { ...item, title: event.target.value } : item))} /><input aria-label="Mô tả hoặc nhóm" value={criterion.description} onChange={(event) => setCriteria((current) => current.map((item, position) => position === index ? { ...item, description: event.target.value } : item))} placeholder="Mô tả / nhóm" /><input aria-label="Điểm tối đa" type="number" min={1} max={100} value={criterion.maxScore} onChange={(event) => setCriteria((current) => current.map((item, position) => position === index ? { ...item, maxScore: Number(event.target.value) } : item))} /><select aria-label="Kỹ năng" value={criterion.skillKey ?? ""} onChange={(event) => setCriteria((current) => current.map((item, position) => position === index ? { ...item, skillKey: event.target.value || null } : item))}><option value="">Không ánh xạ kỹ năng</option>{SKILL_CATALOG.map((skill) => <option key={skill.key} value={skill.key}>{skill.label}</option>)}</select><label className={styles.requiredCheck}><input type="checkbox" checked={criterion.required} onChange={(event) => setCriteria((current) => current.map((item, position) => position === index ? { ...item, required: event.target.checked } : item))} />Bắt buộc</label><button aria-label="Xóa tiêu chí" onClick={() => setCriteria((current) => current.filter((_, position) => position !== index))}><Trash2 size={15} /></button></div>)}</div>
      <div className={styles.settingsActions}><button onClick={() => setCriteria((current) => [...current, { title: "Tiêu chí mới", description: "", maxScore: Math.max(1, 100 - total), required: true, skillKey: category === "hair" ? "hair_skills" : null }])}><Plus size={14} />Thêm tiêu chí</button><button className={styles.primaryButton} disabled={saving || total !== 100 || !criteria.length} onClick={() => void save()}>{saving ? "Đang lưu…" : "Tạo phiên bản mới"}</button></div>{message && <p className={styles.message}>{message}</p>}
    </div></article>
  </section>;
}
