"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, Lock } from "lucide-react";
import { MissionBlockField, type StudentBlockValue, type StudentMissionBlock } from "./mission-block-field";

type DisplayState = "locked" | "available" | "not_started" | "learning" | "planning" | "doing" | "evidence_pending" | "review_pending" | "verified" | "result_achieved" | "blocked";
type ResolvedBinding = { id: string; toolType?: string; title?: string; role: string };
type Mission = {
  id: string; title: string; description: string; expectedResult: string; completionPolicy: string;
  successCriteria: string[]; displayState: DisplayState; lockedReason: string | null;
  resourceBindings: (ResolvedBinding & { title: string })[]; toolBindings: ResolvedBinding[];
  actionTemplates: { id: string; title: string; required: boolean }[];
  actions: { id: string; title: string; required: boolean; evidenceRequired: boolean; status: string }[];
  evidence: { note?: string; assetId?: string; submittedAt: string }[];
  evidenceSubmittedAt: string | null; verifiedAt: string | null; resultAchievedAt: string | null;
};
type View = {
  stage: { id: string; title: string; indexLabel: string };
  outcome: { id: string; title: string }; milestone: { id: string; title: string };
  mission: Mission; versionId: string; blueprintTitle: string | null; journeyProgressPercent: number;
  blocks: StudentMissionBlock[]; values: StudentBlockValue[]; readiness: { score: number; missingRequiredBlockIds: string[] };
};

const STATE_LABEL: Record<DisplayState, string> = {
  locked: "Đang khóa", available: "Sẵn sàng bắt đầu", not_started: "Sẵn sàng bắt đầu", learning: "Đang học",
  planning: "Đang lên kế hoạch", doing: "Đang thực hiện", evidence_pending: "Chờ nộp bằng chứng",
  review_pending: "Chờ giáo viên duyệt", verified: "Đã xác nhận", result_achieved: "Hoàn thành", blocked: "Cần xem lại"
};
const STATE_COLOR: Record<DisplayState, string> = {
  locked: "#94a3b8", available: "#2563eb", not_started: "#2563eb", learning: "#2563eb", planning: "#2563eb",
  doing: "#d97706", evidence_pending: "#d97706", review_pending: "#7c3aed", verified: "#16a34a",
  result_achieved: "#16a34a", blocked: "#dc2626"
};
const TABS = [
  { key: "hieu", label: "Hiểu nhiệm vụ" }, { key: "lam-viec", label: "Làm việc" },
  { key: "evidence", label: "Evidence" }, { key: "ket-qua", label: "Kết quả" }
] as const;
type TabKey = typeof TABS[number]["key"];

export function MissionWorkspaceClient({ missionId, initialView }: { missionId: string; initialView: View }) {
  const [view, setView] = useState<View>(initialView);
  const [tab, setTab] = useState<TabKey>("hieu");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [evidenceNote, setEvidenceNote] = useState("");

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
    await fetch("/api/student/mission-workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId, blockId, value, status: "saved" }) });
    setView((v) => ({ ...v, values: [...v.values.filter((x) => x.blockId !== blockId), { blockId, value, status: "saved", updatedAt: new Date().toISOString() }] }));
  }

  const mission = view.mission;
  const started = mission.actions.length > 0;
  const needsEvidence = mission.completionPolicy !== "self_reported" && mission.completionPolicy !== "metric_based";
  const canSubmitEvidence = needsEvidence && ["doing", "learning", "planning", "evidence_pending"].includes(mission.displayState);
  const valueByBlock = useMemo(() => new Map(view.values.map((v) => [v.blockId, v.value])), [view.values]);
  const resourceBindingsForBlocks = mission.resourceBindings.map((b) => ({ id: b.id, title: b.title }));
  const toolBindingsForBlocks = mission.toolBindings.map((b) => ({ id: b.id, title: b.toolType ?? "" }));

  if (mission.displayState === "locked") return <div className="h2o-student-page-head">
    <div>
      <Link href="/student/courses" style={{ fontSize: 12, color: "#6b7a89", display: "inline-flex", gap: 4, alignItems: "center", marginBottom: 8 }}><ArrowLeft size={13} /> Về Roadmap</Link>
      <h1 style={{ display: "flex", gap: 8, alignItems: "center" }}><Lock size={18} color="#94a3b8" /> {mission.title}</h1>
      <p>{mission.lockedReason ?? "Mission này chưa mở."}</p>
    </div>
  </div>;

  return <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 260px", gap: 20, alignItems: "start" }} className="h2o-mission-workspace-grid">
    {/* LEFT: Journey Context */}
    <aside style={{ position: "sticky", top: 12 }}>
      <Link href="/student/courses" style={{ fontSize: 12, color: "#6b7a89", display: "inline-flex", gap: 4, alignItems: "center", marginBottom: 12 }}><ArrowLeft size={13} /> Về Roadmap</Link>
      <p style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", margin: "0 0 2px" }}>{view.stage.indexLabel ? `Giai đoạn ${view.stage.indexLabel}` : "Giai đoạn"}</p>
      <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 10px" }}>{view.stage.title}</p>
      <div style={{ fontSize: 11, color: "#6b7a89", marginBottom: 4 }}>{view.outcome.title}</div>
      <div style={{ fontSize: 11, color: "#6b7a89", marginBottom: 10 }}>› {view.milestone.title}</div>
      <div style={{ background: "#eef1f4", borderRadius: 999, height: 6, overflow: "hidden", marginBottom: 4 }}><div style={{ width: `${view.journeyProgressPercent}%`, height: "100%", background: "#2563eb" }} /></div>
      <p style={{ fontSize: 11, color: "#6b7a89" }}>{view.journeyProgressPercent}% hành trình</p>
    </aside>

    {/* CENTER: Workspace */}
    <main>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: STATE_COLOR[mission.displayState], fontWeight: 600 }}>{STATE_LABEL[mission.displayState]}</span>
        <h1 style={{ margin: "4px 0 4px", fontSize: 20 }}>{mission.title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, maxWidth: 160, background: "#eef1f4", borderRadius: 999, height: 6, overflow: "hidden" }}><div style={{ width: `${view.readiness.score}%`, height: "100%", background: "#16a34a" }} /></div>
          <span style={{ fontSize: 11, color: "#6b7a89" }}>Sẵn sàng {view.readiness.score}%</span>
        </div>
      </div>

      {message && <div className="h2o-student-card" style={{ padding: 10, fontSize: 12, marginBottom: 12 }}>{message}</div>}

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e5e9ee", marginBottom: 16 }}>
        {TABS.map((t) => <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "8px 12px", border: "none", borderBottom: t.key === tab ? "2px solid #2563eb" : "2px solid transparent", background: "none", cursor: "pointer", fontSize: 13, fontWeight: t.key === tab ? 600 : 400, color: t.key === tab ? "#0f172a" : "#6b7a89" }}>{t.label}</button>)}
      </div>

      {tab === "hieu" && <div>
        <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 2px" }}>Expected result</p>
        <p style={{ fontSize: 13, margin: "0 0 14px" }}>{mission.expectedResult || "—"}</p>
        {mission.description && <><p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 2px" }}>Vì sao mission này quan trọng</p><p style={{ fontSize: 13, margin: "0 0 14px" }}>{mission.description}</p></>}
        {mission.resourceBindings.length > 0 && <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600 }}>Cần học</p>
          {mission.resourceBindings.map((r) => <Link key={r.id} href="/student/library" style={{ display: "block", fontSize: 13, color: "#2563eb", padding: "4px 0" }}>{r.title}{r.role === "recommended" ? " (gợi ý)" : ""}</Link>)}
        </div>}
        {mission.toolBindings.length > 0 && <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600 }}>Công cụ</p>
          {mission.toolBindings.map((t) => <div key={t.id} style={{ fontSize: 13 }}>{t.toolType}</div>)}
        </div>}
        {mission.actionTemplates.length > 0 && <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600 }}>Các bước cần làm</p>
          {mission.actionTemplates.map((t) => <div key={t.id} style={{ fontSize: 13, padding: "4px 0", color: "#6b7a89" }}>{t.title}{t.required ? "" : " (tùy chọn)"}</div>)}
        </div>}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600 }}>Success criteria</p>
          {mission.successCriteria.length ? mission.successCriteria.map((c, i) => <div key={i} style={{ fontSize: 13 }}>· {c}</div>) : <p style={{ fontSize: 12, color: "#6b7a89" }}>Chưa có success KPI cho mission này.</p>}
        </div>
        {!started && <button disabled={busy} onClick={() => post("/api/student/journey/mission", { action: "start", missionId, blueprintVersionId: view.versionId })} className="h2o-student-primary">Start Mission <Clock3 size={14} /></button>}
        {started && <button onClick={() => setTab("lam-viec")} className="h2o-student-primary">Tiếp tục ở tab Làm việc</button>}
      </div>}

      {tab === "lam-viec" && <div>
        {!started
          ? <div className="h2o-student-card" style={{ padding: 16, textAlign: "center" }}>
              <p style={{ fontSize: 13, margin: "0 0 8px" }}>Bắt đầu Mission trước khi làm việc.</p>
              <button disabled={busy} onClick={() => post("/api/student/journey/mission", { action: "start", missionId, blueprintVersionId: view.versionId })} className="h2o-student-primary">Start Mission</button>
            </div>
          : <>
              {mission.actions.length > 0 && <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600 }}>Kế hoạch hành động</p>
                {mission.actions.map((a) => <label key={a.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "4px 0" }}>
                  <input type="checkbox" checked={a.status === "completed"} disabled={busy} onChange={(e) => post("/api/student/journey/action", { actionId: a.id, status: e.target.checked ? "completed" : "planned" })} />
                  <span style={{ textDecoration: a.status === "completed" ? "line-through" : "none", color: a.status === "completed" ? "#94a3b8" : "#0f172a" }}>{a.title}{a.required ? "" : " (tùy chọn)"}{a.evidenceRequired ? " · cần evidence" : ""}</span>
                </label>)}
              </div>}
              {view.blocks.length === 0
                ? <p style={{ fontSize: 12, color: "#6b7a89" }}>Mission này chưa có nội dung &quot;Làm việc&quot; nào được cấu hình.</p>
                : view.blocks.map((block) => <MissionBlockField key={block.id} block={block} value={valueByBlock.get(block.id)} onSave={saveBlock} onNavigate={(t) => setTab(t === "result" ? "ket-qua" : "evidence")}
                    resourceBindings={resourceBindingsForBlocks} toolBindings={toolBindingsForBlocks} disabled={busy} />)}
              {mission.completionPolicy === "self_reported" || mission.completionPolicy === "metric_based"
                ? mission.displayState !== "result_achieved" && <button disabled={busy} onClick={() => post("/api/student/journey/mission", { action: "completeSelf", missionId, blueprintVersionId: view.versionId })} className="h2o-student-primary" style={{ marginTop: 10 }}>Đánh dấu hoàn thành</button>
                : <p style={{ fontSize: 12, color: "#6b7a89", marginTop: 10 }}>Mission này cần nộp Evidence — sang tab Evidence khi đã sẵn sàng.</p>}
            </>}
      </div>}

      {tab === "evidence" && <div>
        <p style={{ fontSize: 12, fontWeight: 600 }}>Evidence {mission.completionPolicy === "teacher_verified" ? "(cần giáo viên xác nhận)" : ""}</p>
        {canSubmitEvidence
          ? <>
              <textarea value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} placeholder="Mô tả bằng chứng đã hoàn thành (ảnh Before/After, ghi chú...)" style={{ width: "100%", minHeight: 70, padding: 8, borderRadius: 8, border: "1px solid #dfe3e8", fontSize: 12 }} />
              <button disabled={busy || !evidenceNote.trim()} onClick={async () => { const ok = await post("/api/student/journey/evidence", { missionId, blueprintVersionId: view.versionId, note: evidenceNote }); if (ok) setEvidenceNote(""); }} className="h2o-student-primary" style={{ marginTop: 6 }}>Nộp Evidence</button>
            </>
          : !started ? <p style={{ fontSize: 12, color: "#6b7a89" }}>Bắt đầu Mission trước khi nộp evidence.</p>
          : <p style={{ fontSize: 12, color: "#6b7a89" }}>{mission.displayState === "review_pending" ? "Đã nộp — đang chờ giáo viên duyệt." : mission.displayState === "verified" || mission.displayState === "result_achieved" ? "Đã được xác nhận." : !needsEvidence ? "Mission này không cần evidence." : ""}</p>}
        {mission.evidence.length > 0 && <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600 }}>Lịch sử đã nộp</p>
          {mission.evidence.map((e, i) => <div key={i} className="h2o-student-card" style={{ padding: 10, fontSize: 12, marginBottom: 6 }}>
            <div style={{ color: "#94a3b8", fontSize: 10 }}>{new Date(e.submittedAt).toLocaleString("vi-VN")}</div>
            <div>{e.note || "(không có ghi chú)"}</div>
          </div>)}
        </div>}
      </div>}

      {tab === "ket-qua" && <div>
        <div className="h2o-student-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>{view.blueprintTitle}</p>
              <h3 style={{ margin: "2px 0", fontSize: 16 }}>{mission.title}</h3>
            </div>
            {(mission.displayState === "verified" || mission.displayState === "result_achieved") && <CheckCircle2 size={20} color="#16a34a" />}
          </div>
          <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Trạng thái</span><strong style={{ color: STATE_COLOR[mission.displayState] }}>{STATE_LABEL[mission.displayState]}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Hành động bắt buộc</span><strong>{mission.actions.filter((a) => a.required && a.status === "completed").length}/{mission.actions.filter((a) => a.required).length}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Số lần nộp Evidence</span><strong>{mission.evidence.length}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Sẵn sàng</span><strong>{view.readiness.score}%</strong></div>
            {mission.verifiedAt && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Đã xác nhận lúc</span><strong>{new Date(mission.verifiedAt).toLocaleDateString("vi-VN")}</strong></div>}
            {mission.resultAchievedAt && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Hoàn thành lúc</span><strong>{new Date(mission.resultAchievedAt).toLocaleDateString("vi-VN")}</strong></div>}
          </div>
        </div>
      </div>}
    </main>

    {/* RIGHT: H2O Mission AI — Release 4, not built yet */}
    <aside className="h2o-student-card" style={{ padding: 14, position: "sticky", top: 12 }}>
      <strong style={{ fontSize: 12 }}>H2O Mission AI</strong>
      <p style={{ fontSize: 12, color: "#6b7a89", marginTop: 8 }}>H2O Mentor tạm thời không khả dụng.</p>
    </aside>
  </div>;
}
