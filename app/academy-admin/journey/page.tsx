"use client";
import { useEffect, useState } from "react";
import { Plus, RefreshCw, CheckCircle2, Archive, Copy, AlertTriangle } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type Stage = { id: string; title: string; indexLabel: string };
type Blueprint = { id: string; stageId: string; title: string; currentPublishedVersionId: string | null };
type Version = { id: string; blueprintId: string; versionNumber: number; status: "draft" | "published" | "archived"; publishedAt: string | null };
type Binding = { id: string; role: string; resourceType?: string; resourceId?: string; toolType?: string; toolId?: string; assignmentId?: string };
type ActionTemplate = { id: string; title: string; required: boolean; dayOffset: number | null; evidenceRequired: boolean };
type Mission = {
  id: string; title: string; description: string; expectedResult: string; estimatedDays: number | null;
  completionPolicy: string; successCriteria: string[]; position: number;
  resourceBindings: Binding[]; toolBindings: Binding[]; assignmentBindings: Binding[]; actionTemplates: ActionTemplate[];
};
type Milestone = { id: string; title: string; description: string; missions: Mission[] };
type Outcome = { id: string; title: string; description: string; milestones: Milestone[] };
type Preflight = { ok: boolean; blockers: string[]; warnings: string[] };

const field = { padding: 8, borderRadius: 8, border: "1px solid #dfe3e8", fontSize: 12, width: "100%" } as const;
const STATUS_LABEL: Record<string, string> = { draft: "Nháp", published: "Đã publish", archived: "Đã lưu trữ" };

export default function JourneyMapAdminPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [stageId, setStageId] = useState("");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/academy-admin/stages", { cache: "no-store" }).then((r) => r.json()).then((json) => {
      const list = (json?.stages ?? []).map((s: { id: string; title: string; indexLabel?: string }) => ({ id: s.id, title: s.title, indexLabel: s.indexLabel ?? "" }));
      setStages(list);
      if (list[0]) setStageId(list[0].id);
    }).catch(() => null);
  }, []);

  async function loadJourney(forStageId: string, forVersionId?: string) {
    if (!forStageId) return;
    setLoading(true); setPreflight(null); setSelectedMissionId(null);
    const url = new URL("/api/academy-admin/learn-outcome", window.location.origin);
    url.searchParams.set("stageId", forStageId);
    if (forVersionId) url.searchParams.set("versionId", forVersionId);
    const json = await fetch(url, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    setBlueprint(json?.blueprint ?? null);
    setVersions(json?.versions ?? []);
    setVersionId(json?.selectedVersionId ?? null);
    setOutcomes(json?.outcomes ?? []);
    setLoading(false);
  }

  useEffect(() => { if (stageId) loadJourney(stageId); }, [stageId]);

  async function call(url: string, body: unknown, okMessage: string, reload = true): Promise<boolean> {
    setBusy(true); setMessage(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setMessage(json?.error ?? "Thao tác thất bại."); return false; }
      setMessage(okMessage);
      if (reload) await loadJourney(stageId, versionId ?? undefined);
      return true;
    } catch {
      setMessage("Mất kết nối — thử lại.");
      return false;
    } finally { setBusy(false); }
  }

  const currentVersion = versions.find((v) => v.id === versionId);
  const isDraft = currentVersion?.status === "draft";
  const selectedMission = outcomes.flatMap((o) => o.milestones.flatMap((m) => m.missions)).find((m) => m.id === selectedMissionId) ?? null;

  return <SimpleOperationsShell title="Academy Control" subtitle="Journey Map Builder" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="ĐÀO TẠO">
    <div className="page-header"><div><h1>Journey Map — Outcome/Mission Builder</h1><p style={{ fontSize: 12, color: "#6b7a89" }}>Lớp thực thi bổ sung cho giáo trình hiện có — không thay thế Stage/Program/Module/Group. Xem docs/learn-outcome-os/01_CURRENT_LEARN_AUDIT.md để biết vì sao phần lớn nội dung của Learn đã có sẵn ở nơi khác.</p></div></div>
    {message && <div className={styles.card} style={{ marginBottom: 12, padding: 10, fontSize: 12 }}>{message}</div>}

    <section className={styles.card} style={{ marginBottom: 16 }}>
      <div className={styles.cardBody} style={{ padding: 16, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Giai đoạn
          <select value={stageId} onChange={(e) => setStageId(e.target.value)} style={field}>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.indexLabel ? `${s.indexLabel} — ` : ""}{s.title}</option>)}
          </select>
        </label>
        {blueprint
          ? <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Phiên bản
              <select value={versionId ?? ""} onChange={(e) => loadJourney(stageId, e.target.value)} style={field}>
                {versions.map((v) => <option key={v.id} value={v.id}>v{v.versionNumber} — {STATUS_LABEL[v.status]}</option>)}
              </select>
            </label>
          : <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !stageId} onClick={() => call("/api/academy-admin/learn-outcome", { stageId }, "Đã tạo Journey Map (nháp v1).")}><Plus size={14}/>Tạo Journey Map cho giai đoạn này</button>}
      </div>
      {blueprint && <div style={{ padding: "0 16px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={styles.button} disabled={busy || !versionId} onClick={() => call("/api/academy-admin/learn-outcome/version", { action: "duplicate", blueprintId: blueprint.id, versionId }, "Đã tạo phiên bản nháp mới.")}><Copy size={14}/>Nhân bản thành phiên bản mới</button>
        <button className={styles.button} disabled={busy || !versionId} onClick={async () => {
          setBusy(true);
          const res = await fetch("/api/academy-admin/learn-outcome/version", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "preflight", versionId }) });
          const json = await res.json().catch(() => null);
          setPreflight(json); setBusy(false);
        }}><RefreshCw size={14}/>Kiểm tra trước khi publish</button>
        {isDraft && <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !versionId} onClick={() => call("/api/academy-admin/learn-outcome/version", { action: "publish", blueprintId: blueprint.id, versionId }, "Đã publish. Học viên chưa thấy — chưa bật cutover Tab 1.")}><CheckCircle2 size={14}/>Publish phiên bản này</button>}
        {currentVersion?.status === "published" && <button className={styles.button} disabled={busy || !versionId} onClick={() => call("/api/academy-admin/learn-outcome/version", { action: "archive", versionId }, "Đã lưu trữ phiên bản.")}><Archive size={14}/>Lưu trữ</button>}
      </div>}
    </section>

    {preflight && <section className={styles.card} style={{ marginBottom: 16 }}>
      <div className={styles.cardBody} style={{ padding: 16 }}>
        <strong style={{ color: preflight.ok ? "#1a7f37" : "#b42318" }}>{preflight.ok ? "Sẵn sàng publish — không có blocker." : `${preflight.blockers.length} blocker cần sửa trước khi publish`}</strong>
        {preflight.blockers.length > 0 && <ul style={{ margin: "8px 0 0", fontSize: 12, color: "#b42318" }}>{preflight.blockers.map((b, i) => <li key={i}><AlertTriangle size={11} style={{ verticalAlign: "-1px" }}/> {b}</li>)}</ul>}
        {preflight.warnings.length > 0 && <ul style={{ margin: "8px 0 0", fontSize: 12, color: "#94720f" }}>{preflight.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}</ul>}
      </div>
    </section>}

    {loading ? <p style={{ fontSize: 12 }}>Đang tải...</p> : blueprint && <div style={{ display: "grid", gridTemplateColumns: selectedMission ? "1.1fr 0.9fr" : "1fr", gap: 16 }}>
      <section className={styles.card}>
        <div className={styles.cardHead}><div><h2>Outcome → Milestone → Mission</h2></div></div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          {outcomes.map((outcome) => <div key={outcome.id} style={{ border: "1px solid #e5e9ee", borderRadius: 10, padding: 10 }}>
            <strong style={{ fontSize: 13 }}>{outcome.title}</strong>
            {outcome.description && <p style={{ fontSize: 11, color: "#6b7a89", margin: "2px 0 8px" }}>{outcome.description}</p>}
            {outcome.milestones.map((milestone) => <div key={milestone.id} style={{ marginLeft: 12, marginTop: 8, borderLeft: "2px solid #e5e9ee", paddingLeft: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{milestone.title}</span>
              <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                {milestone.missions.map((mission) => <button key={mission.id} onClick={() => setSelectedMissionId(mission.id)} style={{ textAlign: "left", padding: "6px 8px", borderRadius: 8, border: mission.id === selectedMissionId ? "1px solid #2563eb" : "1px solid #eef1f4", background: mission.id === selectedMissionId ? "#eff6ff" : "#fff", fontSize: 12, cursor: "pointer" }}>
                  {mission.title} <span style={{ color: "#94a3b8" }}>· {mission.completionPolicy}</span>
                </button>)}
                {isDraft && <MiniForm placeholder="+ Thêm mission" onSubmit={(title) => call("/api/academy-admin/learn-outcome/node", { action: "createMission", milestoneId: milestone.id, mission: { title, expectedResult: title } }, "Đã thêm mission.")}/>}
              </div>
            </div>)}
            {isDraft && <div style={{ marginLeft: 12, marginTop: 8 }}><MiniForm placeholder="+ Thêm milestone" onSubmit={(title) => call("/api/academy-admin/learn-outcome/node", { action: "createMilestone", outcomeId: outcome.id, title }, "Đã thêm milestone.")}/></div>}
          </div>)}
          {isDraft && versionId && <MiniForm placeholder="+ Thêm outcome" onSubmit={(title) => call("/api/academy-admin/learn-outcome/node", { action: "createOutcome", versionId, title }, "Đã thêm outcome.")}/>}
          {!outcomes.length && !isDraft && <p style={{ fontSize: 12, color: "#6b7a89" }}>Chưa có outcome nào trong phiên bản này.</p>}
        </div>
      </section>

      {selectedMission && <section className={styles.card}>
        <div className={styles.cardHead}><div><h2>{selectedMission.title}</h2></div></div>
        <div style={{ padding: 16, display: "grid", gap: 10, fontSize: 12 }}>
          <div><strong>Expected result:</strong> {selectedMission.expectedResult || "—"}</div>
          <div><strong>Completion policy:</strong> {selectedMission.completionPolicy}</div>
          <div><strong>Estimated days:</strong> {selectedMission.estimatedDays ?? "—"}</div>

          <div><strong>Resource bindings</strong>
            <ul style={{ margin: "4px 0" }}>{selectedMission.resourceBindings.map((b) => <li key={b.id}>{b.resourceType} · {b.resourceId} ({b.role})</li>)}</ul>
            {isDraft && <MiniForm placeholder="resource_id (career_stage_resources.id)" onSubmit={(resourceId) => call("/api/academy-admin/learn-outcome/node", { action: "attachBinding", missionId: selectedMission.id, binding: { kind: "resource", resourceType: "career_stage_resource", resourceId } }, "Đã gắn resource.")}/>}
          </div>

          <div><strong>Assignment bindings</strong>
            <ul style={{ margin: "4px 0" }}>{selectedMission.assignmentBindings.map((b) => <li key={b.id}>{b.assignmentId} ({b.role})</li>)}</ul>
            {isDraft && <MiniForm placeholder="assignment_id (assignment_definitions.id)" onSubmit={(assignmentId) => call("/api/academy-admin/learn-outcome/node", { action: "attachBinding", missionId: selectedMission.id, binding: { kind: "assignment", assignmentId } }, "Đã gắn assignment.")}/>}
          </div>

          <div><strong>Action templates</strong>
            <ul style={{ margin: "4px 0" }}>{selectedMission.actionTemplates.map((a) => <li key={a.id}>{a.title}{a.required ? " · bắt buộc" : ""}{a.evidenceRequired ? " · cần evidence" : ""}</li>)}</ul>
            {isDraft && <MiniForm placeholder="+ Thêm action template" onSubmit={(title) => call("/api/academy-admin/learn-outcome/node", { action: "createActionTemplate", missionId: selectedMission.id, actionTemplate: { title } }, "Đã thêm action template.")}/>}
          </div>
        </div>
      </section>}
    </div>}
  </SimpleOperationsShell>;
}

function MiniForm({ placeholder, onSubmit }: { placeholder: string; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("");
  return <form onSubmit={(e) => { e.preventDefault(); if (!value.trim()) return; onSubmit(value.trim()); setValue(""); }} style={{ display: "flex", gap: 6 }}>
    <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} style={field}/>
    <button type="submit" className={styles.button} style={{ whiteSpace: "nowrap" }}>Thêm</button>
  </form>;
}
