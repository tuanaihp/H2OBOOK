"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type Stage = { id: string; slug: string; position: number; indexLabel: string; title: string; description: string; durationLabel: string; status: string; resources: unknown[] };
const field = { padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 12 } as const;

export default function CareerStagesAdminPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newStageTitle, setNewStageTitle] = useState("");

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

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Giai đoạn & lộ trình" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>BẢN ĐỒ GIAI ĐOẠN NGHỀ</span>
        <h1>Giai đoạn &amp; lộ trình</h1>
        <p>Mỗi giai đoạn là một workspace quản trị riêng — chương trình, module, nội dung, mở khóa và giao diện học viên. Bấm vào một giai đoạn để vào workspace của nó.</p>
      </div>
      <Link href="/academy-admin/content" className={styles.button}>Kho nội dung Academy</Link>
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

    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
      {stages.map((stage) => <Link key={stage.id} href={`/academy-admin/stages/${stage.id}`} className={styles.card} style={{ padding: 18, opacity: stage.status === "hidden" ? 0.7 : 1, textDecoration: "none", color: "inherit", display: "block" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#a21caf", letterSpacing: "0.08em", textTransform: "uppercase" }}>Giai đoạn {stage.indexLabel || stage.position + 1}</div>
        <h2 style={{ margin: "6px 0 0", fontSize: 20 }}>{stage.title}</h2>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b7a89", minHeight: 32 }}>{stage.description || "Chưa có mô tả giai đoạn."}</p>
        <div style={{ marginTop: 12, display: "flex", gap: 14, fontSize: 12, color: "#6b7a89" }}>
          <span>{stage.resources.length} tài liệu</span>
          {stage.durationLabel && <span>{stage.durationLabel}</span>}
        </div>
        <div style={{ marginTop: 12, fontWeight: 600, fontSize: 13 }}>Mở Stage Workspace →</div>
      </Link>)}
    </section>
  </SimpleOperationsShell>;
}
