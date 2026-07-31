"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { ArrowRight, BookOpen, Brain, CheckCircle2, Plus, Target } from "lucide-react";
import { buildAcademicOpsViewModel } from "@/lib/academic-ops-v2/selectors";
import { trackAcademicOpsEvent } from "@/lib/academic-ops-v2/analytics";
import { AcademicOpsFlowBar, MetricGrid } from "./shared";
import styles from "./academic-ops.module.css";

export function AcademicLearnV2() {
  const store = useAppStore();
  const model = buildAcademicOpsViewModel(store);
  const [title, setTitle] = useState("");
  const goals = model.goals.filter((goal) => goal.status === "active");
  const books = useMemo(() => model.books.slice(0, 4), [model.books]);

  const addGoal = () => {
    if (!title.trim()) return;
    store.createLearningGoal({ title: title.trim(), description: "Mục tiêu học tập trong Academic Operations V2." });
    trackAcademicOpsEvent("academic_goal_created", { title: title.trim() });
    setTitle("");
  };

  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>LEARNING COMMAND · LOCAL FIRST</span>
            <h1>Học có mục tiêu.<br/><em>Tiến độ có bằng chứng.</em></h1>
            <p>H2OBOOK kết nối mục tiêu, sách, bài tập, flashcard và thời lượng học mà không phụ thuộc API AI.</p>
            <div className={styles.actions}>
              <Link className="btn btn-primary" href="/academic-ops-v2-preview/study"><Brain size={16}/>Ôn ngay {model.metrics.dueFlashcards} thẻ</Link>
              <Link className="btn btn-secondary" href="/academic-ops-v2-preview/library"><BookOpen size={16}/>Mở thư viện</Link>
            </div>
          </div>
          <div className={styles.orb}>{model.metrics.mastery}%</div>
        </section>

        <MetricGrid items={[
          { label: "Mục tiêu đang theo đuổi", value: String(model.metrics.activeGoals), note: "Hành trình học hiện tại" },
          { label: "Flashcard đến hạn", value: String(model.metrics.dueFlashcards), note: "Ôn tập theo lịch local" },
          { label: "Phút học đã ghi nhận", value: String(model.metrics.studyMinutes), note: "Tổng phiên học" },
          { label: "Mastery", value: `${model.metrics.mastery}%`, note: "Từ các mục tiêu đang mở" }
        ]}/>

        <div className={styles.grid2}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Hành trình của tôi</h2><p>Cập nhật tiến độ bằng bằng chứng học tập.</p></div></div>
            <div className={`${styles.panelBody} ${styles.list}`}>
              {goals.map((goal) => (
                <article className={styles.listRow} key={goal.id}>
                  <span className={styles.iconTile}><Target size={18}/></span>
                  <span><strong>{goal.title}</strong><small>{goal.description}</small><span className={styles.progress}><i style={{ width: `${goal.progress}%` }}/></span></span>
                  <button className="icon-btn" onClick={() => store.updateLearningGoal(goal.id, { progress: Math.min(100, goal.progress + 10) })}><CheckCircle2 size={16}/></button>
                </article>
              ))}
              <div className={styles.toolbar}>
                <div className={styles.search}><input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addGoal()} placeholder="Thêm mục tiêu học mới..."/></div>
                <button className="btn btn-soft" onClick={addGoal}><Plus size={15}/>Thêm</button>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Tiếp tục học</h2><p>Những tài liệu gần nhất.</p></div></div>
            <div className={`${styles.panelBody} ${styles.list}`}>
              {books.map((book, index) => (
                <Link className={styles.listRow} key={book.id} href={`/reader/${book.id}`}>
                  <span className={styles.iconTile}>{index + 1}</span>
                  <span><strong>{book.title}</strong><small>{book.readingMinutes} phút · {book.pages.length} trang</small></span>
                  <ArrowRight size={15}/>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
