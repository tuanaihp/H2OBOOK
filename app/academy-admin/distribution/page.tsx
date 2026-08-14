"use client";
import { useEffect, useMemo, useState } from "react";
import { Award, BadgeCheck, GraduationCap, Search, Sparkles, Users } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type Course = { id: string; title: string };
type Stage = { id: string; slug: string; title: string; indexLabel: string };
type MembershipPlan = { slug: string; name: string };
type Student = { id: string; name: string; email: string };
type StudentListRow = { id: string; name: string; email: string; status: "active" | "paused" | "invited"; progress: number };
type Grant = { id: string; userId: string; userName: string; resourceType: string; resourceId: string; status: string; expiresAt: string | null; reason: string | null };
type StageGrant = { id: string; userId: string; userName: string; stageSlug: string; stageTitle: string; active: boolean; expiresAt: string | null; createdAt: string };
type Stage1Eligibility = { stageId: string; eligible: boolean; missionsTotal: number; missionsDone: number };

export default function DistributionPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [stageGrants, setStageGrants] = useState<StageGrant[]>([]);
  const [email, setEmail] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Danh sách đủ toàn bộ học viên (2026-08-14) — trước đây chỉ có ô gõ email, phải nhớ đúng email
  // mới tìm được. Giờ hiện cả danh sách để bấm chọn trực tiếp; ô gõ email vẫn giữ lại cho tra cứu
  // nhanh khi danh sách dài. Cùng nguồn dữ liệu thật /api/academy/students trang "Học viên" đang dùng.
  const [allStudents, setAllStudents] = useState<StudentListRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [listFilter, setListFilter] = useState("");
  const [courseId, setCourseId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Cấp Giai đoạn (2026-08-14) — lib/student/stage-access.ts's getUnlockedStageIds() đã đọc
  // business_feature_grants từ trước (migration 0030/0033), chỉ chưa có màn hình nào ghi vào đó.
  // Chỉ cộng thêm (Set), không bao giờ tự xóa Giai đoạn đã cấp trước — cấp Giai đoạn mới không làm
  // mất quyền vào Giai đoạn cũ.
  const [stageSlug, setStageSlug] = useState("");
  const [stageExpiresAt, setStageExpiresAt] = useState("");
  const [stageReason, setStageReason] = useState("");
  const [stageSaving, setStageSaving] = useState(false);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  // Cấp Membership thủ công — active ngay (không phải bản dùng thử 7 ngày của luồng tự mời), theo
  // đúng quyết định đã xác nhận: Admin đã chủ động cấp thì có hiệu lực thật ngay.
  const [planSlug, setPlanSlug] = useState("");
  const [membershipExpiresAt, setMembershipExpiresAt] = useState("");
  const [membershipReason, setMembershipReason] = useState("");
  const [membershipSaving, setMembershipSaving] = useState(false);
  const [membershipMessage, setMembershipMessage] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<Stage1Eligibility | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issueMessage, setIssueMessage] = useState<string | null>(null);

  async function loadGrants() {
    const res = await fetch("/api/academy-admin/entitlements?resourceType=course");
    const json = await res.json();
    if (res.ok) setGrants(json.grants ?? []);
  }
  async function loadStageGrants() {
    const res = await fetch("/api/academy-admin/stage-grants");
    const json = await res.json();
    if (res.ok) setStageGrants(json.grants ?? []);
  }
  async function loadStudentList() {
    setStudentsLoading(true);
    const res = await fetch("/api/academy/students", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (res.ok) setAllStudents(json.students ?? []);
    setStudentsLoading(false);
  }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/academy-admin/courses");
      const json = await res.json();
      if (res.ok) setCourses((json.courses ?? []).map((c: { id: string; title: string }) => ({ id: c.id, title: c.title })));
    })();
    (async () => {
      const res = await fetch("/api/academy-admin/stages");
      const json = await res.json();
      if (res.ok) setStages((json.stages ?? []).map((s: { id: string; slug: string; title: string; indexLabel: string }) => ({ id: s.id, slug: s.slug, title: s.title, indexLabel: s.indexLabel })));
    })();
    (async () => {
      const res = await fetch("/api/academy-admin/membership-grants");
      const json = await res.json();
      if (res.ok) setMembershipPlans(json.plans ?? []);
    })();
    loadGrants();
    loadStageGrants();
    loadStudentList();
  }, []);

  async function selectStudent(candidate: Student) {
    setSearchError(null); setStudent(candidate); setEligibility(null); setIssueMessage(null);
    const elig = await fetch(`/api/academy-admin/stage1-credential?studentId=${candidate.id}`);
    const eligJson = await elig.json().catch(() => null);
    if (elig.ok) setEligibility(eligJson);
  }

  async function searchStudent() {
    setSearchError(null); setStudent(null); setEligibility(null); setIssueMessage(null);
    const res = await fetch(`/api/academy-admin/students/lookup?email=${encodeURIComponent(email)}`);
    const json = await res.json();
    if (!res.ok) { setSearchError(json.error === "STUDENT_NOT_FOUND" ? "Không tìm thấy học viên với email này." : json.error); return; }
    await selectStudent(json.student);
  }

  const filteredStudents = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    if (!q) return allStudents;
    return allStudents.filter((s) => `${s.name} ${s.email}`.toLowerCase().includes(q));
  }, [allStudents, listFilter]);

  async function issueCertificate() {
    if (!student || !eligibility) return;
    setIssuing(true); setIssueMessage(null);
    const res = await fetch("/api/academy-admin/stage1-credential", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: student.id, stageId: eligibility.stageId }) });
    const json = await res.json();
    setIssuing(false);
    if (!res.ok) { setIssueMessage(json.error ?? "Không cấp được chứng nhận."); return; }
    setIssueMessage(json.issued ? `Đã cấp chứng nhận: ${json.certificateNo}` : (json.reason ?? "Chưa đủ điều kiện."));
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

  async function grantStage() {
    if (!student || !stageSlug || !stageReason.trim()) return;
    setStageSaving(true); setStageMessage(null);
    const res = await fetch("/api/academy-admin/stage-grants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: student.id, stageSlug, expiresAt: stageExpiresAt || undefined, reason: stageReason }) });
    const json = await res.json();
    setStageSaving(false);
    if (!res.ok) { setStageMessage(json.error ?? "Không cấp được Giai đoạn."); return; }
    setStageMessage("Đã cấp quyền vào Giai đoạn — Giai đoạn đã cấp trước đó vẫn giữ nguyên.");
    setStageReason(""); setStageExpiresAt("");
    await loadStageGrants();
  }

  async function revokeStage(grantId: string) {
    await fetch(`/api/academy-admin/stage-grants/${grantId}/revoke`, { method: "POST" });
    await loadStageGrants();
  }

  async function grantMembership() {
    if (!student || !planSlug || !membershipReason.trim()) return;
    setMembershipSaving(true); setMembershipMessage(null);
    const res = await fetch("/api/academy-admin/membership-grants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: student.id, planSlug, expiresAt: membershipExpiresAt || undefined, reason: membershipReason }) });
    const json = await res.json();
    setMembershipSaving(false);
    if (!res.ok) { setMembershipMessage(json.error ?? "Không cấp được Membership."); return; }
    setMembershipMessage("Đã cấp Membership — có hiệu lực ngay, mở toàn bộ Giai đoạn.");
    setMembershipReason(""); setMembershipExpiresAt("");
  }

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Phân phối & cấp quyền" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>PHÂN PHỐI &amp; CẤP QUYỀN</span><h1>Cấp quyền truy cập thủ công</h1><p>Tìm học viên theo email, chọn khóa học/giai đoạn/membership và ghi rõ lý do — mọi thao tác đều được ghi lại (audit).</p></div>
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

      <div style={{ padding: "0 18px 18px", borderTop: "1px solid #eef1f4", marginTop: 6, paddingTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <strong style={{ fontSize: 12 }}><Users size={13} style={{ verticalAlign: "-2px" }} /> Hoặc chọn thẳng từ danh sách ({filteredStudents.length} học viên)</strong>
          <input value={listFilter} onChange={(e) => setListFilter(e.target.value)} placeholder="Lọc theo tên/email…" style={{ padding: 8, borderRadius: 8, border: "1px solid #dfe3e8", fontSize: 12, width: 220 }} />
        </div>
        {studentsLoading ? <p style={{ fontSize: 12, color: "#8d97a6" }}>Đang tải danh sách…</p>
          : !filteredStudents.length ? <p style={{ fontSize: 12, color: "#8d97a6" }}>Không có học viên nào khớp.</p>
          : <div style={{ maxHeight: 320, overflowY: "auto", display: "grid", gap: 6 }}>
              {filteredStudents.map((s) => {
                const isSelected = student?.id === s.id;
                return <button key={s.id} onClick={() => selectStudent({ id: s.id, name: s.name, email: s.email })}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: isSelected ? "1px solid #a21caf" : "1px solid #eef1f4", background: isSelected ? "#fdf4ff" : "#fff", cursor: "pointer", textAlign: "left" }}>
                  <span><strong style={{ fontSize: 12 }}>{s.name}</strong><br /><small style={{ color: "#8d97a6" }}>{s.email}</small></span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={styles.badge} data-tone={s.status === "active" ? "success" : s.status === "invited" ? "warning" : "neutral"}>{s.status === "active" ? "Đang học" : s.status === "invited" ? "Đã mời" : "Tạm dừng"}</span>
                    <small style={{ color: "#8d97a6" }}>{s.progress}%</small>
                  </span>
                </button>;
              })}
            </div>}
      </div>
    </section>

    {student && (
      <section className={styles.card} style={{ marginBottom: 18 }}>
        <div className={styles.cardHead}><div><h2>Bước 2a — Cấp Khóa học</h2></div></div>
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

    {student && (
      <section className={styles.card} style={{ marginBottom: 18 }}>
        <div className={styles.cardHead}><div><h2><GraduationCap size={16} style={{ verticalAlign: "-3px" }} /> Bước 2b — Cấp Giai đoạn</h2><p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7a89" }}>Giai đoạn đầu tiên luôn miễn phí cho mọi học viên. Cấp thêm ở đây để mở 1 Giai đoạn cụ thể mà không cần Membership — Giai đoạn đã cấp trước đó không bao giờ bị mất.</p></div></div>
        <div style={{ padding: 18, display: "grid", gap: 10 }}>
          {stageMessage && <p style={{ fontSize: 12, color: stageMessage.startsWith("Đã") ? "#177a54" : "#b22949" }}>{stageMessage}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Giai đoạn
              <select value={stageSlug} onChange={(e) => setStageSlug(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }}>
                <option value="">— Chọn Giai đoạn —</option>
                {stages.map((s) => <option key={s.id} value={s.slug}>{s.indexLabel ? `${s.indexLabel} — ` : ""}{s.title}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Hết hạn (để trống = vĩnh viễn)
              <input type="date" value={stageExpiresAt} onChange={(e) => setStageExpiresAt(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
            </label>
          </div>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Lý do cấp quyền (bắt buộc)
            <input value={stageReason} onChange={(e) => setStageReason(e.target.value)} placeholder="Ví dụ: đã hoàn thành Giai đoạn trước ở lớp offline…" style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
          </label>
          <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={stageSaving || !stageSlug || !stageReason.trim()} onClick={grantStage} style={{ justifySelf: "start" }}>Cấp Giai đoạn</button>
        </div>
      </section>
    )}

    {student && (
      <section className={styles.card} style={{ marginBottom: 18 }}>
        <div className={styles.cardHead}><div><h2><Sparkles size={16} style={{ verticalAlign: "-3px" }} /> Bước 2c — Cấp Membership</h2><p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7a89" }}>Membership mở toàn bộ Giai đoạn cùng lúc. Cấp ở đây có hiệu lực ngay (không phải bản dùng thử) — dùng khi bạn đã quyết định cấp thật (VIP, đối tác, hỗ trợ sự cố…).</p></div></div>
        <div style={{ padding: 18, display: "grid", gap: 10 }}>
          {membershipMessage && <p style={{ fontSize: 12, color: membershipMessage.startsWith("Đã") ? "#177a54" : "#b22949" }}>{membershipMessage}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Gói Membership
              <select value={planSlug} onChange={(e) => setPlanSlug(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }}>
                <option value="">— Chọn gói —</option>
                {membershipPlans.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Hết hạn (để trống = vĩnh viễn)
              <input type="date" value={membershipExpiresAt} onChange={(e) => setMembershipExpiresAt(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
            </label>
          </div>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Lý do cấp quyền (bắt buộc)
            <input value={membershipReason} onChange={(e) => setMembershipReason(e.target.value)} placeholder="Ví dụ: nâng cấp sau khi thanh toán ngoài hệ thống…" style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
          </label>
          <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={membershipSaving || !planSlug || !membershipReason.trim()} onClick={grantMembership} style={{ justifySelf: "start" }}>Cấp Membership</button>
        </div>
      </section>
    )}

    {student && eligibility && (
      <section className={styles.card} style={{ marginBottom: 18 }}>
        <div className={styles.cardHead}><div><h2>Bước 3 — Chứng nhận Stage 1</h2><p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7a89" }}>Cấp chỉ khi đủ điều kiện thật — mọi Nhiệm vụ Stage 1 đã hoàn thành. Không thể cấp trước khi đủ.</p></div></div>
        <div style={{ padding: 18, display: "grid", gap: 10 }}>
          {issueMessage && <p style={{ fontSize: 12, color: issueMessage.startsWith("Đã cấp") ? "#177a54" : "#b22949" }}>{issueMessage}</p>}
          <p style={{ fontSize: 12 }}>Tiến độ Stage 1: <strong>{eligibility.missionsDone}/{eligibility.missionsTotal}</strong> Nhiệm vụ hoàn thành.</p>
          <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={!eligibility.eligible || issuing} onClick={issueCertificate} style={{ justifySelf: "start" }}>
            <Award size={14} />{eligibility.eligible ? "Cấp chứng nhận" : "Chưa đủ điều kiện"}
          </button>
        </div>
      </section>
    )}

    <section className={styles.card} style={{ marginBottom: 18 }}>
      <div className={styles.cardHead}><div><h2>Lịch sử cấp Giai đoạn thủ công</h2><p>{stageGrants.length} lượt</p></div></div>
      <div className={styles.cardBody}>
        {!stageGrants.length ? <p style={{ color: "#8d97a6" }}>Chưa có lượt cấp Giai đoạn thủ công nào.</p> : (
          <div className={styles.list}>
            {stageGrants.map((grant) => (
              <div key={grant.id} className={styles.listItem}>
                <span className={styles.listItemIcon}><GraduationCap size={16} /></span>
                <div><strong>{grant.userName}</strong><small>{grant.stageTitle}</small></div>
                <div className={styles.listItemMeta}>
                  <span className={styles.badge} data-tone={grant.active ? "success" : "danger"}>{grant.active ? "active" : "hết hạn/thu hồi"}</span>
                  {grant.active && <button onClick={() => revokeStage(grant.id)} style={{ display: "block", marginTop: 4, fontSize: 9, border: "none", background: "none", color: "#b22949", cursor: "pointer" }}>Thu hồi</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>

    <section className={styles.card}>
      <div className={styles.cardHead}><div><h2>Lịch sử cấp Khóa học thủ công</h2><p>{grants.length} lượt</p></div></div>
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
