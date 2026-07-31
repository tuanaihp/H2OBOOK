"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { ArrowRight, Brain, ClipboardCheck, FileCheck2, LibraryBig, Network, Sparkles } from "lucide-react";
import { buildAcademicOpsViewModel } from "@/lib/academic-ops-v2/selectors";
import { trackAcademicOpsEvent } from "@/lib/academic-ops-v2/analytics";
import { AcademicOpsFlowBar, MetricGrid } from "./shared";
import styles from "./academic-ops.module.css";

export function AcademicDashboardV2() {
  const store = useAppStore();
  const model = buildAcademicOpsViewModel(store);

  const priorities = [
    { label: "Phản hồi bài thực hành", note: `${model.metrics.pendingGrades} bài đang chờ`, href: "/academic-ops-v2-preview/assignments", Icon: ClipboardCheck },
    { label: "Ôn flashcard đến hạn", note: `${model.metrics.dueFlashcards} thẻ cần ôn`, href: "/academic-ops-v2-preview/study", Icon: Brain },
    { label: "Kiểm tra nội dung Knowledge Space", note: `${model.knowledgeSources.length} nguồn đang quản lý`, href: "/academic-ops-v2-preview/knowledge", Icon: Network },
    { label: "Cấp tài liệu theo lớp", note: `${model.metrics.activeClasses} lớp hoạt động`, href: "/academic-ops-v2-preview/library", Icon: LibraryBig }
  ];

  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <section className={styles.hero} onMouseEnter={() => trackAcademicOpsEvent("academic_dashboard_opened")}>
          <div>
            <span className={styles.eyebrow}>ACADEMIC OPERATIONS · SMART CORE</span>
            <h1>Chào {store.workspace.ownerName}.<br/><em>Hôm nay hệ thống học cần điều gì?</em></h1>
            <p>Một trung tâm thống nhất nối sách, lớp học, bài tập, quiz, Knowledge Space và nhịp ôn tập. AI vẫn là lớp tùy chọn.</p>
            <div className={styles.actions}>
              <Link className="btn btn-primary" href="/academic-ops-v2-preview/assignments"><ClipboardCheck size={16}/>Xử lý bài chờ chấm</Link>
              <Link className="btn btn-secondary" href="/academic-ops-v2-preview/learn"><Brain size={16}/>Mở Learning Command</Link>
            </div>
          </div>
          <div className={styles.orb}>H₂</div>
        </section>

        <MetricGrid items={[
          { label: "Sách đang hoạt động", value: String(model.metrics.activeBooks), note: "Nguồn học trong workspace" },
          { label: "Học viên hoạt động", value: String(model.metrics.activeStudents), note: `${model.metrics.activeClasses} lớp đang học` },
          { label: "Bài chờ chấm", value: String(model.metrics.pendingGrades), note: `${model.metrics.gradedSubmissions} bài đã chấm` },
          { label: "Mastery trung bình", value: `${model.metrics.mastery}%`, note: `${model.metrics.dueFlashcards} flashcard đến hạn` }
        ]}/>

        <div className={styles.grid2}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Ưu tiên học thuật</h2><p>Được tính bằng dữ liệu cục bộ.</p></div></div>
            <div className={`${styles.panelBody} ${styles.list}`}>
              {priorities.map(({ label, note, href, Icon }) => (
                <Link className={styles.listRow} href={href} key={href}>
                  <span className={styles.iconTile}><Icon size={18}/></span>
                  <span><strong>{label}</strong><small>{note}</small></span>
                  <ArrowRight size={15}/>
                </Link>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Luồng kiến thức gần đây</h2><p>Từ sách đến hoạt động học.</p></div></div>
            <div className={`${styles.panelBody} ${styles.list}`}>
              {model.books.slice(0, 4).map((book, index) => (
                <Link className={styles.listRow} href={`/reader/${book.id}`} key={book.id}>
                  <span className={styles.iconTile}><Sparkles size={18}/></span>
                  <span><strong>{book.title}</strong><small>{book.pages.length} trang · {book.readingMinutes} phút</small></span>
                  <ArrowRight size={15}/>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <section className={styles.grid3}>
          <Link className={styles.entityCard} href="/academic-ops-v2-preview/knowledge"><Network/><h3>Knowledge Space</h3><p>Nguồn sách, ghi chú và tài liệu tạo nên bộ nhớ học thuật.</p></Link>
          <Link className={styles.entityCard} href="/academic-ops-v2-preview/quizzes"><FileCheck2/><h3>Assessment</h3><p>Quiz và đánh giá nối trực tiếp với kỹ năng cần đạt.</p></Link>
          <Link className={styles.entityCard} href="/academic-ops-v2-preview/library"><LibraryBig/><h3>Digital Library</h3><p>Cấp nội dung đúng người, đúng lớp và đúng tiến độ.</p></Link>
        </section>
      </div>
    </AppShell>
  );
}
