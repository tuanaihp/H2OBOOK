"use client";
import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

type Kind = "included" | "premium_resource" | "course" | "membership";
type Item = {
  id: string; kind: Kind; title: string; subtitle: string | null; reason: string; currentGap: string | null;
  benefits: string[]; priceLabel: string | null; ctaLabel: string; href: string;
};

const KIND_LABEL: Record<Kind, string> = { included: "HỌC NGAY", premium_resource: "TÀI LIỆU NÂNG CAO", course: "KHÓA HỌC PHÙ HỢP", membership: "MEMBERSHIP" };

function fireEvent(eventName: string, itemId: string, kind: string) {
  fetch("/api/student/growth/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventName, itemId, kind }) }).catch(() => {});
}

/** v5/32-.../components/growth/GrowthRecommendations.tsx, ported onto the h2o-sr-* card language already shared by Smart Roadmap/Mission Workspace instead of a separate visual system. */
export function GrowthRecommendations({ items }: { items: Item[] }) {
  useEffect(() => { for (const item of items) fireEvent("growth.recommendation.viewed", item.id, item.kind); }, [items]);
  if (!items.length) return null;
  return <section className="h2o-student-section" style={{ marginTop: 24 }}>
    <header><div><span>H2O GROWTH RECOMMENDATIONS</span><h2>Bạn muốn tiến nhanh hơn ở đâu?</h2><p style={{ fontSize: 12, color: "#718092", margin: "4px 0 0" }}>Gợi ý dựa trên Stage, Journey và quyền hiện tại của bạn — tư vấn học tiếp trước, bán hàng sau.</p></div></header>
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", marginTop: 16 }}>
      {items.map((item) => <article key={item.id} className="h2o-sr-panel" style={{ padding: 16 }}>
        <div className="h2o-sr-eyebrow">{KIND_LABEL[item.kind]}</div>
        <h3 style={{ margin: "6px 0 2px", fontSize: 15 }}>{item.title}</h3>
        {item.subtitle && <p style={{ fontSize: 12, color: "#718092", margin: 0 }}>{item.subtitle}</p>}
        <div className="h2o-sr-insight" style={{ marginTop: 10 }}>{item.reason}</div>
        {item.currentGap && <p style={{ fontSize: 11, color: "#b7791f", marginTop: 8 }}>Hiện tại: {item.currentGap}</p>}
        {item.benefits.length > 0 && <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
          {item.benefits.map((b) => <li key={b} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12 }}><CheckCircle2 size={13} color="#12a67a" style={{ marginTop: 1, flexShrink: 0 }} /> {b}</li>)}
        </ul>}
        {item.priceLabel && <p style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>{item.priceLabel}</p>}
        <Link href={item.href} onClick={() => { fireEvent("growth.recommendation.clicked", item.id, item.kind); if (item.kind === "membership") fireEvent("growth.membership_compare.opened", item.id, item.kind); }}
          className={`h2o-sr-btn${item.kind === "membership" ? " primary" : ""}`} style={{ display: "block", textAlign: "center", marginTop: 12, textDecoration: "none" }}>
          {item.ctaLabel}
        </Link>
      </article>)}
    </div>
  </section>;
}
