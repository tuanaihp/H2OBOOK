"use client";
import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Rocket, Trash2 } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { instructorRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

const BLOCK_TYPES = ["mission_brief", "rich_text", "video", "image", "checklist", "quiz", "assignment", "reflection", "case_study", "before_after", "download", "flashcards", "result"];

type Block = { id: string; block_type: string; title: string; position: number; visibility: string; required: boolean; payload: Record<string, unknown> };
type Section = { id: string; title: string; description: string; position: number; icon: string; required: boolean; learning_blocks: Block[] };
type VersionSummary = { id: string; version_number: number; status: string; title: string };

export default function BrainStudioSpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = usePromise(params);
  const [organizationId, setOrganizationId] = useState("");
  const [space, setSpace] = useState<Record<string, unknown> | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>("");
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");

  async function loadSpace() {
    setLoading(true);
    const res = await fetch(`/api/learning/spaces/${spaceId}`);
    const json = await res.json();
    if (!res.ok) { setMessage(json.error ?? "Không tải được Knowledge Space."); setLoading(false); return; }
    setSpace(json.space);
    setVersions(json.versions ?? []);
    const draft = (json.versions ?? []).find((version: VersionSummary) => version.status === "draft");
    setActiveVersionId(draft?.id ?? json.versions?.[0]?.id ?? "");
    setLoading(false);
  }

  async function loadVersion(versionId: string) {
    if (!versionId) { setSections([]); return; }
    const res = await fetch(`/api/learning/versions/${versionId}`);
    const json = await res.json();
    if (!res.ok) { setMessage(json.error ?? "Không tải được phiên bản."); return; }
    setOrganizationId(json.version.organization_id);
    setSections((json.sections ?? []).sort((a: Section, b: Section) => a.position - b.position).map((section: Section) => ({ ...section, learning_blocks: (section.learning_blocks ?? []).sort((a, b) => a.position - b.position) })));
  }

  useEffect(() => { loadSpace(); }, [spaceId]);
  useEffect(() => { if (activeVersionId) loadVersion(activeVersionId); }, [activeVersionId]);

  const activeVersion = versions.find((version) => version.id === activeVersionId);
  const isEditable = activeVersion?.status === "draft";

  async function createNewVersion() {
    setBusy(true);
    const res = await fetch(`/api/learning/spaces/${spaceId}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, cloneFromVersionId: activeVersionId || undefined }) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setMessage(json.error ?? "Không tạo được phiên bản mới."); return; }
    await loadSpace();
    setActiveVersionId(json.version.id);
  }

  async function addSection() {
    if (!newSectionTitle.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/learning/versions/${activeVersionId}/sections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, title: newSectionTitle.trim() }) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setMessage(json.error ?? "Không thêm được phần học."); return; }
    setNewSectionTitle("");
    await loadVersion(activeVersionId);
  }

  async function removeSection(sectionId: string) {
    if (!confirm("Xóa phần học này và toàn bộ block bên trong?")) return;
    await fetch(`/api/learning/sections/${sectionId}?organizationId=${organizationId}`, { method: "DELETE" });
    await loadVersion(activeVersionId);
  }

  async function addBlock(sectionId: string, blockType: string) {
    const res = await fetch(`/api/learning/sections/${sectionId}/blocks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, blockType, title: "Block mới", payload: defaultPayload(blockType) }) });
    const json = await res.json();
    if (!res.ok) { setMessage(json.error ?? "Không thêm được block."); return; }
    await loadVersion(activeVersionId);
  }

  async function updateBlock(block: Block, patch: Partial<Block>) {
    const res = await fetch(`/api/learning/blocks/${block.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, ...patch }) });
    const json = await res.json();
    if (!res.ok) { setMessage(json.error ?? "Không cập nhật được block."); return; }
    await loadVersion(activeVersionId);
  }

  async function removeBlock(blockId: string) {
    await fetch(`/api/learning/blocks/${blockId}?organizationId=${organizationId}`, { method: "DELETE" });
    await loadVersion(activeVersionId);
  }

  async function publish() {
    if (!confirm("Xuất bản phiên bản này? Phiên bản đang publish (nếu có) sẽ chuyển sang superseded.")) return;
    setBusy(true);
    const res = await fetch(`/api/learning/versions/${activeVersionId}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId }) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setMessage(json.error ?? "Không xuất bản được."); return; }
    setMessage("Đã xuất bản thành công.");
    await loadSpace();
  }

  if (loading) return <SimpleOperationsShell title="H2O Brain Studio" subtitle="Đang tải…" homeHref="/instructor/brain-studio" routes={instructorRoutes} accentLabel="Brain Content Studio"><p>Đang tải…</p></SimpleOperationsShell>;

  return <SimpleOperationsShell title="H2O Brain Studio" subtitle={String(space?.title ?? "")} homeHref="/instructor/brain-studio" routes={instructorRoutes} accentLabel="Brain Content Studio">
    <Link href="/instructor/brain-studio" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, marginBottom: 14, color: "#6f829c", textDecoration: "none" }}><ArrowLeft size={14} />Quay lại danh sách</Link>
    {message && <div className={styles.card} style={{ marginBottom: 14, padding: 12, fontSize: 12 }}>{message}</div>}

    <div className={styles.header}>
      <div><span className={styles.eyebrow}>KNOWLEDGE SPACE</span><h1>{String(space?.title ?? "")}</h1><p>Trạng thái: {String(space?.status ?? "")} · Bài học gốc: {String(space?.content_item_id ?? "")}</p></div>
      <div className={styles.headerActions}>
        <select value={activeVersionId} onChange={(event) => setActiveVersionId(event.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }}>
          {versions.map((version) => <option key={version.id} value={version.id}>v{version.version_number} — {version.status}</option>)}
        </select>
        {!isEditable && <button className={`${styles.button} ${styles.buttonSecondary}`} disabled={busy} onClick={createNewVersion}><Plus size={16} />Tạo bản nháp mới</button>}
        {isEditable && <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy} onClick={publish}><Rocket size={16} />Xuất bản</button>}
      </div>
    </div>

    {!isEditable && <div className={styles.card} style={{ marginBottom: 14, padding: 14, fontSize: 12, color: "#a05a13" }}>Phiên bản này không còn ở trạng thái draft nên không thể sửa trực tiếp (đúng theo nguyên tắc: không sửa Published Version). Bấm &quot;Tạo bản nháp mới&quot; để tiếp tục chỉnh sửa.</div>}

    <div style={{ display: "grid", gap: 14 }}>
      {sections.map((section) => (
        <div key={section.id} className={styles.card}>
          <div className={styles.cardHead}>
            <div><h2>{section.title}</h2><p>{section.learning_blocks.length} block</p></div>
            {isEditable && <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => removeSection(section.id)}><Trash2 size={14} />Xóa phần</button>}
          </div>
          <div className={styles.cardBody}>
            <div style={{ display: "grid", gap: 10 }}>
              {section.learning_blocks.map((block) => (
                <div key={block.id} style={{ border: "1px solid #edf0f2", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                    <span className={styles.badge}>{block.block_type}</span>
                    <input value={block.title} disabled={!isEditable} onChange={(event) => updateBlock(block, { title: event.target.value })} style={{ flex: 1, minWidth: 160, padding: 8, borderRadius: 8, border: "1px solid #dfe3e8" }} />
                    <select value={block.visibility} disabled={!isEditable} onChange={(event) => updateBlock(block, { visibility: event.target.value })} style={{ padding: 8, borderRadius: 8, border: "1px solid #dfe3e8" }}>
                      {["preview", "all_entitled", "instructor", "admin"].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    {isEditable && <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => removeBlock(block.id)}><Trash2 size={14} /></button>}
                  </div>
                  <label style={{ display: "grid", gap: 4, fontSize: 10, color: "#8b8e97" }}>Payload (JSON) — {payloadHint(block.block_type)}
                    <textarea defaultValue={JSON.stringify(block.payload, null, 2)} disabled={!isEditable} rows={4}
                      onBlur={(event) => { try { updateBlock(block, { payload: JSON.parse(event.target.value || "{}") }); } catch { setMessage("Payload phải là JSON hợp lệ."); } }}
                      style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, padding: 8, borderRadius: 8, border: "1px solid #dfe3e8" }} />
                  </label>
                </div>
              ))}
              {isEditable && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {BLOCK_TYPES.map((type) => <button key={type} className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => addBlock(section.id, type)} style={{ fontSize: 10 }}>+ {type}</button>)}
              </div>}
            </div>
          </div>
        </div>
      ))}
      {isEditable && (
        <div className={styles.card}>
          <div className={styles.cardBody} style={{ display: "flex", gap: 10 }}>
            <input value={newSectionTitle} onChange={(event) => setNewSectionTitle(event.target.value)} placeholder="Tên phần học mới…" style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
            <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy} onClick={addSection}><Plus size={16} />Thêm phần học</button>
          </div>
        </div>
      )}
    </div>
  </SimpleOperationsShell>;
}

function defaultPayload(blockType: string): Record<string, unknown> {
  if (blockType === "video") return { assetId: "" };
  if (blockType === "assignment") return { instructions: "" };
  if (blockType === "quiz") return { questions: [] };
  if (blockType === "checklist") return { items: [] };
  return { text: "" };
}

function payloadHint(blockType: string) {
  if (blockType === "video") return "cần assetId";
  if (blockType === "assignment") return "cần instructions";
  if (blockType === "quiz") return "cần questions";
  return "tự do";
}
