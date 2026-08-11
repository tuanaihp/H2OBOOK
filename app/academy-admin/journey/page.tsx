"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, CheckCircle2, Archive, Copy, AlertTriangle, Search, X } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import { MissionWorkspaceBuilder } from "@/components/academy-admin/mission-workspace-builder";
import styles from "@/components/operations/operations.module.css";

type Stage = { id: string; title: string; indexLabel: string };
type Blueprint = { id: string; stageId: string; title: string; currentPublishedVersionId: string | null };
type Version = { id: string; blueprintId: string; versionNumber: number; status: "draft" | "published" | "archived"; publishedAt: string | null };
type Binding = { id: string; role: string; resourceType?: string; resourceId?: string; title?: string | null; toolType?: string; toolId?: string; assignmentId?: string };
type ActionTemplate = { id: string; title: string; required: boolean; dayOffset: number | null; evidenceRequired: boolean };
type Mission = {
  id: string; title: string; description: string; expectedResult: string; estimatedDays: number | null;
  completionPolicy: string; successCriteria: string[]; position: number; prerequisiteMissionId: string | null;
  resourceBindings: Binding[]; toolBindings: Binding[]; assignmentBindings: Binding[]; actionTemplates: ActionTemplate[];
};
type Milestone = { id: string; title: string; missions: Mission[] };
type Outcome = { id: string; title: string; description: string; milestones: Milestone[] };
type Finding = { severity: "blocker" | "warning"; category: string; missionId: string | null; missionTitle: string | null; message: string };
type Preflight = { ok: boolean; findings: Finding[] };
type ResourceResult = { resourceType: string; resourceId: string; title: string; summary: string; sourceLabel: string; stageTitle: string };

const field = { padding: 8, borderRadius: 8, border: "1px solid #dfe3e8", fontSize: 12, width: "100%" } as const;
const STATUS_LABEL: Record<string, string> = { draft: "Nháp", published: "Đã publish", archived: "Đã lưu trữ" };
const CATEGORY_LABEL: Record<string, string> = { structure: "Cấu trúc", missing_kpi: "Thiếu Success KPI", missing_duration: "Thiếu Estimated Days", missing_binding: "Thiếu Resource/Tool", circular: "Vòng lặp Prerequisite", broken_reference: "Tham chiếu gãy", other: "Khác" };

export default function JourneyMapAdminPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [stageId, setStageId] = useState("");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<ResourceResult[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/academy-admin/stages", { cache: "no-store" }).then((r) => r.json()).then((json) => {
      const list = (json?.stages ?? []).map((s: { id: string; title: string; indexLabel?: string }) => ({ id: s.id, title: s.title, indexLabel: s.indexLabel ?? "" }));
      setStages(list);
      if (list[0]) setStageId(list[0].id);
    }).catch(() => null);
  }, []);

  async function loadJourney(forStageId: string, forVersionId?: string) {
    if (!forStageId) return;
    setLoading(true); setPreflight(null); setSelectedMissionId(null); setActiveCategory(null);
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

  async function runPreflight() {
    setBusy(true);
    const res = await fetch("/api/academy-admin/learn-outcome/version", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "preflight", versionId }) });
    const json = await res.json().catch(() => null);
    setPreflight(json); setActiveCategory(null); setBusy(false);
  }

  async function searchResources(query: string) {
    setPickerQuery(query);
    if (!query.trim()) { setPickerResults([]); return; }
    const res = await fetch(`/api/academy-admin/learn-outcome/resource-search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setPickerResults(json?.results ?? []);
  }

  const missions = useMemo(() => outcomes.flatMap((o) => o.milestones.flatMap((m) => m.missions)), [outcomes]);
  const currentVersion = versions.find((v) => v.id === versionId);
  const isDraft = currentVersion?.status === "draft";
  const selectedMission = missions.find((m) => m.id === selectedMissionId) ?? null;

  const findingsByCategory = useMemo(() => {
    const map = new Map<string, Finding[]>();
    for (const f of preflight?.findings ?? []) map.set(f.category, [...(map.get(f.category) ?? []), f]);
    return map;
  }, [preflight]);
  const flaggedMissionIds = useMemo(() => {
    if (!activeCategory) return null;
    return new Set((findingsByCategory.get(activeCategory) ?? []).map((f) => f.missionId).filter(Boolean));
  }, [activeCategory, findingsByCategory]);

  return <SimpleOperationsShell title="Academy Control" subtitle="Bản đồ kết quả học viên" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="ĐÀO TẠO">
    <div className="page-header"><div><h1>Bản đồ kết quả học viên — Outcome → Mission Builder</h1><p style={{ fontSize: 12, color: "#6b7a89" }}>Lớp thực thi bổ sung cho giáo trình hiện có (Stage → Program → Module → Group vẫn ở &ldquo;Giai đoạn &amp; Nội dung đào tạo&rdquo;) — không thay thế, không copy tài liệu.</p></div></div>
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
                {versions.map((v) => <option key={v.id} value={v.id}>v{v.versionNumber} — {STATUS_LABEL[v.status]}{blueprint.currentPublishedVersionId === v.id ? " (đang publish)" : ""}</option>)}
              </select>
            </label>
          : <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !stageId} onClick={() => call("/api/academy-admin/learn-outcome", { stageId }, "Đã tạo Bản đồ kết quả (nháp v1).")}><Plus size={14}/>Tạo Bản đồ kết quả cho giai đoạn này</button>}
      </div>
      {blueprint && <div style={{ padding: "0 16px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={styles.button} disabled={busy || !versionId} onClick={() => call("/api/academy-admin/learn-outcome/version", { action: "duplicate", blueprintId: blueprint.id, versionId }, "Đã tạo phiên bản nháp mới (clone).")}><Copy size={14}/>Nhân bản thành phiên bản mới</button>
        <button className={styles.button} disabled={busy || !versionId} onClick={runPreflight}><RefreshCw size={14}/>Kiểm tra trước khi publish</button>
        {isDraft && <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !versionId} onClick={() => call("/api/academy-admin/learn-outcome/version", { action: "publish", blueprintId: blueprint.id, versionId }, "Đã publish. Học viên đang pin phiên bản cũ không tự chuyển sang bản này.")}><CheckCircle2 size={14}/>Publish phiên bản này</button>}
        {currentVersion?.status === "published" && <button className={styles.button} disabled={busy || !versionId} onClick={() => call("/api/academy-admin/learn-outcome/version", { action: "archive", versionId }, "Đã lưu trữ phiên bản.")}><Archive size={14}/>Lưu trữ</button>}
      </div>}
    </section>

    {preflight && <section className={styles.card} style={{ marginBottom: 16 }}>
      <div className={styles.cardBody} style={{ padding: 16 }}>
        <strong style={{ color: preflight.ok ? "#1a7f37" : "#b42318" }}>{preflight.ok ? "Sẵn sàng publish — không có blocker." : `${preflight.findings.filter((f) => f.severity === "blocker").length} blocker cần sửa trước khi publish`}</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {[...findingsByCategory.entries()].map(([category, items]) => {
            const hasBlocker = items.some((f) => f.severity === "blocker");
            return <button key={category} onClick={() => setActiveCategory(activeCategory === category ? null : category)}
              style={{ padding: "6px 10px", borderRadius: 999, border: activeCategory === category ? "1px solid #2563eb" : "1px solid #e5e9ee", background: activeCategory === category ? "#eff6ff" : hasBlocker ? "#fef2f2" : "#fffbeb", fontSize: 11, cursor: "pointer", color: hasBlocker ? "#b42318" : "#92400e" }}>
              {hasBlocker ? <AlertTriangle size={11} style={{ verticalAlign: "-1px" }} /> : null} {CATEGORY_LABEL[category] ?? category} ({items.length})
            </button>;
          })}
        </div>
        {activeCategory && <div style={{ marginTop: 10, fontSize: 12 }}>
          {(findingsByCategory.get(activeCategory) ?? []).map((f, i) => <div key={i} style={{ padding: "4px 0", borderTop: i ? "1px solid #f1f3f5" : undefined }}>
            {f.missionTitle ? <button onClick={() => setSelectedMissionId(f.missionId)} style={{ border: "none", background: "none", padding: 0, color: "#2563eb", cursor: "pointer", fontWeight: 600 }}>{f.missionTitle}</button> : <strong>Chung</strong>} — {f.message}
          </div>)}
        </div>}
      </div>
    </section>}

    {loading ? <p style={{ fontSize: 12 }}>Đang tải...</p> : blueprint && <div style={{ display: "grid", gridTemplateColumns: selectedMission ? "1fr 1.1fr" : "1fr", gap: 16 }}>
      <section className={styles.card}>
        <div className={styles.cardHead}><div><h2>Outcome → Milestone → Mission</h2>{activeCategory && <p style={{ fontSize: 11, color: "#6b7a89", margin: "2px 0 0" }}>Đang lọc theo: {CATEGORY_LABEL[activeCategory]} <button onClick={() => setActiveCategory(null)} style={{ border: "none", background: "none", color: "#2563eb", cursor: "pointer" }}>(bỏ lọc)</button></p>}</div></div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          {outcomes.map((outcome) => <div key={outcome.id} style={{ border: "1px solid #e5e9ee", borderRadius: 10, padding: 10 }}>
            <strong style={{ fontSize: 13 }}>{outcome.title}</strong>
            {outcome.milestones.map((milestone) => <div key={milestone.id} style={{ marginLeft: 12, marginTop: 8, borderLeft: "2px solid #e5e9ee", paddingLeft: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{milestone.title}</span>
              <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                {milestone.missions.filter((mission) => !flaggedMissionIds || flaggedMissionIds.has(mission.id)).map((mission) => {
                  const missionFindings = (preflight?.findings ?? []).filter((f) => f.missionId === mission.id);
                  // "Entry Mission" (§7): opens as soon as the Stage is accessible — no prerequisite at
                  // all, which after the parallel-outcome fix means exactly one per Outcome (its first
                  // Mission), not one per Stage.
                  const isEntry = !mission.prerequisiteMissionId;
                  const prereqOutcome = mission.prerequisiteMissionId ? outcomes.find((o) => o.milestones.some((ms) => ms.missions.some((m) => m.id === mission.prerequisiteMissionId))) : null;
                  const isCrossOutcome = prereqOutcome && prereqOutcome.id !== outcome.id;
                  return <button key={mission.id} onClick={() => setSelectedMissionId(mission.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", padding: "6px 8px", borderRadius: 8, border: mission.id === selectedMissionId ? "1px solid #2563eb" : "1px solid #eef1f4", background: mission.id === selectedMissionId ? "#eff6ff" : "#fff", fontSize: 12, cursor: "pointer" }}>
                    <span>{mission.title} {isEntry && <span style={{ fontSize: 9, fontWeight: 700, color: "#1a7f37", background: "#e6f6ec", borderRadius: 999, padding: "1px 6px", marginLeft: 4 }}>ENTRY</span>}{isCrossOutcome && <span title={`Phụ thuộc Outcome khác: ${prereqOutcome!.title}`} style={{ fontSize: 9, fontWeight: 700, color: "#b7791f", background: "#fff8ec", borderRadius: 999, padding: "1px 6px", marginLeft: 4 }}>⚠ CHÉO OUTCOME</span>}</span>
                    {missionFindings.length > 0 && <span style={{ fontSize: 10, color: missionFindings.some((f) => f.severity === "blocker") ? "#b42318" : "#92400e" }}>{missionFindings.length} vấn đề</span>}
                  </button>;
                })}
                {isDraft && <MiniForm placeholder="+ Thêm mission" onSubmit={(title) => call("/api/academy-admin/learn-outcome/node", { action: "createMission", milestoneId: milestone.id, mission: { title, expectedResult: title } }, "Đã thêm mission.")}/>}
              </div>
            </div>)}
            {isDraft && <div style={{ marginLeft: 12, marginTop: 8 }}><MiniForm placeholder="+ Thêm milestone" onSubmit={(title) => call("/api/academy-admin/learn-outcome/node", { action: "createMilestone", outcomeId: outcome.id, title }, "Đã thêm milestone.")}/></div>}
          </div>)}
          {isDraft && versionId && <MiniForm placeholder="+ Thêm outcome" onSubmit={(title) => call("/api/academy-admin/learn-outcome/node", { action: "createOutcome", versionId, title }, "Đã thêm outcome.")}/>}
        </div>
      </section>

      {selectedMission && <section className={styles.card}>
        <div className={styles.cardHead}><div><h2>{selectedMission.title}</h2></div></div>
        <div style={{ padding: 16, display: "grid", gap: 10, fontSize: 12 }}>
          <div><strong>Expected result:</strong> {selectedMission.expectedResult || "—"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label>Completion policy
              <select defaultValue={selectedMission.completionPolicy} disabled={!isDraft} onChange={(e) => call("/api/academy-admin/learn-outcome/node", { action: "updateMission", missionId: selectedMission.id, mission: { completionPolicy: e.target.value } }, "Đã cập nhật.")} style={field}>
                {["self_reported", "evidence_required", "teacher_verified", "metric_based"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label>Estimated days
              <input type="number" min={0} defaultValue={selectedMission.estimatedDays ?? ""} disabled={!isDraft} onBlur={(e) => call("/api/academy-admin/learn-outcome/node", { action: "updateMission", missionId: selectedMission.id, mission: { estimatedDays: e.target.value ? Number(e.target.value) : null } }, "Đã cập nhật.")} style={field}/>
            </label>
          </div>

          <div>
            {/* Prerequisite picker (§7): a Mission selector grouped by Outcome, never a raw UUID field.
                Empty = Entry Mission (opens as soon as the Stage is accessible). Picking a Mission from
                a different Outcome is allowed (explicit cross-outcome dependency, §6) but flagged so
                Admin knows they are opting out of the default parallel-Outcome behavior. */}
            <strong>Prerequisite</strong>
            <select defaultValue={selectedMission.prerequisiteMissionId ?? ""} disabled={!isDraft} onChange={(e) => call("/api/academy-admin/learn-outcome/node", { action: "updateMission", missionId: selectedMission.id, mission: { prerequisiteMissionId: e.target.value || null } }, "Đã cập nhật prerequisite.")} style={{ ...field, marginTop: 4 }}>
              <option value="">— Không có (Entry Mission, mở ngay khi Stage mở) —</option>
              {outcomes.map((outcome) => <optgroup key={outcome.id} label={outcome.title}>
                {outcome.milestones.flatMap((ms) => ms.missions).filter((m) => m.id !== selectedMission.id).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </optgroup>)}
            </select>
            {(() => {
              if (!selectedMission.prerequisiteMissionId) return null;
              const ownerOutcome = outcomes.find((o) => o.milestones.some((ms) => ms.missions.some((m) => m.id === selectedMission.id)));
              const prereqOutcome = outcomes.find((o) => o.milestones.some((ms) => ms.missions.some((m) => m.id === selectedMission.prerequisiteMissionId)));
              if (!ownerOutcome || !prereqOutcome || ownerOutcome.id === prereqOutcome.id) return null;
              return <p style={{ fontSize: 11, color: "#b7791f", margin: "6px 0 0" }}>⚠ Phụ thuộc chéo Outcome — Mission này sẽ KHÔNG mở song song với các Outcome khác, chỉ mở sau khi hoàn thành Mission ở &ldquo;{prereqOutcome.title}&rdquo;. Đây phải là lựa chọn có chủ đích (§6).</p>;
            })()}
          </div>

          <div><strong>Success KPI</strong>
            {selectedMission.successCriteria.length ? selectedMission.successCriteria.map((c, i) => <div key={i}>· {c}</div>) : <p style={{ color: "#6b7a89" }}>Chưa có success KPI.</p>}
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Resource bindings</strong>
              {isDraft && <button onClick={() => setPickerOpen(true)} className={styles.button} style={{ fontSize: 11, padding: "4px 8px" }}><Search size={11}/> Tìm resource</button>}
            </div>
            <ul style={{ margin: "4px 0", paddingLeft: 16 }}>{selectedMission.resourceBindings.map((b) => <li key={b.id}>{b.title || <em style={{ color: "#b42318" }}>Chưa resolve được title ({b.resourceId})</em>} <small style={{ color: "#94a3b8" }}>({b.role})</small></li>)}</ul>
          </div>

          <div><strong>Assignment bindings</strong>
            <ul style={{ margin: "4px 0" }}>{selectedMission.assignmentBindings.map((b) => <li key={b.id}>{b.assignmentId} ({b.role})</li>)}</ul>
          </div>

          <div><strong>Action templates</strong>
            <ul style={{ margin: "4px 0" }}>{selectedMission.actionTemplates.map((a) => <li key={a.id}>{a.title}{a.required ? " · bắt buộc" : ""}{a.evidenceRequired ? " · cần evidence" : ""}</li>)}</ul>
            {isDraft && <MiniForm placeholder="+ Thêm action template" onSubmit={(title) => call("/api/academy-admin/learn-outcome/node", { action: "createActionTemplate", missionId: selectedMission.id, actionTemplate: { title } }, "Đã thêm action template.")}/>}
          </div>

          <div style={{ borderTop: "1px solid #eef1f4", paddingTop: 10 }}>
            {versionId && <MissionWorkspaceBuilder journeyVersionId={versionId} missionId={selectedMission.id} isDraft={isDraft}
              resourceBindings={selectedMission.resourceBindings.map((b) => ({ id: b.id, label: b.title || b.resourceId || b.id }))}
              toolBindings={selectedMission.toolBindings.map((b) => ({ id: b.id, label: b.toolId || b.id }))}
              assignmentBindings={selectedMission.assignmentBindings.map((b) => ({ id: b.id, label: b.assignmentId || b.id }))}
            />}
          </div>
        </div>
      </section>}
    </div>}

    {pickerOpen && selectedMission && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setPickerOpen(false)}>
      <div style={{ width: 480, maxHeight: "80vh", overflowY: "auto", background: "#fff", borderRadius: 12, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><strong>Tìm resource thật</strong><button onClick={() => setPickerOpen(false)} style={{ border: "none", background: "none", cursor: "pointer" }}><X size={16}/></button></div>
        <input autoFocus value={pickerQuery} onChange={(e) => searchResources(e.target.value)} placeholder="Gõ tên tài liệu..." style={{ ...field, margin: "10px 0" }}/>
        <div style={{ display: "grid", gap: 6 }}>
          {pickerResults.map((r) => <button key={r.resourceId} onClick={async () => {
            await call("/api/academy-admin/learn-outcome/node", { action: "attachBinding", missionId: selectedMission.id, binding: { kind: "resource", resourceType: r.resourceType, resourceId: r.resourceId } }, "Đã gắn resource.");
            setPickerOpen(false); setPickerQuery(""); setPickerResults([]);
          }} style={{ textAlign: "left", padding: 10, borderRadius: 8, border: "1px solid #eef1f4", background: "#fff", cursor: "pointer" }}>
            <strong style={{ fontSize: 12 }}>{r.title}</strong>
            <div style={{ fontSize: 10, color: "#6b7a89" }}>{r.sourceLabel} · {r.stageTitle}</div>
          </button>)}
          {pickerQuery && !pickerResults.length && <p style={{ fontSize: 12, color: "#6b7a89" }}>Không tìm thấy tài liệu nào khớp.</p>}
        </div>
      </div>
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
