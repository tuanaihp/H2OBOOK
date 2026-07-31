"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FileOutput, FileScan, Image, Play, RefreshCcw, Server } from "lucide-react";
import type { ProcessingJob } from "@/lib/academic-ops-v2/teaching-data";
import { AcademicOpsFlowBar, IntelligenceHeader } from "./shared";
import styles from "./academic-ops.module.css";

const tasks = [
  { type: "pdf_import" as const, label: "Test PDF Import", note: "Tách trang và thumbnail", Icon: FileScan },
  { type: "ocr" as const, label: "Test OCR", note: "Nhận dạng layout", Icon: Image },
  { type: "pdf_export" as const, label: "Test PDF Export", note: "Tạo file chất lượng cao", Icon: FileOutput }
];

export function AcademicProcessingV2() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  function enqueue(type: ProcessingJob["type"], label: string) {
    const id = `${type}-${Date.now()}`;
    setJobs((current) => [{ id, type, name: label, progress: 12, status: "processing", createdAt: "Vừa xong" }, ...current]);
    window.setTimeout(() => setJobs((current) => current.map((job) => job.id === id ? { ...job, progress: 100, status: "completed" } : job)), 900);
  }

  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <IntelligenceHeader eyebrow="DOCUMENT PROCESSING" title="Hàng đợi xử lý tài liệu" description="PDF/Word, OCR, thumbnail và export chạy ngoài editor để giao diện luôn mượt." actions={<span className={styles.warningPill}><Server size={14}/>Memory fallback</span>}/>
        <section className={styles.grid3}>
          {tasks.map(({ type, label, note, Icon }) => <button className={styles.taskCard} key={type} type="button" onClick={() => enqueue(type, label)}><Icon/><span><strong>{label}</strong><small>{note}</small></span><Play/></button>)}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Jobs gần đây</h2><p>Tự cập nhật mỗi 2,5 giây trong production adapter.</p></div><button className="btn btn-secondary" type="button" onClick={() => setJobs([])}><RefreshCcw size={14}/>Làm mới</button></div>
          <div className={styles.matrixScroll}>
            <table className={styles.jobTable}><thead><tr><th>Job</th><th>Loại</th><th>Tiến độ</th><th>Trạng thái</th><th>Khởi tạo</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td><strong>{job.name}</strong><small>{job.id}</small></td><td>{job.type}</td><td><div className={styles.progress}><i style={{ width: `${job.progress}%` }}/></div></td><td><span className={styles.status}>{job.status}</span></td><td>{job.createdAt}</td></tr>)}</tbody></table>
            {!jobs.length ? <div className={styles.emptyState}>Chưa có job. Chạy một tác vụ kiểm tra phía trên.</div> : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
