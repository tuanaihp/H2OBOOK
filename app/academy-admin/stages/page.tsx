"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type Stage = { id: string; slug: string; position: number; indexLabel: string; title: string; description: string; durationLabel: string; status: string; resources: unknown[] };
type Health = { score: number; issues: { severity: "info" | "warning" | "error" }[] };
const field = { padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 12 } as const;

export default function CareerStagesAdminPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [health, setHealth] = useState<Record<string, Health>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newStageTitle, setNewStageTitle] = useState("");

  // One request for the list and every stage's health together. Fetching health per stage meant a
  // separate serverless invocation per card, and each one paid the full auth round trip again
  // before it could read anything.
  async function load() {
    setLoading(true);
    const res = await fetch("/api/academy-admin/stages?health=1", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (res.ok) { setStages(json?.stages ?? []); setHealth(json?.health ?? {}); }
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

  /**
   * Reordering swaps two neighbours' `position` values. Two writes rather than one because position
   * is what both the public learning-paths page and the student journey sort by — leaving a gap or a
   * duplicate would change the order those pages render, not just this list.
   */
  async function moveStage(stage: Stage, direction: -1 | 1) {
    const ordered = stages.slice().sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((item) => item.id === stage.id);
    const swapWith = ordered[index + direction];
    if (!swapWith) return;
    setBusy(true); setMessage(null);
    await fetch(`/api/academy-admin/stages/${stage.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ position: swapWith.position }) });
    await fetch(`/api/academy-admin/stages/${swapWith.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ position: stage.position }) });
    setBusy(false); setMessage("Đã đổi thứ tự giai đoạn.");
    await load();
  }

  const ordered = stages.slice().sort((a, b) => a.position - b.position);
  const totalResources = stages.reduce((sum, stage) => sum + stage.resources.length, 0);
  const totalWarnings = Object.values(health).reduce((sum, item) => sum + item.issues.filter((issue) => issue.severity !== "info").length, 0);

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Giai đoạn & lộ trình" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>BẢN ĐỒ GIAI ĐOẠN NGHỀ</span>
        <h1>Giai đoạn &amp; lộ trình</h1>
        <p>Mỗi giai đoạn là một workspace quản trị riêng — cấu trúc, nội dung, mở khóa và giao diện học viên. Thứ tự ở đây chính là thứ tự học viên thấy trên lộ trình.</p>
      </div>
      <Link href="/academy-admin/content" className={styles.button}>Kho nội dung Academy</Link>
    </header>

    {message && <p style={{ fontSize: 12, marginBottom: 14, color: message.startsWith("Đã") ? "#177a54" : "#b22949" }}>{message}</p>}
    {loading && <p style={{ fontSize: 12, color: "#6b7a89" }}>Đang tải…</p>}

    {!loading && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 18 }}>
      <SummaryCard label="Giai đoạn" value={stages.length} />
      <SummaryCard label="Đang publish" value={stages.filter((stage) => stage.status === "active").length} />
      <SummaryCard label="Tài liệu" value={totalResources} />
      <SummaryCard label="Cảnh báo" value={totalWarnings} />
    </div>}

    {!loading && stages.length === 0 && <section className={styles.card} style={{ marginBottom: 18 }}>
      <div className={styles.cardBody} style={{ padding: 18, display: "grid", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 12 }}>Chưa có giai đoạn nào. Bạn có thể nạp sẵn 5 giai đoạn đang dùng trên trang công khai rồi sửa lại, hoặc tự tạo từ đầu.</p>
        <div><button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy} onClick={() => call("/api/academy-admin/stages", { method: "POST", body: JSON.stringify({ action: "seed" }) }, "Đã nạp 5 giai đoạn mặc định.")}>Nạp 5 giai đoạn mặc định</button></div>
      </div>
    </section>}

    {/* Seeding is idempotent, so this stays available rather than only appearing on an empty
        workspace: re-running after the manifest gains a program adds just that program. */}
    <section className={styles.card} style={{ marginBottom: 18 }}>
      <div className={styles.cardHead}>
        <div>
          <h2>Nạp giáo trình 6 giai đoạn (ThuyH2O Makeup)</h2>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7a89" }}>
            Tạo giai đoạn → chương trình → học phần → nhóm → tài liệu vào đúng cấu hình admin. Chạy lại nhiều lần không nhân bản: mục nào đã có thì giữ nguyên, kể cả khi bạn đã sửa tay.
          </p>
        </div>
      </div>
      <div style={{ padding: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className={styles.button} disabled={busy} onClick={async () => {
          setBusy(true); setMessage(null);
          const res = await fetch("/api/academy-admin/curriculum/seed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dryRun: true }) });
          const json = await res.json().catch(() => null);
          setBusy(false);
          setMessage(json ? `Chạy thử: sẽ tạo ${json.stages?.created ?? 0} giai đoạn · ${json.nodes?.created ?? 0} mục cấu trúc · ${json.documents?.created ?? 0} tài liệu · ${json.placements?.created ?? 0} lượt gắn.` : "Không chạy thử được.");
        }}>Chạy thử (không ghi)</button>
        <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy} onClick={async () => {
          if (!confirm("Nạp giáo trình 6 giai đoạn vào workspace này? Mục đã có sẽ được giữ nguyên, không ghi đè.")) return;
          if (!await call("/api/academy-admin/curriculum/seed", { method: "POST", body: "{}" }, "Đã nạp giáo trình.")) return;
        }}>Nạp vào workspace</button>
      </div>
    </section>

    <section className={styles.card} style={{ marginBottom: 18 }}>
      <div className={styles.cardHead}><div><h2>Thêm giai đoạn</h2><p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7a89" }}>Giai đoạn mới được thêm vào cuối và ở trạng thái nháp — dùng mũi tên để đưa về đúng vị trí.</p></div></div>
      <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Tên giai đoạn
          <input value={newStageTitle} onChange={(event) => setNewStageTitle(event.target.value)} placeholder="Ví dụ: Chuyên gia đào tạo" style={field} />
        </label>
        <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !newStageTitle.trim()} onClick={async () => {
          if (await call("/api/academy-admin/stages", { method: "POST", body: JSON.stringify({ title: newStageTitle, status: "hidden" }) }, "Đã thêm giai đoạn (đang ở trạng thái nháp).")) setNewStageTitle("");
        }}><Plus size={14} />Thêm</button>
      </div>
    </section>

    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
      {ordered.map((stage, index) => {
        const stageHealth = health[stage.id];
        const warnings = stageHealth?.issues.filter((issue) => issue.severity !== "info").length ?? 0;
        return <div key={stage.id} className={styles.card} style={{ padding: 0, opacity: stage.status === "hidden" ? 0.85 : 1, overflow: "hidden" }}>
          <div style={{ background: "#0f172a", color: "#fff", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#67e8f9", textTransform: "uppercase", letterSpacing: "0.1em" }}>Giai đoạn {stage.indexLabel || index + 1}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: stage.status === "active" ? "#065f46" : "#78350f" }}>{stage.status === "active" ? "Đã publish" : "Nháp"}</span>
                <button title="Đưa lên trước" disabled={busy || index === 0} onClick={() => moveStage(stage, -1)} style={{ border: "none", background: "none", cursor: index === 0 ? "default" : "pointer", color: index === 0 ? "#475569" : "#cbd5e1", padding: 2 }}><ChevronUp size={13} /></button>
                <button title="Đưa xuống sau" disabled={busy || index === ordered.length - 1} onClick={() => moveStage(stage, 1)} style={{ border: "none", background: "none", cursor: index === ordered.length - 1 ? "default" : "pointer", color: index === ordered.length - 1 ? "#475569" : "#cbd5e1", padding: 2 }}><ChevronDown size={13} /></button>
              </div>
            </div>
            <Link href={`/academy-admin/stages/${stage.id}`} style={{ color: "#fff", textDecoration: "none" }}>
              <h2 style={{ margin: "8px 0 0", fontSize: 18 }}>{stage.title}</h2>
            </Link>
          </div>
          <div style={{ padding: 16 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7a89", minHeight: 32 }}>{stage.description || "Chưa có mô tả giai đoạn."}</p>
            <div style={{ marginTop: 10, display: "flex", gap: 14, fontSize: 12, color: "#6b7a89" }}>
              <span>{stage.resources.length} tài liệu</span>
              {stage.durationLabel && <span>{stage.durationLabel}</span>}
            </div>
            {stageHealth && <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}><span>Stage Health</span><strong>{stageHealth.score}/100</strong></div>
              <div style={{ height: 6, borderRadius: 999, background: "#eef1f4" }}><div style={{ height: 6, borderRadius: 999, width: `${stageHealth.score}%`, background: "linear-gradient(90deg,#22d3ee,#8b5cf6)" }} /></div>
            </div>}
            <div style={{ marginTop: 10, fontSize: 11, color: warnings ? "#b45309" : "#177a54" }}>{warnings ? `⚠ ${warnings} cảnh báo` : "✓ Sẵn sàng"}</div>

            <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid #eef1f4", paddingTop: 12 }}>
              <Link href={`/academy-admin/stages/${stage.id}`} className={`${styles.button} ${styles.buttonPrimary}`} style={{ flex: 1, justifyContent: "center" }}>Mở workspace</Link>
              <button className={styles.button} disabled={busy} title={stage.status === "active" ? "Tạm ẩn khỏi học viên" : "Cho hiển thị lại"}
                onClick={() => call(`/api/academy-admin/stages/${stage.id}`, { method: "PATCH", body: JSON.stringify({ status: stage.status === "active" ? "hidden" : "active" }) }, stage.status === "active" ? "Đã tạm ẩn giai đoạn." : "Đã cho hiển thị lại giai đoạn.")}>
                {stage.status === "active" ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button className={styles.button} disabled={busy} title="Lưu trữ giai đoạn"
                onClick={() => { if (confirm(`Lưu trữ giai đoạn “${stage.title}” và toàn bộ tài liệu gắn kèm? Giai đoạn sẽ biến mất khỏi danh sách này.`)) call(`/api/academy-admin/stages/${stage.id}`, { method: "DELETE" }, "Đã lưu trữ giai đoạn."); }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>;
      })}
    </section>
  </SimpleOperationsShell>;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className={styles.card} style={{ padding: 14 }}>
    <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    <div style={{ fontSize: 11, color: "#6b7a89" }}>{label}</div>
  </div>;
}
