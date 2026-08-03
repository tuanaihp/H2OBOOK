"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpenCheck, GraduationCap, Sparkles, UsersRound } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { OperationsMetric } from "@/components/operations/metric-card";
import { instructorRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type RankedTask = { id: string; kind: string; title: string; priorityLabel: "low" | "normal" | "high" | "urgent"; studentId?: string; sourceId?: string };
type CommandCenterSummary = {
  classCount: number; studentCount: number; pendingSubmissionCount: number; atRiskCount: number; pendingPortfolioReviewCount: number;
  tasks: RankedTask[];
  recentAchievements: { id: string; title: string; studentName: string; updatedAt: string }[];
};

const TASK_HREF: Record<string, (task: RankedTask) => string> = {
  grade_submission: () => "/instructor/assessments",
  student_intervention: (task) => `/instructor/students?focus=${task.studentId ?? ""}`,
  approve_portfolio: () => "/instructor/assessments"
};

const PRIORITY_TONE: Record<RankedTask["priorityLabel"], "danger" | "warning" | "purple" | undefined> = { urgent: "danger", high: "warning", normal: "purple", low: undefined };

export default function InstructorCommandCenterPage() {
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/teaching/command-center");
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok) { setError(json.error ?? "Không tải được dữ liệu."); setLoading(false); return; }
      setSummary(json);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return <SimpleOperationsShell title="H2OBOOK Instructor" subtitle="Teaching Command Center" homeHref="/instructor" routes={instructorRoutes} accentLabel="Instructor Workspace">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>TEACHING COMMAND CENTER</span><h1>Giảng dạy, đánh giá và hỗ trợ đúng lúc</h1><p>Danh sách việc cần làm được xếp hạng theo mức độ khẩn cấp thực tế — bài chờ chấm, học viên cần hỗ trợ và thành quả cần duyệt.</p></div>
      <div className={styles.headerActions}><Link href="/instructor/assessments" className={`${styles.button} ${styles.buttonPrimary}`}>Chấm bài ngay</Link></div>
    </header>

    {error && <p style={{ color: "#b22949", fontSize: 12 }}>{error}</p>}

    <section className={styles.metrics}>
      <OperationsMetric icon={GraduationCap} value={summary?.classCount ?? 0} label="Lớp phụ trách" />
      <OperationsMetric icon={BookOpenCheck} value={summary?.pendingSubmissionCount ?? 0} label="Bài cần chấm" />
      <OperationsMetric icon={UsersRound} value={summary?.studentCount ?? 0} label="Học viên phụ trách" />
      <OperationsMetric icon={AlertTriangle} value={summary?.atRiskCount ?? 0} label="Học viên cần hỗ trợ" />
    </section>

    <div className={styles.grid}>
      <section className={`${styles.card} ${styles.span7}`}>
        <div className={styles.cardHead}><div><h2>Việc cần làm hôm nay</h2><p>Xếp hạng tự động theo thời gian chờ, hạn nộp và mức rủi ro.</p></div></div>
        <div className={styles.cardBody}>
          {loading ? <p>Đang tải…</p> : !summary?.tasks.length ? (
            <div className={styles.empty}><Sparkles /><strong>Không có việc khẩn cấp</strong><p>Mọi bài nộp và học viên đều trong tầm kiểm soát.</p></div>
          ) : (
            <div className={styles.list}>
              {summary.tasks.slice(0, 12).map((task) => (
                <Link key={task.id} href={TASK_HREF[task.kind]?.(task) ?? "/instructor"} className={styles.listItem}>
                  <span className={styles.listItemIcon}><BookOpenCheck size={16} /></span>
                  <div><strong>{task.title}</strong></div>
                  <div className={styles.listItemMeta}><span className={styles.badge} data-tone={PRIORITY_TONE[task.priorityLabel]}>{task.priorityLabel}</span></div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={`${styles.card} ${styles.span5}`}>
        <div className={styles.cardHead}><div><h2>Thành quả gần đây</h2><p>Portfolio/Create Outcome vừa được duyệt.</p></div></div>
        <div className={styles.cardBody}>
          {!summary?.recentAchievements.length ? (
            <div className={styles.empty}><Sparkles /><strong>Chưa có thành quả mới</strong><p>Thành quả được duyệt sẽ hiện tại đây.</p></div>
          ) : (
            <div className={styles.list}>
              {summary.recentAchievements.map((item) => (
                <div key={item.id} className={styles.listItem}>
                  <span className={styles.listItemIcon}><Sparkles size={16} /></span>
                  <div><strong>{item.title}</strong><small>{item.studentName}</small></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  </SimpleOperationsShell>;
}
