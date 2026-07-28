"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { ArrowRight, BookOpen, Brain, CheckCircle2, Clock3, Flame, GraduationCap, Plus, Target } from "lucide-react";
import { useMemo, useState } from "react";

export default function LearnPage() {
  const store = useAppStore();
  const [title, setTitle] = useState("");
  const dueCards = store.flashcards.filter((card) => new Date(card.nextReviewAt).getTime() <= Date.now()).length;
  const minutes = store.studySessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const activeGoals = store.learningGoals.filter((goal) => goal.status === "active");
  const recentBooks = useMemo(() => store.books.filter((book) => !book.archivedAt).slice(0, 4), [store.books]);
  const addGoal = () => { if (!title.trim()) return; store.createLearningGoal({ title: title.trim(), description: "Mục tiêu học tập mới trong H2OBOOK." }); setTitle(""); };
  return <AppShell>
    <section className="quantum-hero learning-hero">
      <div><span className="eyebrow">SMART LEARNING — KHÔNG PHỤ THUỘC AI</span><h1>Học có mục tiêu, ôn đúng lúc, ghi nhớ lâu hơn.</h1><p>H2OBOOK dùng dữ liệu học, flashcard và lịch ôn local để dẫn dắt hành trình. AI chỉ là lớp hỗ trợ tùy chọn.</p><div className="hero-actions"><Link className="btn btn-primary" href="/study"><Brain size={17}/>Ôn ngay {dueCards} thẻ</Link><Link className="btn btn-secondary" href="/library"><BookOpen size={17}/>Mở thư viện</Link></div></div>
      <div className="learning-orbit"><div className="orbit-core"><span>{Math.round(activeGoals.reduce((sum, goal) => sum + goal.progress, 0) / Math.max(1, activeGoals.length))}%</span><small>Mastery</small></div><i/><i/><i/></div>
    </section>

    <section className="smart-metric-grid">
      <article><span><Target/></span><div><strong>{activeGoals.length}</strong><small>Mục tiêu đang theo đuổi</small></div></article>
      <article><span><Brain/></span><div><strong>{dueCards}</strong><small>Flashcard đến hạn</small></div></article>
      <article><span><Clock3/></span><div><strong>{minutes}</strong><small>Phút học đã ghi nhận</small></div></article>
      <article><span><Flame/></span><div><strong>7</strong><small>Ngày duy trì nhịp học</small></div></article>
    </section>

    <div className="learning-layout">
      <section className="section-card"><div className="section-head"><div><h2>Hành trình của tôi</h2><p>Mỗi mục tiêu có tiến độ riêng và không cần AI để vận hành.</p></div></div><div className="section-body goal-list">{activeGoals.map((goal) => <article key={goal.id}><div className="goal-icon"><Target size={18}/></div><div><strong>{goal.title}</strong><p>{goal.description}</p><div className="goal-progress"><span style={{ width: `${goal.progress}%` }}/></div><small>{goal.progress}% hoàn thành</small></div><button onClick={() => store.updateLearningGoal(goal.id, { progress: Math.min(100, goal.progress + 10), status: goal.progress >= 90 ? "completed" : goal.status })}><CheckCircle2 size={17}/></button></article>)}</div><footer className="inline-create"><input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addGoal(); }} placeholder="Thêm mục tiêu học mới..."/><button className="btn btn-soft btn-sm" onClick={addGoal}><Plus size={14}/>Thêm</button></footer></section>

      <section className="section-card"><div className="section-head"><div><h2>Tiếp tục học</h2><p>Sách và bài học gần đây.</p></div><Link className="text-link" href="/library">Tất cả <ArrowRight size={14}/></Link></div><div className="section-body continue-stack">{recentBooks.map((book, index) => <Link key={book.id} href={`/reader/${book.id}`}><div className="mini-book-cover" style={{ background: book.cover }}>{index + 1}</div><span><strong>{book.title}</strong><small>{book.readingMinutes} phút · {book.pages.length} trang</small><div className="micro-progress"><i style={{ width: `${Math.min(92, 28 + index * 17)}%` }}/></div></span><ArrowRight size={15}/></Link>)}</div></section>
    </div>

    <section className="learning-path-strip"><div><GraduationCap/><span><strong>Học không bị khóa bởi API</strong><small>Reader, quiz, flashcard, ghi chú, tiến độ và lớp học luôn hoạt động.</small></span></div><Link href="/smart-settings">Xem nguyên tắc Smart Core <ArrowRight size={14}/></Link></section>
  </AppShell>;
}
