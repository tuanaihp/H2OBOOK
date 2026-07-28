"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { useAppStore } from "@/store/app-store";
import { formatDate } from "@/lib/utils";
import { Activity, AlertTriangle, CheckCircle2, Cloud, Database, HardDrive, RefreshCw, Server, ShieldCheck, Users } from "lucide-react";

type RuntimeCapability = { key: string; label: string; configured: boolean; required: boolean; description: string };
type AdminJob = { id: string; externalJobId?: string; type: string; status: string; progress: number; createdAt: string; updatedAt?: string; error?: string };

export default function AdminPage() {
  const store = useAppStore();
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [capabilities, setCapabilities] = useState<RuntimeCapability[]>([]);
  const [systemStatus, setSystemStatus] = useState("loading");
  const [mode, setMode] = useState("demo");
  const [refreshing, setRefreshing] = useState(false);
  const usage = Math.round(store.workspace.storageUsedMb / store.workspace.storageLimitMb * 100);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [readinessResponse, jobsResponse] = await Promise.all([fetch("/api/readiness", { cache: "no-store" }), fetch("/api/jobs", { cache: "no-store" })]);
      const readiness = await readinessResponse.json(); const jobPayload = await jobsResponse.json();
      setCapabilities(readiness.capabilities ?? []); setSystemStatus(readiness.status ?? "degraded"); setMode(readiness.mode ?? "demo"); setJobs(jobPayload.jobs ?? []);
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { void refresh(); const timer = window.setInterval(refresh, 8000); return () => window.clearInterval(timer); }, [refresh]);
  const configured = useMemo(() => capabilities.filter(item => item.configured).length, [capabilities]);
  const securityWarnings = useMemo(() => capabilities.filter(item => item.required && !item.configured).length, [capabilities]);

  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">SYSTEM ADMINISTRATION</span><h1>Trung tâm quản trị production</h1><p>Giám sát workspace, document worker, tích hợp, bảo mật và audit log theo dữ liệu runtime.</p></div><Badge tone={systemStatus === "ready" ? "success" : "warning"}>{systemStatus === "ready" ? <CheckCircle2/> : <AlertTriangle/>}{systemStatus === "ready" ? "Production ready" : `${mode} / degraded`}</Badge></div>
    <section className="metric-grid"><MetricCard label="Người dùng hệ thống" value={String(store.users.length + store.students.length)} note={`${store.users.filter(item => item.status === "active").length} nhân sự nội bộ`} icon={Users}/><MetricCard label="Dung lượng sử dụng" value={`${usage}%`} note={`${(store.workspace.storageUsedMb/1024).toFixed(1)} / ${(store.workspace.storageLimitMb/1024).toFixed(0)} GB`} icon={HardDrive} tone="warning"/><MetricCard label="Job đang chạy" value={String(jobs.filter(item => item.status === "processing" || item.status === "queued").length)} note={`${jobs.filter(item => item.status === "failed").length} job lỗi`} icon={Server} tone="blue"/><MetricCard label="Dịch vụ đã kết nối" value={`${configured}/${capabilities.length || 8}`} note={`${securityWarnings} kết nối bắt buộc còn thiếu`} icon={ShieldCheck} tone={securityWarnings ? "warning" : "success"}/></section>
    <div className="admin-grid"><section className="section-card admin-wide"><div className="section-head"><div><h2>Document Processing Queue</h2><p>Dữ liệu từ Supabase/Redis; Demo Mode dùng memory fallback.</p></div><button className="btn btn-secondary btn-sm" disabled={refreshing} onClick={refresh}><RefreshCw className={refreshing ? "spin" : ""}/>Làm mới</button></div><div className="table-responsive"><table className="data-table"><thead><tr><th>Job</th><th>Loại</th><th>Tiến độ</th><th>Trạng thái</th><th>Bắt đầu</th></tr></thead><tbody>{jobs.length ? jobs.map(job => <tr key={job.id}><td><strong>{job.id.slice(0, 12)}</strong>{job.externalJobId && <small className="block-muted">Queue: {job.externalJobId}</small>}</td><td>{job.type}</td><td><div className="progress-cell"><div className="progress"><span style={{ width: `${job.progress}%` }}/></div><strong>{job.progress}%</strong></div></td><td><Badge tone={job.status === "completed" ? "success" : job.status === "failed" ? "warning" : "purple"}>{job.status}</Badge>{job.error && <small className="block-muted">{job.error}</small>}</td><td>{formatDate(job.createdAt)}</td></tr>) : <tr><td colSpan={5}><div className="table-empty">Chưa có job. Tạo tác vụ tại Document Queue.</div></td></tr>}</tbody></table></div></section>
      <section className="section-card"><div className="section-head"><div><h2>Hạ tầng runtime</h2><p>Đọc trực tiếp từ biến môi trường server.</p></div><Cloud/></div><div className="section-body service-list">{capabilities.map(capability => <div key={capability.key}><span className="service-icon">{capability.key === "database" ? <Database/> : capability.key === "queue" ? <Server/> : <Cloud/>}</span><span><strong>{capability.label}</strong><small>{capability.configured ? "Đã cấu hình" : capability.required ? "Bắt buộc còn thiếu" : "Tùy chọn"}</small></span><i className={capability.configured ? "online" : "pending"}/></div>)}</div></section>
      <section className="section-card admin-wide"><div className="section-head"><div><h2>Audit Log</h2><p>Các hành động quan trọng trong workspace local hiện tại.</p></div><Activity/></div><div className="section-body audit-list">{store.activities.map(item => <div key={item.id}><span className={`audit-icon ${item.tone}`}><Activity/></span><span><strong>{item.actor}</strong> {item.action} <b>{item.target}</b><small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small></span></div>)}</div></section>
      <section className="section-card"><div className="section-head"><div><h2>Database Readiness</h2><p>Thứ tự migration của bản hợp nhất.</p></div></div><div className="section-body readiness-list">{["0001 Core + RLS", "0002 Training & Commerce", "0003 Workflow & Licensing", "0004 Production Core", "0005 Security Hardening", "Restore test & backup policy"].map((item, index) => <div key={item}><span className={index < 5 ? "done" : "pending"}>{index < 5 ? <CheckCircle2/> : <AlertTriangle/>}</span>{item}</div>)}</div></section>
    </div>
  </AppShell>;
}
