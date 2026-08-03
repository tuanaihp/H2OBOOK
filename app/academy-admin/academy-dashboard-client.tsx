"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, BookOpenCheck, GraduationCap, UserRoundPlus, UsersRound } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { OperationsMetric } from "@/components/operations/metric-card";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type Summary = { totalCourses: number; activeCourses: number; totalLessons: number; publishedLessons: number; pendingApplications: number; activeStudents: number };

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

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Tổng quan đào tạo" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>TỔNG QUAN ĐÀO TẠO</span><h1>Nội dung, chương trình và học viên</h1><p>Số liệu thật từ dữ liệu khóa học và tuyển sinh — không phải demo.</p></div>
      <div className={styles.headerActions}>
        <Link href="/academy-admin/programs" className={`${styles.button} ${styles.buttonPrimary}`}>Quản lý chương trình</Link>
      </div>
    </header>

    <section className={styles.metrics}>
      <OperationsMetric icon={GraduationCap} value={loading ? "…" : data?.totalCourses ?? 0} label="Tổng khóa học" />
      <OperationsMetric icon={BadgeCheck} value={loading ? "…" : data?.activeCourses ?? 0} label="Đang hoạt động" />
      <OperationsMetric icon={BookOpenCheck} value={loading ? "…" : `${data?.publishedLessons ?? 0}/${data?.totalLessons ?? 0}`} label="Bài học đã xuất bản" />
      <OperationsMetric icon={UsersRound} value={loading ? "…" : data?.activeStudents ?? 0} label="Học viên đang hoạt động" />
    </section>

    <div className={styles.grid}>
      <section className={`${styles.card} ${styles.span6}`}>
        <div className={styles.cardHead}><div><h2>Hồ sơ tuyển sinh chờ duyệt</h2><p>Từ trang đăng ký công khai</p></div></div>
        <div className={styles.cardBody}>
          {loading ? <p>Đang tải…</p> : (
            <div className={styles.listItem}><span className={styles.listItemIcon}><UserRoundPlus size={16} /></span><div><strong>{data?.pendingApplications ?? 0} hồ sơ mới</strong><small>Xử lý tại Operations → CRM &amp; Admissions</small></div></div>
          )}
        </div>
      </section>
      <section className={`${styles.card} ${styles.span6}`}>
        <div className={styles.cardHead}><div><h2>Phân phối &amp; cấp quyền</h2><p>Cấp quyền truy cập thủ công cho học viên</p></div><Link href="/academy-admin/distribution">Mở</Link></div>
        <div className={styles.cardBody}><p style={{ fontSize: 12, color: "#8d97a6" }}>Tìm học viên theo email và cấp quyền truy cập khóa học thủ công, có ghi lý do và audit.</p></div>
      </section>
    </div>
  </SimpleOperationsShell>;
}
