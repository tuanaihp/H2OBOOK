"use client";
import { useEffect, useState } from "react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";
import { calculateCoachProgress, detectConfirmIntent, determineMissionState, extractCandidatesFromText, nextOfflineQuestionRule, questionTargetField, runOfflineCoachTurn } from "@/lib/h2o-coach/offline-engine";
import { missionConfirmedFieldKey, type CoachCandidateExtraction, type CoachExtractionRule, type CoachMemoryFieldSchema, type CoachQuestionRule, type CoachRuntimeContext, type CoachStageProfileVersion, type CoachToolBinding, type LearnerMemoryValue } from "@/lib/h2o-coach/types";

interface StageSummary { stageId: string; stageTitle: string; stagePosition: number; profileId: string | null; publishedVersionId: string | null; publishedVersionNumber: number | null; latestDraftVersionId: string | null; status: "published" | "draft" | "unconfigured" }
interface VersionRow { id: string; versionNumber: number; status: "draft" | "published" | "archived"; publishedAt: string | null }
// These alias the canonical lib/h2o-coach/types.ts shapes rather than redeclaring them — the Test
// Chat panel below imports offline-engine.ts's real pure functions directly (they have no
// "server-only" import by design, see types.ts's own comment on why) and passes this page's live,
// unsaved edit state straight into them, so the shapes must stay exactly assignable, not just similar.
type ExtractionRule = CoachExtractionRule;
type MemoryField = CoachMemoryFieldSchema;
type QuestionRule = CoachQuestionRule;
type ToolBinding = CoachToolBinding;
interface MissionConfig { id: string; missionId: string; objective: string; coachInstructions?: string; requiredFields: string[]; questions: QuestionRule[]; tools: ToolBinding[]; rubric?: Record<string, unknown>; evidenceRequirements?: Record<string, unknown>[] }
interface KnowledgeScope { resourceIds: string[]; allowMissionBindings: boolean; allowStageCurriculum: boolean }
interface VersionDetail {
  id: string; profileId: string; versionNumber: number; status: "draft" | "published" | "archived";
  name: string; coachRole: string; systemTone: string; providerMode: "offline" | "hybrid" | "ai";
  knowledgeScope: KnowledgeScope; memorySchema: MemoryField[]; missionConfigs: MissionConfig[];
}
type Tab = "role" | "knowledge" | "mission" | "memory" | "ai" | "version";
const TABS: [Tab, string][] = [["role", "1. Vai trò Coach"], ["knowledge", "2. Kiến thức sử dụng"], ["mission", "3/5/6. Mission Coaching · Công cụ · Quy tắc"], ["memory", "4. Dữ liệu cần ghi nhớ"], ["ai", "7. AI Mode"], ["version", "8. Phiên bản & triển khai"]];

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; json: T & { error?: string } }> {
  const res = await fetch(url, init ? { ...init, headers: { "content-type": "application/json", ...init.headers } } : undefined);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

/**
 * H2O Coach Builder Admin — the reference package's placeholder scaffold
 * (v5/39-H2OBOOK_H2O_COACH_OS_V1/src/app/academy-admin/coach-builder/page.tsx) replaced with real
 * career_stages + coach_stage_profile_versions data. "3/5/6" is one tab, not three, because Mission
 * Coaching/Tools/Rules all live on the same coach_mission_configs row per Mission in this schema
 * (docs/h2o-coach-v1/01_PRODUCTION_AUDIT.md) — not a separate Stage-wide tools/rules table.
 */
export default function CoachBuilderPage() {
  const [stages, setStages] = useState<StageSummary[] | null>(null);
  const [selectedStage, setSelectedStage] = useState<StageSummary | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [detail, setDetail] = useState<VersionDetail | null>(null);
  const [missions, setMissions] = useState<{ id: string; title: string }[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("role");
  const [busy, setBusy] = useState(false);
  const [autoGenBusy, setAutoGenBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadStages() {
    const { json } = await api<{ stages: StageSummary[] }>("/api/academy-admin/coach-builder/profiles");
    setStages(json.stages ?? []);
  }
  useEffect(() => { void loadStages(); }, []);

  async function loadVersion(versionId: string) {
    const { json } = await api<{ version: VersionDetail }>(`/api/academy-admin/coach-builder/versions/${versionId}`);
    setDetail(json.version ?? null);
  }
  async function loadVersions(profileId: string) {
    const { json } = await api<{ versions: VersionRow[] }>(`/api/academy-admin/coach-builder/profiles/${profileId}/versions`);
    setVersions(json.versions ?? []);
  }

  async function openStage(stage: StageSummary) {
    setSelectedStage(stage); setMessage(null); setTab("role");
    let profileId = stage.profileId; let versionId = stage.publishedVersionId ?? stage.latestDraftVersionId;
    if (!profileId || !versionId) {
      const { json } = await api<{ profileId: string; versionId: string }>("/api/academy-admin/coach-builder/profiles", { method: "POST", body: JSON.stringify({ stageId: stage.stageId }) });
      profileId = json.profileId; versionId = json.versionId;
    }
    if (!profileId || !versionId) return;
    await Promise.all([loadVersion(versionId), loadVersions(profileId)]);
    const { json: missionJson } = await api<{ missions: { id: string; title: string }[] }>(`/api/academy-admin/coach-builder/stages/${stage.stageId}/missions`);
    setMissions(missionJson.missions ?? []);
    setSelectedMissionId(missionJson.missions?.[0]?.id ?? "");
  }

  const editable = detail?.status === "draft";

  async function saveField(patch: Partial<Pick<VersionDetail, "name" | "coachRole" | "systemTone" | "providerMode" | "knowledgeScope" | "memorySchema">>) {
    if (!detail || !editable) return;
    setBusy(true);
    const { ok } = await api(`/api/academy-admin/coach-builder/versions/${detail.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    setBusy(false);
    if (ok) setDetail({ ...detail, ...patch });
  }

  async function duplicate() {
    if (!detail || !selectedStage?.profileId) return;
    setBusy(true);
    const { ok, json } = await api<{ versionId: string }>(`/api/academy-admin/coach-builder/versions/${detail.id}/duplicate`, { method: "POST", body: JSON.stringify({ profileId: selectedStage.profileId }) });
    setBusy(false);
    if (ok) { await loadVersion(json.versionId); await loadVersions(selectedStage.profileId); setMessage("Đã tạo bản nháp mới từ phiên bản này."); }
  }

  async function publish(versionId: string) {
    if (!selectedStage?.profileId) return;
    setBusy(true);
    const { ok, json } = await api<{ error?: string }>(`/api/academy-admin/coach-builder/versions/${versionId}/publish`, { method: "POST", body: JSON.stringify({ profileId: selectedStage.profileId }) });
    setBusy(false);
    if (ok) { await loadVersion(versionId); await loadVersions(selectedStage.profileId); await loadStages(); setMessage("Đã áp dụng cho học viên."); }
    else setMessage(json.error ?? "Không áp dụng được.");
  }

  async function saveMissionConfig(missionId: string, patch: Partial<Pick<MissionConfig, "objective" | "coachInstructions" | "requiredFields" | "questions" | "tools" | "rubric" | "evidenceRequirements">>) {
    if (!detail || !editable) return;
    const existing = detail.missionConfigs.find((m) => m.missionId === missionId);
    const body = {
      profileVersionId: detail.id, missionId, objective: patch.objective ?? existing?.objective ?? "",
      coachInstructions: patch.coachInstructions ?? existing?.coachInstructions ?? "",
      requiredFields: patch.requiredFields ?? existing?.requiredFields ?? [], questions: patch.questions ?? existing?.questions ?? [], tools: patch.tools ?? existing?.tools ?? [],
      rubric: patch.rubric ?? existing?.rubric ?? {}, evidenceRequirements: patch.evidenceRequirements ?? existing?.evidenceRequirements ?? []
    };
    setBusy(true);
    const { ok, json } = await api<{ id: string }>("/api/academy-admin/coach-builder/mission-configs", { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!ok) return;
    setDetail({ ...detail, missionConfigs: existing ? detail.missionConfigs.map((m) => m.missionId === missionId ? { ...m, ...body } : m) : [...detail.missionConfigs, { id: json.id, ...body }] });
  }

  // "Tự động tạo cấu hình Coach" — derives a first-draft objective/questions/memory-fields from the
  // Mission's own real success_criteria/expected_result (learning_journey_missions), instead of an
  // admin hand-authoring every one of a 6-Stage, 100+-Mission curriculum from scratch. Draft-only —
  // still goes through the same review → Chat thử → Publish flow as any hand-typed config.
  async function autoGenerateOne() {
    if (!detail || !selectedMissionId) return;
    setAutoGenBusy(true); setMessage(null);
    const { ok, json } = await api<{ fieldsAdded: number; source: "success_criteria" | "expected_result" | "title" }>("/api/academy-admin/coach-builder/mission-configs/auto-generate", { method: "POST", body: JSON.stringify({ profileVersionId: detail.id, missionId: selectedMissionId }) });
    setAutoGenBusy(false);
    if (ok) {
      const sourceNote = json.source === "success_criteria" ? "từ Success Criteria (đầy đủ)" : json.source === "expected_result" ? "từ Expected Result (Mission chưa có Success Criteria — nên bổ sung để câu hỏi chi tiết hơn)" : "từ tên Mission (Mission chưa có Success Criteria lẫn Expected Result — nên bổ sung dữ liệu này)";
      setMessage(`Đã tự động tạo cấu hình ${sourceNote} — thêm ${json.fieldsAdded} trường dữ liệu mới. Xem lại, chỉnh nếu cần, rồi Áp dụng khi sẵn sàng.`);
    } else setMessage(json.error ?? "Không tạo được.");
  }
  async function autoGenerateAll() {
    if (!detail || !selectedStage) return;
    setAutoGenBusy(true); setMessage(null);
    const { ok, json } = await api<{ generated: number; skipped: number; errors: string[] }>("/api/academy-admin/coach-builder/mission-configs/auto-generate-all", { method: "POST", body: JSON.stringify({ profileVersionId: detail.id, stageId: selectedStage.stageId }) });
    setAutoGenBusy(false);
    if (ok) {
      await loadVersion(detail.id);
      setMessage(`Đã tự động tạo cho ${json.generated} Mission, bỏ qua ${json.skipped} (đã có cấu hình hoặc chưa có Success Criteria)${json.errors.length ? ` — lỗi: ${json.errors.join("; ")}` : ""}. Xem lại và Áp dụng khi sẵn sàng.`);
    } else setMessage(json.error ?? "Không tạo được.");
  }

  const currentMissionConfig = detail?.missionConfigs.find((m) => m.missionId === selectedMissionId);

  return <SimpleOperationsShell title="Academy Control Center" subtitle="H2O Coach Builder" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <div className={styles.grid}>
      <section className={`${styles.card} ${styles.span12}`}>
        <div className={styles.cardHead}><div><h2>H2O Coach Builder</h2><p>Cấu hình bộ não huấn luyện theo từng giai đoạn. Một Coach Engine, nhiều Stage Brain Profile.</p></div></div>
        <div className={styles.cardBody}>
          {!stages && <p>Đang tải…</p>}
          {stages && stages.length === 0 && <p className={styles.empty}>Học viện chưa cấu hình Giai đoạn nào.</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
            {stages?.map((s) => <button key={s.stageId} onClick={() => openStage(s)}
              style={{ textAlign: "left", cursor: "pointer", padding: 16, borderRadius: 16, border: selectedStage?.stageId === s.stageId ? "2px solid #7b61ff" : "1px solid #dde6ef", background: "#fff" }}>
              <small style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", color: "#1a91a6" }}>GIAI ĐOẠN {String(s.stagePosition).padStart(2, "0")}</small>
              <div style={{ fontSize: 15, fontWeight: 700, margin: "6px 0" }}>{s.stageTitle}</div>
              <span className={styles.badge}>{s.status === "published" ? `Đang áp dụng · v${s.publishedVersionNumber}` : s.status === "draft" ? "Bản nháp" : "Chưa cấu hình"}</span>
            </button>)}
          </div>
        </div>
      </section>

      {selectedStage && detail && <section className={`${styles.card} ${styles.span12}`}>
        <div className={styles.cardHead}>
          <div><h2>{selectedStage.stageTitle}</h2><p>{editable ? `Đang chỉnh bản nháp v${detail.versionNumber}` : `Đang xem bản v${detail.versionNumber} (${detail.status === "published" ? "đang áp dụng" : "đã lưu trữ"}) — chỉ đọc`}</p></div>
          <div style={{ display: "flex", gap: 8 }}>
            {!editable && <button className={styles.buttonSecondary} onClick={duplicate} disabled={busy}>Nhân bản để chỉnh sửa</button>}
            {editable && <button className={styles.buttonPrimary} onClick={() => publish(detail.id)} disabled={busy}>Áp dụng cho học viên</button>}
          </div>
        </div>
        <div className={styles.cardBody}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {TABS.map(([key, label]) => <button key={key} onClick={() => setTab(key)}
              style={{ borderRadius: 999, border: tab === key ? "1px solid #7b61ff" : "1px solid #dde6ef", background: tab === key ? "#f2effe" : "#fff", padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{label}</button>)}
          </div>
          {message && <p style={{ fontSize: 12, color: "#177a54", marginBottom: 10 }}>{message}</p>}

          {tab === "role" && <div style={{ display: "grid", gap: 10, maxWidth: 560 }}>
            <label style={fieldLabelStyle}>Tên hồ sơ<input defaultValue={detail.name} disabled={!editable} onBlur={(e) => saveField({ name: e.target.value })} style={inputStyle} /></label>
            <label style={fieldLabelStyle}>Vai trò Coach<input defaultValue={detail.coachRole} disabled={!editable} onBlur={(e) => saveField({ coachRole: e.target.value })} style={inputStyle} placeholder="Career & Foundation Coach" /></label>
            <label style={fieldLabelStyle}>Phong cách giao tiếp<textarea rows={4} defaultValue={detail.systemTone} disabled={!editable} onBlur={(e) => saveField({ systemTone: e.target.value })} style={inputStyle} /></label>
          </div>}

          {tab === "knowledge" && <div style={{ display: "grid", gap: 10, maxWidth: 560 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" checked={detail.knowledgeScope.allowMissionBindings} disabled={!editable} onChange={(e) => saveField({ knowledgeScope: { ...detail.knowledgeScope, allowMissionBindings: e.target.checked } })} />
              Dùng học liệu đã gắn vào Mission
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" checked={detail.knowledgeScope.allowStageCurriculum} disabled={!editable} onChange={(e) => saveField({ knowledgeScope: { ...detail.knowledgeScope, allowStageCurriculum: e.target.checked } })} />
              Dùng Curriculum của Giai đoạn này
            </label>
            <label style={fieldLabelStyle}>Tài liệu chỉ định thêm (mỗi dòng 1 resource id)
              <textarea rows={3} defaultValue={(detail.knowledgeScope.resourceIds ?? []).join("\n")} disabled={!editable} style={inputStyle}
                onBlur={(e) => saveField({ knowledgeScope: { ...detail.knowledgeScope, resourceIds: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) } })} />
            </label>
          </div>}

          {tab === "memory" && <MemorySchemaEditor schema={detail.memorySchema} editable={editable} onChange={(memorySchema) => saveField({ memorySchema })} />}

          {tab === "ai" && <div style={{ display: "grid", gap: 10, maxWidth: 400 }}>
            <label style={fieldLabelStyle}>Chế độ
              <select defaultValue={detail.providerMode} disabled={!editable} onChange={(e) => saveField({ providerMode: e.target.value as VersionDetail["providerMode"] })} style={inputStyle}>
                <option value="offline">Offline — Rule Engine</option>
                <option value="hybrid">Hybrid — Rule Engine + AI</option>
                <option value="ai">AI — Provider API</option>
              </select>
            </label>
            <p style={{ fontSize: 12, color: "#718092" }}>Offline luôn hoạt động không cần AI API. Hybrid/AI chỉ chạy thật khi tổ chức đã cấu hình GEMINI_API_KEY — nếu chưa, hệ thống tự dùng lại Offline.</p>
          </div>}

          {tab === "mission" && <div>
            {missions.length === 0 && <p className={styles.empty}>Giai đoạn này chưa có Mission nào được publish trong Bản đồ kết quả học viên.</p>}
            {missions.length > 0 && <>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 10 }}>
                <label style={fieldLabelStyle}>Mission<select value={selectedMissionId} onChange={(e) => setSelectedMissionId(e.target.value)} style={{ ...inputStyle, maxWidth: 400 }}>
                  {missions.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select></label>
                {editable && <button onClick={autoGenerateOne} disabled={autoGenBusy || !selectedMissionId} className={styles.buttonSecondary} style={{ fontSize: 12 }}>✨ Tự động tạo cấu hình cho Mission này</button>}
              </div>
              {editable && <button onClick={autoGenerateAll} disabled={autoGenBusy} style={{ ...addBtnStyle, marginBottom: 14, borderColor: "#7b61ff", color: "#5b3df0" }}>
                {autoGenBusy ? "Đang tạo…" : "✨ Tự động tạo cho TẤT CẢ Mission chưa cấu hình trong Giai đoạn này"}
              </button>}
              {selectedMissionId && <MissionConfigEditor
                key={selectedMissionId} missionId={selectedMissionId} config={currentMissionConfig} memorySchema={detail.memorySchema} editable={editable}
                onSave={(patch) => saveMissionConfig(selectedMissionId, patch)} />}
            </>}
          </div>}

          {tab === "version" && <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            {versions.map((v) => <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #dde6ef", borderRadius: 12, padding: "10px 14px" }}>
              <div><b>v{v.versionNumber}</b> <span className={styles.badge}>{v.status === "published" ? "Đang áp dụng" : v.status === "draft" ? "Bản nháp" : "Đã lưu trữ"}</span>{v.publishedAt && <small style={{ display: "block", color: "#718092", fontSize: 11 }}>Áp dụng lúc {new Date(v.publishedAt).toLocaleString("vi-VN")}</small>}</div>
              {v.status === "archived" && <button className={styles.buttonSecondary} onClick={() => publish(v.id)} disabled={busy}>Áp dụng lại</button>}
              {v.id !== detail.id && <button className={styles.button} onClick={() => loadVersion(v.id)}>Xem</button>}
            </div>)}
          </div>}
        </div>
      </section>}
    </div>
  </SimpleOperationsShell>;
}

const fieldLabelStyle: React.CSSProperties = { display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: "#435065" };
const inputStyle: React.CSSProperties = { padding: "9px 11px", borderRadius: 10, border: "1px solid #dde6ef", fontSize: 13, font: "inherit" };
const deleteBtnStyle: React.CSSProperties = { border: "none", background: "none", color: "#b42318", cursor: "pointer", fontSize: 13 };
const addBtnStyle: React.CSSProperties = { alignSelf: "start", fontSize: 12, border: "1px dashed #9aa4b2", borderRadius: 10, padding: "6px 12px", background: "none", cursor: "pointer" };
const reorderBtnStyle: React.CSSProperties = { width: 22, height: 15, fontSize: 8, lineHeight: 1, border: "1px solid #dde6ef", borderRadius: 4, background: "#fff", cursor: "pointer", padding: 0, color: "#5b6472" };

/** Structured "từ khoá → giá trị" list — replaces the earlier one-per-line "khách trẻ=Khách trẻ 20-30" textarea (real complaint: easy to mistype the "=" separator, no visual sense of individual pairs). Same CoachExtractionRule[] shape either way, just a friendlier editor. */
function ExtractionRulesEditor({ rules, editable, onChange }: { rules: ExtractionRule[]; editable: boolean; onChange: (rules: ExtractionRule[]) => void }) {
  function updateRow(i: number, patch: Partial<ExtractionRule>) { onChange(rules.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }
  function addRow() { onChange([...rules, { pattern: "", value: "" }]); }
  function removeRow(i: number) { onChange(rules.filter((_, idx) => idx !== i)); }

  return <div style={{ display: "grid", gap: 6 }}>
    {rules.map((r, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 16px 1fr 20px", gap: 6, alignItems: "center" }}>
      <input value={r.pattern} disabled={!editable} placeholder="cô dâu" style={inputStyle} onChange={(e) => updateRow(i, { pattern: e.target.value })} />
      <span style={{ color: "#9aa4b2", fontSize: 12, textAlign: "center" }}>→</span>
      <input value={r.value} disabled={!editable} placeholder="Bridal Makeup" style={inputStyle} onChange={(e) => updateRow(i, { value: e.target.value })} />
      {editable && <button onClick={() => removeRow(i)} style={deleteBtnStyle} title="Xoá từ khoá này">✕</button>}
    </div>)}
    {rules.length === 0 && <small style={{ color: "#9aa4b2", fontSize: 11 }}>Chưa có từ khoá nào — khi không khớp gì, Coach vẫn hoạt động: câu trả lời gốc của học viên trở thành giá trị trực tiếp.</small>}
    {editable && <button onClick={addRow} style={{ ...addBtnStyle, justifySelf: "start" }}>+ Thêm từ khoá</button>}
  </div>;
}

function MemorySchemaEditor({ schema, editable, onChange }: { schema: MemoryField[]; editable: boolean; onChange: (schema: MemoryField[]) => void }) {
  const [rows, setRows] = useState<MemoryField[]>(schema);
  function update(index: number, patch: Partial<MemoryField>) { const next = rows.map((r, i) => i === index ? { ...r, ...patch } : r); setRows(next); onChange(next); }
  function addRow() { const next = [...rows, { key: "", label: "", namespace: "career", type: "text" as const, requiresConfirmation: true }]; setRows(next); }
  function removeRow(index: number) { const next = rows.filter((_, i) => i !== index); setRows(next); onChange(next); }

  return <div style={{ display: "grid", gap: 14, maxWidth: 760 }}>
    <p style={{ fontSize: 12, color: "#718092" }}>Field key dạng &quot;namespace.field&quot;, ví dụ career.direction — Mission sau sẽ tự đọc lại field đã confirm, không hỏi lại.</p>
    {rows.map((row, i) => <div key={i} style={{ border: "1px solid #eef1f4", borderRadius: 12, padding: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px 90px auto", gap: 6, alignItems: "center" }}>
        <input value={row.key} disabled={!editable} placeholder="career.direction" style={inputStyle} onChange={(e) => update(i, { key: e.target.value, namespace: e.target.value.split(".")[0] || "career" })} />
        <input value={row.label} disabled={!editable} placeholder="Hướng nghề" style={inputStyle} onChange={(e) => update(i, { label: e.target.value })} />
        <select value={row.type} disabled={!editable} style={inputStyle} onChange={(e) => update(i, { type: e.target.value as MemoryField["type"] })}>
          {["text", "number", "boolean", "select", "multi_select", "date", "json"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={row.requiresConfirmation ?? true} disabled={!editable} onChange={(e) => update(i, { requiresConfirmation: e.target.checked })} />Cần xác nhận</label>
        {editable && <button onClick={() => removeRow(i)} style={deleteBtnStyle}>✕</button>}
      </div>
      <div>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#435065", display: "block", marginBottom: 4 }}>Quy tắc nhận diện Offline (chỉ áp dụng khi Chế độ AI = Offline)</span>
        <ExtractionRulesEditor rules={row.extractionRules ?? []} editable={editable} onChange={(rules) => update(i, { extractionRules: rules })} />
      </div>
    </div>)}
    {editable && <button onClick={addRow} style={addBtnStyle}>+ Thêm field</button>}
  </div>;
}

function buildStubProfile(memorySchema: MemoryField[]): CoachStageProfileVersion {
  return {
    id: "preview", organizationId: "preview", profileId: "preview", versionNumber: 0, status: "draft",
    name: "preview", coachRole: "", systemTone: "", providerMode: "offline",
    knowledgeScope: { resourceIds: [], allowMissionBindings: true, allowStageCurriculum: true },
    memorySchema, publishedAt: null, createdAt: "", updatedAt: ""
  };
}

/**
 * Real complaint this answers: admin had no way to see what Coach will actually ask until publishing
 * and opening the student screen. This simulates a full turn using the EXACT SAME pure functions
 * production runs (lib/h2o-coach/offline-engine.ts — no server-only dependency by design, same reason
 * they're Vitest-importable), fed with this page's live in-editor state (including unsaved changes),
 * so "what you test here" and "what ships" are provably the same code path, not a re-implementation
 * that could silently drift. Runs entirely in the browser — no network call, nothing written to any
 * real learner's data. AI/Hybrid mode cannot be simulated this way (it needs a real provider call), so
 * this always simulates the Offline Rule Engine, which is also the one thing that is 100% deterministic
 * and worth verifying before publish.
 */
function CoachTestChatPanel({ missionId, objective, requiredFields, questions, memorySchema }: { missionId: string; objective: string; requiredFields: string[]; questions: QuestionRule[]; memorySchema: MemoryField[] }) {
  const [open, setOpen] = useState(false);
  const [memory, setMemory] = useState<LearnerMemoryValue[]>([]);
  const [messages, setMessages] = useState<{ role: "coach" | "learner"; text: string }[]>([]);
  const [input, setInput] = useState("");

  function buildCtx(currentMemory: LearnerMemoryValue[]): CoachRuntimeContext {
    return {
      organizationId: "preview", learnerId: "preview", stageId: "preview", missionId,
      profile: buildStubProfile(memorySchema),
      missionConfig: { id: "preview", missionId, profileVersionId: "preview", objective, coachInstructions: "", requiredFields, questions, tools: [], rubric: {}, evidenceRequirements: [] },
      memory: currentMemory
    };
  }

  function reset() {
    const opening = runOfflineCoachTurn(buildCtx([]));
    setMemory([]);
    setMessages([{ role: "coach", text: `Mình sẽ cùng bạn hoàn thành "${objective || "mục tiêu này"}". ${opening.reply}` }]);
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");

    // Mirrors lib/h2o-coach/service.ts's handleCoachTurn extraction step exactly (minus persistence/
    // AI/evidence-handoff, which need real infra this preview intentionally doesn't touch).
    const stateBeforeTurn = determineMissionState(requiredFields, memory, missionId);
    const confirmedKeys = new Set(memory.filter((m) => m.status === "confirmed").map((m) => m.field));
    let candidates: CoachCandidateExtraction[] = [];
    if (stateBeforeTurn === "awaiting_confirmation") {
      if (detectConfirmIntent(text) === "confirm") candidates = [{ field: missionConfirmedFieldKey(missionId), value: true, confidence: 1, requiresConfirmation: false, rationale: "test confirm" }];
    } else {
      candidates = extractCandidatesFromText(text, memorySchema, confirmedKeys);
      if (!candidates.length) {
        const activeRule = nextOfflineQuestionRule(buildCtx(memory));
        const targetField = activeRule ? questionTargetField(activeRule) : null;
        if (targetField && !confirmedKeys.has(targetField)) candidates = [{ field: targetField, value: text, confidence: 0.6, requiresConfirmation: false, rationale: "câu trả lời trực tiếp" }];
      }
    }

    const nextMemory = [...memory];
    for (const c of candidates) {
      const entry: LearnerMemoryValue = { field: c.field, namespace: c.field.split(".")[0] ?? c.field, value: c.value, status: c.requiresConfirmation ? "proposed" : "confirmed", updatedAt: new Date().toISOString() };
      const idx = nextMemory.findIndex((m) => m.field === c.field);
      if (idx >= 0) nextMemory[idx] = entry; else nextMemory.push(entry);
    }
    const result = runOfflineCoachTurn(buildCtx(nextMemory), candidates);
    setMemory(nextMemory);
    setMessages((prev) => [...prev, { role: "learner", text }, { role: "coach", text: result.reply }]);
  }

  const progressPercent = calculateCoachProgress(requiredFields, memory, missionId);

  return <div style={{ border: "1px solid #dde6ef", borderRadius: 14, marginTop: 18 }}>
    <button onClick={() => { const next = !open; setOpen(next); if (next && messages.length === 0) reset(); }}
      style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#f7f5ff", border: "none", borderRadius: open ? "14px 14px 0 0" : 14, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#5b3df0" }}>
      <span>🧪 Chat thử với cấu hình hiện tại</span><span>{open ? "▲ Thu gọn" : "▼ Mở"}</span>
    </button>
    {open && <div style={{ padding: 14 }}>
      <p style={{ fontSize: 11, color: "#9aa4b2", margin: "0 0 10px" }}>Mô phỏng đúng luật Coach Offline thật (không gọi AI, không lưu vào dữ liệu học viên nào cả) — dùng để kiểm tra thứ tự câu hỏi và từ khoá nhận diện trước khi bấm &quot;Áp dụng cho học viên&quot;.</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#435065" }}>Tiến độ mô phỏng: {progressPercent}%</span>
        <button onClick={reset} className={styles.buttonSecondary} style={{ fontSize: 11, padding: "4px 10px" }}>↺ Đặt lại</button>
      </div>
      <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 10, padding: 10, background: "#f8fafc", borderRadius: 10 }}>
        {messages.map((m, i) => <div key={i} style={{ alignSelf: m.role === "coach" ? "flex-start" : "flex-end", maxWidth: "85%", background: m.role === "coach" ? "#fff" : "#0d1624", color: m.role === "coach" ? "#1c2333" : "#fff", border: m.role === "coach" ? "1px solid #eef1f4" : "none", borderRadius: 12, padding: "8px 11px", fontSize: 12, whiteSpace: "pre-line" }}>{m.text}</div>)}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Nhập câu trả lời thử của học viên..." style={{ ...inputStyle, flex: 1 }} />
        <button onClick={send} disabled={!input.trim()} className={styles.buttonPrimary}>Gửi</button>
      </div>
    </div>}
  </div>;
}

function MissionConfigEditor({ missionId, config, memorySchema, editable, onSave }: { missionId: string; config?: MissionConfig; memorySchema: MemoryField[]; editable: boolean; onSave: (patch: Partial<Pick<MissionConfig, "objective" | "coachInstructions" | "requiredFields" | "questions" | "tools" | "rubric" | "evidenceRequirements">>) => void }) {
  const [objective, setObjective] = useState(config?.objective ?? "");
  const [coachInstructions, setCoachInstructions] = useState(config?.coachInstructions ?? "");
  const [requiredFields, setRequiredFields] = useState<string[]>(config?.requiredFields ?? []);
  // Sorted by priority descending on load so on-screen order always matches the real ask-order —
  // some earlier-authored Missions may not have array order == priority order, this self-corrects it.
  const [questions, setQuestions] = useState<QuestionRule[]>(() => [...(config?.questions ?? [])].sort((a, b) => b.priority - a.priority));
  const [tools, setTools] = useState<ToolBinding[]>(config?.tools ?? []);
  const [rubricText, setRubricText] = useState(JSON.stringify(config?.rubric ?? {}, null, 2));
  const [evidenceText, setEvidenceText] = useState(JSON.stringify(config?.evidenceRequirements ?? [], null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  function saveRubric() {
    try { onSave({ rubric: JSON.parse(rubricText || "{}") }); setJsonError(null); }
    catch { setJsonError("Rubric không phải JSON hợp lệ."); }
  }
  function saveEvidence() {
    try { onSave({ evidenceRequirements: JSON.parse(evidenceText || "[]") }); setJsonError(null); }
    catch { setJsonError("Evidence Requirements không phải JSON hợp lệ."); }
  }

  function toggleField(key: string) { const next = requiredFields.includes(key) ? requiredFields.filter((f) => f !== key) : [...requiredFields, key]; setRequiredFields(next); onSave({ requiredFields: next }); }

  // Real complaint this answers: admin had to type a raw priority number (4, 3, 2, 1...) per question
  // with no visual sense of the resulting order. Array position IS the ask-order now — ▲/▼ just swap
  // neighbors, and priority values are derived automatically (never hand-edited) so the underlying
  // "higher priority asked first" contract offline-engine.ts's nextOfflineQuestionRule() relies on
  // never breaks, regardless of how the list gets reordered here.
  function reassignPriorities(list: QuestionRule[]): QuestionRule[] { return list.map((q, idx) => ({ ...q, priority: list.length - idx })); }
  function addQuestion() {
    const next = reassignPriorities([...questions, { id: crypto.randomUUID(), when: [{ field: memorySchema[0]?.key ?? "", op: "missing" as const }], prompt: "", priority: 0 }]);
    setQuestions(next); onSave({ questions: next });
  }
  function updateQuestion(i: number, patch: Partial<QuestionRule>) { const next = questions.map((q, idx) => idx === i ? { ...q, ...patch } : q); setQuestions(next); onSave({ questions: next }); }
  function removeQuestion(i: number) { const next = reassignPriorities(questions.filter((_, idx) => idx !== i)); setQuestions(next); onSave({ questions: next }); }
  function moveQuestion(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    const reassigned = reassignPriorities(next);
    setQuestions(reassigned); onSave({ questions: reassigned });
  }
  function addTool() { const next = [...tools, { toolKey: "", label: "" }]; setTools(next); }
  function updateTool(i: number, patch: Partial<ToolBinding>) { const next = tools.map((t, idx) => idx === i ? { ...t, ...patch } : t); setTools(next); onSave({ tools: next }); }
  function removeTool(i: number) { const next = tools.filter((_, idx) => idx !== i); setTools(next); onSave({ tools: next }); }

  return <div key={missionId} style={{ display: "grid", gap: 16, marginTop: 14, maxWidth: 760 }}>
    <label style={fieldLabelStyle}>Mục tiêu Mission (objective — học viên nhìn thấy)<input value={objective} disabled={!editable} style={inputStyle} onChange={(e) => setObjective(e.target.value)} onBlur={() => onSave({ objective })} /></label>
    <label style={fieldLabelStyle}>Hướng dẫn riêng cho Coach (nội bộ, không đọc nguyên văn cho học viên)
      <textarea rows={2} value={coachInstructions} disabled={!editable} style={inputStyle} onChange={(e) => setCoachInstructions(e.target.value)} onBlur={() => onSave({ coachInstructions })} />
    </label>

    <div>
      <span style={{ ...fieldLabelStyle, display: "block", marginBottom: 6 } as React.CSSProperties}>Dữ liệu cần thu (từ Bản đồ ghi nhớ)</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {memorySchema.length === 0 && <small style={{ color: "#9aa4b2" }}>Chưa có field nào — cấu hình ở tab &quot;4. Dữ liệu cần ghi nhớ&quot; trước.</small>}
        {memorySchema.map((f) => <button key={f.key} disabled={!editable} onClick={() => toggleField(f.key)}
          style={{ borderRadius: 999, border: requiredFields.includes(f.key) ? "1px solid #2563eb" : "1px solid #dde6ef", background: requiredFields.includes(f.key) ? "#eff6ff" : "#fff", padding: "4px 10px", fontSize: 11, cursor: editable ? "pointer" : "default" }}>{f.label} ({f.key})</button>)}
      </div>
    </div>

    <div>
      <span style={{ ...fieldLabelStyle, display: "block", marginBottom: 6 } as React.CSSProperties}>Quy tắc Coaching (IF thiếu field → hỏi) — thứ tự trên xuống dưới là thứ tự Coach sẽ hỏi</span>
      {questions.map((q, i) => <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #eef1f4", borderRadius: 10, padding: "8px 10px", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#9aa4b2", minWidth: 16, textAlign: "center" }}>{i + 1}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <button onClick={() => moveQuestion(i, -1)} disabled={!editable || i === 0} style={reorderBtnStyle} title="Hỏi sớm hơn">▲</button>
          <button onClick={() => moveQuestion(i, 1)} disabled={!editable || i === questions.length - 1} style={reorderBtnStyle} title="Hỏi muộn hơn">▼</button>
        </div>
        <select value={q.when[0]?.field ?? ""} disabled={!editable} style={{ ...inputStyle, width: 210, flexShrink: 0 }} onChange={(e) => updateQuestion(i, { when: [{ ...q.when[0], field: e.target.value, op: q.when[0]?.op ?? "missing" }] })}>
          {memorySchema.map((f) => <option key={f.key} value={f.key}>Khi thiếu: {f.label}</option>)}
        </select>
        <input value={q.prompt} disabled={!editable} placeholder="Câu hỏi sẽ hỏi học viên" style={{ ...inputStyle, flex: 1 }} onChange={(e) => updateQuestion(i, { prompt: e.target.value })} />
        {editable && <button onClick={() => removeQuestion(i)} style={deleteBtnStyle}>✕</button>}
      </div>)}
      {editable && <button onClick={addQuestion} style={addBtnStyle}>+ Thêm câu hỏi</button>}
    </div>

    <CoachTestChatPanel missionId={missionId} objective={objective} requiredFields={requiredFields} questions={questions} memorySchema={memorySchema} />

    <div>
      <span style={{ ...fieldLabelStyle, display: "block", marginBottom: 6 } as React.CSSProperties}>Công cụ được phép sử dụng</span>
      {tools.map((t, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 6, marginBottom: 6 }}>
        <input value={t.toolKey} disabled={!editable} placeholder="career_map_builder" style={inputStyle} onChange={(e) => updateTool(i, { toolKey: e.target.value })} />
        <input value={t.label} disabled={!editable} placeholder="Career Map Builder" style={inputStyle} onChange={(e) => updateTool(i, { label: e.target.value })} />
        <input value={t.href ?? ""} disabled={!editable} placeholder="/student/create/... (tuỳ chọn)" style={inputStyle} onChange={(e) => updateTool(i, { href: e.target.value })} />
        {editable && <button onClick={() => removeTool(i)} style={deleteBtnStyle}>✕</button>}
      </div>)}
      {editable && <button onClick={addTool} style={addBtnStyle}>+ Thêm công cụ</button>}
    </div>

    <div>
      <span style={{ ...fieldLabelStyle, display: "block", marginBottom: 6 } as React.CSSProperties}>Rubric (JSON — tiêu chí chấm, chỉ tham khảo cho Coach, không tự động chấm điểm)</span>
      <textarea rows={4} value={rubricText} disabled={!editable} style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12 }} onChange={(e) => setRubricText(e.target.value)} onBlur={saveRubric} />
    </div>
    <div>
      <span style={{ ...fieldLabelStyle, display: "block", marginBottom: 6 } as React.CSSProperties}>Evidence Requirements (JSON array — yêu cầu bằng chứng gợi ý, không thay thế cơ chế Minh chứng đã có)</span>
      <textarea rows={4} value={evidenceText} disabled={!editable} style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12 }} onChange={(e) => setEvidenceText(e.target.value)} onBlur={saveEvidence} />
    </div>
    {jsonError && <p style={{ fontSize: 12, color: "#b42318" }}>{jsonError}</p>}
  </div>;
}
