"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Activity, Pause, Play, Plus, RotateCcw, Webhook, Zap } from "lucide-react";
import { automationRules } from "@/lib/academic-ops-v2/teaching-data";
import { AcademicOpsFlowBar, IntelligenceHeader, MetricGrid } from "./shared";
import styles from "./academic-ops.module.css";

export function AcademicAutomationsV2() {
  const [rules, setRules] = useState(automationRules);
  const active = useMemo(() => rules.filter((rule) => rule.active).length, [rules]);
  const totalRuns = useMemo(() => rules.reduce((sum, rule) => sum + rule.runs, 0), [rules]);

  function toggleRule(id: string) {
    setRules((current) => current.map((rule) => rule.id === id ? { ...rule, active: !rule.active } : rule));
  }

  function testRule(id: string) {
    setRules((current) => current.map((rule) => rule.id === id ? { ...rule, runs: rule.runs + 1, lastRun: "Vừa xong" } : rule));
  }

  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <IntelligenceHeader
          eyebrow="H2O AUTOMATION ENGINE"
          title="Tự động hóa vận hành học thuật"
          description="Nối sự kiện sách, đơn hàng, lớp học và phản hồi thành quy trình tự chạy, nhưng luôn có quyền kiểm soát thủ công."
          actions={<button className="btn btn-primary" type="button"><Plus size={16}/>Tạo automation</button>}
        />
        <MetricGrid items={[
          { label: "Đang hoạt động", value: String(active), note: "Workflow đã bật" },
          { label: "Lượt chạy", value: String(totalRuns), note: "Tổng số lần thực thi" },
          { label: "Lỗi đã ghi nhận", value: "2", note: "Cần rà log" },
          { label: "Kết nối webhook", value: "1", note: "Endpoint đang hoạt động" }
        ]}/>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><h2>Workflow đang cấu hình</h2><p>Mỗi rule gồm một trigger và một hoặc nhiều hành động.</p></div>
            <span className={styles.status}><Webhook size={13}/>Event driven</span>
          </div>
          <div className={`${styles.panelBody} ${styles.workflowList}`}>
            {rules.map((rule) => (
              <article className={styles.workflowRow} key={rule.id}>
                <span className={styles.workflowIndicator} data-active={rule.active}/>
                <div className={styles.workflowMain}>
                  <strong>{rule.name}</strong>
                  <small><Zap size={12}/>{rule.trigger}</small>
                  <div className={styles.meta}>{rule.actions.map((action) => <span key={action}>{action}</span>)}</div>
                </div>
                <div className={styles.workflowStats}><strong>{rule.runs}</strong><small>Lượt chạy<br/>{rule.lastRun}</small></div>
                <div className={styles.rowActions}>
                  <button type="button" className="btn btn-secondary" onClick={() => testRule(rule.id)}><Play size={14}/>Chạy thử</button>
                  <button type="button" className="btn btn-secondary" onClick={() => toggleRule(rule.id)}>{rule.active ? <Pause size={14}/> : <RotateCcw size={14}/>} {rule.active ? "Tạm dừng" : "Kích hoạt"}</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.grid3}>
          <article className={styles.entityCard}><Zap/><h3>Trigger chuẩn hóa</h3><p>book.published, order.paid, assignment.graded và class.started dùng chung event contract.</p></article>
          <article className={styles.entityCard}><Webhook/><h3>Webhook an toàn</h3><p>Secret được mã hóa, delivery có idempotency key và retry theo cấp số nhân.</p></article>
          <article className={styles.entityCard}><Activity/><h3>Run history</h3><p>Mỗi lần chạy có trace, trạng thái, lỗi và khả năng chạy lại có kiểm soát.</p></article>
        </section>
      </div>
    </AppShell>
  );
}
