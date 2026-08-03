"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Sparkles, Wand2 } from "lucide-react";

type CreateAsset = { projectId: string; assetType: string; title: string; status: string };
type FeatureDecision = { feature: string; allowed: boolean; reason: string; unlockHint?: string };

const ASSET_LABEL: Record<string, string> = { portfolio: "Portfolio", brand_kit: "Bộ nhận diện", pricing: "Bảng giá", content_plan: "Kế hoạch nội dung", sales_script: "Kịch bản tư vấn" };
const STATUS_LABEL: Record<string, string> = { draft: "Bản nháp", approved: "Đã duyệt", published: "Đã công khai" };

// growth_campaigns / growth_reader do not have a per-learner data source yet (Growth Reader is
// an organization-level marketing tool, module 5) — shown as locked-with-reason cards instead of
// fabricated placeholder numbers, matching the module's own "không chỉ hiển thị dashboard số
// liệu trống" rule by being honest about what is real vs. not-yet-connected.
const DEFERRED_TOOLS = [
  { feature: "content_90_days", label: "Content 90 ngày", hint: "Dùng recipe \"Kế hoạch Content 90 ngày\" trong Create Studio để bắt đầu." },
  { feature: "growth_campaigns", label: "Growth Campaign", hint: "Chưa kết nối — sẽ mở ở bản nâng cấp tiếp theo." },
  { feature: "growth_reader", label: "Growth Reader cá nhân", hint: "Growth Reader hiện là công cụ marketing cấp tổ chức, chưa có bản cho từng học viên." }
];

export default function BusinessGrowthPage() {
  const [assets, setAssets] = useState<CreateAsset[]>([]);
  const [features, setFeatures] = useState<FeatureDecision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [assetsRes, commandRes] = await Promise.all([fetch("/api/business/assets"), fetch("/api/business/command-center")]);
      const assetsJson = await assetsRes.json();
      const commandJson = await commandRes.json();
      if (assetsRes.ok) setAssets(assetsJson.assets ?? []);
      if (commandRes.ok) setFeatures(commandJson.view.unlockedFeatures ?? []);
      setLoading(false);
    })();
  }, []);

  const unlockedSlugs = new Set(features.map((f) => f.feature));

  return <>
    <section className="h2o-student-page-head">
      <div><span>NỘI DUNG &amp; TĂNG TRƯỞNG</span><h1>Biến thành quả Create thành khách hàng mới</h1><p>Portfolio, Casebook, Bảng giá và Kịch bản tư vấn từ Create Outcome Studio — sẵn sàng dùng để tiếp cận khách hàng.</p></div>
    </section>

    <section className="h2o-student-card">
      <header className="h2o-student-card-head"><div><span><Sparkles size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />THÀNH QUẢ TỪ CREATE</span><h2>{assets.length} thành quả</h2></div><Link href="/student/create">Mở Studio</Link></header>
      <div style={{ padding: 18 }}>
        {loading ? <p>Đang tải…</p> : !assets.length ? (
          <p style={{ color: "#8d97a6" }}>Chưa có thành quả nào — tạo Portfolio hoặc Bảng giá trong Create Studio để dùng cho tăng trưởng.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {assets.map((asset) => (
              <Link key={asset.projectId} href={`/student/create/projects/${asset.projectId}`} style={{ display: "flex", justifyContent: "space-between", padding: 12, borderRadius: 10, border: "1px solid #edf0f2", fontSize: 12, textDecoration: "none", color: "inherit" }}>
                <div><strong>{asset.title}</strong><div style={{ color: "#8d97a6", marginTop: 2 }}>{ASSET_LABEL[asset.assetType] ?? asset.assetType}</div></div>
                <em style={{ fontStyle: "normal", color: asset.status === "published" ? "#177a54" : "#a05a13" }}>{STATUS_LABEL[asset.status]}</em>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>

    <section className="h2o-student-card" style={{ marginTop: 20 }}>
      <header className="h2o-student-card-head"><div><span><Wand2 size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />CÔNG CỤ TĂNG TRƯỞNG</span><h2>Content 90 ngày &amp; Growth Campaign</h2></div></header>
      <div style={{ padding: 18, display: "grid", gap: 8 }}>
        {DEFERRED_TOOLS.map((tool) => {
          const unlocked = unlockedSlugs.has(tool.feature);
          return <div key={tool.feature} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, borderRadius: 10, border: "1px solid #edf0f2", fontSize: 12, opacity: unlocked ? 1 : 0.7 }}>
            <span>{tool.label}</span>
            {unlocked ? <Link href="/student/create/new" style={{ color: "#8875eb" }}>Mở →</Link> : <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#a05a13", fontSize: 10 }}><Lock size={12} />{tool.hint}</span>}
          </div>;
        })}
      </div>
    </section>
  </>;
}
