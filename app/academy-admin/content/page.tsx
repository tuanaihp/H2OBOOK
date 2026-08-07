"use client";
import { useEffect, useState } from "react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type CatalogItem = { id: string; contentType: string; sourceTable: string; title: string; summary: string; tags: string[]; reuseCount: number };
const field = { padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 12 } as const;
const TYPE_LABEL: Record<string, string> = { book: "Sách / giáo trình", publication: "Ấn phẩm", template: "Mẫu thiết kế", knowledge_space: "Knowledge Space", asset: "Tài sản trong kho" };

export default function ContentLibraryPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [count, setCount] = useState(0);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    const url = new URL("/api/academy-admin/content-items", window.location.origin);
    if (q.trim()) url.searchParams.set("q", q.trim());
    if (type) url.searchParams.set("type", type);
    const res = await fetch(url.toString().replace(window.location.origin, ""), { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setItems(json?.items ?? []);
    setCount(json?.count ?? 0);
    setLoading(false);
  }
  useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function sync() {
    setBusy(true); setMessage(null);
    const res = await fetch("/api/academy-admin/content-items/sync", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setMessage(json?.error ?? "Đồng bộ thất bại."); return; }
    setMessage("Đã đồng bộ danh mục từ sách/ấn phẩm/template/knowledge space/asset thật.");
    search();
  }

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Kho nội dung Academy" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>MASTER CONTENT LIBRARY</span>
        <h1>Kho nội dung Academy</h1>
        <p>
          Danh mục để duyệt và chọn khi gắn tài liệu vào một giai đoạn — không phải nơi lưu nội dung.
          Sách/ấn phẩm/template/knowledge space/tài sản thật vẫn ở đúng chỗ cũ; đây chỉ là chỉ mục.
          Khóa học video (Academy Courses) không nằm trong danh mục này — quản lý riêng ở mục &quot;Khóa học video&quot;.
        </p>
      </div>
    </header>

    {message && <p style={{ fontSize: 12, marginBottom: 14, color: message.startsWith("Đã") ? "#177a54" : "#b22949" }}>{message}</p>}

    <section className={styles.card} style={{ padding: 18, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <strong style={{ fontSize: 13 }}>{count} mục trong danh mục</strong>
        <button className={styles.button} disabled={busy} onClick={sync}>{busy ? "Đang đồng bộ…" : "Đồng bộ lại danh mục"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10 }}>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tìm theo tên hoặc mô tả…" style={field} />
        <select value={type} onChange={(event) => setType(event.target.value)} style={field}>
          <option value="">Tất cả loại</option>
          {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className={styles.button} onClick={search}>Tìm</button>
      </div>
    </section>

    {loading && <p style={{ fontSize: 12, color: "#6b7a89" }}>Đang tải…</p>}
    {!loading && items.length === 0 && <div className={styles.card} style={{ padding: 24, textAlign: "center", color: "#6b7a89" }}>
      Chưa có mục nào khớp bộ lọc. Nếu danh mục còn trống, bấm &quot;Đồng bộ lại danh mục&quot; để nạp từ sách/ấn phẩm/template/knowledge space/tài sản đang có.
    </div>}

    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
      {items.map((item) => <div key={item.id} className={styles.card} style={{ padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#a21caf", textTransform: "uppercase" }}>{TYPE_LABEL[item.contentType] ?? item.contentType}</div>
        <div style={{ marginTop: 6, fontWeight: 600, fontSize: 14 }}>{item.title}</div>
        {item.summary && <p style={{ marginTop: 6, fontSize: 12, color: "#6b7a89" }}>{item.summary}</p>}
      </div>)}
    </section>
  </SimpleOperationsShell>;
}
