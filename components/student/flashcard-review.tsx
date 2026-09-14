"use client";

import Link from "next/link";
import { useState } from "react";
import { Brain, Check, RotateCcw, X } from "lucide-react";

export type ReviewCard = { id: string; front: string; back: string; difficulty: number; reviewCount: number };

export function FlashcardReview({ cards, demo }: { cards: ReviewCard[]; demo: boolean }) {
  const [queue, setQueue] = useState(cards);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const card = queue[0];

  const answer = async (remembered: boolean) => {
    if (!card || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/student/flashcards/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, remembered })
      });
      const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? payload?.error ?? "REVIEW_FAILED");
      setQueue((current) => current.slice(1));
      setReviewed((value) => value + 1);
      setFlipped(false);
    } catch (caught) {
      setError(caught instanceof Error ? `Chưa lưu được kết quả ôn (${caught.message}). Thử lại nhé.` : "Chưa lưu được kết quả ôn.");
    } finally {
      setBusy(false);
    }
  };

  if (demo) {
    return <section className="h2o-student-card"><div style={{ padding: 18 }}><p style={{ color: "#718092", margin: 0 }}>Chế độ demo không có thẻ ôn thật. Đăng nhập bằng tài khoản học viên để ôn thẻ của bạn.</p></div></section>;
  }

  return <div className="study-grid">
    <section className="study-stage section-card">
      <div className="study-summary">
        <div><Brain /><span><strong>{queue.length}</strong><small>thẻ còn lại</small></span></div>
        <div><Check /><span><strong>{reviewed}</strong><small>đã ôn phiên này</small></span></div>
      </div>
      {error && <p role="alert" style={{ margin: "0 0 12px", color: "#b42318", fontSize: 13 }}>{error}</p>}
      {card
        ? <div className={`flashcard-stage ${flipped ? "flipped" : ""}`} onClick={() => setFlipped((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setFlipped((value) => !value); } }} role="button" tabIndex={0} aria-label={flipped ? "Xem câu hỏi" : "Xem đáp án"}>
            <div className="flashcard-face front"><small>CÂU HỎI</small><h2>{card.front}</h2><span>Chạm để xem đáp án</span></div>
            <div className="flashcard-face back"><small>ĐÁP ÁN</small><p>{card.back}</p><span>Độ khó {card.difficulty}/5 · đã ôn {card.reviewCount} lần</span></div>
          </div>
        : <div className="study-empty"><Check /><h2>Đã hoàn thành lượt ôn hôm nay</h2><p>Các thẻ tiếp theo sẽ xuất hiện theo lịch ôn của bạn.</p><Link href="/student/learn" className="btn btn-secondary btn-sm">Về Học &amp; ghi nhớ</Link></div>}
      {card && <div className="study-answer-actions">
        <button className="btn study-forgot" disabled={busy} onClick={() => void answer(false)}><X size={16} />Chưa nhớ</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => setFlipped(false)}><RotateCcw size={16} />Xem lại</button>
        <button className="btn study-remember" disabled={busy} onClick={() => void answer(true)}><Check size={16} />Đã nhớ</button>
      </div>}
    </section>
  </div>;
}
