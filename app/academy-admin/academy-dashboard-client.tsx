"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, BookOpenCheck, Brain, Compass, FileQuestion, GraduationCap, LibraryBig, School, UserRoundPlus, UsersRound, Workflow } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { OperationsMetric } from "@/components/operations/metric-card";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type Summary = {
  totalCourses: number; activeCourses: number; totalLessons: number; publishedLessons: number;
  pendingApplications: number; activeStudents: number;
  totalStages: number; publishedStages: number; stageResources: number;
};

/**
 * Learning Control Center IA (v5/32-.../CLAUDE_INTEGRATION_PROMPT.md §9): the 7 modules Admin
 * should see, mapped onto what is actually real in this repo rather than 7 fresh pages. 5/7 are
 * real, DB-backed pages (2 of them — Classes & Cohorts, Assignment & Review — already existed
 * under /instructor/*, just not linked from here). "Smart Review" and "Quiz & Assessment" have no
 * admin-facing surface anywhere in the app today (confirmed by search, not assumed) — shown
 * honestly as not built rather than pointed at something unrelated.
 */
const LEARNING_CONTROL_MODULES: { icon: typeof Compass; title: string; purpose: string; href: string | null }[] = [
  { icon: Compass, title: "Tổng quan đào tạo", purpose: "Sức khỏe hệ đào tạo, tiến độ và cảnh báo.", href: "/academy-admin" },
  { icon: Workflow, title: "Journey & Outcomes", purpose: "Stage, Outcome, Mission, unlock và Result.", href: "/academy-admin/journey" },
  { icon: LibraryBig, title: "Knowledge & Library", purpose: "Tài liệu, Resource Mapping và quyền truy cập.", href: "/academy-admin/content" },
  { icon: Brain, title: "Smart Review", purpose: "Flashcard, spaced repetition, review rules.", href: null },
  { icon: School, title: "Classes & Cohorts", purpose: "Lớp học, cohort, lịch học và giảng viên.", href: "/instructor/classes" },
  { icon: BookOpenCheck, title: "Assignment & Review", purpose: "Bài tập, submission, teacher review, rubric.", href: "/instructor/assessments" },
  { icon: FileQuestion, title: "Quiz & Assessment", purpose: "Question bank, quiz, test và assessment.", href: null }
];

export function AcademyDashboardClient() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/academy-admin/dashboard");
      const json = await res.json();
      if (res.ok) setData(json);
      setLoading(false);
    })();
  }, []);

  const draftStages = data ? data.totalStages - data.publishedStages : 0;

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Tổng quan đào tạo" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>TỔNG QUAN ĐÀO TẠO</span><h1>Lộ trình, nội dung và học viên</h1><p>Số liệu thật từ dữ liệu giai đoạn, khóa học và tuyển sinh — không phải demo.</p></div>
      <div className={styles.headerActions}>
        <Link href="/academy-admin/stages" className={`${styles.button} ${styles.buttonPrimary}`}>Mở Giai đoạn &amp; lộ trình</Link>
      </div>
    </header>

    {/* Career stages come first: this is where an admin configures what students actually learn, and
        the metrics below it (courses/lessons) describe only one kind of resource inside it. */}
    <section className={styles.metrics}>
      <OperationsMetric icon={Compass} value={loading ? "…" : `${data?.publishedStages ?? 0}/${data?.totalStages ?? 0}`} label="Giai đoạn đã publish" />
      <OperationsMetric icon={LibraryBig} value={loading ? "…" : data?.stageResources ?? 0} label="Tài liệu trong lộ trình" />
      <OperationsMetric icon={GraduationCap} value={loading ? "…" : `${data?.activeCourses ?? 0}/${data?.totalCourses ?? 0}`} label="Khóa học video hoạt động" />
      <OperationsMetric icon={BookOpenCheck} value={loading ? "…" : `${data?.publishedLessons ?? 0}/${data?.totalLessons ?? 0}`} label="Bài học đã xuất bản" />
    </section>

    {/* Learning Control Center — same domains Student LEARN uses, admin semantics
        (CONFIGURE/MANAGE/REVIEW/ANALYZE/PUBLISH) instead of a student-facing mirror. */}
    <section style={{ marginTop: 24, marginBottom: 8 }}>
      <div className={styles.cardHead} style={{ padding: 0, border: 0 }}><div><span className={styles.eyebrow}>LEARNING CONTROL CENTER</span><h2 style={{ margin: "4px 0 0" }}>7 module đào tạo</h2></div></div>
    </section>
    <div className={styles.grid} style={{ marginBottom: 8 }}>
      {LEARNING_CONTROL_MODULES.map((module) => {
        const Icon = module.icon;
        const card = <>
          <div className={styles.listItemIcon}><Icon size={16} /></div>
          <div style={{ flex: 1 }}><strong>{module.title}</strong><br /><small style={{ color: "var(--muted, #6b7a89)" }}>{module.purpose}</small></div>
        </>;
        return <section key={module.title} className={`${styles.card} ${styles.span4}`}>
          <div className={styles.cardBody} style={{ padding: 16 }}>
            {module.href
              ? <Link href={module.href} style={{ display: "flex", gap: 10, alignItems: "flex-start", textDecoration: "none", color: "inherit" }}>{card}</Link>
              : <div style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: 0.55 }}>{card}</div>}
            {!module.href && <small style={{ display: "block", marginTop: 8, fontSize: 11, color: "#b7791f" }}>Chưa có trang quản trị — cần quyết định phạm vi riêng</small>}
          </div>
        </section>;
      })}
    </div>

    <div className={styles.grid}>
      <section className={`${styles.card} ${styles.span6}`}>
        <div className={styles.cardHead}><div><h2>Giai đoạn &amp; lộ trình</h2><p>Nơi cấu hình nội dung học viên thấy</p></div><Link href="/academy-admin/stages">Mở</Link></div>
        <div className={styles.cardBody} style={{ padding: 18 }}>
          {loading ? <p style={{ fontSize: 12 }}>Đang tải…</p> : data?.totalStages === 0 ? (
            <p style={{ fontSize: 12, margin: 0 }}>Chưa có giai đoạn nào. Vào <Link href="/academy-admin/stages">Giai đoạn &amp; lộ trình</Link> để nạp 5 giai đoạn mặc định hoặc tự tạo.</p>
          ) : (
            <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
              <div className={styles.listItem}><span className={styles.listItemIcon}><Compass size={16} /></span><div><strong>{data?.publishedStages ?? 0} giai đoạn đang hiển thị cho học viên</strong><small>{draftStages > 0 ? `${draftStages} giai đoạn còn ở trạng thái nháp` : "Không có giai đoạn nháp"}</small></div></div>
              <div className={styles.listItem}><span className={styles.listItemIcon}><LibraryBig size={16} /></span><div><strong>{data?.stageResources ?? 0} tài liệu đã gắn vào lộ trình</strong><small>Chọn từ Kho nội dung Academy, không nhân bản file gốc</small></div></div>
            </div>
          )}
        </div>
      </section>

      <section className={`${styles.card} ${styles.span6}`}>
        <div className={styles.cardHead}><div><h2>Hồ sơ tuyển sinh chờ duyệt</h2><p>Từ trang đăng ký công khai</p></div></div>
        <div className={styles.cardBody}>
          {loading ? <p>Đang tải…</p> : (
            <div className={styles.listItem}><span className={styles.listItemIcon}><UserRoundPlus size={16} /></span><div><strong>{data?.pendingApplications ?? 0} hồ sơ mới</strong><small>Xử lý tại Operations → CRM &amp; Admissions</small></div></div>
          )}
        </div>
      </section>

      <section className={`${styles.card} ${styles.span6}`}>
        <div className={styles.cardHead}><div><h2>Học viên</h2><p>Thành viên đang hoạt động</p></div></div>
        <div className={styles.cardBody}>
          {loading ? <p>Đang tải…</p> : (
            <div className={styles.listItem}><span className={styles.listItemIcon}><UsersRound size={16} /></span><div><strong>{data?.activeStudents ?? 0} học viên đang hoạt động</strong><small>Tính theo vai trò student trong tổ chức</small></div></div>
          )}
        </div>
      </section>

      <section className={`${styles.card} ${styles.span6}`}>
        <div className={styles.cardHead}><div><h2>Phân phối &amp; cấp quyền</h2><p>Cấp quyền truy cập thủ công cho học viên</p></div><Link href="/academy-admin/distribution">Mở</Link></div>
        <div className={styles.cardBody}>
          <div className={styles.listItem}><span className={styles.listItemIcon}><BadgeCheck size={16} /></span><div><strong>Cấp quyền riêng lẻ</strong><small>Dùng cho mua lẻ, bonus, quyền đặc biệt — mặc định của cả lớp chạy bằng giai đoạn</small></div></div>
        </div>
      </section>
    </div>
  </SimpleOperationsShell>;
}
