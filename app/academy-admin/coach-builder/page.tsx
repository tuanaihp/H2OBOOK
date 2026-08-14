"use client";
import { useEffect, useState } from "react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

interface StageSummary { stageId: string; stageTitle: string; stagePosition: number; profileId: string | null; publishedVersionId: string | null; publishedVersionNumber: number | null; latestDraftVersionId: string | null; status: "published" | "draft" | "unconfigured" }
interface VersionRow { id: string; versionNumber: number; status: "draft" | "published" | "archived"; publishedAt: string | null }
interface ExtractionRule { pattern: string; value: string }
interface MemoryField { key: string; label: string; namespace: string; type: string; required?: boolean; requiresConfirmation?: boolean; extractionRules?: ExtractionRule[] }
interface Condition { field: string; op: "missing" | "present" | "eq" | "neq" | "contains"; value?: string }
interface QuestionRule { id: string; when: Condition[]; prompt: string; targetField?: string; priority: number }
interface ToolBinding { toolKey: string; label: string; href?: string; required?: boolean }
interface MissionConfig { id: string; missionId: string; objective: string; requiredFields: string[]; questions: QuestionRule[]; tools: ToolBinding[] }
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

  async function saveMissionConfig(missionId: string, patch: Partial<Pick<MissionConfig, "objective" | "requiredFields" | "questions" | "tools">>) {
    if (!detail || !editable) return;
    const existing = detail.missionConfigs.find((m) => m.missionId === missionId);
    const body = { profileVersionId: detail.id, missionId, objective: patch.objective ?? existing?.objective ?? "", requiredFields: patch.requiredFields ?? existing?.requiredFields ?? [], questions: patch.questions ?? existing?.questions ?? [], tools: patch.tools ?? existing?.tools ?? [] };
    setBusy(true);
    const { ok, json } = await api<{ id: string }>("/api/academy-admin/coach-builder/mission-configs", { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!ok) return;
    setDetail({ ...detail, missionConfigs: existing ? detail.missionConfigs.map((m) => m.missionId === missionId ? { ...m, ...body } : m) : [...detail.missionConfigs, { id: json.id, ...body }] });
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
              <label style={fieldLabelStyle}>Mission<select value={selectedMissionId} onChange={(e) => setSelectedMissionId(e.target.value)} style={{ ...inputStyle, maxWidth: 400 }}>
                {missions.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select></label>
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

function MemorySchemaEditor({ schema, editable, onChange }: { schema: MemoryField[]; editable: boolean; onChange: (schema: MemoryField[]) => void }) {
  const [rows, setRows] = useState<MemoryField[]>(schema);
  function update(index: number, patch: Partial<MemoryField>) { const next = rows.map((r, i) => i === index ? { ...r, ...patch } : r); setRows(next); onChange(next); }
  function addRow() { const next = [...rows, { key: "", label: "", namespace: "career", type: "text" as const, requiresConfirmation: true }]; setRows(next); }
  function removeRow(index: number) { const next = rows.filter((_, i) => i !== index); setRows(next); onChange(next); }

  function updateRules(index: number, text: string) {
    const rules: ExtractionRule[] = text.split("\n").map((line) => {
      const [pattern, value] = line.split("=");
      return { pattern: (pattern ?? "").trim(), value: (value ?? "").trim() };
    }).filter((r) => r.pattern && r.value);
    update(index, { extractionRules: rules });
  }
  function rulesToText(rules?: ExtractionRule[]): string {
    return (rules ?? []).map((r) => `${r.pattern}=${r.value}`).join("\n");
  }

  return <div style={{ display: "grid", gap: 14, maxWidth: 760 }}>
    <p style={{ fontSize: 12, color: "#718092" }}>Field key dạng &quot;namespace.field&quot;, ví dụ career.direction — Mission sau sẽ tự đọc lại field đã confirm, không hỏi lại.</p>
    {rows.map((row, i) => <div key={i} style={{ border: "1px solid #eef1f4", borderRadius: 12, padding: 10, display: "grid", gap: 6 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px 90px auto", gap: 6, alignItems: "center" }}>
        <input value={row.key} disabled={!editable} placeholder="career.direction" style={inputStyle} onChange={(e) => update(i, { key: e.target.value, namespace: e.target.value.split(".")[0] || "career" })} />
        <input value={row.label} disabled={!editable} placeholder="Hướng nghề" style={inputStyle} onChange={(e) => update(i, { label: e.target.value })} />
        <select value={row.type} disabled={!editable} style={inputStyle} onChange={(e) => update(i, { type: e.target.value as MemoryField["type"] })}>
          {["text", "number", "boolean", "select", "multi_select", "date", "json"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={row.requiresConfirmation ?? true} disabled={!editable} onChange={(e) => update(i, { requiresConfirmation: e.target.checked })} />Cần xác nhận</label>
        {editable && <button onClick={() => removeRow(i)} style={{ border: "none", background: "none", color: "#b42318", cursor: "pointer" }}>✕</button>}
      </div>
      <label style={fieldLabelStyle}>Quy tắc nhận diện Offline (mỗi dòng: từ khoá=giá trị lưu lại, ví dụ &quot;cô dâu=Bridal Makeup&quot;) — chỉ áp dụng khi Chế độ AI = Offline
        <textarea rows={2} defaultValue={rulesToText(row.extractionRules)} disabled={!editable} style={inputStyle} onBlur={(e) => updateRules(i, e.target.value)} />
      </label>
    </div>)}
    {editable && <button onClick={addRow} style={{ alignSelf: "start", fontSize: 12, border: "1px dashed #9aa4b2", borderRadius: 10, padding: "6px 12px", background: "none", cursor: "pointer" }}>+ Thêm field</button>}
  </div>;
}

function MissionConfigEditor({ missionId, config, memorySchema, editable, onSave }: { missionId: string; config?: MissionConfig; memorySchema: MemoryField[]; editable: boolean; onSave: (patch: Partial<Pick<MissionConfig, "objective" | "requiredFields" | "questions" | "tools">>) => void }) {
  const [objective, setObjective] = useState(config?.objective ?? "");
  const [requiredFields, setRequiredFields] = useState<string[]>(config?.requiredFields ?? []);
  const [questions, setQuestions] = useState<QuestionRule[]>(config?.questions ?? []);
  const [tools, setTools] = useState<ToolBinding[]>(config?.tools ?? []);

  function toggleField(key: string) { const next = requiredFields.includes(key) ? requiredFields.filter((f) => f !== key) : [...requiredFields, key]; setRequiredFields(next); onSave({ requiredFields: next }); }
  function addQuestion() { const next = [...questions, { id: crypto.randomUUID(), when: [{ field: memorySchema[0]?.key ?? "", op: "missing" as const }], prompt: "", priority: questions.length }]; setQuestions(next); onSave({ questions: next }); }
  function updateQuestion(i: number, patch: Partial<QuestionRule>) { const next = questions.map((q, idx) => idx === i ? { ...q, ...patch } : q); setQuestions(next); onSave({ questions: next }); }
  function removeQuestion(i: number) { const next = questions.filter((_, idx) => idx !== i); setQuestions(next); onSave({ questions: next }); }
  function addTool() { const next = [...tools, { toolKey: "", label: "" }]; setTools(next); }
  function updateTool(i: number, patch: Partial<ToolBinding>) { const next = tools.map((t, idx) => idx === i ? { ...t, ...patch } : t); setTools(next); onSave({ tools: next }); }
  function removeTool(i: number) { const next = tools.filter((_, idx) => idx !== i); setTools(next); onSave({ tools: next }); }

  return <div key={missionId} style={{ display: "grid", gap: 16, marginTop: 14, maxWidth: 760 }}>
    <label style={fieldLabelStyle}>Mục tiêu Mission (objective)<input value={objective} disabled={!editable} style={inputStyle} onChange={(e) => setObjective(e.target.value)} onBlur={() => onSave({ objective })} /></label>

    <div>
      <span style={{ ...fieldLabelStyle, display: "block", marginBottom: 6 } as React.CSSProperties}>Dữ liệu cần thu (từ Bản đồ ghi nhớ)</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {memorySchema.length === 0 && <small style={{ color: "#9aa4b2" }}>Chưa có field nào — cấu hình ở tab &quot;4. Dữ liệu cần ghi nhớ&quot; trước.</small>}
        {memorySchema.map((f) => <button key={f.key} disabled={!editable} onClick={() => toggleField(f.key)}
          style={{ borderRadius: 999, border: requiredFields.includes(f.key) ? "1px solid #2563eb" : "1px solid #dde6ef", background: requiredFields.includes(f.key) ? "#eff6ff" : "#fff", padding: "4px 10px", fontSize: 11, cursor: editable ? "pointer" : "default" }}>{f.key}</button>)}
      </div>
    </div>

    <div>
      <span style={{ ...fieldLabelStyle, display: "block", marginBottom: 6 } as React.CSSProperties}>Quy tắc Coaching (IF thiếu field → hỏi)</span>
      {questions.map((q, i) => <div key={q.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr 70px auto", gap: 6, marginBottom: 6 }}>
        <select value={q.when[0]?.field ?? ""} disabled={!editable} style={inputStyle} onChange={(e) => updateQuestion(i, { when: [{ ...q.when[0], field: e.target.value, op: q.when[0]?.op ?? "missing" }] })}>
          {memorySchema.map((f) => <option key={f.key} value={f.key}>{f.key} chưa có</option>)}
        </select>
        <input value={q.prompt} disabled={!editable} placeholder="Câu hỏi sẽ hỏi học viên" style={inputStyle} onChange={(e) => updateQuestion(i, { prompt: e.target.value })} />
        <input type="number" value={q.priority} disabled={!editable} style={inputStyle} onChange={(e) => updateQuestion(i, { priority: Number(e.target.value) })} />
        {editable && <button onClick={() => removeQuestion(i)} style={{ border: "none", background: "none", color: "#b42318", cursor: "pointer" }}>✕</button>}
      </div>)}
      {editable && <button onClick={addQuestion} style={{ fontSize: 12, border: "1px dashed #9aa4b2", borderRadius: 10, padding: "6px 12px", background: "none", cursor: "pointer" }}>+ Thêm câu hỏi</button>}
    </div>

    <div>
      <span style={{ ...fieldLabelStyle, display: "block", marginBottom: 6 } as React.CSSProperties}>Công cụ được phép sử dụng</span>
      {tools.map((t, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 6, marginBottom: 6 }}>
        <input value={t.toolKey} disabled={!editable} placeholder="career_map_builder" style={inputStyle} onChange={(e) => updateTool(i, { toolKey: e.target.value })} />
        <input value={t.label} disabled={!editable} placeholder="Career Map Builder" style={inputStyle} onChange={(e) => updateTool(i, { label: e.target.value })} />
        <input value={t.href ?? ""} disabled={!editable} placeholder="/student/create/... (tuỳ chọn)" style={inputStyle} onChange={(e) => updateTool(i, { href: e.target.value })} />
        {editable && <button onClick={() => removeTool(i)} style={{ border: "none", background: "none", color: "#b42318", cursor: "pointer" }}>✕</button>}
      </div>)}
      {editable && <button onClick={addTool} style={{ fontSize: 12, border: "1px dashed #9aa4b2", borderRadius: 10, padding: "6px 12px", background: "none", cursor: "pointer" }}>+ Thêm công cụ</button>}
    </div>
  </div>;
}
