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
const MODES = ["Viết trực tiếp", "Tài liệu (DOCX)", "URL", "Ảnh / PDF", "Video", "Từ thư viện"] as const;
const borderedBoxStyle: React.CSSProperties = { maxWidth: 640, border: "1px dashed #dde6ef", borderRadius: 14, padding: 20, fontSize: 13, color: "#718092" };

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
  const [extracting, setExtracting] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [extractionNote, setExtractionNote] = useState<string | null>(null);

  async function runExtraction(body: FormData) {
    setExtracting(true); setExtractionNote(null); setStatus("Chưa có thay đổi");
    const res = await fetch("/api/academy-admin/knowledge/extract", { method: "POST", body });
    const json = await res.json().catch(() => null);
    setExtracting(false);
    if (!res.ok) { setStatus(json?.error ?? "Không trích xuất được nội dung."); return; }
    setForm({ title: json.title || "", summary: json.summary || "", bodyMarkdown: json.bodyMarkdown || "", docType: json.docType || "article", skillCode: json.skillCode || "", authority: "h2o_official" });
    setExtractionNote(json.usedAi
      ? "Đã trích xuất văn bản thật và AI đã gợi ý tiêu đề/tóm tắt/loại tài liệu bên dưới — kiểm tra lại trước khi lưu."
      : "Đã trích xuất văn bản thật (chưa cấu hình AI trong Cổng API nên chưa có gợi ý tự động — chỉ có văn bản gốc) — kiểm tra lại trước khi lưu.");
    setMode("Viết trực tiếp");
  }

  async function onPickDocx(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    await runExtraction(fd);
  }

  async function onExtractUrl() {
    if (!urlInput.trim()) return;
    const fd = new FormData();
    fd.append("url", urlInput.trim());
    await runExtraction(fd);
  }

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
            {extractionNote && <p style={{ fontSize: 12, color: "#a05a13", background: "#fff5e8", borderRadius: 10, padding: "8px 12px" }}>{extractionNote}</p>}
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

          {mode === "Tài liệu (DOCX)" && <div style={{ maxWidth: 640, display: "grid", gap: 8 }}>
            <label style={{ ...borderedBoxStyle, display: "block", cursor: extracting ? "wait" : "pointer", textAlign: "center", fontWeight: 600 }}>
              {extracting ? "Đang trích xuất…" : "+ Chọn file .docx để trích xuất văn bản thật"}
              <input type="file" accept=".docx" disabled={extracting} onChange={onPickDocx} style={{ display: "none" }} />
            </label>
            <p style={{ fontSize: 12, color: "#718092" }}>Trích xuất văn bản thật từ file Word (không phải giả lập). Nếu tổ chức đã cấu hình AI trong &quot;Cổng API&quot;, AI sẽ gợi ý thêm tiêu đề/tóm tắt/loại tài liệu — chưa cấu hình thì chỉ có văn bản gốc, vẫn dùng được. Kết quả mở ở tab &quot;Viết trực tiếp&quot; để bạn xem lại trước khi lưu.</p>
          </div>}

          {mode === "URL" && <div style={{ maxWidth: 640, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="https://..." value={urlInput} onChange={(e) => setUrlInput(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <button className={styles.buttonPrimary} disabled={extracting || !urlInput.trim()} onClick={onExtractUrl}>{extracting ? "Đang tải…" : "Trích xuất"}</button>
            </div>
            <p style={{ fontSize: 12, color: "#718092" }}>Tải trang thật (có chặn địa chỉ nội bộ/riêng tư) và trích văn bản — mặc định Nguồn = &quot;Tham khảo ngoài&quot;. Kết quả mở ở tab &quot;Viết trực tiếp&quot; để bạn xem lại trước khi lưu.</p>
          </div>}

          {mode === "Ảnh / PDF" && <div style={borderedBoxStyle}>
            Chưa hỗ trợ tự động. OCR ảnh/PDF trong H2OBOOK cần máy chủ xử lý riêng (Python document-processor) — hạ tầng đã có sẵn trong dự án nhưng chưa được triển khai/kết nối (biến môi trường DOCUMENT_WORKER_URL chưa cấu hình). Dùng &quot;Viết trực tiếp&quot; và dán nội dung đã đọc thủ công cho tới khi máy chủ đó sẵn sàng — tránh dùng thư viện OCR khác chạy trực tiếp trên Vercel vì không ổn định cho môi trường serverless.
          </div>}
          {mode === "Video" && <div style={borderedBoxStyle}>
            Chưa hỗ trợ tự động — chuyển giọng nói thành văn bản (transcription) cần dịch vụ riêng chưa được kết nối. Dùng &quot;Viết trực tiếp&quot; và dán nội dung đã ghi chú thủ công.
          </div>}
          {mode === "Từ thư viện" && <div style={borderedBoxStyle}>
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
