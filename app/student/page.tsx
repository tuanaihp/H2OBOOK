"use client";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, GraduationCap, RefreshCw, Target, Trophy } from "lucide-react";
import { useStudentData, useStudentName } from "@/components/student/student-data";
import { useLocale } from "@/components/providers/locale-provider";
import styles from "@/components/ui/experience.module.css";

export default function StudentDashboard() {
  const { summary, loading, error, refresh, live } = useStudentData();
  const name = useStudentName();
  const { locale } = useLocale();
  const l = (vi: string, en: string) => locale === "vi" ? vi : en;
  const data = summary && (!live || summary.mode === "production") ? summary : null;
  const next = data?.todayTasks[0];
  const courseHref = data?.nextCourse ? "/student/courses/" + encodeURIComponent(data.nextCourse.slug) : "/student/courses";
  const metrics = [
    { icon: BookOpen, value: data ? data.completedLessons + "/" + data.totalLessons : "—", label: l("Bài đã hoàn thành", "Lessons completed") },
    { icon: GraduationCap, value: data?.activeCourses ?? "—", label: l("Khóa đang học", "Active courses") },
    { icon: Target, value: data ? data.mastery + "%" : "—", label: l("Mức độ thành thạo", "Mastery") },
    { icon: Trophy, value: data?.todayTasks.length ?? "—", label: l("Việc cần làm", "Next tasks") }
  ];
  return <div className={styles.surface}>
    <section className={styles.hero}>
      <span className={styles.eyebrow}>{l("KHÔNG GIAN HỌC TẬP", "LEARNING WORKSPACE")}</span>
      <h1>{l("Chào", "Hello")}, {name} 👋</h1>
      <p>{next ? l("Bước tiếp theo: ", "Next step: ") + next.title : l("Theo dõi tiến độ, mở lịch học và tiếp tục hành trình của bạn.", "Track your progress, open your schedule and continue your journey.")}</p>
      <div className={styles.actions}>
        <Link className={styles.primary} href={next?.href ?? courseHref}><ArrowRight size={17}/>{next ? l("Bắt đầu nhiệm vụ", "Start task") : l("Mở khóa học của tôi", "My courses")}</Link>
        <Link href="/student/makeup-journey"><CalendarDays size={17}/>{l("Lịch học", "Schedule")}</Link>
        <Link href="/student/library"><BookOpen size={17}/>{l("Thư viện", "Library")}</Link>
      </div>
    </section>
    {error !== null || (!loading && !data) ? <div className={styles.notice} role="alert"><p>{l("Chưa tải được tiến độ học tập. Bạn vẫn có thể mở khóa học và thư viện.", "Learning progress is unavailable. You can still open your courses and library.")}</p><div className={styles.actions}><button onClick={refresh} disabled={loading}><RefreshCw size={16}/>{l("Thử lại", "Retry")}</button></div></div> : null}
    {data?.mode === "demo" && <div className={styles.notice}>{l("Bạn đang xem dữ liệu minh họa.", "You are viewing sample data.")}</div>}
    <section className={styles.metrics} aria-busy={loading} aria-label={l("Tiến độ học tập", "Learning progress")}>{metrics.map(({ icon: Icon, value, label }) => <article className={styles.metric} key={label}><Icon size={24}/><div><strong>{value}</strong><small>{label}</small></div></article>)}</section>
    <div className={styles.toolbar}><span role="status">{loading ? l("Đang cập nhật tiến độ…", "Updating progress…") : l("Kế hoạch học tập của bạn", "Your learning plan")}</span><div className={styles.actions}><button disabled={loading} onClick={refresh}><RefreshCw size={16}/>{l("Cập nhật", "Refresh")}</button></div></div>
    <div className={styles.columns}>
      <section className={styles.panel}><header><h2>{l("Ưu tiên hôm nay", "Today's priorities")}</h2><Link href="/student/assignments">{l("Xem bài tập", "Assignments")}</Link></header>
        <div className={styles.list}>{data?.todayTasks.length ? data.todayTasks.slice(0,5).map((task, index) => <Link className={styles.item} key={task.href + index} href={task.href}><Target size={22}/><div><strong>{task.title}</strong><p>{task.description}</p><small>{task.estimatedMinutes} {l("phút", "minutes")}</small></div><ArrowRight size={17}/></Link>) : <div className={styles.empty}>{loading ? l("Đang tải nhiệm vụ…", "Loading tasks…") : data ? l("Chưa có nhiệm vụ cần làm. Kiểm tra lịch học hoặc mở thư viện để tự ôn tập.", "No tasks due. Check your schedule or review your library.") : l("Nhiệm vụ sẽ xuất hiện khi tải được dữ liệu.", "Tasks will appear when data is available.")}</div>}</div>
      </section>
      <section className={styles.panel}><h2>{l("Tiếp tục học", "Continue learning")}</h2><p>{data?.nextCourse?.title ?? l("Chọn khóa học được cấp quyền để bắt đầu hoặc tiếp tục học.", "Choose an available course to start or continue learning.")}</p><div className={styles.actions}><Link className={styles.primary} href={courseHref}><BookOpen size={16}/>{l("Mở khóa học", "Open courses")}</Link></div><hr/><h2>{l("Cần hỗ trợ?", "Need help?")}</h2><p>{l("Mở trợ lý để hỏi về bài học và hướng dẫn thực hành.", "Ask your assistant about lessons and practice guidance.")}</p><div className={styles.actions}><Link href="/student/mentor">{l("Hỏi trợ lý học tập", "Ask your learning assistant")}</Link><Link href="/student/profile">{l("Hồ sơ & thành tựu", "Profile & achievements")}</Link></div></section>
    </div>
    <section className={styles.panel}><header><h2>{l("Kỹ năng của bạn", "Your skills")}</h2><Link href="/student/roadmap">{l("Xem lộ trình", "View roadmap")}</Link></header><div className={styles.modules}>{data?.skillMastery.length ? data.skillMastery.map(skill => <article className={styles.module} key={skill.key}><Target size={20}/><h3>{skill.label}</h3><b>{skill.masteryPercent}%</b><progress className={styles.progress} max={100} value={Math.max(0, Math.min(100, skill.masteryPercent))} aria-label={skill.label}/>{skill.nextAction && <p>{skill.nextAction}</p>}</article>) : <p className={styles.empty}>{l("Kỹ năng được cập nhật từ bài học và kết quả thực hành của bạn.", "Skills are updated from your lessons and practice results.")}</p>}</div></section>
    <section className={styles.panel}><header><h2>{l("Lộ trình nghề nghiệp", "Career journey")}</h2><Link href="/student/roadmap">{l("Chi tiết", "Details")}</Link></header><div className={styles.list}>{data?.stages?.length ? data.stages.map((stage,index) => <Link className={styles.item} key={stage.slug} href="/student/roadmap"><span>{String(index+1).padStart(2,"0")}</span><div><strong>{stage.title}</strong><p>{stage.description}</p><small>{data.unlockedStageIds?.includes(stage.slug) ? l("Đã mở", "Available") : l("Xem điều kiện mở", "View access requirements")}</small></div><ArrowRight size={17}/></Link>) : <Link className={styles.item} href="/student/roadmap">{l("Mở lộ trình và điều kiện của từng giai đoạn", "Open your roadmap and stage requirements")}<ArrowRight size={17}/></Link>}</div></section>
  </div>;
}
