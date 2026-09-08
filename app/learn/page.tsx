"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpenCheck, Brain, Compass, FileQuestion, GraduationCap, LibraryBig, RefreshCw, School, UsersRound, Workflow } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useLocale } from "@/components/providers/locale-provider";
import { useSummaryResource } from "@/hooks/use-summary-resource";
import type { LearningControlSummary } from "@/lib/learning-control/summary";
import { normalizeNavigationText } from "@/components/layout/navigation-dialog";
import styles from "@/components/ui/experience.module.css";

export default function LearningControlCenterPage() {
  const { locale } = useLocale();
  const l = (vi: string, en: string) => locale === "vi" ? vi : en;
  const { data: response, loading, error, refresh } = useSummaryResource<{ summary: LearningControlSummary | null }>("/api/learning-control/summary");
  const data = response?.summary;
  const [query, setQuery] = useState("");
  const count = (n: number | undefined) => n === undefined ? "—" : String(n);
  const modules = [
    { icon: Compass, title: l("Giai đoạn & nội dung đào tạo", "Stages & curriculum"), purpose: l("Cấu hình chương trình, học phần và tài liệu theo từng giai đoạn.", "Configure programs, modules and resources for each stage."), href: "/academy-admin/stages", stat: count(data?.stages.published) + l(" giai đoạn đã công bố", " published stages") },
    { icon: Workflow, title: l("Hành trình & kết quả", "Journeys & outcomes"), purpose: l("Xây mục tiêu đầu ra, nhiệm vụ, điều kiện mở và minh chứng hoàn thành.", "Build outcomes, missions, unlock rules and completion evidence."), href: "/academy-admin/journey", stat: count(data?.missions) + l(" nhiệm vụ", " missions") },
    { icon: LibraryBig, title: l("Kho tri thức & thư viện", "Knowledge & library"), purpose: l("Quản lý học liệu và gắn tài liệu vào lộ trình.", "Manage learning materials and link them to journeys."), href: "/academy-admin/content", stat: count(data?.documents) + l(" tài liệu", " documents") },
    { icon: School, title: l("Lớp học & nhóm", "Classes & cohorts"), purpose: l("Quản lý lớp, lịch học, học viên và giảng viên.", "Manage classes, schedules, students and instructors."), href: "/instructor/classes", stat: count(data?.classes) + l(" lớp", " classes") },
    { icon: BookOpenCheck, title: l("Bài tập & chấm bài", "Assignments & review"), purpose: l("Xem bài nộp và đánh giá theo tiêu chí chấm điểm.", "Review submissions and grade against rubric criteria."), href: "/instructor/assessments", stat: l("Mở danh sách cần chấm", "Open assessment queue") },
    { icon: Brain, title: l("Ôn tập thông minh", "Smart review"), purpose: l("Thẻ ghi nhớ, lặp lại ngắt quãng và quy tắc ôn tập.", "Flashcards, spaced repetition and review rules."), href: null, stat: count(data?.flashcards) + l(" thẻ ghi nhớ", " flashcards") },
    { icon: FileQuestion, title: l("Trắc nghiệm & đánh giá", "Quizzes & assessment"), purpose: l("Ngân hàng câu hỏi, bài trắc nghiệm và kiểm tra.", "Question banks, quizzes and tests."), href: null, stat: count(data?.quizzes) + l(" bài trắc nghiệm", " quizzes") }
  ];
  const filtered = modules.filter(item=>normalizeNavigationText(item.title+" "+item.purpose).includes(normalizeNavigationText(query)));
  const metrics = [
    { icon: Compass, value: data ? data.stages.published + "/" + data.stages.total : "—", label: l("Giai đoạn đã công bố", "Published stages") },
    { icon: LibraryBig, value: count(data?.documents), label: l("Tài liệu trong kho", "Library documents") },
    { icon: Workflow, value: count(data?.missions), label: l("Nhiệm vụ đã cấu hình", "Configured missions") },
    { icon: UsersRound, value: data ? data.studentsWithProgress + "/" + data.activeStudents : "—", label: l("Học viên có tiến độ / đang hoạt động", "With progress / active students") }
  ];
  const unavailable = error !== null || (!loading && !data);
  return <AppShell><div className={styles.surface}>
    <section className={styles.hero}><span className={styles.eyebrow}>{l("TRUNG TÂM QUẢN TRỊ ĐÀO TẠO", "LEARNING CONTROL CENTER")}</span><h1>{l("Nắm tiến độ. Điều hành việc học.", "Understand progress. Manage learning.")}</h1><p>{l("Quản lý chương trình, học liệu, lớp học và kết quả học viên trong một không gian.", "Manage curriculum, learning materials, classes and learner outcomes in one workspace.")}</p><div className={styles.actions}><Link className={styles.primary} href="/academy-admin"><GraduationCap size={18}/>{l("Điều hành học viện", "Academy control")}</Link><Link href="/instructor/assessments"><BookOpenCheck size={18}/>{l("Chấm bài & phản hồi", "Grade & give feedback")}</Link><button disabled={loading} onClick={refresh}><RefreshCw size={17}/>{l("Cập nhật", "Refresh")}</button></div></section>
    {unavailable && <div className={styles.notice} role="alert"><p>{error === 403 ? l("Bạn chưa có quyền xem tổng quan đào tạo của tổ chức.", "You do not have access to this organization's training overview.") : l("Chưa tải được số liệu. Hãy thử lại để xem tiến độ mới nhất.", "Metrics are unavailable. Retry to see the latest progress.")}</p><div className={styles.actions}><button disabled={loading} onClick={refresh}>{l("Thử lại", "Retry")}</button></div></div>}
    <section className={styles.metrics} aria-busy={loading}>{metrics.map(({icon:Icon,value,label})=><article className={styles.metric} key={label}><Icon size={23}/><div><strong>{value}</strong><small>{label}</small></div></article>)}</section>
    {data && <section className={styles.panel}><header><h2>{l("Việc nên kiểm tra", "Suggested checks")}</h2><span>{l("Dựa trên số liệu hiện tại", "Based on current metrics")}</span></header><div className={styles.list}>
      {data.stages.total > data.stages.published && <Link href="/academy-admin/stages" className={styles.item}><Compass/><div><strong>{data.stages.total - data.stages.published} {l("giai đoạn chưa công bố", "unpublished stages")}</strong><p>{l("Kiểm tra học liệu và điều kiện trước khi mở cho học viên.", "Review resources and access rules before opening to students.")}</p></div><ArrowRight/></Link>}
      {data.classes === 0 && <Link href="/instructor/classes" className={styles.item}><School/><div><strong>{l("Tạo lớp và ghi danh học viên", "Create a class and enroll students")}</strong></div><ArrowRight/></Link>}
      <Link href="/academy-admin/data-link" className={styles.item}><Workflow/><div><strong>{l("Kiểm tra liên kết học liệu & lộ trình", "Check resource & journey links")}</strong><p>{l("Xác nhận tài liệu và nhiệm vụ đã được gắn đúng giai đoạn.", "Confirm resources and missions are linked to the correct stage.")}</p></div><ArrowRight/></Link>
    </div></section>}
    <section className={styles.panel}><header className={styles.toolbar}><h2>{l("Chức năng đào tạo", "Training modules")}</h2><input value={query} onChange={e=>setQuery(e.target.value)} aria-label={l("Tìm chức năng đào tạo", "Search training modules")} placeholder={l("Tìm lớp, học liệu, chấm bài…", "Find classes, materials, reviews…")}/></header><div className={styles.modules}>{filtered.map(module=>{const Icon=module.icon;const body=<><Icon size={24}/><h3>{module.title}</h3><p>{module.purpose}</p><b>{module.stat}</b>{!module.href && <small>{l("Chưa có trang quản trị riêng", "Dedicated administration is not available yet")}</small>}</>;return module.href ? <Link key={module.title} className={styles.module} href={module.href}>{body}<ArrowRight size={17}/></Link> : <article key={module.title} className={styles.module}>{body}</article>;})}</div>{!filtered.length && <p role="status">{l("Không tìm thấy chức năng phù hợp.", "No matching modules.")}</p>}</section>
  </div></AppShell>;
}
