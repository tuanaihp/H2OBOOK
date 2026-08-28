"use client";
import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { instructorRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";
import formStyles from "@/components/student-competency/student-competency.module.css";
import { OverviewTab } from "@/components/student-competency/overview-tab";
import { RosterTab } from "@/components/student-competency/roster-tab";
import { TrainingGradingTab } from "@/components/student-competency/training-grading-tab";
import { MakeupGradingTab } from "@/components/student-competency/makeup-grading-tab";
import { HairGradingTab } from "@/components/student-competency/hair-grading-tab";
import { GraduationTab } from "@/components/student-competency/graduation-tab";
import { CompetencyTab } from "@/components/student-competency/competency-tab";

type TeachingClassSummary = { id: string; name: string; code: string; status: string; studentCount: number };
interface RosterMember { studentId: string; name: string; avatarUrl: string | null; joinedAt: string | null; status: string }

// Spec: "1 tab lớn... trong tab này gồm đủ 7 bảng quản lý" — this route IS that one tab (reached
// by clicking a class on /instructor/classes), and the 7 sub-tabs below cover Tổng quan / Học
// viên / Training / Thực hành Makeup / Hair / Điều kiện tốt nghiệp / Hồ sơ năng lực from spec §3,
// switched by local state rather than by adding 7 more top-level nav routes.
const SUB_TABS = [
  { key: "overview", label: "Tổng quan" },
  { key: "roster", label: "Học viên" },
  { key: "training", label: "Training" },
  { key: "makeup", label: "Thực hành Makeup" },
  { key: "hair", label: "Hair" },
  { key: "graduation", label: "Điều kiện tốt nghiệp" },
  { key: "competency", label: "Hồ sơ năng lực" }
] as const;
type SubTabKey = typeof SUB_TABS[number]["key"];

export default function ClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = usePromise(params);
  const [klass, setKlass] = useState<TeachingClassSummary | null>(null);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [activeTab, setActiveTab] = useState<SubTabKey>("overview");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/teaching/classes");
      const json = await res.json().catch(() => null);
      const found = ((json?.classes ?? []) as TeachingClassSummary[]).find((c) => c.id === classId);
      setKlass(found ?? null);
    })();
    (async () => {
      setRosterLoading(true);
      const res = await fetch(`/api/teaching/classes/${classId}/roster`);
      const json = await res.json().catch(() => null);
      setRoster((json?.roster ?? []) as RosterMember[]);
      setRosterLoading(false);
    })();
  }, [classId]);

  const rosterOptions = roster.map((r) => ({ studentId: r.studentId, name: r.name }));

  return <SimpleOperationsShell title="H2OBOOK Instructor" subtitle={klass?.name ?? "Lớp học"} homeHref="/instructor/classes" routes={instructorRoutes} accentLabel="Instructor Workspace">
    <Link href="/instructor/classes" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, marginBottom: 14, color: "#6f829c", textDecoration: "none" }}><ArrowLeft size={14} />Quay lại danh sách lớp</Link>

    <header className={styles.header}>
      <div><span className={styles.eyebrow}>QUẢN LÝ HỌC VIÊN & NĂNG LỰC</span><h1>{klass?.name ?? "…"}</h1><p>{klass ? `${klass.code} · ${klass.studentCount} học viên · trạng thái ${klass.status}` : "Đang tải…"}</p></div>
    </header>

    <div className={formStyles.subTabs}>
      {SUB_TABS.map((tab) => <button key={tab.key} type="button" className={formStyles.subTab} data-active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}
    </div>

    {activeTab === "overview" && <OverviewTab classId={classId} />}
    {activeTab === "roster" && <RosterTab roster={roster} loading={rosterLoading} selectedStudentId={selectedStudentId} onSelect={(id) => { setSelectedStudentId(id); setActiveTab("training"); }} />}
    {activeTab === "training" && <TrainingGradingTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}
    {activeTab === "makeup" && <MakeupGradingTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}
    {activeTab === "hair" && <HairGradingTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}
    {activeTab === "graduation" && <GraduationTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}
    {activeTab === "competency" && <CompetencyTab classId={classId} roster={rosterOptions} initialStudentId={selectedStudentId} />}
  </SimpleOperationsShell>;
}
