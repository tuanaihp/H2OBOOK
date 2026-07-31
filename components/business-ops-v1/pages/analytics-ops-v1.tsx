"use client";

import { useMemo, useState } from "react";
import { Activity, Download, Eye, MousePointerClick, RefreshCw, ShoppingCart, Users } from "lucide-react";
import { demoOrders, demoProducts } from "@/lib/business-ops-v1/data";
import { BusinessPageHeader, BusinessPipelineBar, Metric, Panel, formatVnd } from "../business-ops-shared";
import styles from "../business-ops-v1.module.css";

const baseDaily = [12,18,16,29,24,37,42,36,51,48,66,58,73,69];

export function AnalyticsOpsV1() {
  const [refreshCount, setRefreshCount] = useState(0);
  const daily = useMemo(() => baseDaily.map((value, index) => value + ((index + refreshCount) % 4)), [refreshCount]);
  const purchases = demoOrders.filter((order) => order.payment === "paid").length;
  const revenue = demoProducts.reduce((sum, product) => sum + product.revenue, 0);
  const max = Math.max(...daily);
  const exportCsv = () => {
    const rows = [["Ngày","Page views"], ...daily.map((value, index) => [`D${index + 1}`, String(value)])];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "h2obook-business-analytics.csv"; link.click(); URL.revokeObjectURL(url);
  };
  return <div className={styles.surface}><BusinessPageHeader eyebrow="LIVE BUSINESS INTELLIGENCE" title="Analytics từ hành vi thật" description="Một event contract chung cho reader, lead, checkout, purchase, entitlement, MRR và royalty." actions={<><button className={styles.secondaryButton} onClick={() => setRefreshCount((value) => value + 1)}><RefreshCw/>Làm mới</button><button className={styles.secondaryButton} onClick={exportCsv}><Download/>Xuất CSV</button></>}/><BusinessPipelineBar active="analytics"/><div className={styles.metricGrid}><Metric label="Người đọc" value="184" note="Anonymous ID duy nhất" icon={<Users/>}/><Metric label="Lượt xem trang" value={String(daily.reduce((sum, value) => sum + value, 0))} note="Event page_viewed" icon={<Eye/>} tone="blue"/><Metric label="Lead" value="37" note="Growth Reader" icon={<MousePointerClick/>} tone="warning"/><Metric label="Mua hàng" value={String(purchases)} note={formatVnd(revenue)} icon={<ShoppingCart/>} tone="success"/></div><div className={styles.analyticsGrid}><Panel title="Lượt xem theo ngày" description="Event chống ghi trùng bằng event ID." icon={<Activity/>} className={styles.analyticsWide}><div className={styles.chartBars}>{daily.map((value, index) => <div key={index}><span style={{ height: `${value / max * 100}%` }}/><small>{index + 1}</small></div>)}</div></Panel><Panel title="Phễu chuyển đổi" description="Từ reader tới entitlement."><div className={styles.funnel}>{[["Mở Reader",184],["Qua lead gate",76],["Bấm CTA",42],["Checkout",18],["Purchase",purchases],["Cấp quyền",2]].map(([label,value]) => <div key={String(label)}><span><strong>{value}</strong>{label}</span><i><b style={{ width: `${Number(value) / 184 * 100}%` }}/></i></div>)}</div></Panel><Panel title="Doanh thu theo nguồn" description="Attribution từ store, membership và licensing." className={styles.analyticsWide}><div className={styles.revenueSources}><article><strong>{formatVnd(123900000)}</strong><span>Store trực tiếp</span></article><article><strong>{formatVnd(43654000)}</strong><span>Membership</span></article><article><strong>{formatVnd(39890000)}</strong><span>Licensing</span></article><article><strong>{formatVnd(2520000)}</strong><span>Royalty pending</span></article></div></Panel></div></div>;
}
