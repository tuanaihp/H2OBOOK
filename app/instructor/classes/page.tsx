"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Plus, School } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { Modal } from "@/components/ui/modal";
import { instructorRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type TeachingClassSummary = { id: string; name: string; code: string; status: string; studentCount: number; avgProgressPercent: number; atRiskCount: number };

export default function InstructorClassesPage() {
  const [classes, setClasses] = useState<TeachingClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Khóa Makeup Chuyên nghiệp");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/teaching/classes");
      const json = await res.json();
      if (res.ok) setClasses(json.classes ?? []);
      setLoading(false);
    })();
  }, []);

  const createClass = async () => {
    if (!name.trim() || !code.trim()) { setMessage("Nhập tên lớp và mã lớp."); return; }
    setSaving(true); setMessage(null);
    const res = await fetch("/api/teaching/classes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, code, totalSessions: 60 }) });
    const json = await res.json().catch(() => null); setSaving(false);
    if (!res.ok) { setMessage(json?.error === "CLASS_CODE_ALREADY_EXISTS" ? "Mã lớp đã tồn tại." : (json?.error ?? "Không thể tạo lớp.")); return; }
    const created = json.class as TeachingClassSummary;
    setClasses((current) => [{ ...created, avgProgressPercent: 0, atRiskCount: 0 }, ...current]);
    setOpen(false); setCode("");
  };

  return <SimpleOperationsShell title="H2OBOOK Instructor" subtitle="Class Command Center" homeHref="/instructor" routes={instructorRoutes} accentLabel="Instructor Workspace">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>CLASS COMMAND CENTER</span><h1>Lớp của tôi</h1><p>Tiến độ trung bình được tính từ Knowledge Space Progress thực tế của từng học viên trong lớp.</p></div><button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => setOpen(true)}><Plus size={15} />Tạo lớp 60 buổi</button>
    </header>

    <div className={styles.card}>
      <div className={styles.cardHead}><div><h2>Danh sách lớp</h2><p>{classes.length} lớp</p></div></div>
      <div className={styles.cardBody}>
        {loading ? <p>Đang tải…</p> : !classes.length ? (
          <div className={styles.empty}><School /><strong>Chưa có lớp nào</strong><p>Bạn chưa được gán làm giáo viên của lớp nào trong hệ thống.</p></div>
        ) : (
          <div className={styles.list}>
            {classes.map((klass) => (
              <Link key={klass.id} href={`/instructor/classes/${klass.id}`} className={styles.listItem} style={{ textDecoration: "none", color: "inherit" }}>
                <span className={styles.listItemIcon}><School size={16} /></span>
                <div>
                  <strong>{klass.name}</strong>
                  <small>{klass.code} · {klass.studentCount} học viên</small>
                  <div className={styles.progress} style={{ marginTop: 6, width: 220 }}><i style={{ width: `${klass.avgProgressPercent}%` }} /></div>
                </div>
                <div className={styles.listItemMeta}>
                  <span className={styles.badge} data-tone={klass.status === "active" ? "success" : undefined}>{klass.status}</span>
                  {klass.atRiskCount > 0 && <em style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 4 }}><AlertTriangle size={11} />{klass.atRiskCount} cần hỗ trợ</em>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
    <Modal open={open} onClose={() => setOpen(false)} title="Tạo lớp học thật" description="Lớp được lưu vào Supabase và tự động phân công cho tài khoản hiện tại."><div className="form-grid"><label className="field full"><span>Tên lớp</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field full"><span>Mã lớp</span><input className="input" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ví dụ: C26-08" /></label></div>{message && <p style={{ color: "#b42318", fontSize: 12 }}>{message}</p>}<div className="modal-actions"><button className="btn btn-secondary" onClick={() => setOpen(false)}>Hủy</button><button className="btn btn-primary" disabled={saving} onClick={() => void createClass()}>{saving ? "Đang tạo…" : "Tạo lớp"}</button></div></Modal>
  </SimpleOperationsShell>;
}
