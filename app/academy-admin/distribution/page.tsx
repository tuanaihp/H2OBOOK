"use client";
import { useEffect, useState } from "react";
import { BadgeCheck, Search } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type Course = { id: string; title: string };
type Student = { id: string; name: string; email: string };
type Grant = { id: string; userId: string; userName: string; resourceType: string; resourceId: string; status: string; expiresAt: string | null; reason: string | null };

export default function DistributionPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [email, setEmail] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadGrants() {
    const res = await fetch("/api/academy-admin/entitlements?resourceType=course");
    const json = await res.json();
    if (res.ok) setGrants(json.grants ?? []);
  }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/academy-admin/courses");
      const json = await res.json();
      if (res.ok) setCourses((json.courses ?? []).map((c: { id: string; title: string }) => ({ id: c.id, title: c.title })));
    })();
    loadGrants();
  }, []);

  async function searchStudent() {
    setSearchError(null); setStudent(null);
    const res = await fetch(`/api/academy-admin/students/lookup?email=${encodeURIComponent(email)}`);
    const json = await res.json();
    if (!res.ok) { setSearchError(json.error === "STUDENT_NOT_FOUND" ? "Không tìm thấy học viên với email này." : json.error); return; }
    setStudent(json.student);
  }

  async function grantAccess() {
    if (!student || !courseId || !reason.trim()) return;
    setSaving(true); setMessage(null);
    const res = await fetch("/api/academy-admin/entitlements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: student.id, resourceType: "course", resourceId: courseId, expiresAt: expiresAt || undefined, reason }) });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setMessage(json.error ?? "Không cấp được quyền."); return; }
    setMessage("Đã cấp quyền truy cập.");
    setReason(""); setExpiresAt("");
    await loadGrants();
  }

  async function revoke(grantId: string) {
    await fetch(`/api/academy-admin/entitlements/${grantId}/revoke`, { method: "POST" });
    await loadGrants();
  }

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Phân phối & cấp quyền" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>PHÂN PHỐI &amp; CẤP QUYỀN</span><h1>Cấp quyền truy cập thủ công</h1><p>Tìm học viên theo email, chọn khóa học và ghi rõ lý do — mọi thao tác đều được ghi lại (audit).</p></div>
    </header>

    <section className={styles.card} style={{ marginBottom: 18 }}>
      <div className={styles.cardHead}><div><h2>Bước 1 — Tìm học viên</h2></div></div>
      <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Email học viên
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hocvien@email.com" style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
        </label>
        <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={searchStudent}><Search size={14} />Tìm</button>
      </div>
      {searchError && <p style={{ padding: "0 18px 12px", color: "#b22949", fontSize: 12 }}>{searchError}</p>}
      {student && <p style={{ padding: "0 18px 12px", fontSize: 12, color: "#177a54" }}>Đã chọn: <strong>{student.name}</strong> ({student.email})</p>}
    </section>

    {student && (
      <section className={styles.card} style={{ marginBottom: 18 }}>
        <div className={styles.cardHead}><div><h2>Bước 2 — Cấp quyền</h2></div></div>
        <div style={{ padding: 18, display: "grid", gap: 10 }}>
          {message && <p style={{ fontSize: 12, color: message.startsWith("Đã") ? "#177a54" : "#b22949" }}>{message}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Khóa học
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }}>
                <option value="">— Chọn khóa học —</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Hết hạn (để trống = vĩnh viễn)
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
            </label>
          </div>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Lý do cấp quyền (bắt buộc)
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: hỗ trợ sự cố thanh toán, quà tặng…" style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
          </label>
          <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={saving || !courseId || !reason.trim()} onClick={grantAccess} style={{ justifySelf: "start" }}>Cấp quyền</button>
        </div>
      </section>
    )}

    <section className={styles.card}>
      <div className={styles.cardHead}><div><h2>Lịch sử cấp quyền thủ công</h2><p>{grants.length} lượt</p></div></div>
      <div className={styles.cardBody}>
        {!grants.length ? <p style={{ color: "#8d97a6" }}>Chưa có lượt cấp quyền thủ công nào.</p> : (
          <div className={styles.list}>
            {grants.map((grant) => (
              <div key={grant.id} className={styles.listItem}>
                <span className={styles.listItemIcon}><BadgeCheck size={16} /></span>
                <div><strong>{grant.userName}</strong><small>{grant.reason ?? "—"}</small></div>
                <div className={styles.listItemMeta}>
                  <span className={styles.badge} data-tone={grant.status === "active" ? "success" : "danger"}>{grant.status}</span>
                  {grant.status === "active" && <button onClick={() => revoke(grant.id)} style={{ display: "block", marginTop: 4, fontSize: 9, border: "none", background: "none", color: "#b22949", cursor: "pointer" }}>Thu hồi</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  </SimpleOperationsShell>;
}
