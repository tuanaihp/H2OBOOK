"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CheckCircle2, MessageSquare, Plus } from "lucide-react";
import { reviewRequests } from "@/lib/academic-ops-v2/teaching-data";
import type { ReviewRequest } from "@/lib/academic-ops-v2/teaching-data";
import { AcademicOpsFlowBar, IntelligenceHeader, MetricGrid } from "./shared";
import styles from "./academic-ops.module.css";

const columns = [
  ["preparing", "Chuẩn bị"],
  ["reviewing", "Đang duyệt"],
  ["changes", "Cần chỉnh sửa"],
  ["approved", "Đã phê duyệt"]
] as const;

export function AcademicReviewsV2() {
  const [requests, setRequests] = useState(reviewRequests);
  const [selectedId, setSelectedId] = useState(reviewRequests[0]?.id ?? "");
  const selected = requests.find((item) => item.id === selectedId) ?? requests[0];
  const counts = useMemo(() => Object.fromEntries(columns.map(([status]) => [status, requests.filter((item) => item.status === status).length])), [requests]);

  function updateStatus(status: ReviewRequest["status"]) {
    if (!selected) return;
    setRequests((current) => current.map((item) => item.id === selected.id ? { ...item, status } : item));
  }

  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <IntelligenceHeader eyebrow="PUBLISHING APPROVAL WORKFLOW" title="Trung tâm duyệt sách" description="Kiểm soát nội dung, thiết kế, thương hiệu và bản quyền trước khi phát hành." actions={<button className="btn btn-primary" type="button"><Plus size={16}/>Tạo yêu cầu duyệt</button>}/>
        <MetricGrid items={[
          { label: "Đã phê duyệt", value: String(counts.approved ?? 0), note: "Sẵn sàng phát hành" },
          { label: "Đang duyệt", value: String(counts.reviewing ?? 0), note: "Đang xử lý" },
          { label: "Bình luận chưa xử lý", value: String(requests.reduce((sum, item) => sum + item.comments, 0)), note: "Cần phản hồi" },
          { label: "Người có thể duyệt", value: "3", note: "Theo vai trò" }
        ]}/>

        <section className={styles.kanban}>
          {columns.map(([status, label]) => <div className={styles.kanbanColumn} key={status}><div className={styles.kanbanHeader}><strong>{label}</strong><span>{counts[status] ?? 0}</span></div>{requests.filter((item) => item.status === status).map((item) => <button className={styles.reviewCard} data-selected={item.id === selectedId} type="button" key={item.id} onClick={() => setSelectedId(item.id)}><span>{item.category}</span><strong>{item.title}</strong><small>{item.book}</small><div className={styles.progress}><i style={{ width: `${(item.checklistDone / item.checklistTotal) * 100}%` }}/></div><footer><small>{item.checklistDone}/{item.checklistTotal} checklist</small><small><MessageSquare size={12}/>{item.comments}</small></footer></button>)}</div>)}
        </section>

        {selected ? <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>{selected.title}</h2><p>Cập nhật {selected.updatedAt}</p></div><div className={styles.rowActions}><button className="btn btn-secondary" type="button" onClick={() => updateStatus("reviewing")}>Gửi duyệt</button><button className="btn btn-secondary" type="button" onClick={() => updateStatus("changes")}>Yêu cầu sửa</button><button className="btn btn-primary" type="button" onClick={() => updateStatus("approved")}><CheckCircle2 size={14}/>Phê duyệt</button></div></div>
          <div className={styles.reviewDetailGrid}><div><h3>Checklist phát hành</h3><ul className={styles.checkList}><li><CheckCircle2/>Kiểm tra bìa và mục lục</li><li><CheckCircle2/>Kiểm tra font tiếng Việt</li><li data-open="true"><span/>Kiểm tra ảnh độ phân giải thấp</li></ul></div><div><h3>Bình luận</h3><div className={styles.commentBox}><strong>Designer Linh</strong><p>Ảnh bìa cần tăng tương phản để tên sách nổi bật hơn.</p></div><textarea className={styles.commentInput} placeholder="Nhập bình luận hoặc yêu cầu chỉnh sửa..."/></div></div>
        </section> : null}
      </div>
    </AppShell>
  );
}
