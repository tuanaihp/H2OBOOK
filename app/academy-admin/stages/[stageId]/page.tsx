"use client";
import { useEffect, useState, use as usePromise } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import { DISPLAY_LOCATIONS, REQUIREMENT_TYPES, STAGE_RESOURCE_ACCESS, STAGE_RESOURCE_TYPES, UNLOCK_MODES, type StageResourceAccess, type StageResourceType } from "@/lib/career-stages/types";
import styles from "@/components/operations/operations.module.css";

type Resource = {
  id: string; resourceType: string; resourceId: string; title: string; position: number; access: string; status: string;
  unlockMode: string; prerequisiteBindingId: string | null; requiredProgress: number | null; unlockAt: string | null;
  requirementType: string; displayLocations: string[]; nodeId: string | null; surface: string | null; isFeatured: boolean;
};
type Stage = { id: string; slug: string; position: number; indexLabel: string; title: string; description: string; durationLabel: string; skills: string[]; status: string; resources: Resource[] };
type Node = { id: string; parentId: string | null; nodeType: "program" | "module" | "group"; title: string; description: string; position: number; status: string };
type CatalogItem = { id: string; contentType: string; title: string; summary: string; tags: string[] };
type NavItemDraft = { key: string; label: string; icon?: string; route?: string; visible: boolean; locked: boolean; requiredStage?: number | null };
type UiConfig = { id: string; version: number; status: string; config: { topLevel: NavItemDraft[]; notes?: string }; publishedAt: string | null };

const field = { padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 12 } as const;
const TABS: Array<{ key: string; label: string }> = [
  { key: "overview", label: "Tổng quan" },
  { key: "structure", label: "Chương trình / module" },
  { key: "content", label: "Nội dung" },
  { key: "resources", label: "Tài nguyên" },
  { key: "assignments", label: "Bài tập" },
  { key: "unlock", label: "Mở khóa" },
  { key: "experience", label: "Giao diện học viên" },
  { key: "analytics", label: "Analytics" }
];
const SURFACE_LABEL: Record<string, string> = { learn: "Learn", create: "Create", business: "Business", coaching: "H2O Coaching" };
const TYPE_LABEL: Record<string, string> = {
  book: "Sách / giáo trình", course: "Khóa học", publication: "Ấn phẩm", template: "Mẫu thiết kế",
  knowledge_space: "Knowledge Space", roadmap: "Lộ trình", link: "Liên kết ngoài", asset: "Tài sản trong kho"
};
const ACCESS_LABEL: Record<string, string> = { free_preview: "Miễn phí — ai cũng xem", stage_locked: "Khóa theo giai đoạn", entitlement_only: "Chỉ khi được cấp riêng" };
const UNLOCK_LABEL: Record<string, string> = {
  immediate: "Mở ngay khi vào giai đoạn", stage_active: "Khi đang ở giai đoạn này", after_resource: "Sau khi học xong tài liệu khác",
  progress_gte: "Khi đạt % tiến độ tài liệu khác", date: "Từ một mốc thời gian", manual: "Chỉ mở tay cho từng học viên"
};
const REQUIREMENT_LABEL: Record<string, string> = { required: "Bắt buộc", optional: "Tùy chọn", bonus: "Mở rộng" };
const LOCATION_LABEL: Record<string, string> = { library: "Thư viện", journey: "Hành trình", smart_home: "Smart Home" };

export default function StageWorkspacePage({ params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = usePromise(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = TABS.some((tab) => tab.key === searchParams.get("view")) ? (searchParams.get("view") as string) : "overview";

  const [stage, setStage] = useState<Stage | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [stagesRes, nodesRes] = await Promise.all([
      fetch("/api/academy-admin/stages", { cache: "no-store" }),
      fetch(`/api/academy-admin/stages/${stageId}/nodes`, { cache: "no-store" })
    ]);
    const stagesJson = await stagesRes.json().catch(() => null);
    const nodesJson = await nodesRes.json().catch(() => null);
    if (stagesRes.ok) setStage((stagesJson?.stages ?? []).find((candidate: Stage) => candidate.id === stageId) ?? null);
    if (nodesRes.ok) setNodes(nodesJson?.items ?? []);
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

  const programs = nodes.filter((node) => node.nodeType === "program");
  const modules = nodes.filter((node) => node.nodeType === "module");
  const groups = nodes.filter((node) => node.nodeType === "group");

  if (loading) return <SimpleOperationsShell title="Academy Control Center" subtitle="Stage Workspace" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin"><p style={{ fontSize: 12, color: "#6b7a89" }}>Đang tải…</p></SimpleOperationsShell>;
  if (!stage) return <SimpleOperationsShell title="Academy Control Center" subtitle="Stage Workspace" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin"><p style={{ fontSize: 12, color: "#b22949" }}>Không tìm thấy giai đoạn này.</p></SimpleOperationsShell>;

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Stage Workspace" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <div style={{ marginBottom: 14 }}><Link href="/academy-admin/stages" style={{ fontSize: 12, color: "#6b7a89" }}>← Tất cả giai đoạn</Link></div>

    <header style={{ borderRadius: 24, background: "#0f172a", color: "#fff", padding: 24, marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#67e8f9" }}>Stage Workspace · Giai đoạn {stage.indexLabel || stage.position + 1}</div>
      <h1 style={{ margin: "8px 0 0", fontSize: 30 }}>{stage.title}</h1>
      <p style={{ margin: "8px 0 0", color: "#cbd5e1", maxWidth: 640 }}>{stage.description || "Quản trị cấu trúc và trải nghiệm học viên của giai đoạn này."}</p>
    </header>

    {message && <p style={{ fontSize: 12, marginBottom: 14, color: message.startsWith("Đã") ? "#177a54" : "#b22949" }}>{message}</p>}

    <div style={{ display: "flex", gap: 8, overflowX: "auto", borderBottom: "1px solid #eef1f4", paddingBottom: 8, marginBottom: 18 }}>
      {TABS.map((tab) => <button key={tab.key} onClick={() => router.push(`/academy-admin/stages/${stageId}?view=${tab.key}`)}
        style={{ whiteSpace: "nowrap", padding: "8px 14px", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: active === tab.key ? "#0f172a" : "#f1f5f9", color: active === tab.key ? "#fff" : "#334155" }}>
        {tab.label}
      </button>)}
    </div>

    {active === "overview" && <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Metric label="Chương trình" value={programs.length} />
        <Metric label="Module" value={modules.length} />
        <Metric label="Nhóm tài liệu" value={groups.length} />
        <Metric label="Tài liệu" value={stage.resources.length} />
      </div>
      <StageMetaForm stage={stage} busy={busy} onSave={(payload) => call(`/api/academy-admin/stages/${stageId}`, { method: "PATCH", body: JSON.stringify(payload) }, "Đã lưu thông tin giai đoạn.")} />
    </div>}

    {active === "structure" && <StructureTab nodes={nodes} busy={busy} onCreate={(payload) => call(`/api/academy-admin/stages/${stageId}/nodes`, { method: "POST", body: JSON.stringify(payload) }, "Đã thêm.")} onArchive={(nodeId) => call(`/api/academy-admin/stage-nodes/${nodeId}`, { method: "DELETE" }, "Đã lưu trữ.")} />}

    {active === "content" && <ContentTab nodes={nodes} busy={busy}
      onSync={() => call("/api/academy-admin/content-items/sync", { method: "POST", body: "{}" }, "Đã đồng bộ danh mục.")}
      onAttach={(payload) => call(`/api/academy-admin/stages/${stageId}/catalog-resources`, { method: "POST", body: JSON.stringify(payload) }, "Đã gắn tài liệu vào giai đoạn.")} />}

    {active === "resources" && <div style={{ display: "grid", gap: 14 }}>
      <div className={styles.tableWrap}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ textAlign: "left", color: "#6b7a89" }}>
            <th style={{ padding: 8 }}>Tài liệu</th><th style={{ padding: 8 }}>Nav section</th><th style={{ padding: 8 }}>Quyền xem</th><th style={{ padding: 8 }}>Luật mở khóa</th><th style={{ padding: 8 }}>Hiển thị ở</th><th style={{ padding: 8 }} />
          </tr></thead>
          <tbody>
            {stage.resources.length === 0 && <tr><td colSpan={6} style={{ padding: 12, color: "#6b7a89" }}>Chưa gắn tài liệu nào cho giai đoạn này.</td></tr>}
            {stage.resources.map((resource) => <ResourceRow key={resource.id} resource={resource} siblings={stage.resources.filter((r) => r.id !== resource.id)} busy={busy}
              onPatch={(payload, msg) => call(`/api/academy-admin/stage-resources/${resource.id}`, { method: "PATCH", body: JSON.stringify(payload) }, msg)}
              onDetach={() => { if (confirm("Gỡ tài liệu này khỏi giai đoạn? Nội dung gốc không bị xóa.")) call(`/api/academy-admin/stage-resources/${resource.id}`, { method: "DELETE" }, "Đã gỡ tài liệu khỏi giai đoạn."); }} />)}
          </tbody>
        </table>
      </div>
      <AttachResourceForm busy={busy} onSubmit={(payload) => call(`/api/academy-admin/stages/${stageId}/resources`, { method: "POST", body: JSON.stringify(payload) }, "Đã gắn tài liệu vào giai đoạn.")} />
    </div>}

    {active === "assignments" && <InfoPanel title="Bài tập" text="Chưa nối vào hệ bài tập trong lượt tích hợp này. Bài tập/nộp bài/chấm điểm vẫn quản lý ở Academy Admin → Bài tập như hiện tại — tab này sẽ trỏ vào đúng bài tập theo stage/node ở một lượt sau." />}

    {active === "unlock" && <InfoPanel title="Quy tắc mở khóa" text="Luật mở khóa được sửa trực tiếp trên từng dòng ở tab Tài nguyên (cột 'Luật mở khóa') — dùng engine đã có: immediate, stage_active, after_resource, progress_gte, date, manual. Không có bảng luật mở khóa riêng để tránh trùng lặp với engine thật." />}

    {active === "experience" && <ExperienceTab stageId={stageId} busy={busy}
      onSaveDraft={(topLevel) => call(`/api/academy-admin/stages/${stageId}/ui-config`, { method: "POST", body: JSON.stringify({ topLevel }) }, "Đã lưu bản nháp.")}
      onPublish={(version) => call(`/api/academy-admin/stages/${stageId}/ui-config/publish`, { method: "POST", body: JSON.stringify({ version }) }, "Đã xuất bản.")} />}

    {active === "analytics" && <InfoPanel title="Analytics" text="Chưa tổng hợp trong lượt tích hợp này. Đọc từ các bảng progress/assignment thật ở lượt sau, không có số liệu giả trong lúc chưa nối." />}
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

function StructureTab({ nodes, busy, onCreate, onArchive }: { nodes: Node[]; busy: boolean; onCreate: (payload: Record<string, unknown>) => Promise<boolean>; onArchive: (nodeId: string) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [nodeType, setNodeType] = useState<"program" | "module" | "group">("program");
  const [parentId, setParentId] = useState("");
  const programs = nodes.filter((node) => node.nodeType === "program");
  const parentOptions = nodeType === "module" ? programs : nodeType === "group" ? nodes.filter((node) => node.nodeType === "module") : [];

  return <div style={{ display: "grid", gap: 14 }}>
    <div className={styles.card} style={{ padding: 18 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 15 }}>Program → Module → Group</h2>
      {programs.length === 0 && <p style={{ fontSize: 12, color: "#6b7a89" }}>Chưa có chương trình nào. Tạo Program đầu tiên cho giai đoạn này.</p>}
      <div style={{ display: "grid", gap: 12 }}>
        {programs.map((program) => <div key={program.id} style={{ borderRadius: 14, border: "1px solid #eef1f4", padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <strong>{program.title}</strong>
            <button className={styles.button} disabled={busy} onClick={() => { if (confirm(`Lưu trữ chương trình "${program.title}"?`)) onArchive(program.id); }}><Trash2 size={12} /></button>
          </div>
          <div style={{ marginTop: 8, paddingLeft: 14, display: "grid", gap: 8 }}>
            {nodes.filter((node) => node.parentId === program.id).map((moduleNode) => <div key={moduleNode.id} style={{ background: "#f8fafc", borderRadius: 10, padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600 }}>{moduleNode.title}</span>
                <button className={styles.button} disabled={busy} onClick={() => { if (confirm(`Lưu trữ module "${moduleNode.title}"?`)) onArchive(moduleNode.id); }}><Trash2 size={11} /></button>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {nodes.filter((node) => node.parentId === moduleNode.id).map((group) => <span key={group.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #dfe3e8", borderRadius: 999, padding: "4px 10px", fontSize: 11, background: "#fff" }}>
                  {group.title}
                  <button style={{ border: "none", background: "none", cursor: "pointer", color: "#b22949" }} disabled={busy} onClick={() => { if (confirm(`Lưu trữ nhóm "${group.title}"?`)) onArchive(group.id); }}>×</button>
                </span>)}
              </div>
            </div>)}
          </div>
        </div>)}
      </div>
    </div>

    <div className={styles.card} style={{ padding: 18 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 15 }}>Thêm program / module / group</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Loại
          <select value={nodeType} style={field} onChange={(event) => { setNodeType(event.target.value as "program" | "module" | "group"); setParentId(""); }}>
            <option value="program">Chương trình (program)</option>
            <option value="module">Module</option>
            <option value="group">Nhóm tài liệu (group)</option>
          </select>
        </label>
        {nodeType !== "program" && <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Thuộc
          <select value={parentId} style={field} onChange={(event) => setParentId(event.target.value)}>
            <option value="">— Chọn {nodeType === "module" ? "chương trình" : "module"} —</option>
            {parentOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
          </select>
        </label>}
        <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Tên
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Module 1 — Nền tảng" style={field} />
        </label>
        <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !title.trim() || (nodeType !== "program" && !parentId)} onClick={async () => {
          if (await onCreate({ nodeType, title, parentId: nodeType === "program" ? undefined : parentId })) { setTitle(""); setParentId(""); }
        }}><Plus size={14} />Thêm</button>
      </div>
    </div>
  </div>;
}

function ContentTab({ nodes, busy, onSync, onAttach }: { nodes: Node[]; busy: boolean; onSync: () => Promise<boolean>; onAttach: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [nodeId, setNodeId] = useState("");

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

  return <div style={{ display: "grid", gap: 14 }}>
    <div className={styles.card} style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>Kho nội dung Academy</h2>
        <button className={styles.button} disabled={busy} onClick={async () => { if (await onSync()) search(); }}>Đồng bộ lại danh mục</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, marginBottom: 12 }}>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tìm theo tên…" style={field} />
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
      <label style={{ display: "grid", gap: 6, fontSize: 11, marginBottom: 12 }}>Gắn vào (tùy chọn)
        <select value={nodeId} onChange={(event) => setNodeId(event.target.value)} style={field}>
          <option value="">— Không thuộc program/module nào —</option>
          {nodes.map((node) => <option key={node.id} value={node.id}>{"— ".repeat(node.nodeType === "module" ? 1 : node.nodeType === "group" ? 2 : 0)}{node.title}</option>)}
        </select>
      </label>
      {loading && <p style={{ fontSize: 12, color: "#6b7a89" }}>Đang tải…</p>}
      {!loading && items.length === 0 && <p style={{ fontSize: 12, color: "#6b7a89" }}>Không có mục nào khớp. Nếu bạn vừa tạo sách/asset/template mới, bấm &quot;Đồng bộ lại danh mục&quot;.</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item) => <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #eef1f4", borderRadius: 10, padding: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</div>
            <div style={{ fontSize: 11, color: "#6b7a89" }}>{TYPE_LABEL[item.contentType] ?? item.contentType}</div>
          </div>
          <button className={styles.button} disabled={busy} onClick={() => onAttach({ contentItemId: item.id, nodeId: nodeId || undefined })}><Plus size={12} />Gắn vào giai đoạn</button>
        </div>)}
      </div>
    </div>
  </div>;
}

function AttachResourceForm({ busy, onSubmit }: { busy: boolean; onSubmit: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [resourceType, setResourceType] = useState<StageResourceType>("course");
  const [resourceId, setResourceId] = useState("");
  const [title, setTitle] = useState("");
  const [access, setAccess] = useState<StageResourceAccess>("stage_locked");

  return <div className={styles.card} style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
    <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Loại tài liệu (gắn tay — vd khóa học video)
      <select value={resourceType} style={field} onChange={(event) => setResourceType(event.target.value as StageResourceType)}>
        {STAGE_RESOURCE_TYPES.map((value) => <option key={value} value={value}>{TYPE_LABEL[value]}</option>)}
      </select>
    </label>
    <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Mã tài liệu (id hoặc slug)
      <input value={resourceId} onChange={(event) => setResourceId(event.target.value)} placeholder="vd: id khóa học" style={field} />
    </label>
    <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Tên hiển thị (tùy chọn)
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Để trống = lấy tên gốc" style={field} />
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

function ResourceRow({ resource, siblings, busy, onPatch, onDetach }: {
  resource: Resource; siblings: Resource[]; busy: boolean;
  onPatch: (payload: Record<string, unknown>, message: string) => Promise<boolean>; onDetach: () => void;
}) {
  const needsPrerequisite = resource.unlockMode === "after_resource" || resource.unlockMode === "progress_gte";
  const locations = resource.displayLocations ?? [];

  function toggleLocation(value: string) {
    const next = locations.includes(value) ? locations.filter((item) => item !== value) : [...locations, value];
    onPatch({ displayLocations: next }, "Đã đổi nơi hiển thị.");
  }

  return <tr style={{ borderTop: "1px solid #eef1f4", verticalAlign: "top" }}>
    <td style={{ padding: 8 }}>
      <strong style={{ display: "block" }}>{resource.title || resource.resourceId}</strong>
      <small style={{ color: "#6b7a89" }}>{TYPE_LABEL[resource.resourceType] ?? resource.resourceType} · <code>{resource.resourceId}</code></small>
      <div style={{ marginTop: 6 }}>
        <select value={resource.requirementType} disabled={busy} style={{ ...field, padding: 6 }} onChange={(event) => onPatch({ requirementType: event.target.value }, "Đã đổi mức độ bắt buộc.")}>
          {REQUIREMENT_TYPES.map((value) => <option key={value} value={value}>{REQUIREMENT_LABEL[value]}</option>)}
        </select>
      </div>
    </td>

    <td style={{ padding: 8 }}>
      <select value={resource.surface ?? ""} disabled={busy} style={field} onChange={(event) => onPatch({ surface: event.target.value || null }, "Đã đổi nav section.")}>
        <option value="">— Chưa gán —</option>
        {Object.entries(SURFACE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginTop: 6 }}>
        <input type="checkbox" checked={resource.isFeatured} disabled={busy} onChange={(event) => onPatch({ isFeatured: event.target.checked }, "Đã đổi trạng thái nổi bật.")} />
        Nổi bật
      </label>
    </td>

    <td style={{ padding: 8 }}>
      <select value={resource.access} disabled={busy} style={field} onChange={(event) => onPatch({ access: event.target.value }, "Đã đổi quyền xem.")}>
        {STAGE_RESOURCE_ACCESS.map((value) => <option key={value} value={value}>{ACCESS_LABEL[value]}</option>)}
      </select>
    </td>

    <td style={{ padding: 8, minWidth: 260 }}>
      <select value={resource.unlockMode} disabled={busy || resource.access === "free_preview"} style={field} onChange={(event) => onPatch({ unlockMode: event.target.value }, "Đã đổi luật mở khóa.")}>
        {UNLOCK_MODES.map((value) => <option key={value} value={value}>{UNLOCK_LABEL[value]}</option>)}
      </select>
      {resource.access === "free_preview" && <small style={{ display: "block", marginTop: 4, color: "#6b7a89" }}>Tài liệu miễn phí luôn mở — luật này không áp dụng.</small>}

      {needsPrerequisite && <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
        <select value={resource.prerequisiteBindingId ?? ""} disabled={busy} style={field} onChange={(event) => onPatch({ prerequisiteBindingId: event.target.value }, "Đã đặt tài liệu tiên quyết.")}>
          <option value="">— Chọn tài liệu phải học trước —</option>
          {siblings.map((sibling) => <option key={sibling.id} value={sibling.id}>{sibling.title || sibling.resourceId}</option>)}
        </select>
        {siblings.length === 0 && <small style={{ color: "#b22949" }}>Giai đoạn này chưa có tài liệu nào khác để làm điều kiện.</small>}
        {resource.unlockMode === "progress_gte" && <label style={{ display: "grid", gap: 4, fontSize: 11 }}>Mở khi đạt (%)
          <input type="number" min={0} max={100} defaultValue={resource.requiredProgress ?? 80} disabled={busy} style={field}
            onBlur={(event) => onPatch({ requiredProgress: Number(event.target.value) }, "Đã đặt ngưỡng tiến độ.")} />
        </label>}
      </div>}

      {resource.unlockMode === "date" && <label style={{ display: "grid", gap: 4, fontSize: 11, marginTop: 6 }}>Mở từ lúc
        <input type="datetime-local" defaultValue={resource.unlockAt ? resource.unlockAt.slice(0, 16) : ""} disabled={busy} style={field}
          onBlur={(event) => onPatch({ unlockAt: event.target.value ? new Date(event.target.value).toISOString() : null }, "Đã đặt mốc thời gian mở.")} />
      </label>}

      {resource.unlockMode === "manual" && <small style={{ display: "block", marginTop: 4, color: "#6b7a89" }}>Chỉ mở khi cấp quyền riêng cho từng học viên ở mục Phân phối &amp; cấp quyền.</small>}
    </td>

    <td style={{ padding: 8 }}>
      <div style={{ display: "grid", gap: 4 }}>
        {DISPLAY_LOCATIONS.map((value) => <label key={value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <input type="checkbox" checked={locations.includes(value)} disabled={busy} onChange={() => toggleLocation(value)} />
          {LOCATION_LABEL[value]}
        </label>)}
      </div>
    </td>

    <td style={{ padding: 8 }}>
      <button className={styles.button} disabled={busy} onClick={onDetach}><Trash2 size={13} /></button>
    </td>
  </tr>;
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
