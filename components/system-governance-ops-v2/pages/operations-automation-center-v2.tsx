"use client";

import { useState } from "react";
import { Activity, GitBranch, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { automationWorkflows as initialWorkflows } from "@/lib/system-governance-ops-v2/data";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { Metric, Panel, SystemPageHeader } from "../system-shared";
import { OperationsStatus } from "../operations-shared";
import styles from "../system-governance-ops-v2.module.css";

export function OperationsAutomationCenterV2() {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const toggle = (id: string) => setWorkflows((items) => items.map((item) => {
    if (item.id !== id) return item;
    const status = item.status === "active" ? "paused" : "active";
    emitSystemEvent("operations_workflow_toggled", { workflowId: id, status });
    return { ...item, status };
  }));
  return <>
    <SystemPageHeader eyebrow="H2OBOOK OPERATIONS" title="Automation Center" description="Kết nối sự kiện kinh doanh và đào tạo với hành động tự động, có retry, idempotency và audit." actions={<button className={styles.primaryButton}><Plus/> Tạo automation</button>}/>
    <div className={styles.metricGrid}><Metric label="Đang hoạt động" value={String(workflows.filter((item) => item.status === "active").length)} note="Workflow live" icon={<Activity/>}/><Metric label="Tổng lượt chạy" value={String(workflows.reduce((sum, item) => sum + item.runs, 0))} note="Toàn bộ thời gian" tone="blue" icon={<RotateCcw/>}/><Metric label="Lỗi ghi nhận" value={String(workflows.reduce((sum, item) => sum + item.errors, 0))} note="Cần quan sát" tone="warning" icon={<GitBranch/>}/></div>
    <Panel title="Workflow đang cấu hình" description="Mỗi rule gồm một trigger và một hoặc nhiều hành động." icon={<GitBranch/>}><div className={styles.workflowList}>{workflows.map((workflow) => <article key={workflow.id}><span className={styles.opsIconBox}><GitBranch/></span><div><OperationsStatus status={workflow.status}/><h3>{workflow.name}</h3><p><code>{workflow.trigger}</code> → {workflow.steps.join(" → ")}</p></div><div className={styles.workflowStats}><strong>{workflow.runs}</strong><small>lượt chạy</small><span>{workflow.errors} lỗi</span></div><button className={workflow.status === "active" ? styles.secondaryButton : styles.primaryButton} onClick={() => toggle(workflow.id)}>{workflow.status === "active" ? <><Pause/> Tạm dừng</> : <><Play/> Kích hoạt</>}</button></article>)}</div></Panel>
  </>;
}
