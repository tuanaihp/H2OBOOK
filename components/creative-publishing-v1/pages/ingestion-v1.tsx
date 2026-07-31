"use client";

import Link from "next/link";
import { FileImage, FileText, Globe2, Import, Link2, RefreshCw, ScanText, ShieldCheck, Workflow } from "lucide-react";
import { CreativePageFrame, StatusPill, SurfaceCard, styles } from "../creative-shared";

const sources = [
  { label: "DOCX", detail: "Mammoth + python-docx fallback", icon: FileText },
  { label: "PDF", detail: "Dual import: fidelity hoặc semantic", icon: FileText },
  { label: "PNG/JPEG", detail: "Ảnh, full page, OCR hoặc vùng thủ công", icon: FileImage },
  { label: "HTML/HTM", detail: "DOM parse, sanitize và relative assets", icon: Globe2 },
  { label: "Markdown/TXT", detail: "Heading, list, quote và media", icon: ScanText },
  { label: "URL", detail: "Safe fetch, SSRF guard và preview", icon: Link2 },
];

export function IngestionV1() {
  return <CreativePageFrame active="ingestion" eyebrow="UNIVERSAL CONTENT INGESTION" title="Biến nguồn nội dung thành bản thảo có cấu trúc" description="Module này điều hướng tới Unified Input 4.13.7, không tạo parser song song." actions={<><Link className={styles.secondaryButton} href="/input"><Import/>Mở Input Gateway</Link><Link className={styles.primaryButton} href="/ingestion"><Workflow/>Mở Orchestrator</Link></>} metrics={[
    { label: "Định dạng", value: 8 },
    { label: "Chế độ PDF", value: 2 },
    { label: "Retry", value: "Có" },
    { label: "Recovery", value: "Checkpoint" },
  ]}>
    <SurfaceCard title="Input Gateway thống nhất" description="Detect → Validate → Scan → Mode → Process → Preview → Commit" icon={<Workflow/>} tone="gradient">
      <div className={styles.sourceGrid}>{sources.map(({ label, detail, icon: Icon }) => <article key={label}><span><Icon/></span><div><strong>{label}</strong><p>{detail}</p></div><StatusPill tone="success">Sẵn sàng</StatusPill></article>)}</div>
    </SurfaceCard>
    <div className={styles.twoColumn}>
      <SurfaceCard title="Orchestrator Contract" description="Một job ID xuyên suốt toàn bộ pipeline.">
        <div className={styles.flowSteps}>{["Detect", "Validate", "Scan", "Choose mode", "Process", "Preview", "Commit", "Recovery"].map((step, index) => <div key={step}><span>{index + 1}</span><strong>{step}</strong></div>)}</div>
      </SurfaceCard>
      <SurfaceCard title="Production Guard" description="Không fetch tùy ý và không commit trước preview." icon={<ShieldCheck/>}>
        <ul className={styles.checkList}><li><ShieldCheck/>SSRF protection và redirect limit</li><li><RefreshCw/>Retry idempotent theo job ID</li><li><FileText/>Đầu ra là BookDocument, không cắt chuỗi text</li><li><ScanText/>OCR local/server, AI chỉ là tùy chọn</li></ul>
      </SurfaceCard>
    </div>
  </CreativePageFrame>;
}
