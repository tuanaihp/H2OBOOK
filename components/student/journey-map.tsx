"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass } from "lucide-react";
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

const DONE_STATES: MissionDisplayState[] = ["verified", "result_achieved"];
const STATE_LABEL: Record<MissionDisplayState, string> = {
  locked: "Khóa", available: "Sẵn sàng", not_started: "Sẵn sàng", learning: "Đang học",
  planning: "Đang lên kế hoạch", doing: "Đang thực hiện", evidence_pending: "Chờ nộp bằng chứng",
  review_pending: "Chờ giáo viên duyệt", verified: "Đã xác nhận", result_achieved: "Hoàn thành", blocked: "Cần xem lại"
};

/** 100 khi đã đạt kết quả, 0 khi còn khóa, còn lại là tỉ lệ hành động đã hoàn thành — tất cả đều là dữ liệu thật, không phải AI ước lượng. */
function missionProgress(mission: Mission): number {
  if (DONE_STATES.includes(mission.displayState)) return 100;
  if (mission.displayState === "locked") return 0;
  if (!mission.actions.length) return 0;
  return Math.round((mission.actions.filter((a) => a.status === "completed").length / mission.actions.length) * 100);
}

function outcomeMissions(outcome: Outcome): Mission[] {
  return outcome.milestones.flatMap((m) => m.missions);
}

function outcomeProgress(outcome: Outcome): number {
  const missions = outcomeMissions(outcome);
  if (!missions.length) return 0;
  return Math.round(missions.reduce((sum, m) => sum + missionProgress(m), 0) / missions.length);
}

function stateClass(mission: Mission): string {
  if (DONE_STATES.includes(mission.displayState)) return "done";
  if (mission.displayState === "locked") return "locked";
  return "current";
}

function stateLabel(mission: Mission): string {
  if (DONE_STATES.includes(mission.displayState)) return `✓ ${STATE_LABEL[mission.displayState]}`;
  if (mission.displayState === "locked") return `🔒 ${STATE_LABEL[mission.displayState]}`;
  return `● ${STATE_LABEL[mission.displayState]}`;
}

export function StudentJourneyMap({ supplementaryCourses }: { supplementaryCourses: StudentCourseSummary[] }) {
  const router = useRouter();
  const [data, setData] = useState<JourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"map" | "roadmap" | "list">("map");
  const [currentReadiness, setCurrentReadiness] = useState<number | null>(null);

  const missions = useMemo(() => data?.journey?.outcomes.flatMap(outcomeMissions) ?? [], [data]);
  const currentMission = useMemo(() => missions.find((m) => !DONE_STATES.includes(m.displayState) && m.displayState !== "locked") ?? null, [missions]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch("/api/student/journey", { cache: "no-store" });
      setData(await res.json().catch(() => null));
      setLoading(false);
    })();
  }, []);

  // Readiness chỉ lấy cho ĐÚNG mission đang làm — một request phụ, không phải mỗi mission một request
  // (docs/30 §14 và test #20: Roadmap không được N+1).
  useEffect(() => {
    if (!currentMission) { setCurrentReadiness(null); return; }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/student/mission-workspace?missionId=${currentMission.id}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!cancelled) setCurrentReadiness(json?.view?.readiness?.score ?? null);
    })();
    return () => { cancelled = true; };
  }, [currentMission]);

  if (loading) return <div className="h2o-student-page-head"><div><h1>Hành trình của tôi</h1><p>Đang tải...</p></div></div>;

  const journey = data?.journey ?? null;
  const noJourney = !journey || !journey.outcomes.length;
  const remaining = missions.filter((m) => !DONE_STATES.includes(m.displayState));
  const remainingDays = remaining.every((m) => m.estimatedDays != null)
    ? remaining.reduce((sum, m) => sum + (m.estimatedDays ?? 0), 0)
    : null;
  const openTasks = missions.flatMap((m) => m.actions).filter((a) => a.status !== "completed" && a.status !== "skipped").length;
  const doneCount = missions.filter((m) => DONE_STATES.includes(m.displayState)).length;

  return <>
    <section className="h2o-student-page-head">
      <div>
        <span>AI JOURNEY ROADMAP</span>
        <h1>{data?.stage ? data.stage.title : "Hành trình của tôi"}</h1>
        <p>Bản đồ dẫn từ kiến thức → hành động → evidence → kết quả.</p>
      </div>
      {journey && <div className="h2o-sr-chips">
        <span className="h2o-sr-chip good">● Journey đang áp dụng</span>
        {data?.stage?.indexLabel && <span className="h2o-sr-chip">Giai đoạn {data.stage.indexLabel}</span>}
        {remainingDays != null && <span className="h2o-sr-chip">Còn ~{remainingDays} ngày</span>}
      </div>}
    </section>

    {noJourney
      ? <section className="h2o-sr-panel" style={{ padding: 28, textAlign: "center", marginBottom: 24 }}>
          <Compass size={22} style={{ opacity: 0.5 }} />
          <p style={{ marginTop: 8, fontSize: 13 }}>Giai đoạn này đang được xây dựng hành trình.</p>
        </section>
      : <>
          <div className="h2o-sr-switch">
            {(["map", "roadmap", "list"] as const).map((v) => <button key={v} className={v === view ? "active" : undefined} onClick={() => setView(v)}>
              {v === "map" ? "Map" : v === "roadmap" ? "Roadmap" : "Danh sách"}
            </button>)}
          </div>

          <div className="h2o-sr-strip">
            {/* Ô này trong thiết kế gốc là "H2O Mentor Insight" do AI viết. AI là Release 4 chưa xây,
                nên giữ đúng vị trí/kiểu dáng nhưng hiển thị dữ liệu thật: mission đang làm. */}
            <div className="h2o-sr-panel h2o-sr-card ai">
              <div className="label">Mission hiện tại</div>
              <strong>{currentMission ? currentMission.title : "Đã hoàn thành giai đoạn"}</strong>
              <p>{currentMission ? (currentMission.expectedResult || "Mở Mission Workspace để bắt đầu.") : "Không còn mission nào đang mở."}</p>
            </div>
            <div className="h2o-sr-panel h2o-sr-card">
              <div className="label">Journey Progress</div>
              <strong>{journey!.progressPercent}%</strong>
              <p>{doneCount}/{missions.length} Mission đã đạt kết quả.</p>
            </div>
            <div className="h2o-sr-panel h2o-sr-card">
              <div className="label">Readiness</div>
              <strong>{currentReadiness != null ? `${currentReadiness}/100` : "—"}</strong>
              <p>{currentReadiness != null ? "Mức sẵn sàng của mission đang làm." : "Chưa có mission nào đang mở."}</p>
            </div>
            <div className="h2o-sr-panel h2o-sr-card">
              <div className="label">Dự kiến còn lại</div>
              <strong>{remainingDays != null ? `${remainingDays} ngày` : "—"}</strong>
              <p>{remainingDays != null ? "Tổng thời lượng ước tính các mission còn lại." : "Chưa đặt thời lượng ước tính cho mission."}</p>
            </div>
          </div>

          <div className="h2o-sr-grid">
            <section className="h2o-sr-panel h2o-sr-map">
              <div className="h2o-sr-maphead">
                <div><div className="h2o-sr-eyebrow">Outcome Map</div><h3>Con đường tạo kết quả</h3></div>
                <span className="h2o-sr-chip">{journey!.outcomes.length} Outcome · {missions.length} Mission</span>
              </div>

              {view === "map" && journey!.outcomes.map((outcome, index) => {
                const list = outcomeMissions(outcome);
                const progress = outcomeProgress(outcome);
                return <div key={outcome.id} className="h2o-sr-outcome">
                  <div className="h2o-sr-outcometitle">
                    <div className="h2o-sr-num">{String(index + 1).padStart(2, "0")}</div>
                    <div><h3>{outcome.title}</h3><small>Outcome progress {progress}%</small></div>
                    <span className={`h2o-sr-chip${progress > 0 && progress < 100 ? " good" : ""}`}>{progress === 100 ? "Hoàn thành" : progress > 0 ? "Đang học" : `${list.length} Mission`}</span>
                  </div>
                  {/* Outcome → Milestone → Mission (§3). Tiêu đề Milestone chỉ hiện khi nó thật sự
                      thêm thông tin — Stage 1 hiện có Outcome và Milestone trùng tên 1-1, hiện cả
                      hai chỉ làm nhiễu chứ không giúp học viên định vị. */}
                  {outcome.milestones.map((milestone) => <div key={milestone.id}>
                    {(outcome.milestones.length > 1 || milestone.title !== outcome.title) &&
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#8d1d50", margin: "10px 0 6px" }}>{milestone.title}</div>}
                    <div className="h2o-sr-lane">
                      {milestone.missions.map((mission) => <button key={mission.id} className={`h2o-sr-mission ${stateClass(mission)}`} onClick={() => router.push(`/student/missions/${mission.id}`)}>
                        <div className="state">{stateLabel(mission)}</div>
                        <b>{mission.title}</b>
                        <p>{mission.displayState === "locked" ? (mission.lockedReason ?? "Mở sau mission trước.") : (mission.description || mission.expectedResult || "Mở để xem chi tiết.")}</p>
                        {mission.displayState !== "locked" && <div className="h2o-sr-minibar"><i style={{ width: `${missionProgress(mission)}%` }} /></div>}
                      </button>)}
                    </div>
                  </div>)}
                </div>;
              })}

              {view === "roadmap" && (() => {
                let dayCursor = 0;
                return missions.map((mission) => {
                  const done = DONE_STATES.includes(mission.displayState);
                  const isCurrent = currentMission?.id === mission.id;
                  let when = "Sau đó";
                  if (done) when = "Đã xong";
                  else if (isCurrent) when = "Hôm nay";
                  else if (mission.estimatedDays != null) { dayCursor += mission.estimatedDays; when = `+${dayCursor} ngày`; }
                  const outcome = journey!.outcomes.find((o) => outcomeMissions(o).some((m) => m.id === mission.id));
                  return <button key={mission.id} className="h2o-sr-tlrow" onClick={() => router.push(`/student/missions/${mission.id}`)}>
                    <div className="date">{when}</div>
                    <div><b>{mission.title}</b><br /><span>{outcome?.title ?? ""}</span></div>
                    <span>{done ? "✓ Đã có kết quả" : mission.displayState === "locked" ? "Khóa" : `${missionProgress(mission)}% · đang làm`}</span>
                  </button>;
                });
              })()}

              {view === "list" && <div style={{ overflowX: "auto" }}>
                <table className="h2o-sr-table">
                  <thead><tr><th>Mission</th><th>Outcome</th><th>State</th><th>Readiness</th><th>Thời lượng</th></tr></thead>
                  <tbody>
                    {missions.map((mission) => {
                      const outcome = journey!.outcomes.find((o) => outcomeMissions(o).some((m) => m.id === mission.id));
                      return <tr key={mission.id} onClick={() => router.push(`/student/missions/${mission.id}`)}>
                        <td>{mission.title}</td>
                        <td>{outcome?.title ?? "—"}</td>
                        <td>{STATE_LABEL[mission.displayState]}</td>
                        <td>{currentMission?.id === mission.id && currentReadiness != null ? currentReadiness : DONE_STATES.includes(mission.displayState) ? 100 : "—"}</td>
                        <td>{mission.estimatedDays != null ? `${mission.estimatedDays} ngày` : "—"}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>}
            </section>

            <aside className="h2o-sr-panel h2o-sr-aside">
              <div className="h2o-sr-aihead">
                <div className="h2o-sr-brain">H₂</div>
                <div><b>H2O Journey AI</b><br /><small>Future Smart Roadmap Engine</small></div>
              </div>
              <div className="h2o-sr-aisection">
                <h4>Bước tiếp theo</h4>
                <div className="h2o-sr-next">
                  <b>{currentMission ? currentMission.title : "Đã xong giai đoạn này"}</b>
                  <small>{currentMission ? "Mission đang mở trong hành trình của bạn" : "Không còn mission nào đang mở"}</small>
                  {currentMission && <button className="h2o-sr-aibtn" onClick={() => router.push(`/student/missions/${currentMission.id}`)}>Mở Mission Workspace</button>}
                </div>
              </div>
              <div className="h2o-sr-aisection">
                <h4>Tổng quan</h4>
                <div className="h2o-sr-forecast">
                  <div><small>Đã đạt kết quả</small><strong>{doneCount}</strong></div>
                  <div><small>Còn lại</small><strong>{remaining.length}</strong></div>
                  <div><small>Việc cần làm</small><strong>{openTasks}</strong></div>
                  <div><small>Thời lượng còn</small><strong>{remainingDays != null ? `${remainingDays}n` : "—"}</strong></div>
                </div>
              </div>
              <div className="h2o-sr-aisection">
                <h4>Gợi ý thông minh</h4>
                <div className="h2o-sr-insight">H2O Mentor tạm thời không khả dụng. Toàn bộ hành trình, mission và kết quả vẫn hoạt động bình thường.</div>
              </div>
            </aside>
          </div>
        </>}

    {supplementaryCourses.length > 0 && <section className="h2o-student-section" style={{ marginTop: 24 }}>
      <header><div><span>KHÓA HỌC BỔ TRỢ</span><h2>Khóa học video liên quan</h2></div></header>
      <div className="h2o-student-course-grid">{supplementaryCourses.slice(0, 3).map((course) => <article key={course.slug}><div style={{ background: course.accent }}><span>{course.category}</span></div><h3>{course.title}</h3><p>{course.subtitle}</p><Link href={course.access ? `/student/courses/${course.slug}` : `/academy/courses/${course.slug}`}>Xem <ArrowRight size={13} /></Link></article>)}</div>
    </section>}
  </>;
}
