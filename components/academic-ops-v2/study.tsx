"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { Brain, Check, RotateCcw, Sparkles, X } from "lucide-react";
import { trackAcademicOpsEvent } from "@/lib/academic-ops-v2/analytics";
import { AcademicOpsFlowBar, IntelligenceHeader } from "./shared";
import styles from "./academic-ops.module.css";

export function AcademicStudyV2() {
  const store = useAppStore();
  const due = useMemo(() => store.flashcards.filter((card) => new Date(card.nextReviewAt).getTime() <= Date.now()), [store.flashcards]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const card = due[index];
  const answer = (remembered: boolean) => {
    if (!card) return;
    store.reviewFlashcard(card.id, remembered);
    trackAcademicOpsEvent("academic_flashcard_reviewed", { cardId: card.id, remembered });
    setReviewed((value) => value + 1); setFlipped(false); setIndex((value) => Math.min(value, Math.max(0, due.length - 2)));
  };

  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <IntelligenceHeader eyebrow="LOCAL SPACED REPETITION" title="Ôn tập thông minh" description="Lịch ôn local, không gọi AI và không phát sinh token." actions={<span className={styles.status}><Sparkles size={13}/>Smart Core Local</span>}/>
        <div className={styles.grid2}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Phiên ôn hôm nay</h2><p>{due.length} thẻ đến hạn · {reviewed} thẻ đã ôn</p></div></div>
            <div className={styles.panelBody}>
              {card ? <div className={styles.flashStage} role="button" tabIndex={0} onClick={() => setFlipped(!flipped)} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setFlipped(!flipped)}><div><span className={styles.eyebrow}>{flipped ? "ĐÁP ÁN" : "CÂU HỎI"}</span><h2>{flipped ? card.back : card.front}</h2><p>{flipped ? `Độ khó ${card.difficulty}/5 · đã ôn ${card.reviewCount} lần` : "Chạm để xem đáp án"}</p></div></div> : <div className={styles.flashStage}><div><Check size={48}/><h2>Đã hoàn thành lượt ôn hôm nay</h2></div></div>}
              {card ? <div className={styles.actions}><button className="btn study-forgot" onClick={() => answer(false)}><X size={16}/>Chưa nhớ</button><button className="btn btn-secondary" onClick={() => setFlipped(false)}><RotateCcw size={16}/>Xem lại</button><button className="btn study-remember" onClick={() => answer(true)}><Check size={16}/>Đã nhớ</button></div> : null}
            </div>
          </section>
          <aside className={styles.panel}><div className={styles.panelHeader}><div><h2>Lịch sắp tới</h2><p>Tự sắp theo kết quả ôn.</p></div></div><div className={`${styles.panelBody} ${styles.list}`}>{store.flashcards.slice().sort((a,b) => +new Date(a.nextReviewAt) - +new Date(b.nextReviewAt)).slice(0,8).map((item) => <article className={styles.listRow} key={item.id}><span className={styles.iconTile}><Brain size={17}/></span><span><strong>{item.front}</strong><small>{new Date(item.nextReviewAt).toLocaleDateString("vi-VN")} · {item.tags.join(" · ") || "Flashcard"}</small></span></article>)}</div></aside>
        </div>
      </div>
    </AppShell>
  );
}
