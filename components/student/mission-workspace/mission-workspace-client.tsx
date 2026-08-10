"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MissionBlockField, type StudentBlockValue, type StudentMissionBlock } from "./mission-block-field";

type DisplayState = "locked" | "available" | "not_started" | "learning" | "planning" | "doing" | "evidence_pending" | "review_pending" | "verified" | "result_achieved" | "blocked";
type Mission = {
  id: string; title: string; description: string; expectedResult: string; completionPolicy: string; estimatedDays: number | null;
  successCriteria: string[]; displayState: DisplayState; lockedReason: string | null;
  resourceBindings: { id: string; title: string; role: string; resourceType: string; resourceId: string }[];
  toolBindings: { id: string; toolType: string; toolId: string; role: string }[];
  actionTemplates: { id: string; title: string; description: string; required: boolean; evidenceRequired: boolean }[];
  actions: { id: string; title: string; required: boolean; evidenceRequired: boolean; status: string }[];
  evidence: { note?: string; assetId?: string; submittedAt: string }[];
  evidenceSubmittedAt: string | null; verifiedAt: string | null; resultAchievedAt: string | null;
};
type Sibling = { id: string; title: string; displayState: DisplayState; lockedReason: string | null; outcomeTitle: string };
type View = {
  stage: { id: string; title: string; indexLabel: string };
  outcome: { id: string; title: string }; milestone: { id: string; title: string };
  mission: Mission; versionId: string; blueprintTitle: string | null; journeyProgressPercent: number;
  siblings: Sibling[]; unlocksMissionTitle: string | null; outcomeProgressPercent: number;
  blocks: StudentMissionBlock[]; values: StudentBlockValue[]; readiness: { score: number; missingRequiredBlockIds: string[] };
};

const DONE_STATES: DisplayState[] = ["verified", "result_achieved"];
const STATE_LABEL: Record<DisplayState, string> = {
  locked: "Khóa", available: "Sẵn sàng", not_started: "Sẵn sàng", learning: "Đang học",
  planning: "Đang lên kế hoạch", doing: "Đang thực hiện", evidence_pending: "Chờ nộp bằng chứng",
  review_pending: "Chờ giáo viên duyệt", verified: "Đã xác nhận", result_achieved: "Hoàn thành", blocked: "Cần xem lại"
};
const TABS = [
  { key: "brief", label: "01 · Hiểu nhiệm vụ" }, { key: "work", label: "02 · Làm việc" },
  { key: "evidence", label: "03 · Evidence" }, { key: "result", label: "04 · Kết quả" }
] as const;
type TabKey = typeof TABS[number]["key"];

const POLICY_LABEL: Record<string, string> = {
  self_reported: "Tự đánh giá", metric_based: "Theo chỉ số", evidence_required: "Cần Evidence", teacher_verified: "Teacher review"
};

export function MissionWorkspaceClient({ missionId, initialView }: { missionId: string; initialView: View }) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [tab, setTab] = useState<TabKey>("brief");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceLink, setEvidenceLink] = useState("");

  async function refresh() {
    const res = await fetch(`/api/student/mission-workspace?missionId=${missionId}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (json?.view) setView(json.view);
  }

  async function post(url: string, body: unknown): Promise<boolean> {
    setBusy(true); setMessage(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setMessage(json?.error ?? "Thao tác thất bại."); return false; }
      await refresh();
      return true;
    } catch { setMessage("Mất kết nối — thử lại."); return false; }
    finally { setBusy(false); }
  }

  async function saveBlock(blockId: string, value: unknown) {
    setSaving(true);
    setView((v) => ({ ...v, values: [...v.values.filter((x) => x.blockId !== blockId), { blockId, value, status: "saved", updatedAt: new Date().toISOString() }] }));
    await fetch("/api/student/mission-workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId, blockId, value, status: "saved" }) });
    await refresh();
    setSaving(false);
  }

  const mission = view.mission;
  const started = mission.actions.length > 0;
  const needsEvidence = mission.completionPolicy !== "self_reported" && mission.completionPolicy !== "metric_based";
  const canSubmitEvidence = needsEvidence && started && !DONE_STATES.includes(mission.displayState) && mission.displayState !== "review_pending";
  const valueByBlock = useMemo(() => new Map(view.values.map((v) => [v.blockId, v.value])), [view.values]);
  const resourceBindingsForBlocks = mission.resourceBindings.map((b) => ({ id: b.id, title: b.title }));
  const toolBindingsForBlocks = mission.toolBindings.map((b) => ({ id: b.id, title: b.toolType ?? "" }));
  const requiredActions = mission.actions.filter((a) => a.required);
  const requiredDone = requiredActions.filter((a) => a.status === "completed").length;

  if (mission.displayState === "locked") return <>
    <Link href="/student/courses" className="h2o-sr-back">← Quay lại Roadmap</Link>
    <section className="h2o-sr-panel" style={{ padding: 26, maxWidth: 560 }}>
      <div className="h2o-sr-eyebrow">Universal Mission Workspace</div>
      <h1 style={{ fontSize: 22, margin: "6px 0 8px" }}>🔒 {mission.title}</h1>
      <p style={{ color: "#718092", fontSize: 13, lineHeight: 1.7, margin: 0 }}>{mission.lockedReason ?? "Mission này chưa mở."}</p>
    </section>
  </>;

  return <>
    <Link href="/student/courses" className="h2o-sr-back">← Quay lại Roadmap</Link>

    <section className="h2o-student-page-head">
      <div>
        <span>UNIVERSAL MISSION WORKSPACE</span>
        <h1>{mission.title}</h1>
        <p>Không gian làm việc đồng bộ trực tiếp với Roadmap.</p>
      </div>
      <div className="h2o-sr-chips">
        <span className={`h2o-sr-chip${DONE_STATES.includes(mission.displayState) ? " good" : mission.displayState === "review_pending" ? " warn" : ""}`}>● {STATE_LABEL[mission.displayState]}</span>
        {mission.estimatedDays != null && <span className="h2o-sr-chip">Ước tính {mission.estimatedDays} ngày</span>}
        <span className="h2o-sr-chip">{POLICY_LABEL[mission.completionPolicy] ?? mission.completionPolicy}</span>
      </div>
    </section>

    {message && <div className="h2o-sr-panel" style={{ padding: 10, fontSize: 12, marginBottom: 12 }}>{message}</div>}

    <div className="h2o-sr-shell">
      <aside className="h2o-sr-panel h2o-sr-context">
        <div className="h2o-sr-eyebrow">Journey Context</div>
        <h3 style={{ margin: "5px 0 10px", fontSize: 15 }}>{view.stage.indexLabel ? `Giai đoạn ${view.stage.indexLabel} · ` : ""}{view.stage.title}</h3>
        {view.siblings.map((s) => {
          const isCurrent = s.id === mission.id;
          const done = DONE_STATES.includes(s.displayState);
          const locked = s.displayState === "locked";
          const icon = done ? "✓" : locked ? "🔒" : "●";
          const cls = `h2o-sr-ctxitem${isCurrent ? " active" : ""}${locked ? " locked" : ""}`;
          return <button key={s.id} className={cls} onClick={() => { if (!isCurrent) router.push(`/student/missions/${s.id}`); }}>
            <b>{icon} {s.title}</b>
            <small>{isCurrent ? "Bạn đang ở đây" : locked ? (s.lockedReason ?? "Chưa mở") : done ? "Đã hoàn thành" : STATE_LABEL[s.displayState]}</small>
          </button>;
        })}
      </aside>

      <section className="h2o-sr-panel h2o-sr-work">
        <div className="h2o-sr-missionhead">
          <div className="h2o-sr-eyebrow">Mission Workspace</div>
          <h2>{mission.title}</h2>
          {mission.description && <p className="sub">{mission.description}</p>}
          <div className="h2o-sr-meta">
            {mission.expectedResult && <span className="h2o-sr-chip">🎯 {mission.expectedResult}</span>}
            {mission.resourceBindings.length > 0 && <span className="h2o-sr-chip">📎 {mission.resourceBindings.length} tài liệu</span>}
            {mission.actionTemplates.length > 0 && <span className="h2o-sr-chip">✓ {mission.actionTemplates.length} bước</span>}
          </div>
          <div className="h2o-sr-objective">
            <div className="box">
              <b>Expected Result</b>
              <p>{mission.expectedResult || "Mission này chưa mô tả kết quả mong đợi."}</p>
            </div>
            <div className="h2o-sr-score">
              <small>Mission Readiness</small>
              <strong>{view.readiness.score}</strong>
              <small>/100{view.readiness.missingRequiredBlockIds.length ? ` · còn ${view.readiness.missingRequiredBlockIds.length} mục` : ""}</small>
            </div>
          </div>
        </div>

        <div className="h2o-sr-tabs">
          {TABS.map((t) => <button key={t.key} className={`h2o-sr-tab${t.key === tab ? " active" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
        </div>

        {tab === "brief" && <div className="h2o-sr-pane">
          {(mission.resourceBindings.length > 0 || mission.toolBindings.length > 0) && <div className="h2o-sr-section">
            <h4>Kiến thức cần dùng</h4>
            {mission.resourceBindings.map((r) => <Link key={r.id} href={r.resourceType === "document" ? `/student/document/${r.resourceId}` : "/student/library"} className="h2o-sr-doc">
              <div className="h2o-sr-docicon">📘</div>
              <div><b>{r.title}</b><small>Tài liệu · {r.role === "required" ? "bắt buộc" : "đề xuất"}</small></div>
              <span>→</span>
            </Link>)}
            {mission.toolBindings.map((t) => <div key={t.id} className="h2o-sr-doc">
              <div className="h2o-sr-docicon">🧮</div>
              <div><b>{t.toolType}</b><small>Công cụ · {t.role === "required" ? "bắt buộc" : "đề xuất"}</small></div>
              <span>→</span>
            </div>)}
          </div>}

          {mission.actionTemplates.length > 0 && <div className="h2o-sr-section">
            <h4>Lộ trình thực hiện</h4>
            {started
              ? mission.actions.map((a) => <div key={a.id} className="h2o-sr-task">
                  <input type="checkbox" checked={a.status === "completed"} disabled={busy} onChange={(e) => post("/api/student/journey/action", { actionId: a.id, status: e.target.checked ? "completed" : "planned" })} />
                  <div><b>{a.title}</b>{a.evidenceRequired && <p>Cần nộp bằng chứng.</p>}</div>
                  <span style={{ fontSize: 11, color: a.status === "completed" ? "#12a67a" : "#718092" }}>{a.status === "completed" ? "✓" : a.required ? "bắt buộc" : "tùy chọn"}</span>
                </div>)
              : mission.actionTemplates.map((t) => <div key={t.id} className="h2o-sr-task">
                  <input type="checkbox" disabled />
                  <div><b>{t.title}</b>{t.description && <p>{t.description}</p>}</div>
                  <span style={{ fontSize: 11, color: "#718092" }}>{t.required ? "bắt buộc" : "tùy chọn"}</span>
                </div>)}
          </div>}

          <div className="h2o-sr-section">
            <h4>Success criteria</h4>
            {mission.successCriteria.length
              ? mission.successCriteria.map((c, i) => <div key={i} style={{ fontSize: 12, padding: "6px 0", borderBottom: i < mission.successCriteria.length - 1 ? "1px solid #eef1f4" : undefined }}>· {c}</div>)
              : <p style={{ fontSize: 12, color: "#718092", margin: "8px 0 0" }}>Chưa có tiêu chí thành công cho mission này.</p>}
          </div>

          {!started && <div className="h2o-sr-cta"><button className="h2o-sr-btn primary" disabled={busy} onClick={() => post("/api/student/journey/mission", { action: "start", missionId, blueprintVersionId: view.versionId })}>Bắt đầu Mission</button></div>}
        </div>}

        {tab === "work" && <div className="h2o-sr-pane">
          {!started
            ? <div className="h2o-sr-section" style={{ textAlign: "center" }}>
                <p style={{ fontSize: 13, margin: "0 0 10px" }}>Bắt đầu Mission trước khi làm việc.</p>
                <button className="h2o-sr-btn primary" disabled={busy} onClick={() => post("/api/student/journey/mission", { action: "start", missionId, blueprintVersionId: view.versionId })}>Bắt đầu Mission</button>
              </div>
            : <>
                {view.blocks.length === 0
                  ? <div className="h2o-sr-section"><p style={{ fontSize: 12, color: "#718092", margin: 0 }}>Mission này chưa có nội dung &ldquo;Làm việc&rdquo; nào được cấu hình. Bạn vẫn có thể hoàn thành các bước ở tab 01 và nộp kết quả ở tab 03.</p></div>
                  : <div className="h2o-sr-section">
                      <h4>{mission.title} · Workspace</h4>
                      {view.blocks.map((block) => <MissionBlockField key={block.id} block={block} value={valueByBlock.get(block.id)} onSave={saveBlock}
                        onNavigate={(t) => setTab(t === "result" ? "result" : "evidence")}
                        resourceBindings={resourceBindingsForBlocks} toolBindings={toolBindingsForBlocks} disabled={busy} />)}
                    </div>}
                <div className="h2o-sr-cta">
                  {needsEvidence
                    ? <button className="h2o-sr-btn primary" onClick={() => setTab("evidence")}>Tiếp tục → Evidence</button>
                    : !DONE_STATES.includes(mission.displayState) && <button className="h2o-sr-btn primary" disabled={busy} onClick={() => post("/api/student/journey/mission", { action: "completeSelf", missionId, blueprintVersionId: view.versionId })}>Đánh dấu hoàn thành</button>}
                </div>
              </>}
        </div>}

        {tab === "evidence" && <div className="h2o-sr-pane">
          <div className="h2o-sr-section">
            <h4>Evidence {mission.completionPolicy === "teacher_verified" ? "· cần giáo viên xác nhận" : ""}</h4>
            {canSubmitEvidence ? <>
              <div className="h2o-sr-field">
                <label>Mô tả bằng chứng</label>
                <textarea value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} placeholder="Mô tả bằng chứng đã hoàn thành (ảnh Before/After, ghi chú...)" />
              </div>
              <div className="h2o-sr-field">
                <label>Link ảnh / file (tùy chọn)</label>
                <input value={evidenceLink} onChange={(e) => setEvidenceLink(e.target.value)} placeholder="Dán link ảnh hoặc file" />
              </div>
              <div className="h2o-sr-cta">
                <button className="h2o-sr-btn primary" disabled={busy || (!evidenceNote.trim() && !evidenceLink.trim())}
                  onClick={async () => {
                    const note = [evidenceNote.trim(), evidenceLink.trim()].filter(Boolean).join(" · ");
                    const ok = await post("/api/student/journey/evidence", { missionId, blueprintVersionId: view.versionId, note });
                    if (ok) { setEvidenceNote(""); setEvidenceLink(""); setTab("result"); }
                  }}>Nộp Evidence</button>
              </div>
            </> : <p style={{ fontSize: 12, color: "#718092", margin: "8px 0 0" }}>
              {!started ? "Bắt đầu Mission trước khi nộp evidence."
                : mission.displayState === "review_pending" ? "Đã nộp — đang chờ giáo viên duyệt."
                : DONE_STATES.includes(mission.displayState) ? "Đã được xác nhận."
                : "Mission này không cần evidence."}
            </p>}
          </div>

          {mission.evidence.length > 0 && <div className="h2o-sr-section">
            <h4>Đã nộp ({mission.evidence.length})</h4>
            {mission.evidence.map((e, i) => <div key={i} className="h2o-sr-task">
              <span style={{ fontSize: 14 }}>📎</span>
              <div><b>{e.note || "(không có ghi chú)"}</b><p>{new Date(e.submittedAt).toLocaleString("vi-VN")}</p></div>
              <span />
            </div>)}
          </div>}
        </div>}

        {tab === "result" && <div className="h2o-sr-pane">
          <div className="h2o-sr-section">
            <h4>Mission Result Card</h4>
            <div className="h2o-sr-resultcard">
              <b>{mission.title}</b>
              <p>{mission.expectedResult || "—"}</p>
              <div className="h2o-sr-resultgrid">
                <div><small>Hành động bắt buộc</small><b>{requiredDone}/{requiredActions.length}</b></div>
                <div><small>Evidence</small><b>{mission.evidence.length}</b></div>
                <div><small>Readiness</small><b>{view.readiness.score}/100</b></div>
                <div><small>Trạng thái</small><b style={{ fontSize: 12 }}>{STATE_LABEL[mission.displayState]}</b></div>
              </div>
              {(mission.verifiedAt || mission.resultAchievedAt) && <p style={{ marginTop: 10 }}>
                {mission.verifiedAt && `Xác nhận: ${new Date(mission.verifiedAt).toLocaleDateString("vi-VN")}`}
                {mission.verifiedAt && mission.resultAchievedAt && " · "}
                {mission.resultAchievedAt && `Hoàn thành: ${new Date(mission.resultAchievedAt).toLocaleDateString("vi-VN")}`}
              </p>}
            </div>
            {!DONE_STATES.includes(mission.displayState) && <p style={{ fontSize: 12, color: "#718092", marginTop: 10 }}>
              Kết quả sẽ được chốt khi {needsEvidence ? "bằng chứng được xác nhận" : "bạn đánh dấu hoàn thành"}.
            </p>}
          </div>
        </div>}

        <div className="h2o-sr-footer">
          <small>{saving ? "● Đang lưu..." : "● Tự động lưu · Roadmap cập nhật theo thời gian thực"}</small>
          {tab !== "result" && <button className="h2o-sr-btn primary" onClick={() => setTab(TABS[TABS.findIndex((t) => t.key === tab) + 1].key)}>Tiếp tục nhiệm vụ</button>}
        </div>
      </section>

      <aside className="h2o-sr-panel h2o-sr-aside">
        <div className="h2o-sr-aihead">
          <div className="h2o-sr-brain">H₂</div>
          <div><b>H2O Mission AI</b><br /><small>Contextual Mission Coach</small></div>
        </div>
        <div className="h2o-sr-aisection">
          <h4>Việc cần làm tiếp</h4>
          <div className="h2o-sr-next">
            <b>{view.readiness.missingRequiredBlockIds.length
              ? `Còn ${view.readiness.missingRequiredBlockIds.length} mục bắt buộc chưa điền`
              : requiredDone < requiredActions.length ? `Còn ${requiredActions.length - requiredDone} bước bắt buộc`
              : needsEvidence && !mission.evidence.length ? "Nộp bằng chứng để hoàn thành"
              : "Đã đủ điều kiện hoàn thành"}</b>
            <small>Readiness sẽ tự tăng khi bạn hoàn thành.</small>
            <button className="h2o-sr-aibtn" onClick={() => setTab(view.readiness.missingRequiredBlockIds.length ? "work" : needsEvidence ? "evidence" : "work")}>Đi tới phần cần làm</button>
          </div>
        </div>
        <div className="h2o-sr-aisection">
          <h4>Success Check</h4>
          <div className="h2o-sr-insight">
            {mission.successCriteria.length
              ? mission.successCriteria.map((c, i) => <div key={i}>○ {c}</div>)
              : "Chưa có tiêu chí thành công cho mission này."}
          </div>
        </div>
        <div className="h2o-sr-aisection">
          <h4>Roadmap Impact</h4>
          <div className="h2o-sr-insight">
            {view.unlocksMissionTitle
              ? <>Hoàn thành Mission này sẽ mở khóa <b>&ldquo;{view.unlocksMissionTitle}&rdquo;</b>. Outcome <b>{view.outcome.title}</b> hiện đạt {view.outcomeProgressPercent}%.</>
              : <>Outcome <b>{view.outcome.title}</b> hiện đạt {view.outcomeProgressPercent}% · toàn hành trình {view.journeyProgressPercent}%.</>}
          </div>
        </div>
        <div className="h2o-sr-aisection">
          <h4>Gợi ý thông minh</h4>
          <div className="h2o-sr-insight">H2O Mentor tạm thời không khả dụng.</div>
        </div>
      </aside>
    </div>
  </>;
}
