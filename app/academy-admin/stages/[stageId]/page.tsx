"use client";
import { useEffect, useState, use as usePromise } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, Check, X } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import { DISPLAY_LOCATIONS, REQUIREMENT_TYPES, STAGE_RESOURCE_ACCESS, STAGE_RESOURCE_TYPES, UNLOCK_MODES, type StageResourceAccess, type StageResourceType } from "@/lib/career-stages/types";
import styles from "@/components/operations/operations.module.css";

type Resource = {
  id: string; resourceType: string; resourceId: string; title: string; position: number; access: string; status: string;
  unlockMode: string; prerequisiteBindingId: string | null; requiredProgress: number | null; unlockAt: string | null;
  requirementType: string; displayLocations: string[]; nodeId: string | null; surface: string | null; isFeatured: boolean;
};
type Stage = { id: string; slug: string; position: number; indexLabel: string; title: string; description: string; durationLabel: string; skills: string[]; status: string; resources: Resource[]; publishedAt: string | null };
type Node = { id: string; parentId: string | null; nodeType: "program" | "module" | "group"; title: string; description: string; position: number; status: string; surface: string | null; effectiveSurface: string | null };
type CatalogItem = { id: string; contentType: string; title: string; summary: string; tags: string[] };
type NavItemDraft = { key: string; label: string; icon?: string; route?: string; visible: boolean; locked: boolean; requiredStage?: number | null };
type UiConfig = { id: string; version: number; status: string; config: { topLevel: NavItemDraft[]; notes?: string }; publishedAt: string | null };
type Health = { score: number; structure: number; contentCoverage: number; resourceIntegrity: number; accessRules: number; studentExperience: number; unverifiedResources: number; issues: { id: string; severity: "info" | "warning" | "error"; title: string }[] };
type Preflight = { ok: boolean; checks: { key: string; label: string; status: "pass" | "warn" | "fail"; detail?: string }[] };

const field = { padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 12 } as const;
const TABS: Array<{ key: string; label: string }> = [
  { key: "overview", label: "Tổng quan" },
  { key: "structure", label: "Cấu trúc & nội dung" },
  { key: "assignments", label: "Bài tập" },
  { key: "experience", label: "Giao diện học viên" },
  { key: "analytics", label: "Analytics" }
];
const SURFACE_LABEL: Record<string, string> = { learn: "Learn", create: "Create", business: "Business", coaching: "H2O Coaching" };
// "Học phần" rather than "Module": Academy Courses already uses "Module" for academy_course_modules,
// a different table and a different concept. Two things called Module in one admin panel is how a
// brief gets misread.
const NODE_TYPE_LABEL: Record<string, string> = { program: "Chương trình", module: "Học phần", group: "Nhóm tài liệu" };
const TYPE_LABEL: Record<string, string> = {
  book: "Sách / giáo trình", course: "Khóa học", publication: "Ấn phẩm", template: "Mẫu thiết kế",
  knowledge_space: "Knowledge Space", roadmap: "Lộ trình", link: "Liên kết ngoài", asset: "Tài sản trong kho",
  document: "Tài liệu biên soạn"
};
const ACCESS_LABEL: Record<string, string> = { free_preview: "Miễn phí — ai cũng xem", stage_locked: "Khóa theo giai đoạn", entitlement_only: "Chỉ khi được cấp riêng" };
const UNLOCK_LABEL: Record<string, string> = {
  immediate: "Mở ngay khi vào giai đoạn", stage_active: "Khi đang ở giai đoạn này", after_resource: "Sau khi học xong tài liệu khác",
  progress_gte: "Khi đạt % tiến độ tài liệu khác", date: "Từ một mốc thời gian", manual: "Chỉ mở tay cho từng học viên"
};
const REQUIREMENT_LABEL: Record<string, string> = { required: "Bắt buộc", optional: "Tùy chọn", bonus: "Mở rộng" };
const LOCATION_LABEL: Record<string, string> = { library: "Thư viện", journey: "Hành trình", smart_home: "Smart Home" };
const HEALTH_LABEL: Record<string, string> = { structure: "Cấu trúc", contentCoverage: "Độ phủ nội dung", resourceIntegrity: "Toàn vẹn tài nguyên", accessRules: "Quy tắc mở khóa" };

export default function StageWorkspacePage({ params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = usePromise(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = TABS.some((tab) => tab.key === searchParams.get("view")) ? (searchParams.get("view") as string) : "overview";

  const [stage, setStage] = useState<Stage | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [preflightOpen, setPreflightOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [stagesRes, nodesRes, healthRes] = await Promise.all([
      fetch("/api/academy-admin/stages", { cache: "no-store" }),
      fetch(`/api/academy-admin/stages/${stageId}/nodes`, { cache: "no-store" }),
      fetch(`/api/academy-admin/stages/${stageId}/health`, { cache: "no-store" })
    ]);
    const stagesJson = await stagesRes.json().catch(() => null);
    const nodesJson = await nodesRes.json().catch(() => null);
    const healthJson = await healthRes.json().catch(() => null);
    if (stagesRes.ok) setStage((stagesJson?.stages ?? []).find((candidate: Stage) => candidate.id === stageId) ?? null);
    if (nodesRes.ok) setNodes(nodesJson?.items ?? []);
    if (healthRes.ok) setHealth(healthJson ?? null);
    setLoading(false);
  }
  useEffect(() => { load(); }, [stageId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function call(url: string, init: RequestInit, okMessage: string) {
    setBusy(true); setMessage(null);
    const res = await fetch(url, { headers: { "content-type": "application/json" }, ...init });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setMessage(json?.error ?? "Thao tác thất bại."); return false; }
    setMessage(okMessage);
    await load();
    return true;
  }

  async function openPreflight() {
    const res = await fetch(`/api/academy-admin/stages/${stageId}/preflight`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setPreflight(json ?? null);
    setPreflightOpen(true);
  }

  const programs = nodes.filter((node) => node.nodeType === "program");
  const modules = nodes.filter((node) => node.nodeType === "module");
  const groups = nodes.filter((node) => node.nodeType === "group");

  if (loading) return <SimpleOperationsShell title="Academy Control Center" subtitle="Stage Workspace" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin"><p style={{ fontSize: 12, color: "#6b7a89" }}>Đang tải…</p></SimpleOperationsShell>;
  if (!stage) return <SimpleOperationsShell title="Academy Control Center" subtitle="Stage Workspace" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin"><p style={{ fontSize: 12, color: "#b22949" }}>Không tìm thấy giai đoạn này.</p></SimpleOperationsShell>;

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Stage Workspace" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <div style={{ marginBottom: 14 }}><Link href="/academy-admin/stages" style={{ fontSize: 12, color: "#6b7a89" }}>← Tất cả giai đoạn</Link></div>

    <header style={{ borderRadius: 24, background: "#0f172a", color: "#fff", padding: 24, marginBottom: 18, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#67e8f9", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          Stage Workspace · Giai đoạn {stage.indexLabel || stage.position + 1}
          <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 10, background: stage.status === "active" ? "#065f46" : "#78350f" }}>{stage.status === "active" ? "Đã publish" : stage.status === "hidden" ? "Nháp / đang ẩn" : stage.status}</span>
          {health && <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 10, background: "#1e293b" }}>Health {health.score}/100</span>}
        </div>
        <h1 style={{ margin: "8px 0 0", fontSize: 30 }}>{stage.title}</h1>
        <p style={{ margin: "8px 0 0", color: "#cbd5e1", maxWidth: 640 }}>{stage.description || "Quản trị cấu trúc và trải nghiệm học viên của giai đoạn này."}</p>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <button className={styles.button} disabled={busy} onClick={openPreflight}>Preflight</button>
        <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy} onClick={openPreflight}>Publish</button>
      </div>
    </header>

    {message && <p style={{ fontSize: 12, marginBottom: 14, color: message.startsWith("Đã") ? "#177a54" : "#b22949" }}>{message}</p>}

    <div style={{ display: "flex", gap: 8, overflowX: "auto", borderBottom: "1px solid #eef1f4", paddingBottom: 8, marginBottom: 18 }}>
      {TABS.map((tab) => <button key={tab.key} onClick={() => router.push(`/academy-admin/stages/${stageId}?view=${tab.key}`)}
        style={{ whiteSpace: "nowrap", padding: "8px 14px", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: active === tab.key ? "#0f172a" : "#f1f5f9", color: active === tab.key ? "#fff" : "#334155" }}>
        {tab.label}
      </button>)}
    </div>

    {active === "overview" && <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <Metric label="Chương trình" value={programs.length} />
        <Metric label="Học phần" value={modules.length} />
        <Metric label="Nhóm tài liệu" value={groups.length} />
        <Metric label="Tài liệu" value={stage.resources.length} />
      </div>
      {health && <HealthPanel health={health} />}
      <StageMetaForm stage={stage} busy={busy} onSave={(payload) => call(`/api/academy-admin/stages/${stageId}`, { method: "PATCH", body: JSON.stringify(payload) }, "Đã lưu thông tin giai đoạn.")} />
    </div>}

    {active === "structure" && <StructureContentTab stage={stage} nodes={nodes} busy={busy}
      onCreateNode={(payload) => call(`/api/academy-admin/stages/${stageId}/nodes`, { method: "POST", body: JSON.stringify(payload) }, "Đã thêm.")}
      onPatchNode={(nodeId, payload, msg) => call(`/api/academy-admin/stage-nodes/${nodeId}`, { method: "PATCH", body: JSON.stringify(payload) }, msg)}
      onArchiveNode={(nodeId) => call(`/api/academy-admin/stage-nodes/${nodeId}`, { method: "DELETE" }, "Đã lưu trữ — tài liệu bên trong chuyển về mục Chưa phân loại.")}
      onPatchResource={(resourceId, payload, msg) => call(`/api/academy-admin/stage-resources/${resourceId}`, { method: "PATCH", body: JSON.stringify(payload) }, msg)}
      onDetachResource={(resourceId) => call(`/api/academy-admin/stage-resources/${resourceId}`, { method: "DELETE" }, "Đã gỡ tài liệu khỏi giai đoạn.")}
      onAttachCatalog={(payload) => call(`/api/academy-admin/stages/${stageId}/catalog-resources`, { method: "POST", body: JSON.stringify(payload) }, "Đã gắn tài liệu vào giai đoạn.")}
      onAttachManual={(payload) => call(`/api/academy-admin/stages/${stageId}/resources`, { method: "POST", body: JSON.stringify(payload) }, "Đã gắn tài liệu vào giai đoạn.")} />}

    {active === "assignments" && <InfoPanel title="Bài tập" text="Chưa nối vào hệ bài tập trong lượt tích hợp này. Bài tập/nộp bài/chấm điểm vẫn quản lý ở Academy Admin → Bài tập như hiện tại." />}

    {active === "experience" && <ExperienceTab stageId={stageId} busy={busy}
      onSaveDraft={(topLevel) => call(`/api/academy-admin/stages/${stageId}/ui-config`, { method: "POST", body: JSON.stringify({ topLevel }) }, "Đã lưu bản nháp.")}
      onPublish={(version) => call(`/api/academy-admin/stages/${stageId}/ui-config/publish`, { method: "POST", body: JSON.stringify({ version }) }, "Đã xuất bản.")} />}

    {active === "analytics" && <InfoPanel title="Analytics" text="Chưa tổng hợp trong lượt tích hợp này. Đọc từ các bảng progress/assignment thật ở lượt sau, không có số liệu giả trong lúc chưa nối." />}

    {preflightOpen && <PreflightDialog preflight={preflight} busy={busy} onClose={() => setPreflightOpen(false)}
      onPublish={async () => { if (await call(`/api/academy-admin/stages/${stageId}/publish`, { method: "POST", body: "{}" }, "Đã publish giai đoạn.")) setPreflightOpen(false); }} />}
  </SimpleOperationsShell>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className={styles.card} style={{ padding: 16 }}>
    <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
    <div style={{ fontSize: 11, color: "#6b7a89", marginTop: 4 }}>{label}</div>
  </div>;
}

function InfoPanel({ title, text }: { title: string; text: string }) {
  return <div className={styles.card} style={{ padding: 20 }}>
    <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
    <p style={{ marginTop: 8, fontSize: 13, color: "#6b7a89", maxWidth: 640 }}>{text}</p>
  </div>;
}

function HealthPanel({ health }: { health: Health }) {
  const bars: Array<[string, number]> = [
    ["structure", health.structure], ["contentCoverage", health.contentCoverage],
    ["resourceIntegrity", health.resourceIntegrity], ["accessRules", health.accessRules]
  ];
  return <div className={styles.card} style={{ padding: 18 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 15 }}>Stage Health</h2>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7a89" }}>Tính từ dữ liệu thật lúc mở trang, không lưu điểm riêng nên không bao giờ lệch.</p>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{health.score}<span style={{ fontSize: 13, color: "#94a3b8" }}>/100</span></div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
      {bars.map(([key, value]) => <div key={key}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}><span>{HEALTH_LABEL[key]}</span><strong>{value}%</strong></div>
        <div style={{ height: 6, borderRadius: 999, background: "#eef1f4" }}><div style={{ height: 6, borderRadius: 999, width: `${value}%`, background: "linear-gradient(90deg,#22d3ee,#8b5cf6)" }} /></div>
      </div>)}
    </div>
    <p style={{ margin: "12px 0 0", fontSize: 11, color: "#94a3b8" }}>
      Giao diện học viên ({health.studentExperience}%) không tính vào điểm — tính năng chưa nối vào sidebar thật nên không giai đoạn nào đạt được 100% ở mục đó.
    </p>
    {health.issues.length > 0 && <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
      {health.issues.map((issue) => <div key={issue.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 10, background: issue.severity === "error" ? "#fee2e2" : issue.severity === "warning" ? "#fef3c7" : "#e0f2fe", fontSize: 12 }}>
        <strong style={{ textTransform: "uppercase", fontSize: 10 }}>{issue.severity}</strong>{issue.title}
      </div>)}
    </div>}
  </div>;
}

function PreflightDialog({ preflight, busy, onClose, onPublish }: { preflight: Preflight | null; busy: boolean; onClose: () => void; onPublish: () => void }) {
  return <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
    <div style={{ background: "#fff", borderRadius: 20, padding: 24, maxWidth: 460, width: "100%" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#a21caf", textTransform: "uppercase" }}>Preflight</div>
      <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>Kiểm tra trước khi publish</h2>
      {!preflight && <p style={{ fontSize: 12, color: "#6b7a89", marginTop: 12 }}>Đang kiểm tra…</p>}
      {preflight && <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {preflight.checks.map((check) => <div key={check.key} style={{ display: "flex", gap: 10, border: "1px solid #eef1f4", borderRadius: 12, padding: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, height: "fit-content", background: check.status === "pass" ? "#dcfce7" : check.status === "warn" ? "#fef3c7" : "#fee2e2", color: check.status === "pass" ? "#166534" : check.status === "warn" ? "#92400e" : "#991b1b" }}>{check.status}</span>
          <div><strong style={{ fontSize: 12 }}>{check.label}</strong>{check.detail && <div style={{ fontSize: 11, color: "#6b7a89" }}>{check.detail}</div>}</div>
        </div>)}
      </div>}
      <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className={styles.button} onClick={onClose}>Quay lại sửa</button>
        <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !preflight || preflight.checks.some((check) => check.status === "fail")} onClick={onPublish}>Publish</button>
      </div>
    </div>
  </div>;
}

function StageMetaForm({ stage, busy, onSave }: { stage: Stage; busy: boolean; onSave: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [description, setDescription] = useState(stage.description);
  const [durationLabel, setDurationLabel] = useState(stage.durationLabel);
  const [indexLabel, setIndexLabel] = useState(stage.indexLabel);
  const [skills, setSkills] = useState(stage.skills.join(", "));

  return <div className={styles.card} style={{ padding: 18, display: "grid", gap: 10 }}>
    <h2 style={{ margin: 0, fontSize: 15 }}>Thông tin giai đoạn</h2>
    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 150px", gap: 10 }}>
      <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Số thứ tự<input value={indexLabel} onChange={(event) => setIndexLabel(event.target.value)} placeholder="01" style={field} /></label>
      <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Mô tả<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Giai đoạn này giúp học viên làm được gì" style={field} /></label>
      <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Thời lượng<input value={durationLabel} onChange={(event) => setDurationLabel(event.target.value)} placeholder="0–2 tháng" style={field} /></label>
    </div>
    <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Kỹ năng (cách nhau bằng dấu phẩy)<input value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="Nền tảng makeup, Tóc cơ bản" style={field} /></label>
    <div><button className={styles.button} disabled={busy} onClick={() => onSave({ indexLabel, description, durationLabel, skills: skills.split(",").map((value) => value.trim()).filter(Boolean) })}>Lưu thông tin giai đoạn</button></div>
  </div>;
}

/** 3-pane layout: Structure Explorer (nodes) -> Content Canvas (resources of selected node) -> Resource Inspector. */
function StructureContentTab({ stage, nodes, busy, onCreateNode, onPatchNode, onArchiveNode, onPatchResource, onDetachResource, onAttachCatalog, onAttachManual }: {
  stage: Stage; nodes: Node[]; busy: boolean;
  onCreateNode: (payload: Record<string, unknown>) => Promise<boolean>;
  onPatchNode: (nodeId: string, payload: Record<string, unknown>, message: string) => Promise<boolean>;
  onArchiveNode: (nodeId: string) => Promise<boolean>;
  onPatchResource: (resourceId: string, payload: Record<string, unknown>, message: string) => Promise<boolean>;
  onDetachResource: (resourceId: string) => Promise<boolean>;
  onAttachCatalog: (payload: Record<string, unknown>) => Promise<boolean>;
  onAttachManual: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  // null = whole stage, "__unassigned" = resources with no node. Both are real views an admin needs:
  // the first to see everything, the second to find what still has to be filed.
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const unassignedCount = stage.resources.filter((resource) => !resource.nodeId).length;
  const visibleResources = selectedNodeId === null
    ? stage.resources
    : selectedNodeId === "__unassigned"
      ? stage.resources.filter((resource) => !resource.nodeId)
      : stage.resources.filter((resource) => resource.nodeId === selectedNodeId);
  const selectedResource = stage.resources.find((resource) => resource.id === selectedResourceId) ?? null;
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const attachNodeId = selectedNodeId && selectedNodeId !== "__unassigned" ? selectedNodeId : null;

  const nodePath = (nodeId: string | null): string => {
    if (!nodeId) return "Chưa phân loại";
    const parts: string[] = [];
    const seen = new Set<string>();
    let cursor = nodes.find((node) => node.id === nodeId);
    while (cursor && !seen.has(cursor.id)) {
      parts.unshift(cursor.title);
      seen.add(cursor.id);
      cursor = cursor.parentId ? nodes.find((node) => node.id === cursor!.parentId) : undefined;
    }
    return parts.length ? parts.join(" › ") : "Chưa phân loại";
  };

  async function reorder(resource: Resource, direction: -1 | 1) {
    const siblings = visibleResources.slice().sort((a, b) => a.position - b.position);
    const index = siblings.findIndex((item) => item.id === resource.id);
    const swapWith = siblings[index + direction];
    if (!swapWith) return;
    await onPatchResource(resource.id, { position: swapWith.position }, "Đã đổi thứ tự.");
    await onPatchResource(swapWith.id, { position: resource.position }, "Đã đổi thứ tự.");
  }

  return <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0,1fr) 330px", gap: 14, alignItems: "start" }}>
    <StructureExplorer nodes={nodes} selectedNodeId={selectedNodeId} unassignedCount={unassignedCount} busy={busy}
      onSelect={setSelectedNodeId} onCreate={onCreateNode} onPatch={onPatchNode} onArchive={onArchiveNode} />

    <div className={styles.card} style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: 16, borderBottom: "1px solid #eef1f4", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#a21caf", textTransform: "uppercase" }}>Content Canvas</div>
          <h2 style={{ margin: "4px 0 0", fontSize: 17 }}>
            {selectedNodeId === null ? "Toàn bộ giai đoạn" : selectedNodeId === "__unassigned" ? "Chưa phân loại" : selectedNode?.title ?? "—"}
          </h2>
          <div style={{ fontSize: 11, color: "#6b7a89", marginTop: 2 }}>
            {visibleResources.length} tài nguyên
            {selectedNode?.effectiveSurface && <> · hiển thị ở <strong>{SURFACE_LABEL[selectedNode.effectiveSurface]}</strong>{!selectedNode.surface && " (kế thừa)"}</>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={styles.button} onClick={() => setManualOpen((value) => !value)}>Gắn thủ công</button>
          <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => setPickerOpen(true)}><Plus size={14} />Thêm tài nguyên</button>
        </div>
      </div>

      {manualOpen && <div style={{ padding: 16, borderBottom: "1px solid #eef1f4" }}>
        <AttachResourceForm busy={busy} onSubmit={async (payload) => { const ok = await onAttachManual({ ...payload, nodeId: attachNodeId || undefined }); if (ok) setManualOpen(false); return ok; }} />
      </div>}

      <div style={{ padding: 14, display: "grid", gap: 8 }}>
        {visibleResources.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#6b7a89", border: "1px dashed #dfe3e8", borderRadius: 14 }}>
          Chưa có tài nguyên nào ở đây. Bấm &quot;Thêm tài nguyên&quot; để chọn từ Kho nội dung Academy.
        </div>}
        {visibleResources.slice().sort((a, b) => a.position - b.position).map((resource, index) => <div key={resource.id}
          onClick={() => setSelectedResourceId(resource.id)}
          style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center", padding: 12, borderRadius: 14, cursor: "pointer", border: resource.id === selectedResourceId ? "2px solid #22d3ee" : "1px solid #eef1f4" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <button style={{ border: "none", background: "#f1f5f9", borderRadius: 6, cursor: "pointer" }} onClick={(event) => { event.stopPropagation(); reorder(resource, -1); }}><ChevronUp size={12} /></button>
            <button style={{ border: "none", background: "#f1f5f9", borderRadius: 6, cursor: "pointer" }} onClick={(event) => { event.stopPropagation(); reorder(resource, 1); }}><ChevronDown size={12} /></button>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              <Chip>{TYPE_LABEL[resource.resourceType] ?? resource.resourceType}</Chip>
              <Chip tone={resource.requirementType === "required" ? "rose" : "slate"}>{REQUIREMENT_LABEL[resource.requirementType]}</Chip>
              {resource.isFeatured && <Chip tone="violet">Nổi bật</Chip>}
              {resource.status === "hidden" && <Chip tone="amber">Ẩn</Chip>}
            </div>
            <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resource.title || resource.resourceId}</div>
            {/* Showing the path only in the all-stage view: inside a node it would repeat the heading
                on every row, but in the flat list it is the only way to tell where something lives. */}
            {selectedNodeId === null && <div style={{ fontSize: 11, color: resource.nodeId ? "#94a3b8" : "#b45309", marginTop: 2 }}>{nodePath(resource.nodeId)}</div>}
          </div>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>#{index + 1}</span>
        </div>)}
      </div>
    </div>

    <ResourceInspector resource={selectedResource} siblings={stage.resources.filter((item) => item.id !== selectedResourceId)} nodes={nodes} busy={busy}
      onPatch={onPatchResource}
      onDetach={async (id) => { if (confirm("Gỡ tài liệu này khỏi giai đoạn? Nội dung gốc không bị xóa.")) { await onDetachResource(id); setSelectedResourceId(null); } }} />

    {pickerOpen && <ResourcePickerModal onClose={() => setPickerOpen(false)} nodeId={attachNodeId}
      onAttach={async (contentItemId) => { await onAttachCatalog({ contentItemId, nodeId: attachNodeId || undefined }); }} />}
  </div>;
}

function Chip({ children, tone = "cyan" }: { children: React.ReactNode; tone?: "cyan" | "rose" | "slate" | "violet" | "amber" }) {
  const map: Record<string, { bg: string; fg: string }> = {
    cyan: { bg: "#ecfeff", fg: "#0e7490" }, rose: { bg: "#fff1f2", fg: "#be123c" },
    slate: { bg: "#f1f5f9", fg: "#475569" }, violet: { bg: "#f5f3ff", fg: "#6d28d9" }, amber: { bg: "#fffbeb", fg: "#b45309" }
  };
  const c = map[tone];
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: c.bg, color: c.fg }}>{children}</span>;
}

function StructureExplorer({ nodes, selectedNodeId, unassignedCount, busy, onSelect, onCreate, onPatch, onArchive }: {
  nodes: Node[]; selectedNodeId: string | null; unassignedCount: number; busy: boolean;
  onSelect: (nodeId: string | null) => void;
  onCreate: (payload: Record<string, unknown>) => Promise<boolean>;
  onPatch: (nodeId: string, payload: Record<string, unknown>, message: string) => Promise<boolean>;
  onArchive: (nodeId: string) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [nodeType, setNodeType] = useState<"program" | "module" | "group">("program");
  const [parentId, setParentId] = useState("");
  const [surface, setSurface] = useState("");
  const programs = nodes.filter((node) => node.nodeType === "program").sort((a, b) => a.position - b.position);
  const parentOptions = nodeType === "module" ? programs : nodeType === "group" ? nodes.filter((node) => node.nodeType === "module") : [];

  function childrenOf(parent: Node) {
    return nodes.filter((node) => node.parentId === parent.id).sort((a, b) => a.position - b.position);
  }

  async function move(node: Node, siblings: Node[], direction: -1 | 1) {
    const index = siblings.findIndex((item) => item.id === node.id);
    const swapWith = siblings[index + direction];
    if (!swapWith) return;
    await onPatch(node.id, { position: swapWith.position }, "Đã đổi thứ tự.");
    await onPatch(swapWith.id, { position: node.position }, "Đã đổi thứ tự.");
  }

  return <aside className={styles.card} style={{ padding: 0, overflow: "hidden" }}>
    <div style={{ padding: 14, borderBottom: "1px solid #eef1f4" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#a21caf", textTransform: "uppercase" }}>Structure</div>
      <div style={{ fontSize: 12, color: "#6b7a89" }}>Chương trình → Học phần → Nhóm</div>
    </div>
    <div style={{ padding: 8, maxHeight: 560, overflowY: "auto" }}>
      <button onClick={() => onSelect(null)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, marginBottom: 4, background: selectedNodeId === null ? "#0f172a" : "transparent", color: selectedNodeId === null ? "#fff" : "#334155" }}>Toàn bộ giai đoạn</button>
      {unassignedCount > 0 && <button onClick={() => onSelect("__unassigned")} style={{ display: "flex", justifyContent: "space-between", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, marginBottom: 6, background: selectedNodeId === "__unassigned" ? "#0f172a" : "#fffbeb", color: selectedNodeId === "__unassigned" ? "#fff" : "#b45309" }}>
        <span>Chưa phân loại</span><span>{unassignedCount}</span>
      </button>}
      {programs.map((program) => <div key={program.id}>
        <NodeRow node={program} depth={0} siblings={programs} selected={selectedNodeId === program.id} busy={busy} onSelect={onSelect} onPatch={onPatch} onArchive={onArchive} onMove={move} />
        {childrenOf(program).map((moduleNode) => <div key={moduleNode.id}>
          <NodeRow node={moduleNode} depth={1} siblings={childrenOf(program)} selected={selectedNodeId === moduleNode.id} busy={busy} onSelect={onSelect} onPatch={onPatch} onArchive={onArchive} onMove={move} />
          {childrenOf(moduleNode).map((group) => <NodeRow key={group.id} node={group} depth={2} siblings={childrenOf(moduleNode)} selected={selectedNodeId === group.id} busy={busy} onSelect={onSelect} onPatch={onPatch} onArchive={onArchive} onMove={move} />)}
        </div>)}
      </div>)}
      {programs.length === 0 && <p style={{ fontSize: 12, color: "#6b7a89", padding: 10 }}>Chưa có chương trình nào.</p>}
    </div>
    <div style={{ padding: 10, borderTop: "1px solid #eef1f4" }}>
      {!adding && <button className={styles.button} style={{ width: "100%" }} onClick={() => setAdding(true)}><Plus size={14} />Chương trình / học phần / nhóm</button>}
      {adding && <div style={{ display: "grid", gap: 6 }}>
        <select value={nodeType} style={field} onChange={(event) => { setNodeType(event.target.value as "program" | "module" | "group"); setParentId(""); }}>
          <option value="program">Chương trình</option>
          <option value="module">Học phần</option>
          <option value="group">Nhóm tài liệu</option>
        </select>
        {nodeType !== "program" && <select value={parentId} style={field} onChange={(event) => setParentId(event.target.value)}>
          <option value="">— Chọn {nodeType === "module" ? "chương trình" : "học phần"} —</option>
          {parentOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
        </select>}
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tên" style={field} />
        <select value={surface} style={field} onChange={(event) => setSurface(event.target.value)}>
          <option value="">Khu vực: kế thừa từ cấp trên</option>
          {Object.entries(SURFACE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <div style={{ display: "flex", gap: 6 }}>
          <button className={styles.button} onClick={() => setAdding(false)}>Hủy</button>
          <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !title.trim() || (nodeType !== "program" && !parentId)} onClick={async () => {
            if (await onCreate({ nodeType, title, parentId: nodeType === "program" ? undefined : parentId, surface: surface || undefined })) { setTitle(""); setParentId(""); setSurface(""); setAdding(false); }
          }}>Thêm</button>
        </div>
      </div>}
    </div>
  </aside>;
}

function NodeRow({ node, depth, siblings, selected, busy, onSelect, onPatch, onArchive, onMove }: {
  node: Node; depth: number; siblings: Node[]; selected: boolean; busy: boolean;
  onSelect: (id: string) => void;
  onPatch: (nodeId: string, payload: Record<string, unknown>, message: string) => Promise<boolean>;
  onArchive: (id: string) => Promise<boolean>;
  onMove: (node: Node, siblings: Node[], direction: -1 | 1) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(node.title);

  if (editing) return <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: depth * 14, marginBottom: 2 }}>
    <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} style={{ ...field, flex: 1, padding: 6 }} autoFocus
      onKeyDown={async (event) => { if (event.key === "Enter" && draftTitle.trim()) { await onPatch(node.id, { title: draftTitle }, "Đã đổi tên."); setEditing(false); } if (event.key === "Escape") { setDraftTitle(node.title); setEditing(false); } }} />
    <button disabled={busy || !draftTitle.trim()} onClick={async () => { await onPatch(node.id, { title: draftTitle }, "Đã đổi tên."); setEditing(false); }} style={{ border: "none", background: "none", cursor: "pointer", color: "#177a54" }}><Check size={13} /></button>
    <button onClick={() => { setDraftTitle(node.title); setEditing(false); }} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }}><X size={13} /></button>
  </div>;

  return <div style={{ display: "flex", alignItems: "center", gap: 2, paddingLeft: depth * 14, marginBottom: 2 }}>
    <button onClick={() => onSelect(node.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, background: selected ? "#0f172a" : "transparent", color: selected ? "#fff" : "#334155" }}>
      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.title}</span>
      {node.surface && <span style={{ fontSize: 9, opacity: 0.75 }}>{SURFACE_LABEL[node.surface]}</span>}
    </button>
    <button title="Lên" disabled={busy} onClick={() => onMove(node, siblings, -1)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}><ChevronUp size={11} /></button>
    <button title="Xuống" disabled={busy} onClick={() => onMove(node, siblings, 1)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}><ChevronDown size={11} /></button>
    <button title="Đổi tên" onClick={() => setEditing(true)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}><Pencil size={11} /></button>
    <button title="Lưu trữ" disabled={busy} onClick={() => { if (confirm(`Lưu trữ ${NODE_TYPE_LABEL[node.nodeType].toLowerCase()} “${node.title}”? Mọi mục con cũng được lưu trữ, tài liệu bên trong chuyển về "Chưa phân loại".`)) onArchive(node.id); }} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}><Trash2 size={11} /></button>
  </div>;
}

function ResourceInspector({ resource, siblings, nodes, busy, onPatch, onDetach }: {
  resource: Resource | null; siblings: Resource[]; nodes: Node[]; busy: boolean;
  onPatch: (resourceId: string, payload: Record<string, unknown>, message: string) => Promise<boolean>;
  onDetach: (resourceId: string) => void;
}) {
  if (!resource) return <aside className={styles.card} style={{ padding: 18 }}>
    <strong style={{ fontSize: 13 }}>Inspector</strong>
    <p style={{ marginTop: 8, fontSize: 12, color: "#6b7a89" }}>Chọn một tài nguyên ở Content Canvas để chỉnh quyền, mở khóa và hiển thị.</p>
  </aside>;

  const active = resource;
  const needsPrerequisite = active.unlockMode === "after_resource" || active.unlockMode === "progress_gte";
  const locations = active.displayLocations ?? [];
  const ownerNode = nodes.find((node) => node.id === active.nodeId) ?? null;
  const inheritedSurface = ownerNode?.effectiveSurface ?? null;

  function toggleLocation(value: string) {
    const next = locations.includes(value) ? locations.filter((item) => item !== value) : [...locations, value];
    onPatch(active.id, { displayLocations: next }, "Đã đổi nơi hiển thị.");
  }

  return <aside className={styles.card} style={{ padding: 18, display: "grid", gap: 12 }}>
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <strong style={{ fontSize: 13 }}>Inspector</strong>
        <Chip>{TYPE_LABEL[active.resourceType] ?? active.resourceType}</Chip>
      </div>
      <div style={{ marginTop: 8, fontWeight: 700, fontSize: 14 }}>{active.title || active.resourceId}</div>
      <div style={{ fontSize: 11, color: "#94a3b8" }}><code>{active.resourceId}</code></div>
    </div>

    <Field label="Thuộc">
      <select value={active.nodeId ?? ""} disabled={busy} style={field} onChange={(event) => onPatch(active.id, { nodeId: event.target.value || null }, "Đã chuyển tài liệu.")}>
        <option value="">— Chưa phân loại —</option>
        {nodes.filter((node) => node.nodeType === "program").sort((a, b) => a.position - b.position).flatMap((program) => [
          <option key={program.id} value={program.id}>{program.title}</option>,
          ...nodes.filter((node) => node.parentId === program.id).sort((a, b) => a.position - b.position).flatMap((moduleNode) => [
            <option key={moduleNode.id} value={moduleNode.id}>— {moduleNode.title}</option>,
            ...nodes.filter((node) => node.parentId === moduleNode.id).sort((a, b) => a.position - b.position).map((group) => <option key={group.id} value={group.id}>—— {group.title}</option>)
          ])
        ])}
      </select>
    </Field>

    <Field label="Vai trò">
      <select value={active.requirementType} disabled={busy} style={field} onChange={(event) => onPatch(active.id, { requirementType: event.target.value }, "Đã đổi mức độ bắt buộc.")}>
        {REQUIREMENT_TYPES.map((value) => <option key={value} value={value}>{REQUIREMENT_LABEL[value]}</option>)}
      </select>
    </Field>

    <Field label="Quyền xem">
      <select value={active.access} disabled={busy} style={field} onChange={(event) => onPatch(active.id, { access: event.target.value }, "Đã đổi quyền xem.")}>
        {STAGE_RESOURCE_ACCESS.map((value) => <option key={value} value={value}>{ACCESS_LABEL[value]}</option>)}
      </select>
    </Field>

    <Field label="Luật mở khóa">
      <select value={active.unlockMode} disabled={busy || active.access === "free_preview"} style={field} onChange={(event) => onPatch(active.id, { unlockMode: event.target.value }, "Đã đổi luật mở khóa.")}>
        {UNLOCK_MODES.map((value) => <option key={value} value={value}>{UNLOCK_LABEL[value]}</option>)}
      </select>
      {active.access === "free_preview" && <small style={{ display: "block", marginTop: 4, color: "#6b7a89", fontSize: 11 }}>Tài liệu miễn phí luôn mở — luật này không áp dụng.</small>}

      {needsPrerequisite && <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
        <select value={active.prerequisiteBindingId ?? ""} disabled={busy} style={field} onChange={(event) => onPatch(active.id, { prerequisiteBindingId: event.target.value }, "Đã đặt tài liệu tiên quyết.")}>
          <option value="">— Chọn tài liệu phải học trước —</option>
          {siblings.map((sibling) => <option key={sibling.id} value={sibling.id}>{sibling.title || sibling.resourceId}</option>)}
        </select>
        {siblings.length === 0 && <small style={{ color: "#b22949", fontSize: 11 }}>Giai đoạn này chưa có tài liệu nào khác để làm điều kiện.</small>}
        {active.unlockMode === "progress_gte" && <label style={{ display: "grid", gap: 4, fontSize: 11 }}>Mở khi đạt (%)
          <input type="number" min={0} max={100} defaultValue={active.requiredProgress ?? 80} disabled={busy} style={field}
            onBlur={(event) => onPatch(active.id, { requiredProgress: Number(event.target.value) }, "Đã đặt ngưỡng tiến độ.")} />
        </label>}
      </div>}

      {active.unlockMode === "date" && <input type="datetime-local" defaultValue={active.unlockAt ? active.unlockAt.slice(0, 16) : ""} disabled={busy} style={{ ...field, marginTop: 6 }}
        onBlur={(event) => onPatch(active.id, { unlockAt: event.target.value ? new Date(event.target.value).toISOString() : null }, "Đã đặt mốc thời gian mở.")} />}

      {active.unlockMode === "manual" && <small style={{ display: "block", marginTop: 4, color: "#6b7a89", fontSize: 11 }}>Chỉ mở khi cấp quyền riêng ở mục Phân phối &amp; cấp quyền.</small>}
    </Field>

    <Field label="Khu vực học viên">
      <select value={active.surface ?? ""} disabled={busy} style={field} onChange={(event) => onPatch(active.id, { surface: event.target.value || null }, "Đã đổi khu vực.")}>
        <option value="">{inheritedSurface ? `Kế thừa: ${SURFACE_LABEL[inheritedSurface]}` : "— Chưa gán —"}</option>
        {Object.entries(SURFACE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </Field>

    <Field label="Hiển thị ở">
      <div style={{ display: "grid", gap: 4 }}>
        {DISPLAY_LOCATIONS.map((value) => <label key={value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <input type="checkbox" checked={locations.includes(value)} disabled={busy} onChange={() => toggleLocation(value)} />{LOCATION_LABEL[value]}
        </label>)}
      </div>
    </Field>

    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #eef1f4", borderRadius: 10, padding: 10 }}>
      <strong style={{ fontSize: 12 }}>Nổi bật</strong>
      <input type="checkbox" checked={active.isFeatured} disabled={busy} onChange={(event) => onPatch(active.id, { isFeatured: event.target.checked }, "Đã đổi trạng thái nổi bật.")} />
    </label>
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #eef1f4", borderRadius: 10, padding: 10 }}>
      <strong style={{ fontSize: 12 }}>Hiển thị cho học viên</strong>
      <input type="checkbox" checked={active.status !== "hidden"} disabled={busy} onChange={(event) => onPatch(active.id, { status: event.target.checked ? "active" : "hidden" }, "Đã đổi trạng thái hiển thị.")} />
    </label>

    <button className={styles.button} disabled={busy} onClick={() => onDetach(active.id)}><Trash2 size={12} />Gỡ khỏi giai đoạn</button>
  </aside>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>{children}</div>;
}

function AttachResourceForm({ busy, onSubmit }: { busy: boolean; onSubmit: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [resourceType, setResourceType] = useState<StageResourceType>("course");
  const [resourceId, setResourceId] = useState("");
  const [title, setTitle] = useState("");
  const [access, setAccess] = useState<StageResourceAccess>("stage_locked");

  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
    <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Loại tài liệu (vd khóa học video)
      <select value={resourceType} style={field} onChange={(event) => setResourceType(event.target.value as StageResourceType)}>
        {STAGE_RESOURCE_TYPES.map((value) => <option key={value} value={value}>{TYPE_LABEL[value]}</option>)}
      </select>
    </label>
    <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Mã tài liệu
      <input value={resourceId} onChange={(event) => setResourceId(event.target.value)} placeholder="vd: id khóa học" style={field} />
    </label>
    <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Tên hiển thị (tùy chọn)
      <input value={title} onChange={(event) => setTitle(event.target.value)} style={field} />
    </label>
    <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Quyền xem
      <select value={access} style={field} onChange={(event) => setAccess(event.target.value as StageResourceAccess)}>
        {STAGE_RESOURCE_ACCESS.map((value) => <option key={value} value={value}>{ACCESS_LABEL[value]}</option>)}
      </select>
    </label>
    <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !resourceId.trim()} onClick={async () => {
      if (await onSubmit({ resourceType, resourceId, title, access })) { setResourceId(""); setTitle(""); }
    }}><Plus size={14} />Gắn</button>
  </div>;
}

function ResourcePickerModal({ nodeId, onClose, onAttach }: { nodeId: string | null; onClose: () => void; onAttach: (contentItemId: string) => Promise<void> }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    const url = new URL("/api/academy-admin/content-items", window.location.origin);
    if (q.trim()) url.searchParams.set("q", q.trim());
    if (type) url.searchParams.set("type", type);
    const res = await fetch(url.toString().replace(window.location.origin, ""), { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setItems(json?.items ?? []);
    setLoading(false);
  }
  useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", display: "flex", justifyContent: "flex-end", zIndex: 50 }}>
    <div style={{ background: "#fff", width: "min(560px, 100%)", height: "100%", overflowY: "auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#a21caf", textTransform: "uppercase" }}>Resource Picker</div>
          <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>Thêm tài nguyên{nodeId ? "" : " vào giai đoạn"}</h2>
          <p style={{ fontSize: 12, color: "#6b7a89", marginTop: 4 }}>Tìm theo tên trong Kho nội dung Academy — không cần nhập UUID.</p>
        </div>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginTop: 16 }}>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tìm tên tài liệu…" style={field} />
        <select value={type} onChange={(event) => setType(event.target.value)} style={field}>
          <option value="">Tất cả loại</option>
          <option value="book">Sách</option>
          <option value="publication">Ấn phẩm</option>
          <option value="template">Mẫu thiết kế</option>
          <option value="knowledge_space">Knowledge Space</option>
          <option value="asset">Tài sản</option>
        </select>
        <button className={styles.button} onClick={search}>Tìm</button>
      </div>
      {loading && <p style={{ fontSize: 12, color: "#6b7a89", marginTop: 12 }}>Đang tải…</p>}
      {!loading && items.length === 0 && <p style={{ fontSize: 12, color: "#6b7a89", marginTop: 12 }}>Không có mục nào khớp. Vào &quot;Kho nội dung Academy&quot; để đồng bộ lại danh mục.</p>}
      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {items.map((item) => <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #eef1f4", borderRadius: 12, padding: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</div>
            <div style={{ fontSize: 11, color: "#6b7a89" }}>{TYPE_LABEL[item.contentType] ?? item.contentType}</div>
          </div>
          <button className={styles.button} disabled={attaching === item.id} onClick={async () => { setAttaching(item.id); await onAttach(item.id); setAttaching(null); }}>
            {attaching === item.id ? "Đang gắn…" : "Gắn"}
          </button>
        </div>)}
      </div>
    </div>
  </div>;
}

function ExperienceTab({ stageId, busy, onSaveDraft, onPublish }: {
  stageId: string; busy: boolean;
  onSaveDraft: (topLevel: NavItemDraft[]) => Promise<boolean>;
  onPublish: (version: number) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<UiConfig | null>(null);
  const [published, setPublished] = useState<UiConfig | null>(null);
  const [items, setItems] = useState<NavItemDraft[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/academy-admin/stages/${stageId}/ui-config`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setDraft(json?.draft ?? null);
    setPublished(json?.published ?? null);
    setItems((json?.draft ?? json?.published)?.config?.topLevel ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [stageId]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateItem(index: number, patch: Partial<NavItemDraft>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return <div style={{ display: "grid", gap: 14 }}>
    <div className={styles.card} style={{ padding: 18 }}>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7a89" }}>
        Soạn cấu hình sidebar cho riêng giai đoạn này. <strong>Chưa nối vào sidebar học viên thật</strong> — học viên vẫn thấy menu HOME/LEARN/CREATE/BUSINESS cố định như hiện nay cho tới khi có một đợt tích hợp riêng, có cờ tính năng, bật thủ công. Đây là bước soạn thảo/lưu trữ trước.
      </p>
      {loading && <p style={{ fontSize: 12, color: "#6b7a89" }}>Đang tải…</p>}
      {!loading && <>
        <div style={{ display: "flex", gap: 12, fontSize: 12, marginBottom: 12 }}>
          <span>Bản nháp: {draft ? `v${draft.version}` : "chưa có"}</span>
          <span>Đã xuất bản: {published ? `v${published.version}` : "chưa có"}</span>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto auto", gap: 8, alignItems: "center", border: "1px solid #eef1f4", borderRadius: 10, padding: 8 }}>
            <input value={item.key} onChange={(event) => updateItem(index, { key: event.target.value })} placeholder="key" style={field} />
            <input value={item.label} onChange={(event) => updateItem(index, { label: event.target.value })} placeholder="Tên hiển thị" style={field} />
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}><input type="checkbox" checked={item.visible} onChange={(event) => updateItem(index, { visible: event.target.checked })} />Hiện</label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}><input type="checkbox" checked={item.locked} onChange={(event) => updateItem(index, { locked: event.target.checked })} />Khóa</label>
            <button className={styles.button} onClick={() => setItems((current) => current.filter((_, i) => i !== index))}><Trash2 size={12} /></button>
          </div>)}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button className={styles.button} onClick={() => setItems((current) => [...current, { key: `item_${current.length + 1}`, label: "", visible: true, locked: false }])}><Plus size={14} />Thêm mục</button>
          <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy} onClick={async () => { if (await onSaveDraft(items)) load(); }}>Lưu bản nháp</button>
          {draft && <button className={styles.button} disabled={busy} onClick={async () => { if (await onPublish(draft.version)) load(); }}>Xuất bản v{draft.version}</button>}
        </div>
      </>}
    </div>
  </div>;
}
