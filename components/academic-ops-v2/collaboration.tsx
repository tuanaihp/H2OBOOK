"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Check, MessageSquare, Users } from "lucide-react";
import { collaborationMembers, feedbackItems } from "@/lib/academic-ops-v2/teaching-data";
import { AcademicOpsFlowBar, IntelligenceHeader } from "./shared";
import styles from "./academic-ops.module.css";

export function AcademicCollaborationV2() {
  const [feedback, setFeedback] = useState(feedbackItems);
  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <IntelligenceHeader eyebrow="COLLABORATION HUB" title="Cộng tác và phản hồi" description="Theo dõi người đang làm việc, vị trí đang mở và bình luận gắn trực tiếp với từng cuốn sách." actions={<span className={styles.status}><Users size={13}/>Realtime-ready</span>}/>

        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Phiên làm việc</h2><p>Trạng thái cộng tác đang hoạt động.</p></div><Users/></div>
          <div className={styles.panelBody}>
            <div className={styles.sessionHeader}><div className={styles.bookThumb}/><div><strong>Giáo trình Makeup Chuyên Nghiệp</strong><small>Cập nhật 28/07/2026</small></div><button className="btn btn-secondary" type="button">Mở Studio</button></div>
            <div className={styles.memberList}>
              {collaborationMembers.map((member) => <div className={styles.memberRow} key={member.id}><span className={styles.avatar}>{member.initials}</span><span><strong>{member.name}</strong><small>{member.location}</small></span><span className={styles.status} data-status={member.status}>{member.status}</span></div>)}
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Phản hồi cần xử lý</h2><p>Bình luận chưa được đánh dấu hoàn tất.</p></div><MessageSquare/></div>
          <div className={`${styles.panelBody} ${styles.feedbackList}`}>
            {feedback.filter((item) => !item.resolved).map((item) => (
              <article className={styles.feedbackCard} key={item.id}>
                <div><span className={styles.avatar}>{item.author.slice(0, 2).toUpperCase()}</span><strong>{item.author}</strong><small>{item.book} · {item.date}</small></div>
                <p>{item.message}</p>
                <div className={styles.rowActions}><button className="btn btn-secondary" type="button">Mở vị trí</button><button className="btn btn-primary" type="button" onClick={() => setFeedback((current) => current.map((entry) => entry.id === item.id ? { ...entry, resolved: true } : entry))}><Check size={14}/>Đã xử lý</button></div>
              </article>
            ))}
            {feedback.every((item) => item.resolved) ? <div className={styles.emptyState}>Không còn phản hồi chờ xử lý.</div> : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
