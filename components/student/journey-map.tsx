"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight, Clock3, Compass, Lock, PlayCircle, X } from "lucide-react";
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
  const [data, setData] = useState<JourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"map" | "roadmap" | "list">("list");
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/student/journey", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setData(json);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const missions = useMemo(() => data?.journey?.outcomes.flatMap((o) => o.milestones.flatMap((m) => m.missions)) ?? [], [data]);
  const selectedMission = missions.find((m) => m.id === selectedMissionId) ?? null;
  const currentMission = missions.find((m) => !["locked", "verified", "result_achieved"].includes(m.displayState)) ?? null;
  const nextMission = missions.find((m) => m.displayState === "locked") ?? null;

  async function call(url: string, body: unknown): Promise<boolean> {
    setBusy(true); setMessage(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setMessage(json?.error ?? "Thao tác thất bại."); return false; }
      await load();
      return true;
    } catch {
      setMessage("Mất kết nối — thử lại.");
      return false;
    } finally { setBusy(false); }
  }

  if (loading) return <div className="h2o-student-page-head"><div><h1>Hành trình của tôi</h1><p>Đang tải...</p></div></div>;

  const noJourney = !data?.journey || !data.journey.outcomes.length;

  return <>
    <section className="h2o-student-page-head">
      <div>
        <span>MY LEARNING</span>
        <h1>{data?.stage ? `Hành trình — ${data.stage.title}` : "Hành trình của tôi"}</h1>
        {data?.journey && <p>{data.journey.progressPercent}% hoàn thành · {currentMission ? `Đang làm: ${currentMission.title}` : "Chưa bắt đầu mission nào"}{nextMission ? ` · Tiếp theo: ${nextMission.title}` : ""}</p>}
      </div>
      {data?.journey && <div style={{ display: "flex", gap: 6 }}>
        {(["list", "roadmap", "map"] as const).map((v) => <button key={v} onClick={() => setView(v)} style={{ padding: "6px 12px", borderRadius: 8, border: v === view ? "1px solid #2563eb" : "1px solid #dfe3e8", background: v === view ? "#eff6ff" : "#fff", fontSize: 12, cursor: "pointer" }}>{v === "list" ? "Danh sách" : v === "roadmap" ? "Roadmap" : "Map"}</button>)}
      </div>}
    </section>

    {message && <div className="h2o-student-card" style={{ padding: 10, fontSize: 12, marginBottom: 12 }}>{message}</div>}

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
              {outcome.milestones.flatMap((m) => m.missions).map((mission) => <button key={mission.id} onClick={() => setSelectedMissionId(mission.id)}
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

    {selectedMission && <MissionDrawer mission={selectedMission} versionId={data!.journey!.versionId!} busy={busy} onClose={() => setSelectedMissionId(null)}
      onStart={() => call("/api/student/journey/mission", { action: "start", missionId: selectedMission.id, blueprintVersionId: data!.journey!.versionId })}
      onCompleteSelf={() => call("/api/student/journey/mission", { action: "completeSelf", missionId: selectedMission.id, blueprintVersionId: data!.journey!.versionId })}
      onToggleAction={(actionId, status) => call("/api/student/journey/action", { actionId, status })}
      onSubmitEvidence={(note) => call("/api/student/journey/evidence", { missionId: selectedMission.id, blueprintVersionId: data!.journey!.versionId, note })}
    />}
  </>;
}

function MissionDrawer({ mission, busy, onClose, onStart, onCompleteSelf, onToggleAction, onSubmitEvidence }: {
  mission: Mission; versionId: string; busy: boolean; onClose: () => void;
  onStart: () => void; onCompleteSelf: () => void; onToggleAction: (actionId: string, status: string) => void; onSubmitEvidence: (note: string) => void;
}) {
  const [evidenceNote, setEvidenceNote] = useState("");
  const started = mission.actions.length > 0;
  const needsEvidence = mission.completionPolicy !== "self_reported" && mission.completionPolicy !== "metric_based";
  const canSubmitEvidence = needsEvidence && ["doing", "learning", "planning", "evidence_pending"].includes(mission.displayState);
  const cta = mission.displayState === "locked" ? null
    : mission.displayState === "result_achieved" || mission.displayState === "verified" ? { label: "Đã hoàn thành", disabled: true, onClick: () => {} }
    : mission.displayState === "review_pending" ? { label: "Đang chờ giáo viên duyệt", disabled: true, onClick: () => {} }
    : !started ? { label: "Start Mission", disabled: busy, onClick: onStart }
    : needsEvidence ? { label: "Continue Mission", disabled: true, onClick: () => {} }
    : { label: "Đánh dấu hoàn thành", disabled: busy, onClick: onCompleteSelf };

  return <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", justifyContent: "flex-end", zIndex: 50 }} onClick={onClose}>
    <div style={{ width: 440, maxWidth: "100%", background: "#fff", height: "100%", overflowY: "auto", padding: 24 }} onClick={(e) => e.stopPropagation()}>
      <button onClick={onClose} style={{ float: "right", border: "none", background: "none", cursor: "pointer" }}><X size={18} /></button>
      <span style={{ fontSize: 11, color: STATE_COLOR[mission.displayState], fontWeight: 600 }}>{STATE_LABEL[mission.displayState]}</span>
      <h2 style={{ margin: "4px 0 12px", fontSize: 18 }}>{mission.title}</h2>

      {mission.displayState === "locked" && mission.lockedReason && <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "8px 10px", marginBottom: 12, fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}><Lock size={13} color="#64748b" /><span>{mission.lockedReason}</span></div>}

      <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 2px" }}>Expected result</p>
      <p style={{ fontSize: 13, margin: "0 0 12px" }}>{mission.expectedResult || "—"}</p>

      {mission.description && <><p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 2px" }}>Why this matters</p><p style={{ fontSize: 13, margin: "0 0 12px" }}>{mission.description}</p></>}

      {mission.resourceBindings.length > 0 && <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 600 }}>Cần học</p>
        {mission.resourceBindings.map((r) => <Link key={r.id} href="/student/library" style={{ display: "block", fontSize: 13, color: "#2563eb", padding: "4px 0" }}>{r.title}{r.role === "recommended" ? " (gợi ý)" : ""}</Link>)}
      </div>}

      {mission.toolBindings.length > 0 && <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 600 }}>Công cụ</p>
        {mission.toolBindings.map((t) => <div key={t.id} style={{ fontSize: 13 }}>{t.toolType}</div>)}
      </div>}

      {(mission.actionTemplates.length > 0 || mission.actions.length > 0) && <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 600 }}>Kế hoạch hành động</p>
        {started
          ? mission.actions.map((a) => <label key={a.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "4px 0" }}>
              <input type="checkbox" checked={a.status === "completed"} disabled={busy} onChange={(e) => onToggleAction(a.id, e.target.checked ? "completed" : "planned")} />
              <span style={{ textDecoration: a.status === "completed" ? "line-through" : "none", color: a.status === "completed" ? "#94a3b8" : "#0f172a" }}>{a.title}{a.required ? "" : " (tùy chọn)"}{a.evidenceRequired ? " · cần evidence" : ""}</span>
            </label>)
          : mission.actionTemplates.map((t) => <div key={t.id} style={{ fontSize: 13, padding: "4px 0", color: "#6b7a89" }}>{t.title}{t.required ? "" : " (tùy chọn)"}</div>)}
      </div>}

      {needsEvidence && <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 600 }}>Evidence {mission.completionPolicy === "teacher_verified" ? "(cần giáo viên xác nhận)" : ""}</p>
        {canSubmitEvidence
          ? <>
              <textarea value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} placeholder="Mô tả bằng chứng đã hoàn thành (ảnh Before/After, ghi chú...)" style={{ width: "100%", minHeight: 60, padding: 8, borderRadius: 8, border: "1px solid #dfe3e8", fontSize: 12 }} />
              <button disabled={busy || !evidenceNote.trim()} onClick={() => onSubmitEvidence(evidenceNote)} className="h2o-student-primary" style={{ marginTop: 6 }}>Nộp Evidence</button>
            </>
          : <p style={{ fontSize: 12, color: "#6b7a89" }}>{mission.displayState === "review_pending" ? "Đã nộp — đang chờ giáo viên duyệt." : mission.displayState === "verified" || mission.displayState === "result_achieved" ? "Đã được xác nhận." : "Bắt đầu Mission trước khi nộp evidence."}</p>}
      </div>}

      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 600 }}>Success criteria</p>
        {mission.successCriteria.length ? mission.successCriteria.map((c, i) => <div key={i} style={{ fontSize: 13 }}>· {c}</div>) : <p style={{ fontSize: 12, color: "#6b7a89" }}>Chưa có success KPI cho mission này.</p>}
      </div>

      {cta && <button disabled={cta.disabled} onClick={cta.onClick} className="h2o-student-primary" style={{ width: "100%", marginTop: 8 }}>{cta.label}<Clock3 size={14} /></button>}
    </div>
  </div>;
}
