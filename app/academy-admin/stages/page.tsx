"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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

  async function load() {
    setLoading(true);
    const res = await fetch("/api/academy-admin/stages", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    const list: Stage[] = res.ok ? (json?.stages ?? []) : [];
    if (res.ok) setStages(list); else setMessage(json?.error ?? "Không tải được danh sách giai đoạn.");
    setLoading(false);
    const entries = await Promise.all(list.map(async (stage) => {
      const healthRes = await fetch(`/api/academy-admin/stages/${stage.id}/health`, { cache: "no-store" });
      const healthJson = healthRes.ok ? await healthRes.json().catch(() => null) : null;
      return [stage.id, healthJson] as const;
    }));
    setHealth(Object.fromEntries(entries.filter(([, value]) => value)));
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

  const totalResources = stages.reduce((sum, stage) => sum + stage.resources.length, 0);
  const totalWarnings = Object.values(health).reduce((sum, item) => sum + item.issues.filter((issue) => issue.severity !== "info").length, 0);

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Giai đoạn & lộ trình" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>BẢN ĐỒ GIAI ĐOẠN NGHỀ</span>
        <h1>Giai đoạn &amp; lộ trình</h1>
        <p>Mỗi giai đoạn là một workspace quản trị riêng — cấu trúc, nội dung, mở khóa và giao diện học viên. Bấm vào một giai đoạn để vào workspace của nó.</p>
      </div>
      <Link href="/academy-admin/content" className={styles.button}>Kho nội dung Academy</Link>
    </header>

    {message && <p style={{ fontSize: 12, marginBottom: 14, color: message.startsWith("Đã") ? "#177a54" : "#b22949" }}>{message}</p>}
    {loading && <p style={{ fontSize: 12, color: "#6b7a89" }}>Đang tải…</p>}

    {!loading && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 18 }}>
      <SummaryCard label="Giai đoạn" value={stages.length} />
      <SummaryCard label="Tài liệu" value={totalResources} />
      <SummaryCard label="Cảnh báo" value={totalWarnings} />
    </div>}

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

    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
      {stages.map((stage) => {
        const stageHealth = health[stage.id];
        const warnings = stageHealth?.issues.filter((issue) => issue.severity !== "info").length ?? 0;
        return <Link key={stage.id} href={`/academy-admin/stages/${stage.id}`} className={styles.card} style={{ padding: 0, opacity: stage.status === "hidden" ? 0.85 : 1, textDecoration: "none", color: "inherit", display: "block", overflow: "hidden" }}>
          <div style={{ background: "#0f172a", color: "#fff", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#67e8f9", textTransform: "uppercase", letterSpacing: "0.1em" }}>Giai đoạn {stage.indexLabel || stage.position + 1}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: stage.status === "active" ? "#065f46" : "#78350f" }}>{stage.status === "active" ? "Đã publish" : "Draft"}</span>
            </div>
            <h2 style={{ margin: "8px 0 0", fontSize: 18 }}>{stage.title}</h2>
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
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: warnings ? "#b45309" : "#177a54" }}>{warnings ? `⚠ ${warnings} cảnh báo` : "✓ Sẵn sàng"}</span>
              <span style={{ fontWeight: 600, fontSize: 12 }}>Mở workspace →</span>
            </div>
          </div>
        </Link>;
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
