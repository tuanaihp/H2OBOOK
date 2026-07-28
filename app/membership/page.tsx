"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useAppStore } from "@/store/app-store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Check, Crown, CreditCard, RefreshCw, Sparkles, Users } from "lucide-react";

const plans = [
  { id: "creator", name: "Creator", price: 299000, annual: 2990000, description: "Dành cho chuyên gia bắt đầu số hóa tài liệu.", features: ["3 sách hoạt động", "2 GB lưu trữ", "Editor & PDF import", "Reader có watermark", "100 học viên"] },
  { id: "academy", name: "Academy Pro", price: 899000, annual: 8990000, description: "Dành cho học viện đào tạo và kinh doanh membership.", featured: true, features: ["20 sách hoạt động", "25 GB lưu trữ", "Brand Clone Engine", "500 tài khoản học viên", "Bài tập, quiz & analytics"] },
  { id: "business", name: "Business White-label", price: 2499000, annual: 24990000, description: "Dành cho chuỗi học viện và hệ thống nhượng quyền.", features: ["Không giới hạn sách", "100 GB lưu trữ", "Tên miền & logo riêng", "Linked Clone nhiều đối tác", "Phân quyền và API nâng cao"] }
];

export default function MembershipPage() {
  const store = useAppStore();
  const [annual, setAnnual] = useState(false);
  const [upgradeId, setUpgradeId] = useState<string | null>(null);
  const activePlan = plans.find((item) => item.id === store.workspace.plan) ?? plans[1];
  const upgrade = plans.find((item) => item.id === upgradeId);
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">SUBSCRIPTION & ACCESS</span><h1>Membership H2OBOOK</h1><p>Quản lý gói nền tảng và subscription tài liệu của học viên.</p></div><div className="billing-toggle"><button className={!annual ? "active" : ""} onClick={() => setAnnual(false)}>Theo tháng</button><button className={annual ? "active" : ""} onClick={() => setAnnual(true)}>Theo năm <span>Tiết kiệm 2 tháng</span></button></div></div>
    <section className="current-plan-card"><div className="current-plan-icon"><Crown size={26}/></div><div><span>Gói đang sử dụng</span><h2>{activePlan.name}</h2><p>Gia hạn tiếp theo vào {formatDate(new Date(Date.now()+28*86400000).toISOString())}</p></div><div className="current-plan-usage"><span><strong>{store.books.length}/20</strong>Sách hoạt động</span><span><strong>{store.students.length}/500</strong>Học viên</span><span><strong>{(store.workspace.storageUsedMb/1024).toFixed(1)}/25 GB</strong>Lưu trữ</span></div><Link className="btn btn-secondary" href="/orders"><CreditCard size={15}/>Quản lý thanh toán</Link></section>
    <div className="membership-grid">{plans.map((plan) => <article className={`price-card ${plan.featured ? "featured" : ""}`} key={plan.id}>{plan.featured && <Badge tone="purple"><Sparkles size={12}/>Khuyên dùng</Badge>}<h3>{plan.name}</h3><p>{plan.description}</p><div className="price">{formatCurrency(annual ? plan.annual : plan.price)}</div><small>/ {annual ? "năm" : "tháng"}</small><ul className="feature-list">{plan.features.map((feature) => <li key={feature}><Check size={16}/>{feature}</li>)}</ul><button className={`btn ${store.workspace.plan === plan.id ? "btn-soft" : plan.featured ? "btn-primary" : "btn-secondary"}`} onClick={() => store.workspace.plan !== plan.id && setUpgradeId(plan.id)} disabled={store.workspace.plan === plan.id}>{store.workspace.plan === plan.id ? "Đang sử dụng" : "Chọn gói"}</button></article>)}</div>
    <section className="section-card membership-table"><div className="section-head"><div><h2>Membership học viên</h2><p>Các subscription đang cấp quyền vào thư viện nội dung.</p></div><Badge tone="success"><Users size={12}/>{store.memberships.filter((item) => item.status === "active").length} đang hoạt động</Badge></div><div className="table-responsive"><table className="data-table"><thead><tr><th>Thành viên</th><th>Gói</th><th>Chu kỳ</th><th>Giá trị</th><th>Gia hạn</th><th>Trạng thái</th></tr></thead><tbody>{store.memberships.map((item) => <tr key={item.id}><td><strong>{item.userName}</strong></td><td>{item.planName}</td><td>{item.billingInterval === "month" ? "Hàng tháng" : "Hàng năm"}</td><td>{formatCurrency(item.price)}</td><td>{formatDate(item.renewsAt)}</td><td><Badge tone={item.status === "active" ? "success" : item.status === "trial" ? "warning" : "neutral"}>{item.status === "active" ? "Hoạt động" : item.status === "trial" ? "Dùng thử" : item.status}</Badge></td></tr>)}</tbody></table></div></section>
    <Modal open={Boolean(upgrade)} onClose={() => setUpgradeId(null)} title={`Chuyển sang ${upgrade?.name ?? "gói mới"}`} description="Luồng demo cập nhật gói workspace. Production cần checkout và webhook thanh toán."><div className="upgrade-summary"><Crown size={29}/><div><strong>{upgrade?.name}</strong><span>{upgrade?.description}</span><b>{formatCurrency(annual ? upgrade?.annual ?? 0 : upgrade?.price ?? 0)} / {annual ? "năm" : "tháng"}</b></div></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setUpgradeId(null)}>Hủy</button><button className="btn btn-primary" onClick={() => { if (upgrade) store.updateWorkspace({ plan: upgrade.id as "creator" | "academy" | "business", storageLimitMb: upgrade.id === "creator" ? 2048 : upgrade.id === "academy" ? 25600 : 102400 }); setUpgradeId(null); }}><RefreshCw size={15}/>Xác nhận nâng cấp</button></div></Modal>
  </AppShell>;
}
