"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, ClipboardCheck, GraduationCap, LayoutDashboard, Scissors, Settings2, Sparkles, Users } from "lucide-react";
import { OverviewTab } from "./overview-tab";
import { RosterTab } from "./roster-tab";
import { TrainingGradingTab } from "./training-grading-tab";
import { MakeupGradingTab } from "./makeup-grading-tab";
import { HairGradingTab } from "./hair-grading-tab";
import { GraduationTab } from "./graduation-tab";
import { CompetencyTab } from "./competency-tab";
import { CoursePlanTab } from "./course-plan-tab";
import { SettingsTab } from "./settings-tab";
import styles from "./student-management-workspace.module.css";

type TabKey = "overview" | "students" | "course" | "training" | "makeup" | "hair" | "graduation" | "competency" | "settings";
type RosterMember = { studentId: string; name: string; avatarUrl: string | null; joinedAt: string | null; status: string };
type TeachingClass = { id: string; name: string; code: string; status: string; studentCount: number };
type StudentCandidate = { studentId: string; name: string; email: string; enrolled: boolean; entitlementCount: number };

const TABS: { key: TabKey; label: string; description: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Tổng quan", description: "Theo dõi tiến độ, điểm số và điều kiện tốt nghiệp theo thời gian thực.", icon: LayoutDashboard },
  { key: "students", label: "Học viên", description: "Ghi danh tài khoản Academy và quản lý hồ sơ từng học viên.", icon: Users },
  { key: "course", label: "Khung khóa 60 buổi", description: "Lập lịch, chủ đề và trạng thái từng buổi của khóa Makeup Chuyên nghiệp.", icon: BookOpenCheck },
  { key: "training", label: "Đánh giá Training", description: "Dùng chung cho Training Makeup & Tóc và Training Tóc.", icon: ClipboardCheck },
  { key: "makeup", label: "Đánh giá Makeup", description: "Rubric 100 điểm, minh chứng và lịch sử theo từng buổi.", icon: Sparkles },
  { key: "hair", label: "Đánh giá Hair", description: "Module Hair độc lập với rubric cấu hình từ database.", icon: Scissors },
  { key: "graduation", label: "Điều kiện tốt nghiệp", description: "Tự động tổng hợp điều kiện đạt, thiếu và kế hoạch bổ sung.", icon: GraduationCap },
  { key: "competency", label: "Hồ sơ năng lực", description: "Năng lực kỹ thuật, tốc độ, kỷ luật và xu hướng tiến bộ.", icon: Sparkles },
  { key: "settings", label: "Cài đặt tiêu chí", description: "Tạo phiên bản rubric Training, Makeup và Hair.", icon: Settings2 }
];

export function StudentManagementWorkspace({ classId: requestedClassId }: { classId?: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [classes, setClasses] = useState<TeachingClass[]>([]);
  const [klass, setKlass] = useState<TeachingClass | null>(null);
  const [classId, setClassId] = useState<string | null>(requestedClassId ?? null);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [candidates, setCandidates] = useState<StudentCandidate[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const loadClasses = useCallback(async (preferredClassId?: string) => {
    setLoadingClasses(true); setLoadError(null);
    try {
      const response = await fetch("/api/teaching/classes");
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error ?? "Không tải được danh sách lớp.");
      const nextClasses = (json?.classes ?? []) as TeachingClass[];
      const selected = nextClasses.find((item) => item.id === (preferredClassId ?? requestedClassId)) ?? nextClasses[0] ?? null;
      setClasses(nextClasses); setKlass(selected); setClassId(selected?.id ?? null);
    } catch (error) {
      setClasses([]); setKlass(null); setClassId(null); setLoadError(error instanceof Error ? error.message : "Không tải được danh sách lớp.");
    } finally { setLoadingClasses(false); }
  }, [requestedClassId]);
  useEffect(() => { void loadClasses(); }, [loadClasses]);

  const loadRoster = useCallback(async () => {
    if (!classId) { setRoster([]); setCandidates([]); setLoadingRoster(false); return; }
    setLoadingRoster(true); setLoadError(null);
    try {
      const response = await fetch(`/api/teaching/classes/${classId}/roster`);
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error ?? "Không tải được danh sách học viên.");
      setRoster((json?.roster ?? []) as RosterMember[]); setCandidates((json?.candidates ?? []) as StudentCandidate[]);
    } catch (error) {
      setRoster([]); setCandidates([]); setLoadError(error instanceof Error ? error.message : "Không tải được danh sách học viên.");
    } finally { setLoadingRoster(false); }
  }, [classId]);
  useEffect(() => { void loadRoster(); }, [loadRoster]);

  const active = useMemo(() => TABS.find((tab) => tab.key === activeTab) ?? TABS[0], [activeTab]);
  const rosterOptions = roster.map(({ studentId, name }) => ({ studentId, name }));
  const jumpToGrading = (studentId: string) => { setSelectedStudentId(studentId); setActiveTab("training"); };

  return <div className={styles.workspace}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><span>H2OBOOK MODULE</span><strong>THỦY H2O MAKEUP</strong><small>Student Management &amp; Competency</small></div>
      <p className={styles.navTitle}>Quản lý</p><nav className={styles.nav}>{TABS.slice(0, 8).map((tab) => <TabButton key={tab.key} tab={tab} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} />)}</nav>
      <p className={styles.navTitle}>Hệ thống</p><nav className={styles.nav}><TabButton tab={TABS[8]} active={activeTab === "settings"} onClick={() => setActiveTab("settings")} /></nav>
      <div className={styles.sidebarFooter}><b>{klass?.name ?? "Khóa Makeup Chuyên nghiệp"}</b><span>{klass?.code ?? "Chưa có lớp"} · 3 tháng · 60 buổi</span><span>Theo dõi năng lực sau từng buổi</span></div>
    </aside>
    <main className={styles.main}>
      <header className={styles.topbar}><div><Link className={styles.back} href="/instructor/classes"><ArrowLeft size={14} />Danh sách lớp</Link><h1>{active.label}</h1><p>{active.description}</p></div><div className={styles.context}>
        {classes.length > 1 ? <select aria-label="Chọn lớp" value={classId ?? ""} onChange={(event) => { const selected = classes.find((item) => item.id === event.target.value) ?? null; setKlass(selected); setClassId(selected?.id ?? null); setSelectedStudentId(""); }}><option value="">Chọn lớp</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select> : <span>{klass?.code ?? "Lớp học"}</span>}<b>{roster.length} học viên</b>
      </div></header>
      {loadError && <div className={styles.errorBanner}>{loadError}<button type="button" onClick={() => void loadClasses(classId ?? undefined)}>Thử lại</button></div>}
      {loadingClasses ? <section className={styles.emptyModule}><p>Đang tải Student Management &amp; Competency…</p></section> : !classId ? <EmptyModuleState onCreated={(createdId) => void loadClasses(createdId)} /> : <>
        {activeTab === "overview" && <OverviewTab classId={classId} />}
        {activeTab === "students" && <RosterTab classId={classId} roster={roster} candidates={candidates} loading={loadingRoster} selectedStudentId={selectedStudentId} onSelect={jumpToGrading} onRosterChanged={loadRoster} />}
        {activeTab === "course" && <CoursePlanTab classId={classId} />}
        {activeTab === "training" && <TrainingGradingTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}
        {activeTab === "makeup" && <MakeupGradingTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}
        {activeTab === "hair" && <HairGradingTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}
        {activeTab === "graduation" && <GraduationTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}
        {activeTab === "competency" && <CompetencyTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}
        {activeTab === "settings" && <SettingsTab />}
      </>}
    </main>
  </div>;
}

function TabButton({ tab, active, onClick }: { tab: typeof TABS[number]; active: boolean; onClick: () => void }) {
  const Icon = tab.icon;
  return <button type="button" className={styles.navButton} data-active={active} onClick={onClick}><Icon size={16} /><span>{tab.label}</span></button>;
}

function EmptyModuleState({ onCreated }: { onCreated: (classId: string) => void }) {
  const [name, setName] = useState("Khóa Makeup Chuyên nghiệp"); const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState<string | null>(null);
  const create = async () => {
    if (!name.trim() || !code.trim()) { setMessage("Nhập tên lớp và mã lớp."); return; }
    setSaving(true); setMessage(null);
    const response = await fetch("/api/teaching/classes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, code, totalSessions: 60 }) });
    const json = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setMessage(json?.error === "CLASS_CODE_ALREADY_EXISTS" ? "Mã lớp đã tồn tại." : (json?.error ?? "Không thể tạo lớp.")); return; }
    onCreated(String(json.class.id));
  };
  return <section className={styles.emptyModule}><Users size={34} /><h2>Chưa có lớp học để quản lý</h2><p>Tạo lớp thật trên Supabase. Lớp mới được phân công cho tài khoản hiện tại và có thể ghi danh các tài khoản học viên Academy.</p><div className={styles.createClassForm}><label>Tên lớp<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Mã lớp<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ví dụ: C26-08" /></label><button type="button" className={styles.primaryButton} disabled={saving} onClick={() => void create()}>{saving ? "Đang tạo…" : "Tạo lớp 60 buổi"}</button></div>{message && <p className={styles.message}>{message}</p>}</section>;
}
