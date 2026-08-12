"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, RefreshCw, CheckCircle2, Archive, Copy, AlertTriangle, Search, X, Eye, Trash2, GitBranch, ChevronUp, ChevronDown, Lock } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import { MissionWorkspaceBuilder } from "@/components/academy-admin/mission-workspace-builder";
import { OutcomeEditorPanel } from "@/components/academy-admin/outcome-editor";
import { MilestoneEditorPanel } from "@/components/academy-admin/milestone-editor";
import { JourneyInlineGuide } from "@/components/academy-data-link/inline-guide";
import styles from "@/components/operations/operations.module.css";

// Vietnamese terminology dictionary — v5/33-.../docs/TERMS_VI.md is the source of truth. Every
// label a Admin sees in this Builder must come from here, not ad-hoc English/mixed strings.
const TERMS = {
  outcome: "Kết quả", milestone: "Chặng", mission: "Nhiệm vụ", entry: "Bắt đầu",
  expectedResult: "Kết quả đầu ra", completionPolicy: "Cách xác nhận hoàn thành", estimatedDays: "Thời lượng dự kiến",
  prerequisite: "Điều kiện mở khóa", successKpi: "Tiêu chí đạt", resourceBindings: "Học liệu liên kết",
  assignmentBindings: "Bài tập liên kết", actionTemplates: "Việc cần làm", missionWorkspace: "Không gian làm việc",
  preflight: "Kiểm tra", publish: "Áp dụng cho học viên", published: "Đang áp dụng", draft: "Bản nháp", archived: "Đã lưu trữ"
} as const;

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
type Milestone = { id: string; title: string; description: string; position: number; missions: Mission[] };
type Outcome = { id: string; title: string; description: string; position: number; milestones: Milestone[] };
type Finding = { severity: "blocker" | "warning"; category: string; missionId: string | null; missionTitle: string | null; message: string };
type Preflight = { ok: boolean; findings: Finding[] };
type ResourceResult = { resourceType: string; resourceId: string; title: string; summary: string; sourceLabel: string; stageTitle: string };
type BulkCloneResult = { stageId: string; versionId: string; versionNumber: number };
type InspectorTab = "overview" | "resources" | "actions" | "workspace" | "unlock";
type NodeType = "outcome" | "milestone" | "mission";
type SelectedNode = { type: NodeType; id: string } | null;

const field = { padding: 8, borderRadius: 8, border: "1px solid #dfe3e8", fontSize: 12, width: "100%" } as const;
// "v3 — Bản nháp" / "v1 — Đang áp dụng" / "v0 — Đã lưu trữ" (§15) — no English status words anywhere in the selector.
const STATUS_LABEL: Record<string, string> = { draft: TERMS.draft, published: TERMS.published, archived: TERMS.archived };
const COMPLETION_POLICY_LABEL: Record<string, string> = { self_reported: "Học viên tự xác nhận", evidence_required: "Cần nộp bằng chứng", teacher_verified: "Giảng viên duyệt", metric_based: "Đạt chỉ số/KPI" };
const CATEGORY_LABEL: Record<string, string> = { structure: "Cấu trúc", missing_kpi: `Thiếu ${TERMS.successKpi}`, missing_duration: `Thiếu ${TERMS.estimatedDays}`, missing_binding: `Thiếu ${TERMS.resourceBindings}`, circular: `Vòng lặp ${TERMS.prerequisite}`, broken_reference: "Tham chiếu gãy", other: "Khác" };
const TAB_LABEL: Record<InspectorTab, string> = { overview: "1. Tổng quan", resources: "2. Học liệu", actions: "3. Việc cần làm", workspace: "4. Không gian làm việc", unlock: "5. Mở khóa & đánh giá" };
const CLONE_OPTION_LABEL: Record<keyof CloneOptions, string> = { copyResources: TERMS.resourceBindings, copyActions: TERMS.actionTemplates, copyWorkspaceBlocks: TERMS.missionWorkspace, copyPrerequisites: TERMS.prerequisite };

type CloneOptions = { copyResources: boolean; copyActions: boolean; copyWorkspaceBlocks: boolean; copyPrerequisites: boolean };
const DEFAULT_CLONE_OPTIONS: CloneOptions = { copyResources: true, copyActions: true, copyWorkspaceBlocks: true, copyPrerequisites: true };

// Wrapped in Suspense because useSearchParams() (deep-linking ?stageId=/?missionId= from
// /academy-admin/data-link's Setup Guide and Resource Inspector CTAs) opts this route out of static
// prerendering unless a boundary is present — Next.js build fails otherwise.
export default function JourneyMapAdminPage() {
  return <Suspense fallback={null}><JourneyMapAdminPageInner /></Suspense>;
}

function JourneyMapAdminPageInner() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [stageId, setStageId] = useState("");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [selected, setSelected] = useState<SelectedNode>(null);
  const [activeTab, setActiveTab] = useState<InspectorTab>("overview");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<ResourceResult[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewAsStudent, setPreviewAsStudent] = useState(false);
  const [bulkCloneOpen, setBulkCloneOpen] = useState(false);
  const [bulkCloneTargets, setBulkCloneTargets] = useState<Set<string>>(new Set());
  const [bulkCloneOptions, setBulkCloneOptions] = useState<CloneOptions>(DEFAULT_CLONE_OPTIONS);
  const [bulkCloneResults, setBulkCloneResults] = useState<BulkCloneResult[] | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteNodeConfirm, setDeleteNodeConfirm] = useState<{ type: "outcome" | "milestone"; id: string; title: string } | null>(null);

  const searchParams = useSearchParams();
  const deepLinkStageId = searchParams.get("stageId");
  const deepLinkMissionId = searchParams.get("missionId");
  const deepLinkNodeId = searchParams.get("node");
  const deepLinkNodeType = searchParams.get("type") as NodeType | null;

  useEffect(() => {
    fetch("/api/academy-admin/stages", { cache: "no-store" }).then((r) => r.json()).then((json) => {
      const list = (json?.stages ?? []).map((s: { id: string; title: string; indexLabel?: string }) => ({ id: s.id, title: s.title, indexLabel: s.indexLabel ?? "" }));
      setStages(list);
      // Setup Guide / Resource Data Link Inspector CTAs (folder 34) link here with ?stageId=... —
      // land on that Stage instead of always defaulting to the first one.
      const preselected = deepLinkStageId && list.some((s: Stage) => s.id === deepLinkStageId) ? deepLinkStageId : list[0]?.id;
      if (preselected) setStageId(preselected);
    }).catch(() => null);
  }, [deepLinkStageId]);

  // resetSelection defaults to false: a save (onBlur/onChange -> call() -> loadJourney) must not
  // close whatever Outcome/Chặng/Nhiệm vụ panel Admin is looking at, or "Lưu thay đổi" would feel
  // like it closes the very thing you just edited. Only an actual Stage/Version switch clears it.
  async function loadJourney(forStageId: string, forVersionId?: string, resetSelection = false) {
    if (!forStageId) return;
    setLoading(true); setPreflight(null); setActiveCategory(null);
    if (resetSelection) { setSelected(null); setActiveTab("overview"); }
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

  useEffect(() => { if (stageId) loadJourney(stageId, undefined, true); }, [stageId]);

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

  async function submitBulkClone() {
    if (!versionId || !bulkCloneTargets.size) return;
    setBusy(true); setMessage(null);
    const res = await fetch("/api/academy-admin/learn-outcome/version", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "bulk-clone", versionId, targetStageIds: [...bulkCloneTargets], ...bulkCloneOptions })
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setMessage(json?.error ?? "Nhân bản thất bại."); return; }
    setBulkCloneResults(json.results ?? []);
  }

  async function confirmDeleteDraft() {
    if (!versionId) return;
    const ok = await call("/api/academy-admin/learn-outcome/version", { action: "delete", versionId }, "Đã xóa bản nháp.");
    setDeleteConfirmOpen(false);
    if (ok) loadJourney(stageId, undefined, true);
  }

  async function searchResources(query: string) {
    setPickerQuery(query);
    if (!query.trim()) { setPickerResults([]); return; }
    const res = await fetch(`/api/academy-admin/learn-outcome/resource-search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setPickerResults(json?.results ?? []);
  }

  // §9 Published immutable: the only write a read-only version allows is cloning its way out of
  // read-only — same duplicateVersion() the "Nhân bản phiên bản này" button already uses, via a
  // dedicated action so it also emits journey.version.cloned_for_edit.
  async function cloneForEdit() {
    if (!blueprint || !versionId) return;
    setBusy(true); setMessage(null);
    try {
      const res = await fetch("/api/academy-admin/learn-outcome/version", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "clone-for-edit", blueprintId: blueprint.id, versionId }) });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setMessage(json?.error ?? "Không tạo được bản nháp."); return; }
      setMessage("Đã tạo bản nháp mới để chỉnh sửa.");
      await loadJourney(stageId, json.versionId, true);
    } catch {
      setMessage("Mất kết nối — thử lại.");
    } finally { setBusy(false); }
  }

  // §10 Reorder: same-parent ↑↓ swap, same shape as the Stage list's moveStage.
  async function moveNode(nodeType: NodeType, nodeId: string, direction: -1 | 1) {
    await call("/api/academy-admin/learn-outcome/node", { action: "reorder", nodeType, nodeId, direction }, "Đã đổi thứ tự.");
  }

  async function saveOutcomeNode(outcomeId: string, patch: { title: string; description: string }) {
    await call("/api/academy-admin/learn-outcome/node", { action: "updateOutcome", outcomeId, title: patch.title, description: patch.description }, "Đã lưu Kết quả.");
  }
  async function saveMilestoneNode(milestoneId: string, patch: { title: string; description: string }) {
    await call("/api/academy-admin/learn-outcome/node", { action: "updateMilestone", milestoneId, title: patch.title, description: patch.description }, "Đã lưu Chặng.");
  }
  async function confirmDeleteNode() {
    if (!deleteNodeConfirm) return;
    const { type, id } = deleteNodeConfirm;
    const action = type === "outcome" ? "deleteOutcome" : "deleteMilestone";
    const key = type === "outcome" ? "outcomeId" : "milestoneId";
    const ok = await call("/api/academy-admin/learn-outcome/node", { action, [key]: id }, `Đã xóa ${type === "outcome" ? TERMS.outcome : TERMS.milestone}.`);
    setDeleteNodeConfirm(null);
    if (ok) setSelected(null);
  }

  const missions = useMemo(() => outcomes.flatMap((o) => o.milestones.flatMap((m) => m.missions)), [outcomes]);

  // Deep link (§12): ?node=<id>&type=outcome|milestone|mission from anywhere in the app, plus the
  // older ?missionId= the Data Link Resource Inspector (folder 34) already links with — both jump
  // straight to the right node once its Outcome graph has loaded, instead of leaving the tree closed.
  useEffect(() => {
    if (deepLinkNodeId && deepLinkNodeType) {
      const exists = deepLinkNodeType === "outcome" ? outcomes.some((o) => o.id === deepLinkNodeId)
        : deepLinkNodeType === "milestone" ? outcomes.some((o) => o.milestones.some((m) => m.id === deepLinkNodeId))
        : missions.some((m) => m.id === deepLinkNodeId);
      if (exists) { setSelected({ type: deepLinkNodeType, id: deepLinkNodeId }); if (deepLinkNodeType === "mission") setActiveTab("overview"); }
    } else if (deepLinkMissionId && missions.some((m) => m.id === deepLinkMissionId)) {
      setSelected({ type: "mission", id: deepLinkMissionId });
      setActiveTab("overview");
    }
  }, [deepLinkNodeId, deepLinkNodeType, deepLinkMissionId, outcomes, missions]);

  const currentVersion = versions.find((v) => v.id === versionId);
  // "Xem như học viên" forces every edit control off regardless of draft status — a true read-only
  // preview, not just "draft vs published" (§12's edit-published dialog is a separate concern).
  const isPublished = currentVersion?.status === "published";
  const isDraft = currentVersion?.status === "draft" && !previewAsStudent;
  const selectedOutcome = selected?.type === "outcome" ? outcomes.find((o) => o.id === selected.id) ?? null : null;
  const selectedMilestone = selected?.type === "milestone" ? outcomes.flatMap((o) => o.milestones).find((m) => m.id === selected.id) ?? null : null;
  const selectedMission = selected?.type === "mission" ? missions.find((m) => m.id === selected.id) ?? null : null;
  const otherStages = stages.filter((s) => s.id !== stageId);

  const findingsByCategory = useMemo(() => {
    const map = new Map<string, Finding[]>();
    for (const f of preflight?.findings ?? []) map.set(f.category, [...(map.get(f.category) ?? []), f]);
    return map;
  }, [preflight]);
  const flaggedMissionIds = useMemo(() => {
    if (!activeCategory) return null;
    return new Set((findingsByCategory.get(activeCategory) ?? []).map((f) => f.missionId).filter(Boolean));
  }, [activeCategory, findingsByCategory]);

  function openBulkClone() { setBulkCloneTargets(new Set()); setBulkCloneOptions(DEFAULT_CLONE_OPTIONS); setBulkCloneResults(null); setBulkCloneOpen(true); }
  function toggleTarget(id: string) { setBulkCloneTargets((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }

  return <SimpleOperationsShell title="Academy Control" subtitle="Bản đồ kết quả học viên" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="ĐÀO TẠO">
    <div className="page-header"><div><h1>Bản đồ kết quả học viên — {TERMS.outcome} → {TERMS.mission} Builder</h1><p style={{ fontSize: 12, color: "#6b7a89" }}>Lớp thực thi bổ sung cho giáo trình hiện có (Stage → Program → Module → Group vẫn ở &ldquo;Giai đoạn &amp; Nội dung đào tạo&rdquo;) — không thay thế, không copy tài liệu.</p></div></div>
    {message && <div className={styles.card} style={{ marginBottom: 12, padding: 10, fontSize: 12 }}>{message}</div>}
    {previewAsStudent && <div className={styles.card} style={{ marginBottom: 12, padding: 10, fontSize: 12, background: "#eff6ff", border: "1px solid #bfdbfe" }}><Eye size={12} style={{ verticalAlign: "-1px" }} /> Đang xem như học viên — mọi chỉnh sửa đã tắt. <button onClick={() => setPreviewAsStudent(false)} style={{ border: "none", background: "none", color: "#2563eb", cursor: "pointer", fontWeight: 600 }}>Thoát xem trước</button></div>}
    {/* §9 Published immutable — exact banner/CTA text from the source package. */}
    {isPublished && !previewAsStudent && <div className={styles.card} style={{ marginBottom: 12, padding: 10, fontSize: 12, background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <Lock size={12} /> <strong>Phiên bản đang áp dụng không thể sửa trực tiếp.</strong>
      <button className={styles.button} disabled={busy} onClick={cloneForEdit}><Copy size={12} />Tạo bản nháp để chỉnh sửa</button>
    </div>}
    <JourneyInlineGuide />

    <section className={styles.card} style={{ marginBottom: 16 }}>
      <div className={styles.cardBody} style={{ padding: 16, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Giai đoạn
          <select value={stageId} onChange={(e) => setStageId(e.target.value)} style={field}>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.indexLabel ? `${s.indexLabel} — ` : ""}{s.title}</option>)}
          </select>
        </label>
        {blueprint
          ? <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Phiên bản
              <select value={versionId ?? ""} onChange={(e) => loadJourney(stageId, e.target.value, true)} style={field}>
                {versions.map((v) => <option key={v.id} value={v.id}>v{v.versionNumber} — {blueprint.currentPublishedVersionId === v.id ? TERMS.published : STATUS_LABEL[v.status]}</option>)}
              </select>
            </label>
          : <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !stageId} onClick={() => call("/api/academy-admin/learn-outcome", { stageId }, "Đã tạo Bản đồ kết quả (nháp v1).")}><Plus size={14}/>Tạo Bản đồ kết quả cho giai đoạn này</button>}
      </div>
      {blueprint && <>
        <div style={{ padding: "0 16px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#6b7a89", padding: "6px 0" }}>Đã lưu tự động theo từng thay đổi</span>
          <button className={styles.button} disabled={busy || !versionId} onClick={() => setPreviewAsStudent((v) => !v)}><Eye size={14}/>Xem như học viên</button>
          <button className={styles.button} disabled={busy || !versionId} onClick={runPreflight}><RefreshCw size={14}/>{TERMS.preflight}</button>
          {currentVersion?.status === "draft" && <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !versionId} onClick={() => call("/api/academy-admin/learn-outcome/version", { action: "publish", blueprintId: blueprint.id, versionId, scope: "all_active_students" }, "Đã áp dụng cho học viên. Tiến độ học viên đang có trên phiên bản trước đã được bảo toàn (Mission tương đương tự động chuyển sang phiên bản mới).")}><CheckCircle2 size={14}/>{TERMS.publish}</button>}
        </div>
        <div style={{ padding: "0 16px 16px", display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid #f1f3f5", paddingTop: 12 }}>
          <button className={styles.button} disabled={busy || !versionId} onClick={() => call("/api/academy-admin/learn-outcome/version", { action: "duplicate", blueprintId: blueprint.id, versionId }, "Đã tạo phiên bản nháp mới (nhân bản).")}><Copy size={14}/>Nhân bản phiên bản này</button>
          <button className={styles.button} disabled={busy || !versionId} onClick={openBulkClone}><GitBranch size={14}/>Nhân bản sang nhiều giai đoạn</button>
          {currentVersion?.status === "draft" && <button className={styles.button} disabled={busy || !versionId} style={{ color: "#b42318" }} onClick={() => setDeleteConfirmOpen(true)}><Trash2 size={14}/>Xóa bản nháp</button>}
          {currentVersion?.status === "published" && <button className={styles.button} disabled={busy || !versionId} onClick={() => call("/api/academy-admin/learn-outcome/version", { action: "archive", versionId }, "Đã lưu trữ phiên bản.")}><Archive size={14}/>Lưu trữ phiên bản</button>}
        </div>
      </>}
    </section>

    {preflight && <section className={styles.card} style={{ marginBottom: 16 }}>
      <div className={styles.cardBody} style={{ padding: 16 }}>
        <strong style={{ color: preflight.ok ? "#1a7f37" : "#b42318" }}>{preflight.ok ? "Sẵn sàng áp dụng cho học viên — không có lỗi chặn." : `${preflight.findings.filter((f) => f.severity === "blocker").length} lỗi cần sửa trước khi áp dụng`}</strong>
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
            {f.missionTitle && f.missionId ? <button onClick={() => setSelected({ type: "mission", id: f.missionId! })} style={{ border: "none", background: "none", padding: 0, color: "#2563eb", cursor: "pointer", fontWeight: 600 }}>{f.missionTitle}</button> : <strong>Chung</strong>} — {f.message}
          </div>)}
        </div>}
      </div>
    </section>}

    {loading ? <p style={{ fontSize: 12 }}>Đang tải...</p> : blueprint && <div style={{ display: "grid", gridTemplateColumns: (selectedOutcome || selectedMilestone || selectedMission) ? "1fr 1.1fr" : "1fr", gap: 16 }}>
      <section className={styles.card}>
        <div className={styles.cardHead}><div><h2>{TERMS.outcome} → {TERMS.milestone} → {TERMS.mission}</h2>{activeCategory && <p style={{ fontSize: 11, color: "#6b7a89", margin: "2px 0 0" }}>Đang lọc theo: {CATEGORY_LABEL[activeCategory]} <button onClick={() => setActiveCategory(null)} style={{ border: "none", background: "none", color: "#2563eb", cursor: "pointer" }}>(bỏ lọc)</button></p>}</div></div>
        {/* §3 tree hint — exact wording from the source package. */}
        <p style={{ margin: "10px 16px 0", fontSize: 11, color: "#6b7a89", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 8 }}>Chọn {TERMS.outcome} để sửa mục tiêu lớn. Chọn {TERMS.milestone} để sửa nhóm nhiệm vụ. Chọn {TERMS.mission} để cấu hình học liệu, hành động, bằng chứng và tiêu chí đạt.</p>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          {outcomes.map((outcome, outcomeIndex) => <div key={outcome.id} style={{ border: "1px solid #e5e9ee", borderRadius: 10, padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <button onClick={() => setSelected({ type: "outcome", id: outcome.id })} style={{ flex: 1, minWidth: 0, textAlign: "left", padding: "4px 6px", borderRadius: 8, border: selected?.type === "outcome" && selected.id === outcome.id ? "1px solid #a21caf" : "1px solid transparent", background: selected?.type === "outcome" && selected.id === outcome.id ? "#fdf4ff" : "transparent", cursor: "pointer" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#a21caf", textTransform: "uppercase" }}>{TERMS.outcome}</div>
                <strong style={{ fontSize: 13 }}>{outcome.title}</strong>
              </button>
              {isDraft && <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                <button title="Đưa lên trước" disabled={busy || outcomeIndex === 0} onClick={() => moveNode("outcome", outcome.id, -1)} style={{ border: "1px solid #e5e9ee", borderRadius: 6, background: "#fff", cursor: outcomeIndex === 0 ? "default" : "pointer", padding: 3, opacity: outcomeIndex === 0 ? 0.4 : 1 }}><ChevronUp size={13} /></button>
                <button title="Đưa xuống sau" disabled={busy || outcomeIndex === outcomes.length - 1} onClick={() => moveNode("outcome", outcome.id, 1)} style={{ border: "1px solid #e5e9ee", borderRadius: 6, background: "#fff", cursor: outcomeIndex === outcomes.length - 1 ? "default" : "pointer", padding: 3, opacity: outcomeIndex === outcomes.length - 1 ? 0.4 : 1 }}><ChevronDown size={13} /></button>
              </div>}
            </div>
            {outcome.milestones.map((milestone, milestoneIndex) => <div key={milestone.id} style={{ marginLeft: 12, marginTop: 8, borderLeft: "2px solid #e5e9ee", paddingLeft: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <button onClick={() => setSelected({ type: "milestone", id: milestone.id })} style={{ flex: 1, minWidth: 0, textAlign: "left", padding: "4px 6px", borderRadius: 8, border: selected?.type === "milestone" && selected.id === milestone.id ? "1px solid #6d28d9" : "1px solid transparent", background: selected?.type === "milestone" && selected.id === milestone.id ? "#f5f3ff" : "transparent", cursor: "pointer" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#6d28d9", textTransform: "uppercase" }}>{TERMS.milestone}</div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{milestone.title}</span>
                </button>
                {isDraft && <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button title="Đưa lên trước" disabled={busy || milestoneIndex === 0} onClick={() => moveNode("milestone", milestone.id, -1)} style={{ border: "1px solid #e5e9ee", borderRadius: 6, background: "#fff", cursor: milestoneIndex === 0 ? "default" : "pointer", padding: 3, opacity: milestoneIndex === 0 ? 0.4 : 1 }}><ChevronUp size={12} /></button>
                  <button title="Đưa xuống sau" disabled={busy || milestoneIndex === outcome.milestones.length - 1} onClick={() => moveNode("milestone", milestone.id, 1)} style={{ border: "1px solid #e5e9ee", borderRadius: 6, background: "#fff", cursor: milestoneIndex === outcome.milestones.length - 1 ? "default" : "pointer", padding: 3, opacity: milestoneIndex === outcome.milestones.length - 1 ? 0.4 : 1 }}><ChevronDown size={12} /></button>
                </div>}
              </div>
              <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                {milestone.missions.filter((mission) => !flaggedMissionIds || flaggedMissionIds.has(mission.id)).map((mission, missionIndex) => {
                  const missionFindings = (preflight?.findings ?? []).filter((f) => f.missionId === mission.id);
                  // "Bắt đầu" (Entry Mission, §7): opens as soon as the Stage is accessible — no
                  // prerequisite at all, which after the parallel-outcome fix means exactly one per
                  // Outcome (its first Mission), not one per Stage.
                  const isEntry = !mission.prerequisiteMissionId;
                  const prereqOutcome = mission.prerequisiteMissionId ? outcomes.find((o) => o.milestones.some((ms) => ms.missions.some((m) => m.id === mission.prerequisiteMissionId))) : null;
                  const isCrossOutcome = prereqOutcome && prereqOutcome.id !== outcome.id;
                  const isSelected = selected?.type === "mission" && selected.id === mission.id;
                  return <div key={mission.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button onClick={() => { setSelected({ type: "mission", id: mission.id }); setActiveTab("overview"); }} style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", padding: "6px 8px", borderRadius: 8, border: isSelected ? "1px solid #2563eb" : "1px solid #eef1f4", background: isSelected ? "#eff6ff" : "#fff", fontSize: 12, cursor: "pointer" }}>
                      <span>{mission.title} {isEntry && <span style={{ fontSize: 9, fontWeight: 700, color: "#1a7f37", background: "#e6f6ec", borderRadius: 999, padding: "1px 6px", marginLeft: 4 }}>{TERMS.entry.toUpperCase()}</span>}{isCrossOutcome && <span title={`Phụ thuộc Kết quả khác: ${prereqOutcome!.title}`} style={{ fontSize: 9, fontWeight: 700, color: "#b7791f", background: "#fff8ec", borderRadius: 999, padding: "1px 6px", marginLeft: 4 }}>⚠ CHÉO KẾT QUẢ</span>}</span>
                      {missionFindings.length > 0 && <span style={{ fontSize: 10, color: missionFindings.some((f) => f.severity === "blocker") ? "#b42318" : "#92400e" }}>{missionFindings.length} vấn đề</span>}
                    </button>
                    {isDraft && <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      <button title="Đưa lên trước" disabled={busy || missionIndex === 0} onClick={() => moveNode("mission", mission.id, -1)} style={{ border: "1px solid #e5e9ee", borderRadius: 6, background: "#fff", cursor: missionIndex === 0 ? "default" : "pointer", padding: 3, opacity: missionIndex === 0 ? 0.4 : 1 }}><ChevronUp size={12} /></button>
                      <button title="Đưa xuống sau" disabled={busy || missionIndex === milestone.missions.length - 1} onClick={() => moveNode("mission", mission.id, 1)} style={{ border: "1px solid #e5e9ee", borderRadius: 6, background: "#fff", cursor: missionIndex === milestone.missions.length - 1 ? "default" : "pointer", padding: 3, opacity: missionIndex === milestone.missions.length - 1 ? 0.4 : 1 }}><ChevronDown size={12} /></button>
                    </div>}
                  </div>;
                })}
                {isDraft && <MiniForm placeholder={`+ Thêm ${TERMS.mission.toLowerCase()}`} onSubmit={(title) => call("/api/academy-admin/learn-outcome/node", { action: "createMission", milestoneId: milestone.id, mission: { title, expectedResult: title } }, `Đã thêm ${TERMS.mission.toLowerCase()}.`)}/>}
              </div>
            </div>)}
            {isDraft && <div style={{ marginLeft: 12, marginTop: 8 }}><MiniForm placeholder={`+ Thêm ${TERMS.milestone.toLowerCase()}`} onSubmit={(title) => call("/api/academy-admin/learn-outcome/node", { action: "createMilestone", outcomeId: outcome.id, title }, `Đã thêm ${TERMS.milestone.toLowerCase()}.`)}/></div>}
          </div>)}
          {isDraft && versionId && <MiniForm placeholder={`+ Thêm ${TERMS.outcome.toLowerCase()}`} onSubmit={(title) => call("/api/academy-admin/learn-outcome/node", { action: "createOutcome", versionId, title }, `Đã thêm ${TERMS.outcome.toLowerCase()}.`)}/>}
        </div>
      </section>

      {selectedOutcome && <section className={styles.card}>
        <OutcomeEditorPanel
          outcome={{ id: selectedOutcome.id, title: selectedOutcome.title, description: selectedOutcome.description, position: selectedOutcome.position, milestoneCount: selectedOutcome.milestones.length, missionCount: selectedOutcome.milestones.flatMap((m) => m.missions).length }}
          isDraft={isDraft} busy={busy} stageId={stageId}
          dataLink={{ missionsTotal: selectedOutcome.milestones.flatMap((m) => m.missions).length, missionsWithResources: selectedOutcome.milestones.flatMap((m) => m.missions).filter((m) => m.resourceBindings.length > 0).length }}
          onSave={(patch) => saveOutcomeNode(selectedOutcome.id, patch)}
          onAddMilestone={() => call("/api/academy-admin/learn-outcome/node", { action: "createMilestone", outcomeId: selectedOutcome.id, title: `${TERMS.milestone} mới` }, `Đã thêm ${TERMS.milestone.toLowerCase()}.`)}
          onDelete={() => setDeleteNodeConfirm({ type: "outcome", id: selectedOutcome.id, title: selectedOutcome.title })}
        />
      </section>}

      {selectedMilestone && <section className={styles.card}>
        <MilestoneEditorPanel
          milestone={{ id: selectedMilestone.id, title: selectedMilestone.title, description: selectedMilestone.description, position: selectedMilestone.position, missionCount: selectedMilestone.missions.length }}
          isDraft={isDraft} busy={busy} stageId={stageId}
          dataLink={{ missionsTotal: selectedMilestone.missions.length, missionsWithResources: selectedMilestone.missions.filter((m) => m.resourceBindings.length > 0).length }}
          onSave={(patch) => saveMilestoneNode(selectedMilestone.id, patch)}
          onAddMission={() => call("/api/academy-admin/learn-outcome/node", { action: "createMission", milestoneId: selectedMilestone.id, mission: { title: `${TERMS.mission} mới`, expectedResult: `${TERMS.mission} mới` } }, `Đã thêm ${TERMS.mission.toLowerCase()}.`)}
          onDelete={() => setDeleteNodeConfirm({ type: "milestone", id: selectedMilestone.id, title: selectedMilestone.title })}
        />
      </section>}

      {selectedMission && <section className={styles.card}>
        <div className={styles.cardHead}><div><h2>{selectedMission.title}</h2></div></div>
        <div style={{ display: "flex", gap: 4, padding: "0 16px", borderBottom: "1px solid #eef1f4", flexWrap: "wrap" }}>
          {(Object.keys(TAB_LABEL) as InspectorTab[]).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: "8px 10px", fontSize: 11, fontWeight: activeTab === tab ? 700 : 500, border: "none", borderBottom: activeTab === tab ? "2px solid #2563eb" : "2px solid transparent", background: "none", color: activeTab === tab ? "#2563eb" : "#6b7a89", cursor: "pointer" }}>
            {TAB_LABEL[tab]}
          </button>)}
        </div>

        <div style={{ padding: 16, display: "grid", gap: 10, fontSize: 12 }}>
          {activeTab === "overview" && <>
            <label>{TERMS.expectedResult}
              <textarea defaultValue={selectedMission.expectedResult} disabled={!isDraft} onBlur={(e) => call("/api/academy-admin/learn-outcome/node", { action: "updateMission", missionId: selectedMission.id, mission: { expectedResult: e.target.value } }, "Đã cập nhật.")} style={{ ...field, minHeight: 60 }}/>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label>{TERMS.completionPolicy}
                <select defaultValue={selectedMission.completionPolicy} disabled={!isDraft} onChange={(e) => call("/api/academy-admin/learn-outcome/node", { action: "updateMission", missionId: selectedMission.id, mission: { completionPolicy: e.target.value } }, "Đã cập nhật.")} style={field}>
                  {["self_reported", "evidence_required", "teacher_verified", "metric_based"].map((p) => <option key={p} value={p}>{COMPLETION_POLICY_LABEL[p]}</option>)}
                </select>
              </label>
              <label>{TERMS.estimatedDays}
                <input type="number" min={0} defaultValue={selectedMission.estimatedDays ?? ""} disabled={!isDraft} onBlur={(e) => call("/api/academy-admin/learn-outcome/node", { action: "updateMission", missionId: selectedMission.id, mission: { estimatedDays: e.target.value ? Number(e.target.value) : null } }, "Đã cập nhật.")} style={field}/>
              </label>
            </div>
            <div><strong>{TERMS.successKpi}</strong>
              {selectedMission.successCriteria.length ? selectedMission.successCriteria.map((c, i) => <div key={i}>· {c}</div>) : <p style={{ color: "#6b7a89" }}>Chưa có {TERMS.successKpi.toLowerCase()}.</p>}
            </div>
          </>}

          {activeTab === "resources" && <>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{TERMS.resourceBindings}</strong>
                {isDraft && <button onClick={() => setPickerOpen(true)} className={styles.button} style={{ fontSize: 11, padding: "4px 8px" }}><Search size={11}/> Tìm học liệu</button>}
              </div>
              <ul style={{ margin: "4px 0", paddingLeft: 16 }}>{selectedMission.resourceBindings.map((b) => <li key={b.id}>{b.title || <em style={{ color: "#b42318" }}>Chưa resolve được tiêu đề ({b.resourceId})</em>} <small style={{ color: "#94a3b8" }}>({b.role})</small></li>)}
                {!selectedMission.resourceBindings.length && <p style={{ color: "#6b7a89" }}>Chưa có học liệu liên kết.</p>}
              </ul>
            </div>
            <div><strong>Công cụ liên kết</strong>
              <ul style={{ margin: "4px 0", paddingLeft: 16 }}>{selectedMission.toolBindings.map((b) => <li key={b.id}>{b.toolId || b.id} <small style={{ color: "#94a3b8" }}>({b.role})</small></li>)}
                {!selectedMission.toolBindings.length && <p style={{ color: "#6b7a89" }}>Chưa có công cụ liên kết.</p>}
              </ul>
            </div>
            <div><strong>{TERMS.assignmentBindings}</strong>
              <ul style={{ margin: "4px 0", paddingLeft: 16 }}>{selectedMission.assignmentBindings.map((b) => <li key={b.id}>{b.assignmentId} ({b.role})</li>)}
                {!selectedMission.assignmentBindings.length && <p style={{ color: "#6b7a89" }}>Chưa có {TERMS.assignmentBindings.toLowerCase()}.</p>}
              </ul>
            </div>
          </>}

          {activeTab === "actions" && <div>
            <strong>{TERMS.actionTemplates}</strong>
            <ul style={{ margin: "4px 0", paddingLeft: 16 }}>{selectedMission.actionTemplates.map((a) => <li key={a.id}>{a.title}{a.required ? " · bắt buộc" : ""}{a.evidenceRequired ? " · cần bằng chứng" : ""}</li>)}
              {!selectedMission.actionTemplates.length && <p style={{ color: "#6b7a89" }}>Chưa có {TERMS.actionTemplates.toLowerCase()}.</p>}
            </ul>
            {isDraft && <MiniForm placeholder={`+ Thêm ${TERMS.actionTemplates.toLowerCase()}`} onSubmit={(title) => call("/api/academy-admin/learn-outcome/node", { action: "createActionTemplate", missionId: selectedMission.id, actionTemplate: { title } }, `Đã thêm ${TERMS.actionTemplates.toLowerCase()}.`)}/>}
          </div>}

          {activeTab === "workspace" && versionId && <MissionWorkspaceBuilder journeyVersionId={versionId} missionId={selectedMission.id} isDraft={isDraft}
            resourceBindings={selectedMission.resourceBindings.map((b) => ({ id: b.id, label: b.title || b.resourceId || b.id }))}
            toolBindings={selectedMission.toolBindings.map((b) => ({ id: b.id, label: b.toolId || b.id }))}
            assignmentBindings={selectedMission.assignmentBindings.map((b) => ({ id: b.id, label: b.assignmentId || b.id }))}
          />}

          {activeTab === "unlock" && <div>
            {/* Prerequisite picker (§7): a Mission selector grouped by Outcome, never a raw UUID
                field. Empty = Bắt đầu (opens as soon as the Stage is accessible). Picking a Mission
                from a different Outcome is allowed (explicit cross-outcome dependency, §6) but
                flagged so Admin knows they are opting out of the default parallel-Outcome behavior. */}
            <strong>{TERMS.prerequisite}</strong>
            <select defaultValue={selectedMission.prerequisiteMissionId ?? ""} disabled={!isDraft} onChange={(e) => call("/api/academy-admin/learn-outcome/node", { action: "updateMission", missionId: selectedMission.id, mission: { prerequisiteMissionId: e.target.value || null } }, "Đã cập nhật điều kiện mở khóa.")} style={{ ...field, marginTop: 4 }}>
              <option value="">— Không có ({TERMS.entry}, mở ngay khi Stage mở) —</option>
              {outcomes.map((outcome) => <optgroup key={outcome.id} label={outcome.title}>
                {outcome.milestones.flatMap((ms) => ms.missions).filter((m) => m.id !== selectedMission.id).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </optgroup>)}
            </select>
            {(() => {
              if (!selectedMission.prerequisiteMissionId) return null;
              const ownerOutcome = outcomes.find((o) => o.milestones.some((ms) => ms.missions.some((m) => m.id === selectedMission.id)));
              const prereqOutcome = outcomes.find((o) => o.milestones.some((ms) => ms.missions.some((m) => m.id === selectedMission.prerequisiteMissionId)));
              if (!ownerOutcome || !prereqOutcome || ownerOutcome.id === prereqOutcome.id) return null;
              return <p style={{ fontSize: 11, color: "#b7791f", margin: "6px 0 0" }}>⚠ Phụ thuộc chéo Kết quả — Mission này sẽ KHÔNG mở song song với các Kết quả khác, chỉ mở sau khi hoàn thành Mission ở &ldquo;{prereqOutcome.title}&rdquo;. Đây phải là lựa chọn có chủ đích (§6).</p>;
            })()}
            <div style={{ marginTop: 14 }}>
              <strong>{TERMS.completionPolicy}</strong>
              <p style={{ color: "#6b7a89", marginTop: 4 }}>{COMPLETION_POLICY_LABEL[selectedMission.completionPolicy] ?? selectedMission.completionPolicy}</p>
            </div>
          </div>}
        </div>
      </section>}
    </div>}

    {pickerOpen && selectedMission && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setPickerOpen(false)}>
      <div style={{ width: 480, maxHeight: "80vh", overflowY: "auto", background: "#fff", borderRadius: 12, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><strong>Tìm học liệu thật</strong><button onClick={() => setPickerOpen(false)} style={{ border: "none", background: "none", cursor: "pointer" }}><X size={16}/></button></div>
        <input autoFocus value={pickerQuery} onChange={(e) => searchResources(e.target.value)} placeholder="Gõ tên tài liệu..." style={{ ...field, margin: "10px 0" }}/>
        <div style={{ display: "grid", gap: 6 }}>
          {pickerResults.map((r) => <button key={r.resourceId} onClick={async () => {
            await call("/api/academy-admin/learn-outcome/node", { action: "attachBinding", missionId: selectedMission.id, binding: { kind: "resource", resourceType: r.resourceType, resourceId: r.resourceId } }, "Đã gắn học liệu.");
            setPickerOpen(false); setPickerQuery(""); setPickerResults([]);
          }} style={{ textAlign: "left", padding: 10, borderRadius: 8, border: "1px solid #eef1f4", background: "#fff", cursor: "pointer" }}>
            <strong style={{ fontSize: 12 }}>{r.title}</strong>
            <div style={{ fontSize: 10, color: "#6b7a89" }}>{r.sourceLabel} · {r.stageTitle}</div>
          </button>)}
          {pickerQuery && !pickerResults.length && <p style={{ fontSize: 12, color: "#6b7a89" }}>Không tìm thấy tài liệu nào khớp.</p>}
        </div>
      </div>
    </div>}

    {deleteConfirmOpen && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setDeleteConfirmOpen(false)}>
      <div style={{ width: 420, background: "#fff", borderRadius: 12, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <strong style={{ fontSize: 14 }}>Xóa bản nháp?</strong>
        <p style={{ fontSize: 12, color: "#6b7a89", marginTop: 8 }}>Toàn bộ Kết quả/Chặng/Nhiệm vụ trong bản nháp này (v{currentVersion?.versionNumber}) sẽ bị xóa vĩnh viễn. Hành động này không ảnh hưởng phiên bản đang áp dụng cho học viên.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className={styles.button} onClick={() => setDeleteConfirmOpen(false)}>Hủy</button>
          <button className={styles.button} style={{ background: "#b42318", color: "#fff", borderColor: "#b42318" }} disabled={busy} onClick={confirmDeleteDraft}><Trash2 size={14}/> Xóa bản nháp</button>
        </div>
      </div>
    </div>}

    {/* §8 Xóa an toàn: server checks progress/evidence/bindings/prerequisite references and BLOCKs
        with the exact reason (surfaced through the `message` banner) — this dialog only confirms
        intent, it does not itself decide whether the delete is safe. */}
    {deleteNodeConfirm && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setDeleteNodeConfirm(null)}>
      <div style={{ width: 420, background: "#fff", borderRadius: 12, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <strong style={{ fontSize: 14 }}>Xóa {deleteNodeConfirm.type === "outcome" ? TERMS.outcome : TERMS.milestone} &ldquo;{deleteNodeConfirm.title}&rdquo;?</strong>
        <p style={{ fontSize: 12, color: "#6b7a89", marginTop: 8 }}>{deleteNodeConfirm.type === "outcome" ? "Toàn bộ Chặng và Nhiệm vụ bên trong" : "Toàn bộ Nhiệm vụ bên trong"} sẽ bị xóa vĩnh viễn. Nếu học viên thật đã có tiến độ/bằng chứng, hoặc một Nhiệm vụ khác đang lấy Nhiệm vụ bên trong làm điều kiện mở khóa, hệ thống sẽ từ chối và báo đúng lý do.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className={styles.button} onClick={() => setDeleteNodeConfirm(null)}>Hủy</button>
          <button className={styles.button} style={{ background: "#b42318", color: "#fff", borderColor: "#b42318" }} disabled={busy} onClick={confirmDeleteNode}><Trash2 size={14}/> Xóa {deleteNodeConfirm.type === "outcome" ? TERMS.outcome : TERMS.milestone}</button>
        </div>
      </div>
    </div>}

    {bulkCloneOpen && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setBulkCloneOpen(false)}>
      <div style={{ width: 560, maxHeight: "85vh", overflowY: "auto", background: "#fff", borderRadius: 12, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><strong>Nhân bản sang nhiều giai đoạn</strong><button onClick={() => setBulkCloneOpen(false)} style={{ border: "none", background: "none", cursor: "pointer" }}><X size={16}/></button></div>
        <p style={{ fontSize: 11, color: "#6b7a89", marginTop: 6 }}>Mỗi giai đoạn được chọn sẽ nhận một bản nháp MỚI — không bao giờ ghi đè phiên bản đang áp dụng cho học viên. Tiến độ/bằng chứng/kết quả của học viên KHÔNG bao giờ được sao chép.</p>

        {!bulkCloneResults ? <>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {otherStages.map((s) => <label key={s.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, padding: "4px 0" }}>
              <input type="checkbox" checked={bulkCloneTargets.has(s.id)} onChange={() => toggleTarget(s.id)} />
              {s.indexLabel ? `${s.indexLabel} — ` : ""}{s.title}
            </label>)}
            {!otherStages.length && <p style={{ fontSize: 12, color: "#6b7a89" }}>Không có giai đoạn khác để nhân bản sang.</p>}
          </div>
          <div style={{ marginTop: 14, borderTop: "1px solid #eef1f4", paddingTop: 10 }}>
            <strong style={{ fontSize: 11 }}>Sao chép kèm theo</strong>
            <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
              {(Object.keys(CLONE_OPTION_LABEL) as (keyof CloneOptions)[]).map((key) => <label key={key} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                <input type="checkbox" checked={bulkCloneOptions[key]} onChange={(e) => setBulkCloneOptions((prev) => ({ ...prev, [key]: e.target.checked }))} />
                {CLONE_OPTION_LABEL[key]}
              </label>)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <button className={styles.button} onClick={() => setBulkCloneOpen(false)}>Hủy</button>
            <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !bulkCloneTargets.size} onClick={submitBulkClone}><GitBranch size={14}/> Tạo bản nháp</button>
          </div>
        </> : <>
          <table style={{ width: "100%", marginTop: 14, fontSize: 12, borderCollapse: "collapse" }}>
            <thead><tr style={{ textAlign: "left", borderBottom: "1px solid #eef1f4" }}><th style={{ padding: 6 }}>Giai đoạn</th><th style={{ padding: 6 }}>Phiên bản mới</th><th style={{ padding: 6 }}>Trạng thái</th><th style={{ padding: 6 }}></th></tr></thead>
            <tbody>{bulkCloneResults.map((r) => {
              const stage = stages.find((s) => s.id === r.stageId);
              return <tr key={r.stageId} style={{ borderBottom: "1px solid #f5f6f8" }}>
                <td style={{ padding: 6 }}>{stage?.title ?? r.stageId}</td>
                <td style={{ padding: 6 }}>v{r.versionNumber}</td>
                <td style={{ padding: 6 }}>{TERMS.draft}</td>
                <td style={{ padding: 6 }}><button onClick={() => { setBulkCloneOpen(false); setStageId(r.stageId); loadJourney(r.stageId, r.versionId, true); }} style={{ border: "none", background: "none", color: "#2563eb", cursor: "pointer", fontWeight: 600 }}>Mở</button></td>
              </tr>;
            })}</tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button className={styles.button} onClick={() => setBulkCloneOpen(false)}>Đóng</button>
          </div>
        </>}
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
