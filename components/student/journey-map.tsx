"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronRight, Compass, Lock, PlayCircle } from "lucide-react";
import type { StudentCourseSummary } from "@/lib/academy/student-course";

type MissionDisplayState = "locked" | "available" | "not_started" | "learning" | "planning" | "doing" | "evidence_pending" | "review_pending" | "verified" | "result_achieved" | "blocked";
type Mission = {
  id: string; title: string; description: string; expectedResult: string; completionPolicy: string;
  successCriteria: string[]; displayState: MissionDisplayState; lockedReason: string | null; estimatedDays: number | null;
  resourceBindings: { id: string; title: string; role: string }[];
  toolBindings: { id: string; toolType: string; toolId: string; role: string }[];
  actionTemplates: { id: string; title: string; required: boolean; evidenceRequired: boolean }[];
  actions: { id: string; title: string; required: boolean; evidenceRequired: boolean; status: string }[];
};
type Milestone = { id: string; title: string; description: string; missions: Mission[] };
type Outcome = { id: string; title: string; description: string; milestones: Milestone[] };
type Journey = { outcomes: Outcome[]; versionId: string | null; blueprintTitle: string | null; progressPercent: number };
type JourneyResponse = { mode: "demo" | "unconfigured" | "production"; stage: { id: string; title: string; indexLabel: string } | null; journey: Journey | null };

const STATE_LABEL: Record<MissionDisplayState, string> = {
  locked: "Đang khóa", available: "Sẵn sàng bắt đầu", not_started: "Sẵn sàng bắt đầu", learning: "Đang học",
  planning: "Đang lên kế hoạch", doing: "Đang thực hiện", evidence_pending: "Chờ nộp bằng chứng",
  review_pending: "Chờ giáo viên duyệt", verified: "Đã xác nhận", result_achieved: "Hoàn thành", blocked: "Cần xem lại"
};
const STATE_COLOR: Record<MissionDisplayState, string> = {
  locked: "#94a3b8", available: "#2563eb", not_started: "#2563eb", learning: "#2563eb", planning: "#2563eb",
  doing: "#d97706", evidence_pending: "#d97706", review_pending: "#7c3aed", verified: "#16a34a",
  result_achieved: "#16a34a", blocked: "#dc2626"
};

export function StudentJourneyMap({ supplementaryCourses }: { supplementaryCourses: StudentCourseSummary[] }) {
  const router = useRouter();
  const [data, setData] = useState<JourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"map" | "roadmap" | "list">("list");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch("/api/student/journey", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      setData(json);
      setLoading(false);
    })();
  }, []);

  const missions = useMemo(() => data?.journey?.outcomes.flatMap((o) => o.milestones.flatMap((m) => m.missions)) ?? [], [data]);
  const currentMission = missions.find((m) => !["locked", "verified", "result_achieved"].includes(m.displayState)) ?? null;
  const nextMission = missions.find((m) => m.displayState === "locked") ?? null;

  if (loading) return <div className="h2o-student-page-head"><div><h1>Hành trình của tôi</h1><p>Đang tải...</p></div></div>;

  const noJourney = !data?.journey || !data.journey.outcomes.length;

  return <>
    <section className="h2o-student-page-head">
      <div>
        <span>MY LEARNING</span>
        <h1>{data?.stage ? `Hành trình — ${data.stage.title}` : "Hành trình của tôi"}</h1>
        {data?.journey && <p>{data.journey.progressPercent}% hoàn thành · {currentMission ? `Đang làm: ${currentMission.title}` : "Chưa bắt đầu mission nào"}{nextMission ? ` · Tiếp theo: ${nextMission.title}` : ""}</p>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {data?.journey && <div style={{ display: "flex", gap: 6 }}>
          {(["list", "roadmap", "map"] as const).map((v) => <button key={v} onClick={() => setView(v)} style={{ padding: "6px 12px", borderRadius: 8, border: v === view ? "1px solid #2563eb" : "1px solid #dfe3e8", background: v === view ? "#eff6ff" : "#fff", fontSize: 12, cursor: "pointer" }}>{v === "list" ? "Danh sách" : v === "roadmap" ? "Roadmap" : "Map"}</button>)}
        </div>}
        {currentMission && <button onClick={() => router.push(`/student/missions/${currentMission.id}`)} className="h2o-student-primary" style={{ padding: "8px 14px", fontSize: 12 }}>Mở Mission Workspace</button>}
      </div>
    </section>

    {data?.journey && <div style={{ margin: "0 0 20px", background: "#eef1f4", borderRadius: 999, height: 8, overflow: "hidden" }}><div style={{ width: `${data.journey.progressPercent}%`, height: "100%", background: "#2563eb" }} /></div>}

    {noJourney
      ? <section className="h2o-student-card" style={{ padding: 24, textAlign: "center", marginBottom: 24 }}>
          <Compass size={22} style={{ opacity: 0.5 }} />
          <p style={{ marginTop: 8, fontSize: 13 }}>Giai đoạn này đang được xây dựng hành trình.</p>
        </section>
      : <section style={{ marginBottom: 24, display: view === "list" ? "grid" : "flex", gap: 12, flexWrap: view === "list" ? undefined : "wrap", gridTemplateColumns: view === "list" ? "1fr" : undefined }}>
          {data!.journey!.outcomes.map((outcome) => <div key={outcome.id} className={view === "list" ? "h2o-student-card" : undefined} style={view === "list" ? { padding: 16 } : { width: "100%" }}>
            {view === "list" && <><strong style={{ fontSize: 14 }}>{outcome.title}</strong>{outcome.description && <p style={{ fontSize: 12, color: "#6b7a89", margin: "2px 0 10px" }}>{outcome.description}</p>}</>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {outcome.milestones.flatMap((m) => m.missions).map((mission) => <button key={mission.id} onClick={() => router.push(`/student/missions/${mission.id}`)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e9ee", background: "#fff", cursor: "pointer", opacity: mission.displayState === "locked" ? 0.6 : 1, minWidth: view === "list" ? "100%" : 220, textAlign: "left" }}>
                {mission.displayState === "locked" ? <Lock size={14} color="#94a3b8" /> : mission.displayState === "result_achieved" || mission.displayState === "verified" ? <CheckCircle2 size={14} color="#16a34a" /> : <PlayCircle size={14} color={STATE_COLOR[mission.displayState]} />}
                <span style={{ flex: 1 }}>
                  <strong style={{ fontSize: 12, display: "block" }}>{mission.title}</strong>
                  <small style={{ fontSize: 10, color: STATE_COLOR[mission.displayState] }}>{mission.displayState === "locked" && mission.lockedReason ? mission.lockedReason : STATE_LABEL[mission.displayState]}</small>
                </span>
                <ChevronRight size={14} color="#94a3b8" />
              </button>)}
            </div>
          </div>)}
        </section>}

    {supplementaryCourses.length > 0 && <section className="h2o-student-section">
      <header><div><span>KHÓA HỌC BỔ TRỢ</span><h2>Khóa học video liên quan</h2></div></header>
      <div className="h2o-student-course-grid">{supplementaryCourses.slice(0, 3).map((course) => <article key={course.slug}><div style={{ background: course.accent }}><span>{course.category}</span></div><h3>{course.title}</h3><p>{course.subtitle}</p><Link href={course.access ? `/student/courses/${course.slug}` : `/academy/courses/${course.slug}`}>Xem <ArrowRight size={13} /></Link></article>)}</div>
    </section>}
  </>;
}
