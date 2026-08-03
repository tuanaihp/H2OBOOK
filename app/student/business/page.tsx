"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Sparkles, Target, TrendingUp } from "lucide-react";

type Task = { id: string; title: string; description: string; priority: "urgent" | "high" | "normal"; feature: string };
type FeatureDecision = { feature: string; allowed: boolean; source?: string; reason: string };
type CreateAsset = { projectId: string; assetType: string; title: string; status: string };
type CommandCenterResponse = {
  view: { headline: string; stageLabel: string; progress: number; metrics: { leads: number; qualifiedLeads: number; bookings: number; revenue: number; publishedContent: number }; tasks: Task[]; unlockedFeatures: FeatureDecision[]; nextMilestone: string };
  readyAssets: CreateAsset[];
  plan: string;
  activeMembership: boolean;
};

const PRIORITY_LABEL: Record<Task["priority"], string> = { urgent: "Khẩn cấp", high: "Ưu tiên", normal: "Bình thường" };

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

export default function BusinessCommandCenterPage() {
  const [data, setData] = useState<CommandCenterResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/business/command-center");
      const json = await res.json();
      if (res.ok) setData(json);
      setLoading(false);
    })();
  }, []);

  return <>
    <section className="h2o-student-page-head">
      <div><span>TRUNG TÂM KINH DOANH</span><h1>{loading ? "Đang tải…" : data?.view.headline}</h1><p>{data ? `${data.view.stageLabel} · Gói ${data.plan}${data.activeMembership ? "" : " (chưa có membership hoạt động)"}` : ""}</p></div>
    </section>

    <div className="h2o-student-dashboard-grid">
      <section className="h2o-student-card">
        <header className="h2o-student-card-head"><div><span><TrendingUp size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />CHỈ SỐ THẬT</span><h2>Lead, booking &amp; doanh thu</h2></div></header>
        <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          <div><strong style={{ fontSize: 20, display: "block" }}>{data?.view.metrics.leads ?? 0}</strong><span style={{ fontSize: 11, color: "#8d97a6" }}>Lead</span></div>
          <div><strong style={{ fontSize: 20, display: "block" }}>{data?.view.metrics.bookings ?? 0}</strong><span style={{ fontSize: 11, color: "#8d97a6" }}>Booking</span></div>
          <div><strong style={{ fontSize: 20, display: "block" }}>{data?.view.metrics.publishedContent ?? 0}</strong><span style={{ fontSize: 11, color: "#8d97a6" }}>Nội dung đã đăng</span></div>
          <div style={{ gridColumn: "span 3" }}><strong style={{ fontSize: 18 }}>{formatVnd(data?.view.metrics.revenue ?? 0)}</strong><span style={{ fontSize: 11, color: "#8d97a6", display: "block" }}>Doanh thu đã chốt (won)</span></div>
        </div>
      </section>

      <section className="h2o-student-card">
        <header className="h2o-student-card-head"><div><span><Target size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />MỐC TIẾP THEO</span><h2>{data?.view.nextMilestone ?? "—"}</h2></div></header>
        <div style={{ padding: 18 }}>
          <div style={{ height: 6, borderRadius: 99, background: "#eee", overflow: "hidden", marginBottom: 10 }}><i style={{ display: "block", height: "100%", width: `${data?.view.progress ?? 0}%`, background: "linear-gradient(90deg,#50d7e2,#8875eb)" }} /></div>
          <span style={{ fontSize: 11, color: "#8d97a6" }}>{data?.view.progress ?? 0}% mục tiêu hiện tại</span>
        </div>
      </section>
    </div>

    <section className="h2o-student-card" style={{ marginTop: 20 }}>
      <header className="h2o-student-card-head"><div><span><AlertTriangle size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />NHIỆM VỤ HÔM NAY</span><h2>Việc cần làm để tăng doanh thu</h2></div></header>
      <div style={{ padding: 18, display: "grid", gap: 8 }}>
        {loading ? <p>Đang tải…</p> : !data?.view.tasks.length ? <p style={{ color: "#8d97a6" }}>Không có nhiệm vụ khẩn cấp — tiếp tục duy trì nhịp độ hiện tại.</p> : data.view.tasks.map((task) => (
          <div key={task.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, borderRadius: 10, border: "1px solid #edf0f2", fontSize: 12 }}>
            <div><strong>{task.title}</strong><div style={{ color: "#8d97a6", marginTop: 2 }}>{task.description}</div></div>
            <span style={{ fontSize: 10, color: task.priority === "urgent" ? "#b22949" : task.priority === "high" ? "#a05a13" : "#6948b8" }}>{PRIORITY_LABEL[task.priority]}</span>
          </div>
        ))}
      </div>
    </section>

    <div className="h2o-student-dashboard-grid second" style={{ marginTop: 20 }}>
      <section className="h2o-student-card">
        <header className="h2o-student-card-head"><div><span><Sparkles size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />THÀNH QUẢ SẴN SÀNG DÙNG</span><h2>Từ Create Outcome Studio</h2></div><Link href="/student/business/growth">Xem hết</Link></header>
        <div style={{ padding: 18 }}>
          {!data?.readyAssets.length ? <p style={{ color: "#8d97a6" }}>Chưa có thành quả nào sẵn sàng — tạo Portfolio hoặc Bảng giá trong Create Studio.</p> : (
            <div style={{ display: "grid", gap: 8 }}>{data.readyAssets.slice(0, 4).map((asset) => <div key={asset.projectId} style={{ display: "flex", justifyContent: "space-between", padding: 10, borderRadius: 10, border: "1px solid #edf0f2", fontSize: 12 }}><span>{asset.title}</span><em style={{ color: "#8875eb", fontStyle: "normal" }}>{asset.assetType}</em></div>)}</div>
          )}
        </div>
      </section>

      <section className="h2o-student-card">
        <header className="h2o-student-card-head"><div><span>CÔNG CỤ ĐÃ MỞ</span><h2>{data?.view.unlockedFeatures.length ?? 0} tính năng</h2></div></header>
        <div style={{ padding: 18, display: "grid", gap: 8 }}>
          {data?.view.unlockedFeatures.slice(0, 6).map((feature) => <div key={feature.feature} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}><span>{feature.feature}</span><em style={{ fontStyle: "normal", color: "#8d97a6" }}>{feature.source}</em></div>)}
        </div>
      </section>
    </div>

    <section className="h2o-student-card" style={{ marginTop: 20 }}>
      <div style={{ padding: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/student/business/customers" className="btn btn-primary btn-sm">Khách hàng &amp; bán hàng <ArrowRight size={14} /></Link>
        <Link href="/student/business/growth" className="btn btn-primary btn-sm">Nội dung &amp; tăng trưởng <ArrowRight size={14} /></Link>
        <Link href="/student/business/operations" className="btn btn-primary btn-sm">Quyền lợi &amp; vận hành <ArrowRight size={14} /></Link>
      </div>
    </section>
  </>;
}
