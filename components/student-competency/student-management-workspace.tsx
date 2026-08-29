"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, ClipboardCheck, GraduationCap, LayoutDashboard, Scissors, Settings2, Sparkles, Users } from "lucide-react";
import { OverviewTab } from "./overview-tab";
import { RosterTab } from "./roster-tab";
import { TrainingGradingTab } from "./training-grading-tab";
import { MakeupGradingTab } from "./makeup-grading-tab";
import { HairGradingTab } from "./hair-grading-tab";
import { GraduationTab } from "./graduation-tab";
import { CompetencyTab } from "./competency-tab";
import { CURRICULUM_DEFAULTS, SESSION_TYPE_LABEL, type SessionType } from "@/lib/student-competency/types";
import styles from "./student-management-workspace.module.css";

type TabKey = "overview" | "students" | "course" | "training" | "makeup" | "hair" | "graduation" | "competency" | "settings";
type RosterMember = { studentId: string; name: string; avatarUrl: string | null; joinedAt: string | null; status: string };
type TeachingClass = { id: string; name: string; code: string; status: string; studentCount: number };
type ClassSession = { id: string; sessionType: SessionType; status: "scheduled" | "completed" | "cancelled" };

const TABS: { key: TabKey; label: string; description: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Tổng quan", description: "Theo dõi tiến độ, điểm số và điều kiện tốt nghiệp theo thời gian thực.", icon: LayoutDashboard },
  { key: "students", label: "Học viên", description: "Quản lý hồ sơ, tiến độ và lịch sử đánh giá của từng học viên.", icon: Users },
  { key: "course", label: "Khung khóa 60 buổi", description: "Cấu trúc đào tạo chính thức của khóa Makeup Chuyên nghiệp 3 tháng.", icon: BookOpenCheck },
  { key: "training", label: "Đánh giá Training", description: "Dùng chung cho Training Makeup & Tóc.", icon: ClipboardCheck },
  { key: "makeup", label: "Đánh giá Makeup", description: "Rubric 100 điểm, lưu lịch sử lỗi và tiến bộ theo từng buổi.", icon: Sparkles },
  { key: "hair", label: "Đánh giá Hair", description: "Module Hair độc lập, sẵn sàng nạp rubric 100 điểm.", icon: Scissors },
  { key: "graduation", label: "Điều kiện tốt nghiệp", description: "Tổng hợp tự động điều kiện đạt, thiếu và kế hoạch bổ sung.", icon: GraduationCap },
  { key: "competency", label: "Hồ sơ năng lực", description: "Biểu diễn năng lực theo kỹ thuật, tốc độ, kỷ luật và xu hướng tiến bộ.", icon: Sparkles },
  { key: "settings", label: "Cài đặt tiêu chí", description: "Cấu hình rubric và chính sách tốt nghiệp theo phiên bản.", icon: Settings2 }
];

export function StudentManagementWorkspace({ classId }: { classId: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [klass, setKlass] = useState<TeachingClass | null>(null);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  useEffect(() => { void (async () => {
    const [classesResponse, rosterResponse] = await Promise.all([fetch("/api/teaching/classes"), fetch(`/api/teaching/classes/${classId}/roster`)]);
    const classesJson = await classesResponse.json().catch(() => null); const rosterJson = await rosterResponse.json().catch(() => null);
    setKlass(((classesJson?.classes ?? []) as TeachingClass[]).find((item) => item.id === classId) ?? null); setRoster((rosterJson?.roster ?? []) as RosterMember[]); setLoadingRoster(false);
  })(); }, [classId]);
  const active = useMemo(() => TABS.find((tab) => tab.key === activeTab) ?? TABS[0], [activeTab]);
  const rosterOptions = roster.map(({ studentId, name }) => ({ studentId, name }));
  const jumpToGrading = (studentId: string) => { setSelectedStudentId(studentId); setActiveTab("training"); };
  return <div className={styles.workspace}><aside className={styles.sidebar}>
    <div className={styles.brand}><span>H2OBOOK MODULE</span><strong>THỦY H2O MAKEUP</strong><small>Student Management &amp; Competency</small></div>
    <p className={styles.navTitle}>Quản lý</p><nav className={styles.nav}>{TABS.slice(0, 8).map((tab) => <TabButton key={tab.key} tab={tab} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} />)}</nav>
    <p className={styles.navTitle}>Hệ thống</p><nav className={styles.nav}><TabButton tab={TABS[8]} active={activeTab === "settings"} onClick={() => setActiveTab("settings")} /></nav>
    <div className={styles.sidebarFooter}><b>{klass?.name ?? "Khóa Makeup Chuyên nghiệp"}</b><span>{klass?.code ?? "Đang tải lớp"} · 3 tháng · 60 buổi</span><span>Theo dõi năng lực sau từng buổi</span></div>
  </aside><main className={styles.main}><header className={styles.topbar}><div><Link className={styles.back} href="/instructor/classes"><ArrowLeft size={14} />Danh sách lớp</Link><h1>{active.label}</h1><p>{active.description}</p></div><div className={styles.context}><span>{klass?.code ?? "Lớp học"}</span><b>{roster.length} học viên</b></div></header>
    {activeTab === "overview" && <OverviewTab classId={classId} />}{activeTab === "students" && <RosterTab roster={roster} loading={loadingRoster} selectedStudentId={selectedStudentId} onSelect={jumpToGrading} />}{activeTab === "course" && <CoursePlanTab classId={classId} />}{activeTab === "training" && <TrainingGradingTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}{activeTab === "makeup" && <MakeupGradingTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}{activeTab === "hair" && <HairGradingTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}{activeTab === "graduation" && <GraduationTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}{activeTab === "competency" && <CompetencyTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}{activeTab === "settings" && <SettingsTab />}
  </main></div>;
}
function TabButton({ tab, active, onClick }: { tab: typeof TABS[number]; active: boolean; onClick: () => void }) { const Icon = tab.icon; return <button type="button" className={styles.navButton} data-active={active} onClick={onClick}><Icon size={16} /><span>{tab.label}</span></button>; }
function CoursePlanTab({ classId }: { classId: string }) { const [sessions, setSessions] = useState<ClassSession[] | null>(null); const [seeding, setSeeding] = useState(false); const [message, setMessage] = useState<string | null>(null); const load = async () => { const response = await fetch(`/api/teaching/classes/${classId}/sessions`); const json = await response.json().catch(() => null); if (response.ok) setSessions((json?.sessions ?? []) as ClassSession[]); }; useEffect(() => { void load(); }, [classId]); const counts = new Map<SessionType, { created: number; completed: number }>(); for (const session of sessions ?? []) { const entry = counts.get(session.sessionType) ?? { created: 0, completed: 0 }; entry.created++; if (session.status === "completed") entry.completed++; counts.set(session.sessionType, entry); } const seed = async () => { setSeeding(true); const response = await fetch(`/api/teaching/classes/${classId}/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seedCurriculum: true }) }); const json = await response.json().catch(() => null); setSeeding(false); setMessage(response.ok ? (json.count ? `Đã thêm ${json.count} buổi theo khung chuẩn.` : "Lớp này đã có đủ khung 60 buổi.") : (json?.error ?? "Không thể khởi tạo chương trình.")); await load(); }; return <section className={styles.section}><div className={styles.sectionHead}><div><h2>Khung chương trình 3 tháng · 60 buổi</h2><p>Cấu trúc cố định; nội dung và ngày học từng buổi quản lý theo lớp.</p></div>{sessions?.length === 0 && <button className={styles.primaryButton} disabled={seeding} onClick={() => void seed()}>{seeding ? "Đang khởi tạo…" : "Khởi tạo 60 buổi"}</button>}</div><div className={styles.courseGrid}>{CURRICULUM_DEFAULTS.map((group) => { const value = counts.get(group.type) ?? { created: 0, completed: 0 }; return <article key={group.type} className={styles.courseCard}><span>{SESSION_TYPE_LABEL[group.type]}</span><strong>{group.count}</strong><small>{value.completed}/{group.count} hoàn thành · {value.created}/{group.count} đã tạo</small></article>; })}</div><article className={styles.card}><div className={styles.cardHeader}><h2>Ngoại khóa chuyên môn &amp; nghề nghiệp</h2><span>4 buổi / khóa</span></div><div className={styles.cardBody}><div className={styles.pills}><span>Marketing</span><span>Chụp ảnh</span><span>Chỉnh ảnh</span><span>Kỹ năng mềm</span><span>Makeup Show thực tế</span></div><p className={styles.notice}>Nội dung ngoại khóa có thể luân phiên theo từng khóa, nhưng tổng số buổi chuẩn trong kế hoạch là <b>4 buổi</b>.</p>{message && <p className={styles.message}>{message}</p>}</div></article></section>; }
function SettingsTab() { return <section className={styles.section}><div className={styles.sectionHead}><div><h2>Cài đặt tiêu chí</h2><p>Rubric được version hóa; không sửa đè rubric đã có dữ liệu đánh giá.</p></div></div><article className={styles.card}><div className={styles.cardBody}><div className={styles.settingsGrid}><label>Ngưỡng đạt bài<input value="90" readOnly /></label><label>Tỷ lệ bài ≥90 để tốt nghiệp<input value="50%" readOnly /></label><label>Số buổi bổ sung chuẩn<input value="10" readOnly /></label></div><p className={styles.notice}>Chỉ owner/admin tạo phiên bản rubric mới. Lịch sử chấm điểm luôn giữ rubric và điểm đã áp dụng tại thời điểm lưu.</p></div></article></section>; }
