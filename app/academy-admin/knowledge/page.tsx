"use client";
import { useEffect, useState } from "react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type Authority = "h2o_official" | "external_reference" | "ai_suggestion";
type EditorialStatus = "draft" | "review" | "published" | "archived";
interface UnitSummary { id: string; title: string; summary: string; docType: string; tags: string[]; authority: Authority; skillCode: string | null; editorialStatus: EditorialStatus; currentPublishedVersionNumber: number | null; updatedAt: string }
interface UnitDetail extends UnitSummary { bodyMarkdown: string; latestDraft: { versionId: string; versionNumber: number; bodyMarkdown: string; changeNote: string } | null }

// Must exactly match curriculum_documents.doc_type's CHECK constraint (migration 0045) — a value
// outside this list fails the insert with a 400. Verified live against production 2026-08-16 after
// an earlier draft of this list included "technique", which is not one of the allowed values.
const DOC_TYPES = [
  ["article", "Bài viết"], ["checklist", "Checklist"], ["rubric", "Rubric"], ["practice", "Bài luyện tập"],
  ["worksheet", "Worksheet"], ["template", "Mẫu"], ["assessment", "Đánh giá"], ["case_study", "Tình huống thực tế"],
  ["sop", "Quy trình chuẩn"], ["script", "Kịch bản"], ["tool_guide", "Hướng dẫn công cụ"], ["playbook", "Playbook"], ["assignment", "Bài tập giao"]
] as const;
const AUTHORITY_LABEL: Record<Authority, string> = { h2o_official: "H2O chính thức", external_reference: "Tham khảo ngoài", ai_suggestion: "AI gợi ý" };
const STATUS_LABEL: Record<EditorialStatus, string> = { draft: "Bản nháp", review: "Đang duyệt", published: "Đã publish", archived: "Đã lưu trữ" };
const STATUS_TONE: Record<EditorialStatus, string> = { draft: "#9aa4b2", review: "#a05a13", published: "#177a54", archived: "#b42318" };
const MODES = ["Viết trực tiếp", "Tài liệu (PDF/DOCX/PPTX/Ảnh)", "Video", "URL", "Từ thư viện"] as const;

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; json: T & { error?: string } }> {
  const res = await fetch(url, init ? { ...init, headers: { "content-type": "application/json", ...init.headers } } : undefined);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

/**
 * "Cổng nạp kiến thức" (Admin Knowledge Gateway V1) — curriculum_documents (migration 0045) IS the
 * Knowledge Unit table (docs/knowledge-gateway-v1); this page is the first real authoring UI it has
 * ever had (previously only a seed script wrote to it). Only "Viết trực tiếp" and "Từ thư viện" are
 * fully real this pass — Tài liệu/Video/URL accept a real upload but do not auto-extract text yet
 * (see the mode note below), matching the source spec's own tolerance for a document/video adapter
 * without inventing a parsing vendor.
 */
export default function KnowledgeGatewayPage() {
  const [units, setUnits] = useState<UnitSummary[] | null>(null);
  const [filterStatus, setFilterStatus] = useState<EditorialStatus | "">("");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number]>("Viết trực tiếp");
  const [selected, setSelected] = useState<UnitDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Chưa có thay đổi");

  const [form, setForm] = useState({ title: "", summary: "", bodyMarkdown: "", docType: "article", skillCode: "", authority: "h2o_official" as Authority });

  async function load() {
    setUnits(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (filterStatus) params.set("editorialStatus", filterStatus);
    const { json } = await api<{ units: UnitSummary[] }>(`/api/academy-admin/knowledge/units?${params.toString()}`);
    setUnits(json.units ?? []);
  }
  useEffect(() => { void load(); }, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openUnit(id: string) {
    const { json } = await api<{ unit: UnitDetail }>(`/api/academy-admin/knowledge/units/${id}`);
    setSelected(json.unit ?? null);
  }

  async function createUnit() {
    if (!form.title.trim() || !form.bodyMarkdown.trim()) { setStatus("Cần nhập Tên và Nội dung."); return; }
    setBusy(true);
    const { ok, json } = await api<{ id: string }>("/api/academy-admin/knowledge/units", { method: "POST", body: JSON.stringify(form) });
    setBusy(false);
    if (!ok) { setStatus(json.error ?? "Không lưu được."); return; }
    setStatus("Đã lưu bản nháp.");
    setForm({ title: "", summary: "", bodyMarkdown: "", docType: "article", skillCode: "", authority: "h2o_official" });
    await load();
    await openUnit(json.id);
  }

  async function saveDraft() {
    if (!selected) return;
    setBusy(true);
    const { ok, json } = await api<{ versionId: string }>(`/api/academy-admin/knowledge/units/${selected.id}`, { method: "PATCH", body: JSON.stringify({ title: selected.title, summary: selected.summary, bodyMarkdown: selected.latestDraft?.bodyMarkdown ?? selected.bodyMarkdown, changeNote: "Cập nhật từ Cổng nạp kiến thức" }) });
    setBusy(false);
    if (!ok) { setStatus(json.error ?? "Không lưu được bản nháp."); return; }
    setStatus("Đã lưu bản nháp mới.");
    await openUnit(selected.id);
    await load();
  }

  async function publish() {
    if (!selected?.latestDraft) { setStatus("Chưa có bản nháp để publish."); return; }
    setBusy(true);
    const { ok, json } = await api(`/api/academy-admin/knowledge/units/${selected.id}/publish`, { method: "POST", body: JSON.stringify({ versionId: selected.latestDraft.versionId }) });
    setBusy(false);
    if (!ok) { setStatus(json.error ?? "Không publish được."); return; }
    setStatus("Đã publish — H2O Coach có thể dùng làm kiến thức chính thức. Vào \"Bản đồ kết quả học viên\" để gắn vào đúng Mission.");
    await openUnit(selected.id);
    await load();
  }

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Cổng nạp kiến thức" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <div className={styles.grid}>
      <section className={`${styles.card} ${styles.span12}`}>
        <div className={styles.cardHead}><div><h2>Cổng nạp kiến thức</h2><p>Chỉ nội dung đã Publish mới trở thành kiến thức chính thức cho H2O Coach. Bản nháp không hiển thị cho học viên.</p></div></div>
        <div className={styles.cardBody}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {MODES.map((m) => <button key={m} onClick={() => setMode(m)} style={{ borderRadius: 999, border: mode === m ? "1px solid #7b61ff" : "1px solid #dde6ef", background: mode === m ? "#f2effe" : "#fff", padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{m}</button>)}
          </div>
          {status && <p style={{ fontSize: 12, color: "#177a54", marginBottom: 10 }}>{status}</p>}

          {mode === "Viết trực tiếp" && <div style={{ display: "grid", gap: 8, maxWidth: 640 }}>
            <input placeholder="Tên kiến thức" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <select value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })} style={inputStyle}>{DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <input placeholder="Skill code (tuỳ chọn)" value={form.skillCode} onChange={(e) => setForm({ ...form, skillCode: e.target.value })} style={inputStyle} />
              <select value={form.authority} onChange={(e) => setForm({ ...form, authority: e.target.value as Authority })} style={inputStyle}>
                {(Object.keys(AUTHORITY_LABEL) as Authority[]).map((a) => <option key={a} value={a}>{AUTHORITY_LABEL[a]}</option>)}
              </select>
            </div>
            <textarea rows={2} placeholder="Mô tả ngắn" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} style={inputStyle} />
            <textarea rows={10} placeholder="Nội dung chính thức (markdown)" value={form.bodyMarkdown} onChange={(e) => setForm({ ...form, bodyMarkdown: e.target.value })} style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12 }} />
            <button className={styles.buttonPrimary} disabled={busy} onClick={createUnit}>Lưu bản nháp</button>
          </div>}

          {(mode === "Tài liệu (PDF/DOCX/PPTX/Ảnh)" || mode === "Video") && <div style={{ maxWidth: 640, border: "1px dashed #dde6ef", borderRadius: 14, padding: 20, fontSize: 13, color: "#718092" }}>
            Chế độ này chưa tự động trích xuất văn bản từ file — dùng Kho tài sản (Assets) để tải file lên lưu trữ, sau đó quay lại đây và dùng &quot;Viết trực tiếp&quot; để dán nội dung đã trích xuất thủ công. Trích xuất tự động (OCR/transcription) là bước tiếp theo, chưa xây trong đợt này.
          </div>}
          {mode === "URL" && <div style={{ maxWidth: 640, border: "1px dashed #dde6ef", borderRadius: 14, padding: 20, fontSize: 13, color: "#718092" }}>
            Dùng &quot;Viết trực tiếp&quot;, đặt Nguồn = &quot;Tham khảo ngoài&quot;, và dán nội dung/tóm tắt cùng đường link gốc vào phần Nội dung — tự động tải và phân tích URL là bước tiếp theo, chưa xây trong đợt này.
          </div>}
          {mode === "Từ thư viện" && <div style={{ maxWidth: 640, border: "1px dashed #dde6ef", borderRadius: 14, padding: 20, fontSize: 13, color: "#718092" }}>
            Tài liệu/Sách/Video đã có trong H2OBOOK — vào &quot;Bản đồ kết quả học viên&quot;, mở Mission cần gắn, chọn &quot;Học liệu liên kết&quot; và chọn tài nguyên có sẵn. Không nhân bản file — chỉ liên kết, đúng dữ liệu gốc.
          </div>}
        </div>
      </section>

      <section className={`${styles.card} ${styles.span12}`}>
        <div className={styles.cardHead}>
          <div><h2>Danh sách kiến thức</h2><p>{units?.length ?? 0} mục</p></div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Tìm theo tên..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} style={{ ...inputStyle, width: 200 }} />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as EditorialStatus | "")} style={inputStyle}>
              <option value="">Tất cả trạng thái</option>
              {(Object.keys(STATUS_LABEL) as EditorialStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <button className={styles.button} onClick={load}>Lọc</button>
          </div>
        </div>
        <div className={styles.cardBody}>
          {units === null && <p>Đang tải…</p>}
          {units && units.length === 0 && <p className={styles.empty}>Chưa có kiến thức nào.</p>}
          <div style={{ display: "grid", gap: 8 }}>
            {units?.map((u) => <div key={u.id} onClick={() => openUnit(u.id)} style={{ cursor: "pointer", border: "1px solid #dde6ef", borderRadius: 12, padding: "10px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>{u.title}</b>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_TONE[u.editorialStatus] }}>{STATUS_LABEL[u.editorialStatus]}{u.currentPublishedVersionNumber ? ` · v${u.currentPublishedVersionNumber}` : ""}</span>
              </div>
              <small style={{ color: "#718092" }}>{u.summary || "(chưa có mô tả)"}</small>
              <div style={{ fontSize: 11, color: "#9aa4b2", marginTop: 4 }}>{AUTHORITY_LABEL[u.authority]}{u.skillCode ? ` · ${u.skillCode}` : ""}</div>
            </div>)}
          </div>
        </div>
      </section>

      {selected && <section className={`${styles.card} ${styles.span12}`}>
        <div className={styles.cardHead}>
          <div><h2>{selected.title}</h2><p>{STATUS_LABEL[selected.editorialStatus]}{selected.latestDraft ? ` · đang có bản nháp v${selected.latestDraft.versionNumber}` : ""}</p></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className={styles.button} onClick={saveDraft} disabled={busy}>Lưu bản nháp</button>
            <button className={styles.buttonPrimary} onClick={publish} disabled={busy || !selected.latestDraft}>Publish</button>
          </div>
        </div>
        <div className={styles.cardBody}>
          <textarea rows={12} value={selected.latestDraft?.bodyMarkdown ?? selected.bodyMarkdown} onChange={(e) => setSelected({ ...selected, latestDraft: { versionId: selected.latestDraft?.versionId ?? "", versionNumber: selected.latestDraft?.versionNumber ?? 1, bodyMarkdown: e.target.value, changeNote: selected.latestDraft?.changeNote ?? "" } })}
            style={{ ...inputStyle, width: "100%", fontFamily: "monospace", fontSize: 12 }} />
        </div>
      </section>}
    </div>
  </SimpleOperationsShell>;
}

const inputStyle: React.CSSProperties = { padding: "9px 11px", borderRadius: 10, border: "1px solid #dde6ef", fontSize: 13, font: "inherit" };
