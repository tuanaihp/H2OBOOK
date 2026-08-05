"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import { DISPLAY_LOCATIONS, REQUIREMENT_TYPES, STAGE_RESOURCE_ACCESS, STAGE_RESOURCE_TYPES, UNLOCK_MODES, type StageResourceAccess, type StageResourceType } from "@/lib/career-stages/types";
import styles from "@/components/operations/operations.module.css";

type Resource = { id: string; resourceType: string; resourceId: string; title: string; position: number; access: string; status: string; unlockMode: string; prerequisiteBindingId: string | null; requiredProgress: number | null; unlockAt: string | null; requirementType: string; displayLocations: string[] };
type Stage = { id: string; slug: string; position: number; indexLabel: string; title: string; description: string; durationLabel: string; skills: string[]; status: string; resources: Resource[] };

const TYPE_LABEL: Record<string, string> = {
  book: "Sách / giáo trình", course: "Khóa học", publication: "Ấn phẩm", template: "Mẫu thiết kế",
  knowledge_space: "Knowledge Space", roadmap: "Lộ trình", link: "Liên kết ngoài"
};
const ACCESS_LABEL: Record<string, string> = {
  free_preview: "Miễn phí — ai cũng xem",
  stage_locked: "Khóa theo giai đoạn",
  entitlement_only: "Chỉ khi được cấp riêng"
};
const UNLOCK_LABEL: Record<string, string> = {
  immediate: "Mở ngay khi vào giai đoạn",
  stage_active: "Khi đang ở giai đoạn này",
  after_resource: "Sau khi học xong tài liệu khác",
  progress_gte: "Khi đạt % tiến độ tài liệu khác",
  date: "Từ một mốc thời gian",
  manual: "Chỉ mở tay cho từng học viên"
};
const REQUIREMENT_LABEL: Record<string, string> = { required: "Bắt buộc", optional: "Tùy chọn", bonus: "Mở rộng" };
const LOCATION_LABEL: Record<string, string> = { library: "Thư viện", journey: "Hành trình", smart_home: "Smart Home" };
const field = { padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 12 } as const;

export default function CareerStagesAdminPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [openStageId, setOpenStageId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/academy-admin/stages", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (res.ok) setStages(json?.stages ?? []);
    else setMessage(json?.error ?? "Không tải được danh sách giai đoạn.");
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

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

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Giai đoạn & tài liệu" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>BẢN ĐỒ GIAI ĐOẠN NGHỀ</span>
        <h1>Giai đoạn &amp; tài liệu liên kết</h1>
        <p>Mỗi giai đoạn giữ danh sách tài liệu riêng. Thêm giai đoạn mới bất cứ lúc nào — trang công khai và thư viện học viên đều đọc từ đây, không cần deploy lại.</p>
      </div>
    </header>

    {message && <p style={{ fontSize: 12, marginBottom: 14, color: message.startsWith("Đã") ? "#177a54" : "#b22949" }}>{message}</p>}
    {loading && <p style={{ fontSize: 12, color: "#6b7a89" }}>Đang tải…</p>}

    {!loading && stages.length === 0 && <section className={styles.card} style={{ marginBottom: 18 }}>
      <div className={styles.cardBody} style={{ padding: 18, display: "grid", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 12 }}>Chưa có giai đoạn nào. Bạn có thể nạp sẵn 5 giai đoạn đang dùng trên trang công khai rồi sửa lại, hoặc tự tạo từ đầu.</p>
        <div><button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy} onClick={() => call("/api/academy-admin/stages", { method: "POST", body: JSON.stringify({ action: "seed" }) }, "Đã nạp 5 giai đoạn mặc định.")}>Nạp 5 giai đoạn mặc định</button></div>
      </div>
    </section>}

    <section className={styles.card} style={{ marginBottom: 18 }}>
      <div className={styles.cardHead}><div><h2>Thêm giai đoạn</h2></div></div>
      <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Tên giai đoạn
          <input value={newStageTitle} onChange={(event) => setNewStageTitle(event.target.value)} placeholder="Ví dụ: Chuyên gia đào tạo" style={field} />
        </label>
        <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !newStageTitle.trim()} onClick={async () => {
          if (await call("/api/academy-admin/stages", { method: "POST", body: JSON.stringify({ title: newStageTitle }) }, "Đã thêm giai đoạn.")) setNewStageTitle("");
        }}><Plus size={14} />Thêm</button>
      </div>
    </section>

    {stages.map((stage) => <section key={stage.id} className={styles.card} style={{ marginBottom: 14, opacity: stage.status === "hidden" ? 0.7 : 1 }}>
      <div className={styles.cardHead}>
        <div>
          <h2>{stage.indexLabel || `#${stage.position + 1}`} · {stage.title}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7a89" }}>{stage.slug}{stage.durationLabel ? ` · ${stage.durationLabel}` : ""} · {stage.resources.length} tài liệu</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={stage.status} disabled={busy} style={field} onChange={(event) => call(`/api/academy-admin/stages/${stage.id}`, { method: "PATCH", body: JSON.stringify({ status: event.target.value }) }, "Đã cập nhật trạng thái giai đoạn.")}>
            <option value="active">Đang hiển thị</option>
            <option value="hidden">Tạm ẩn</option>
          </select>
          <button className={styles.button} onClick={() => setOpenStageId(openStageId === stage.id ? null : stage.id)}>{openStageId === stage.id ? "Đóng" : "Quản lý tài liệu"}</button>
          <button className={styles.button} disabled={busy} onClick={() => { if (confirm(`Lưu trữ giai đoạn “${stage.title}” và toàn bộ tài liệu gắn kèm?`)) call(`/api/academy-admin/stages/${stage.id}`, { method: "DELETE" }, "Đã lưu trữ giai đoạn."); }}><Trash2 size={13} />Lưu trữ</button>
        </div>
      </div>

      {openStageId === stage.id && <div className={styles.cardBody} style={{ padding: 18, display: "grid", gap: 14 }}>
        <StageMetaForm stage={stage} busy={busy} onSave={(payload) => call(`/api/academy-admin/stages/${stage.id}`, { method: "PATCH", body: JSON.stringify(payload) }, "Đã lưu thông tin giai đoạn.")} />

        <div className={styles.tableWrap}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ textAlign: "left", color: "#6b7a89" }}><th style={{ padding: 8 }}>Tài liệu</th><th style={{ padding: 8 }}>Quyền xem</th><th style={{ padding: 8 }}>Luật mở khóa</th><th style={{ padding: 8 }}>Hiển thị ở</th><th style={{ padding: 8 }} /></tr></thead>
            <tbody>
              {stage.resources.length === 0 && <tr><td colSpan={5} style={{ padding: 12, color: "#6b7a89" }}>Chưa gắn tài liệu nào cho giai đoạn này.</td></tr>}
              {stage.resources.map((resource) => <ResourceRow
                key={resource.id}
                resource={resource}
                siblings={stage.resources.filter((candidate) => candidate.id !== resource.id)}
                busy={busy}
                onPatch={(payload, message) => call(`/api/academy-admin/stage-resources/${resource.id}`, { method: "PATCH", body: JSON.stringify(payload) }, message)}
                onDetach={() => { if (confirm("Gỡ tài liệu này khỏi giai đoạn? Nội dung gốc không bị xóa.")) call(`/api/academy-admin/stage-resources/${resource.id}`, { method: "DELETE" }, "Đã gỡ tài liệu khỏi giai đoạn."); }}
              />)}
            </tbody>
          </table>
        </div>

        <AttachResourceForm busy={busy} onSubmit={(payload) => call(`/api/academy-admin/stages/${stage.id}/resources`, { method: "POST", body: JSON.stringify(payload) }, "Đã gắn tài liệu vào giai đoạn.")} />
      </div>}
    </section>)}
  </SimpleOperationsShell>;
}

function StageMetaForm({ stage, busy, onSave }: { stage: Stage; busy: boolean; onSave: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [description, setDescription] = useState(stage.description);
  const [durationLabel, setDurationLabel] = useState(stage.durationLabel);
  const [indexLabel, setIndexLabel] = useState(stage.indexLabel);
  const [skills, setSkills] = useState(stage.skills.join(", "));

  return <div style={{ display: "grid", gap: 10 }}>
    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 150px", gap: 10 }}>
      <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Số thứ tự<input value={indexLabel} onChange={(event) => setIndexLabel(event.target.value)} placeholder="01" style={field} /></label>
      <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Mô tả<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Giai đoạn này giúp học viên làm được gì" style={field} /></label>
      <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Thời lượng<input value={durationLabel} onChange={(event) => setDurationLabel(event.target.value)} placeholder="0–2 tháng" style={field} /></label>
    </div>
    <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Kỹ năng (cách nhau bằng dấu phẩy)<input value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="Nền tảng makeup, Tóc cơ bản" style={field} /></label>
    <div><button className={styles.button} disabled={busy} onClick={() => onSave({ indexLabel, description, durationLabel, skills: skills.split(",").map((value) => value.trim()).filter(Boolean) })}>Lưu thông tin giai đoạn</button></div>
  </div>;
}

function AttachResourceForm({ busy, onSubmit }: { busy: boolean; onSubmit: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [resourceType, setResourceType] = useState<StageResourceType>("book");
  const [resourceId, setResourceId] = useState("");
  const [title, setTitle] = useState("");
  const [access, setAccess] = useState<StageResourceAccess>("stage_locked");

  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end", borderTop: "1px solid #eef1f4", paddingTop: 14 }}>
    <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Loại tài liệu
      <select value={resourceType} style={field} onChange={(event) => setResourceType(event.target.value as StageResourceType)}>
        {STAGE_RESOURCE_TYPES.map((value) => <option key={value} value={value}>{TYPE_LABEL[value]}</option>)}
      </select>
    </label>
    <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Mã tài liệu (id hoặc slug)
      <input value={resourceId} onChange={(event) => setResourceId(event.target.value)} placeholder="vd: book_skin" style={field} />
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

// One row per attached resource. The unlock rule fields are shown only when the chosen mode
// actually uses them — a percentage box next to "mở ngay" invites someone to fill in a number that
// will never be read.
function ResourceRow({ resource, siblings, busy, onPatch, onDetach }: {
  resource: Resource;
  siblings: Resource[];
  busy: boolean;
  onPatch: (payload: Record<string, unknown>, message: string) => Promise<boolean>;
  onDetach: () => void;
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
