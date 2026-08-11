"use client";
import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { actionLabel, buildActionQueue, fireJourneyEvent, flattenMissions, STATE_LABEL, type ListMode, type SmartJourneyModel } from "./types";

/**
 * v5/32-.../CLAUDE_H2OBOOK_LEARN_OUTCOME_OS_V4.md §0 decision 2: clicking a Mission from any view
 * goes straight to the Focus Workspace; Quick Preview is now a secondary/optional affordance
 * (this small eye icon), not the default click target — reversing folder 31's drawer-first flow.
 */
function PreviewButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return <button type="button" onClick={(e) => { e.stopPropagation(); onClick(e); }} title="Xem nhanh" style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 8, border: "1px solid var(--student-line)", background: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
    <Eye size={13} color="#718092" />
  </button>;
}

const DONE = new Set(["verified", "result_achieved"]);

function stateClass(state: string): string {
  if (DONE.has(state)) return "done";
  if (state === "locked") return "locked";
  return "current";
}
function stateLabel(state: string, isCurrent: boolean): string {
  if (DONE.has(state)) return `✓ ${STATE_LABEL[state as keyof typeof STATE_LABEL]}`;
  if (state === "locked") return `🔒 ${STATE_LABEL[state as keyof typeof STATE_LABEL]}`;
  return `${isCurrent ? "●" : "○"} ${STATE_LABEL[state as keyof typeof STATE_LABEL]}`;
}

/** Outcome → Milestone → Mission → Checkpoint Result (docs/smart-journey-v3 §6). */
export function JourneyMapView({ model, onMissionClick, onPreview }: { model: SmartJourneyModel; onMissionClick: (id: string) => void; onPreview: (id: string) => void }) {
  return <div>
    {model.outcomes.map((outcome, index) => <div key={outcome.id} className="h2o-sr-outcome">
      <div className="h2o-sr-outcometitle">
        <div className="h2o-sr-num">{String(index + 1).padStart(2, "0")}</div>
        <div><h3>{outcome.title}</h3><small>Outcome progress {outcome.progressPercent}%</small></div>
        <span className={`h2o-sr-chip${outcome.progressPercent > 0 && outcome.progressPercent < 100 ? " good" : ""}`}>{outcome.progressPercent === 100 ? "Hoàn thành" : `${outcome.milestones.flatMap((m) => m.missions).length} Mission`}</span>
      </div>
      {outcome.milestones.map((milestone) => <div key={milestone.id}>
        {(outcome.milestones.length > 1 || milestone.title !== outcome.title) &&
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#8d1d50", margin: "10px 0 6px" }}>{milestone.title}</div>}
        <div className="h2o-sr-lane">
          {milestone.missions.map((mission) => <button key={mission.id} className={`h2o-sr-mission ${stateClass(mission.state)}`} onClick={() => onMissionClick(mission.id)}>
            {mission.state !== "locked" && <PreviewButton onClick={() => onPreview(mission.id)} />}
            {mission.isCurrent && <span className="h2o-sj-hero-tag">Bạn đang ở đây</span>}
            <div className="state">{stateLabel(mission.state, mission.isCurrent)}</div>
            <b>{mission.title}</b>
            <p>{mission.state === "locked" ? (mission.lockedReason ?? "Mở sau mission trước.") : (mission.description || "Mở để xem chi tiết.")}</p>
            {mission.state !== "locked" && <div className="h2o-sr-minibar"><i style={{ width: `${mission.progressPercent}%` }} /></div>}
          </button>)}
        </div>
      </div>)}
      <div className="h2o-sr-doc" style={{ gridTemplateColumns: "34px 1fr", borderStyle: "dashed" }}>
        <div className="h2o-sr-docicon">🏁</div>
        <div><b>Checkpoint</b><small>{outcome.expectedResult || `Kết quả ${outcome.title}`}</small></div>
      </div>
    </div>)}
  </div>;
}

/** Timeline: Hôm nay → Tiếp theo → Tuần này → Sau đó (§7) — grouped by real state/estimated_days, not a copy of the List view. */
export function JourneyRoadmapView({ model, onMissionClick, onPreview }: { model: SmartJourneyModel; onMissionClick: (id: string) => void; onPreview: (id: string) => void }) {
  const rows = flattenMissions(model);
  let dayCursor = 0;
  const groups: { label: string; rows: typeof rows }[] = [{ label: "Hôm nay", rows: [] }, { label: "Tiếp theo", rows: [] }, { label: "Tuần này", rows: [] }, { label: "Sau đó", rows: [] }, { label: "Đã hoàn thành", rows: [] }];
  for (const row of rows) {
    if (DONE.has(row.mission.state)) { groups[4].rows.push(row); continue; }
    if (row.mission.isCurrent) { groups[0].rows.push(row); continue; }
    if (row.mission.state === "locked") {
      dayCursor += row.mission.estimatedDays ?? 0;
      (dayCursor <= 7 ? groups[2] : groups[3]).rows.push(row);
      continue;
    }
    groups[1].rows.push(row);
  }
  return <div>
    {groups.filter((g) => g.rows.length).map((group) => <div key={group.label} style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#8d1d50", margin: "0 0 6px" }}>{group.label}</div>
      {group.rows.map(({ outcome, mission }) => <button key={mission.id} className="h2o-sr-tlrow" disabled={mission.state === "locked"} onClick={() => onMissionClick(mission.id)} style={{ position: "relative", ...(mission.state === "locked" ? { opacity: 0.6, cursor: "default" } : undefined) }}>
        <div className="date">{mission.estimatedDays != null ? `${mission.estimatedDays}n` : "—"}</div>
        <div><b>{mission.title}</b><br /><span>{outcome.title}</span></div>
        <span>{DONE.has(mission.state) ? "✓ Đã có kết quả" : STATE_LABEL[mission.state]}</span>
        {mission.state !== "locked" && <PreviewButton onClick={() => onPreview(mission.id)} />}
      </button>)}
    </div>)}
  </div>;
}

/** Mission Control: summary tiles + search/status/outcome filter + Theo Outcome / Action Queue submodes (§8). */
export function MissionControlListView({ model, onMissionClick, onPreview, onFilterChanged }: { model: SmartJourneyModel; onMissionClick: (id: string) => void; onPreview: (id: string) => void; onFilterChanged: () => void }) {
  const [mode, setMode] = useState<ListMode>("grouped");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [outcomeId, setOutcomeId] = useState("all");
  const flat = useMemo(() => flattenMissions(model), [model]);
  const aiPriorityTitle = null; // AI priority is Release 4 — never fabricated here.
  const filtered = flat.filter(({ outcome, mission }) =>
    (!q || mission.title.toLowerCase().includes(q.toLowerCase())) &&
    (status === "all" || mission.state === status) &&
    (outcomeId === "all" || outcome.id === outcomeId));
  const queue = buildActionQueue(model);

  return <div>
    <div className="h2o-sj-summary" style={{ marginBottom: 12 }}>
      <article><div className="label">Tổng Mission</div><strong>{model.counts.total}</strong></article>
      <article><div className="label">Đang làm</div><strong>{model.counts.doing}</strong></article>
      <article><div className="label">Hoàn thành</div><strong>{model.counts.completed}</strong></article>
      <article><div className="label">Cần Evidence</div><strong>{model.counts.evidencePending}</strong></article>
      <article><div className="label">Đang khóa</div><strong>{model.counts.locked}</strong></article>
      <article><div className="label">AI ưu tiên</div><strong style={{ fontSize: 12, color: "#94a3b8" }}>{aiPriorityTitle ?? "Chưa khả dụng"}</strong></article>
    </div>

    <div className="h2o-sj-filterbar" style={{ marginBottom: 12 }}>
      <input value={q} onChange={(e) => { setQ(e.target.value); onFilterChanged(); }} placeholder="Tìm Mission..." />
      <select value={status} onChange={(e) => { setStatus(e.target.value); onFilterChanged(); }}>
        <option value="all">Tất cả trạng thái</option>
        <option value="doing">Đang làm</option>
        <option value="evidence_pending">Cần Evidence</option>
        <option value="review_pending">Chờ giáo viên duyệt</option>
        <option value="result_achieved">Đạt kết quả</option>
        <option value="locked">Đang khóa</option>
      </select>
      <select value={outcomeId} onChange={(e) => { setOutcomeId(e.target.value); onFilterChanged(); }}>
        <option value="all">Tất cả Outcome</option>
        {model.outcomes.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
      </select>
      <div className="h2o-sj-submode">
        <button className={mode === "grouped" ? "active" : undefined} onClick={() => setMode("grouped")}>Theo Outcome</button>
        <button className={mode === "queue" ? "active" : undefined} onClick={() => { setMode("queue"); fireJourneyEvent("journey.action_queue_viewed"); }}>Action Queue</button>
      </div>
    </div>

    {mode === "queue"
      ? <div className="h2o-sr-panel">{queue.length === 0
          ? <p style={{ padding: 16, fontSize: 12, color: "#718092", margin: 0 }}>Không còn việc nào trong hàng đợi.</p>
          : queue.map(({ mission }, i) => <button key={mission.id} className="h2o-sj-queuerow" style={{ position: "relative" }} onClick={() => onMissionClick(mission.id)}>
              <span className="num">{i + 1}</span>
              <span><b style={{ display: "block", fontSize: 13 }}>{mission.title}</b><small style={{ color: "#718092" }}>{mission.blockers[0] || (mission.readinessScore != null ? `Readiness ${mission.readinessScore}` : "")}</small></span>
              <span style={{ textAlign: "right", fontSize: 11, color: "#718092" }}>{mission.estimatedDays != null ? `${mission.estimatedDays} ngày` : "Mở Workspace"}</span>
              <PreviewButton onClick={() => onPreview(mission.id)} />
            </button>)}
        </div>
      : <div style={{ display: "grid", gap: 14 }}>
          {model.outcomes.map((outcome) => {
            const rows = filtered.filter((x) => x.outcome.id === outcome.id);
            if (!rows.length) return null;
            return <div key={outcome.id} className="h2o-sr-panel">
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--student-line)", background: "#fbfcfd" }}>
                <div className="h2o-sr-eyebrow">Outcome</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <div><strong>{outcome.title}</strong><p style={{ fontSize: 11, color: "#718092", margin: "2px 0 0" }}>{outcome.expectedResult || "Outcome Result"}</p></div>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{outcome.progressPercent}%</span>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="h2o-sr-table">
                  <thead><tr><th>Mission</th><th>State</th><th>Progress</th><th>Readiness</th><th>Blocker</th><th>Result</th><th>Action</th></tr></thead>
                  <tbody>
                    {rows.map(({ mission }) => <tr key={mission.id}>
                      <td>{mission.title}</td>
                      <td>{STATE_LABEL[mission.state]}</td>
                      <td>{mission.progressPercent}%</td>
                      <td>{mission.readinessScore ?? "—"}</td>
                      <td style={{ fontSize: 11, color: "#718092" }}>{mission.blockers[0] || "—"}</td>
                      <td style={{ fontSize: 11 }}>{mission.resultSummary?.status ?? "—"}</td>
                      <td style={{ display: "flex", gap: 6 }}>
                        {mission.state !== "locked" && <button onClick={() => onPreview(mission.id)} title="Xem nhanh" className="h2o-sr-btn" style={{ fontSize: 11, padding: "5px 8px" }}><Eye size={12} /></button>}
                        <button disabled={mission.state === "locked"} onClick={() => onMissionClick(mission.id)} className="h2o-sr-btn" style={{ fontSize: 11, padding: "5px 9px" }}>{actionLabel(mission)}</button>
                      </td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </div>;
          })}
        </div>}
  </div>;
}

/** 1–5 real actionable items for today (§9) — deterministic only; AI enrichment is Release 4. */
export function JourneyTodayView({ model, onMissionClick }: { model: SmartJourneyModel; onMissionClick: (id: string) => void }) {
  return <div style={{ maxWidth: 640, margin: "0 auto" }}>
    <div className="h2o-sr-eyebrow">Today Focus</div>
    <h2 style={{ margin: "4px 0 14px", fontSize: 18 }}>Hôm nay chỉ tập trung vào việc tạo kết quả</h2>
    <div className="h2o-sr-panel">
      {model.todayItems.length === 0
        ? <p style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#718092", margin: 0 }}>Chưa có nhiệm vụ Today — mọi Mission đang mở đã xong việc cần làm.</p>
        : model.todayItems.map((item, i) => <button key={item.id} className="h2o-sj-queuerow" onClick={() => onMissionClick(item.missionId)}>
            <span className="num">{i + 1}</span>
            <span><b style={{ display: "block", fontSize: 13 }}>{item.title}</b><small style={{ color: "#718092" }}>{item.reason || "Được đề xuất hôm nay"}</small></span>
            <span style={{ textAlign: "right", fontSize: 11, color: "#718092" }}>{item.estimatedDays != null ? `${item.estimatedDays} ngày` : "—"}</span>
          </button>)}
    </div>
  </div>;
}
