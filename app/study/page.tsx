"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { Brain, Check, RotateCcw, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";

export default function StudyPage() {
  const store = useAppStore();
  const due = useMemo(() => store.flashcards.filter((card) => new Date(card.nextReviewAt).getTime() <= Date.now()), [store.flashcards]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const card = due[index];
  const answer = (remembered: boolean) => {
    if (!card) return;
    store.reviewFlashcard(card.id, remembered);
    setReviewed((value) => value + 1); setFlipped(false); setIndex((value) => Math.min(value, Math.max(0, due.length - 2)));
  };
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">LOCAL SPACED REPETITION</span><h1>Ôn tập thông minh</h1><p>Lịch ôn được tính trên thiết bị bằng thuật toán lặp lại ngắt quãng, không gọi AI và không phát sinh token.</p></div><div className="header-actions"><span className="core-status-pill"><Sparkles size={14}/>Smart Core Local</span></div></div>
    <div className="study-grid">
      <section className="study-stage section-card"><div className="study-summary"><div><Brain/><span><strong>{due.length}</strong><small>thẻ đến hạn</small></span></div><div><Check/><span><strong>{reviewed}</strong><small>đã ôn phiên này</small></span></div></div>
        {card ? <div className={`flashcard-stage ${flipped ? "flipped" : ""}`} onClick={() => setFlipped(!flipped)} role="button" tabIndex={0}><div className="flashcard-face front"><small>CÂU HỎI</small><h2>{card.front}</h2><span>Chạm để xem đáp án</span></div><div className="flashcard-face back"><small>ĐÁP ÁN</small><p>{card.back}</p><span>Độ khó {card.difficulty}/5 · đã ôn {card.reviewCount} lần</span></div></div> : <div className="study-empty"><Check/><h2>Đã hoàn thành lượt ôn hôm nay</h2><p>Các thẻ tiếp theo sẽ xuất hiện theo lịch đã tính local.</p></div>}
        {card && <div className="study-answer-actions"><button className="btn study-forgot" onClick={() => answer(false)}><X size={16}/>Chưa nhớ</button><button className="btn btn-secondary" onClick={() => setFlipped(false)}><RotateCcw size={16}/>Xem lại</button><button className="btn study-remember" onClick={() => answer(true)}><Check size={16}/>Đã nhớ</button></div>}
      </section>
      <aside className="section-card"><div className="section-head"><div><h2>Lịch sắp tới</h2><p>H2OBOOK tự sắp lịch theo kết quả ôn.</p></div></div><div className="section-body review-calendar">{store.flashcards.slice().sort((a,b) => +new Date(a.nextReviewAt) - +new Date(b.nextReviewAt)).slice(0,8).map((item) => <article key={item.id}><span>{new Date(item.nextReviewAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</span><div><strong>{item.front}</strong><small>{item.tags.join(" · ") || "Flashcard"}</small></div></article>)}</div></aside>
    </div>
  </AppShell>;
}
