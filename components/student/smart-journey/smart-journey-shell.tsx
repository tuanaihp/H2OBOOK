"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { actionLabel, fireJourneyEvent, flattenMissions, STATE_LABEL, type MissionSummary, type PrimaryMode, type SmartJourneyModel, type ViewMode } from "./types";
import { JourneyMapView, JourneyRoadmapView, JourneyTodayView, MissionControlListView } from "./views";

function JourneyHeader({ model }: { model: SmartJourneyModel }) {
  return <section className="h2o-student-page-head">
    <div>
      <span>H2O NEURAL JOURNEY</span>
      <h1>{model.stageTitle}</h1>
      <p>Bản đồ dẫn từ kiến thức → hành động → evidence → kết quả.</p>
    </div>
    <div className="h2o-sr-chips">
      <span className="h2o-sr-chip">Giai đoạn {String(model.stagePosition).padStart(2, "0")}</span>
      <span className="h2o-sr-chip">Journey v{model.journeyVersionNumber}</span>
      <span className="h2o-sr-chip good">● Journey đang áp dụng</span>
    </div>
  </section>;
}

function JourneyIntelligenceBar({ model }: { model: SmartJourneyModel }) {
  return <div className="h2o-sr-strip">
    <div className="h2o-sr-panel h2o-sr-card ai">
      <div className="label">H2O Journey Insight</div>
      <strong style={{ fontSize: 16 }}>{model.ai.status === "ready" && model.ai.insight ? model.ai.insight : "Hành trình đang hoạt động bình thường"}</strong>
    </div>
    <div className="h2o-sr-panel h2o-sr-card">
      <div className="label">Journey Progress</div>
      <strong>{model.progressPercent}%</strong>
      <p>{model.counts.completed}/{model.counts.total} Mission đạt kết quả.</p>
    </div>
    <div className="h2o-sr-panel h2o-sr-card">
      <div className="label">Readiness</div>
      <strong>{model.readinessScore}/100</strong>
    </div>
    <div className="h2o-sr-panel h2o-sr-card">
      <div className="label">Predicted Finish</div>
      <strong>{model.predictedFinishDate ?? "—"}</strong>
      <p>Dự báo, không phải deadline bắt buộc.</p>
    </div>
  </div>;
}

function JourneyControls({ mode, view, onModeChange, onViewChange }: { mode: PrimaryMode; view: ViewMode; onModeChange: (m: PrimaryMode) => void; onViewChange: (v: ViewMode) => void }) {
  return <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, margin: "14px 0" }}>
    <div className="h2o-sr-switch">
      {(["journey", "today"] as const).map((m) => <button key={m} className={m === mode ? "active" : undefined} onClick={() => onModeChange(m)}>{m === "journey" ? "Journey" : "Today"}</button>)}
    </div>
    {mode === "journey" && <div className="h2o-sr-switch">
      {(["map", "roadmap", "list"] as const).map((v) => <button key={v} className={v === view ? "active" : undefined} onClick={() => onViewChange(v)}>{v === "map" ? "Map" : v === "roadmap" ? "Roadmap" : "Danh sách"}</button>)}
    </div>}
  </div>;
}

function JourneyAiPanel({ model, onOpenMission }: { model: SmartJourneyModel; onOpenMission: (id: string) => void }) {
  const all = flattenMissions(model);
  // AI's own nextBestMissionId is validated against this org's own current graph before use
  // (docs/smart-journey-v3 §11/test #12 "AI hallucinated mission ID rejected") — today it is always
  // null (Release 4 not built), so this always falls through to the deterministic current mission.
  const aiPick = model.ai.nextBestMissionId ? all.find((x) => x.mission.id === model.ai.nextBestMissionId) : undefined;
  const current = aiPick ?? all.find((x) => x.mission.id === model.currentMissionId) ?? all.find((x) => x.mission.state !== "locked");
  return <aside className="h2o-sr-panel h2o-sr-aside">
    <div className="h2o-sr-aihead"><div className="h2o-sr-brain">H₂</div><div><b>H2O Journey AI</b><br /><small>Smart Roadmap Engine</small></div></div>
    <div className="h2o-sr-aisection">
      <h4>Next Best Action</h4>
      <div className="h2o-sr-next">
        <b>{model.ai.nextBestAction || current?.mission.title || "Chưa có gợi ý"}</b>
        {current && <button className="h2o-sr-aibtn" onClick={() => onOpenMission(current.mission.id)}>Mở Mission Workspace</button>}
      </div>
    </div>
    {model.ai.blocker && <div className="h2o-sr-aisection"><h4>Blocker</h4><div className="h2o-sr-insight">{model.ai.blocker}</div></div>}
    {model.ai.adaptivePath && <div className="h2o-sr-aisection"><h4>Adaptive Path</h4><div className="h2o-sr-insight">{model.ai.adaptivePath}</div></div>}
    {model.ai.status === "unavailable" && <div className="h2o-sr-aisection"><h4>Gợi ý thông minh</h4><div className="h2o-sr-insight">H2O Mentor tạm thời không khả dụng.</div></div>}
  </aside>;
}

function MissionQuickPreviewDrawer({ mission, onClose, onOpenWorkspace }: { mission: MissionSummary | null; onClose: () => void; onOpenWorkspace: (id: string) => void }) {
  if (!mission) return null;
  return <div className="h2o-sj-drawer-overlay" onClick={onClose}>
    <aside className="h2o-sj-drawer" onClick={(e) => e.stopPropagation()}>
      <button className="h2o-sj-drawer-close" onClick={onClose}>✕</button>
      <div className="h2o-sr-eyebrow">Mission Quick Preview</div>
      <h2 style={{ margin: "8px 0 4px", fontSize: 22 }}>{mission.title}</h2>
      <p style={{ fontSize: 13, color: "#718092", margin: 0 }}>{mission.description || "Mission trong hành trình."}</p>
      <div className="h2o-sr-section" style={{ marginTop: 16 }}>
        <div className="h2o-sr-eyebrow" style={{ fontSize: 10 }}>Current Status</div>
        <p style={{ fontSize: 13, margin: "6px 0 0" }}>{STATE_LABEL[mission.state]} · Progress {mission.progressPercent}% · Readiness {mission.readinessScore ?? "—"}/100</p>
      </div>
      {mission.blockers.length > 0 && <div className="h2o-sr-section">
        <div className="h2o-sr-eyebrow" style={{ fontSize: 10, color: "#b7791f" }}>Blocker</div>
        {mission.blockers.map((b) => <p key={b} style={{ fontSize: 13, margin: "6px 0 0" }}>{b}</p>)}
      </div>}
      <div className="h2o-sr-section">
        <div className="h2o-sr-eyebrow" style={{ fontSize: 10 }}>Result Output</div>
        <p style={{ fontSize: 13, margin: "6px 0 0" }}>{mission.resultSummary?.title || mission.resultSummary?.status || "Chưa có Result"}</p>
      </div>
      <button disabled={mission.state === "locked"} onClick={() => onOpenWorkspace(mission.id)} className="h2o-sr-btn primary" style={{ width: "100%", marginTop: 8 }}>
        {actionLabel(mission)} →
      </button>
    </aside>
  </div>;
}

export function SmartJourneyShell({ model }: { model: SmartJourneyModel }) {
  const router = useRouter();
  const [mode, setMode] = useState<PrimaryMode>("journey");
  const [view, setView] = useState<ViewMode>("map");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const flat = useMemo(() => flattenMissions(model), [model]);
  const previewMission = flat.find((x) => x.mission.id === previewId)?.mission ?? null;

  useEffect(() => { fireJourneyEvent("journey.mode_changed", undefined, { mode }); }, [mode]);
  useEffect(() => { if (mode === "journey") fireJourneyEvent("journey.view_changed", undefined, { view }); }, [view, mode]);

  function openPreview(id: string) {
    setPreviewId(id);
    fireJourneyEvent("journey.mission_previewed", id);
  }
  function openWorkspace(id: string) {
    fireJourneyEvent("journey.mission_workspace_opened", id);
    router.push(`/student/missions/${id}`);
  }

  return <>
    <JourneyHeader model={model} />
    <JourneyControls mode={mode} view={view} onModeChange={setMode} onViewChange={setView} />
    <JourneyIntelligenceBar model={model} />
    <div className="h2o-sr-grid" style={{ marginTop: 16 }}>
      <section className="h2o-sr-panel h2o-sr-map">
        {mode === "today"
          ? <JourneyTodayView model={model} onMissionClick={openPreview} />
          : view === "map" ? <JourneyMapView model={model} onMissionClick={openPreview} />
          : view === "roadmap" ? <JourneyRoadmapView model={model} onMissionClick={openPreview} />
          : <MissionControlListView model={model} onMissionClick={openPreview} onFilterChanged={() => fireJourneyEvent("journey.list_filtered")} />}
      </section>
      <JourneyAiPanel model={model} onOpenMission={openWorkspace} />
    </div>
    <MissionQuickPreviewDrawer mission={previewMission} onClose={() => setPreviewId(null)} onOpenWorkspace={openWorkspace} />
  </>;
}
