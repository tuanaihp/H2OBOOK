"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, BookOpenCheck, Compass, GraduationCap, LibraryBig, UserRoundPlus, UsersRound } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { OperationsMetric } from "@/components/operations/metric-card";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type Summary = {
  totalCourses: number; activeCourses: number; totalLessons: number; publishedLessons: number;
  pendingApplications: number; activeStudents: number;
  totalStages: number; publishedStages: number; stageResources: number;
};


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
