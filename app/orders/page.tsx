"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { useAppStore } from "@/store/app-store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CheckCircle2, CircleDollarSign, Clock3, CreditCard, MoreHorizontal, Search, ShoppingBag, XCircle } from "lucide-react";

export default function OrdersPage() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const orders = useMemo(() => store.orders.filter((order) => (status === "all" || order.paymentStatus === status) && `${order.orderCode} ${order.customerName} ${order.customerEmail} ${order.productName}`.toLowerCase().includes(query.toLowerCase())), [store.orders, query, status]);
  const detail = store.orders.find((item) => item.id === detailId);
  const paid = store.orders.filter((item) => item.paymentStatus === "paid");
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">ORDER & ENTITLEMENT</span><h1>Đơn hàng</h1><p>Xác nhận thanh toán, cấp quyền sách và theo dõi nguồn doanh thu.</p></div></div>
    <section className="metric-grid"><MetricCard label="Tổng đơn" value={String(store.orders.length)} note="Tất cả kênh bán" icon={ShoppingBag}/><MetricCard label="Đã thanh toán" value={String(paid.length)} note={formatCurrency(paid.reduce((sum, item) => sum + item.total, 0))} icon={CheckCircle2} tone="success"/><MetricCard label="Chờ thanh toán" value={String(store.orders.filter((item) => item.paymentStatus === "pending").length)} note="Chưa cấp entitlement" icon={Clock3} tone="warning"/><MetricCard label="Giá trị trung bình" value={formatCurrency(paid.reduce((sum, item) => sum + item.total, 0) / Math.max(1, paid.length))} note="Trên đơn đã thanh toán" icon={CircleDollarSign} tone="blue"/></section>
    <section className="section-card"><div className="table-toolbar"><div className="search-box compact"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã đơn, khách hàng, sản phẩm..."/></div><select className="select compact-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="pending">Chờ thanh toán</option><option value="paid">Đã thanh toán</option><option value="failed">Thất bại</option><option value="refunded">Hoàn tiền</option></select></div><div className="table-responsive"><table className="data-table"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Thanh toán</th><th>Giá trị</th><th>Ngày tạo</th><th>Trạng thái</th><th/></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.orderCode}</strong></td><td><div className="table-user"><span className="mini-avatar">{order.customerName.split(" ").slice(-2).map((part) => part[0]).join("")}</span><span><strong>{order.customerName}</strong><small>{order.customerEmail}</small></span></div></td><td>{order.productName}</td><td><span className="payment-method"><CreditCard size={14}/>{order.paymentMethod === "bank_transfer" ? "Chuyển khoản" : order.paymentMethod === "qr" ? "QR" : order.paymentMethod === "card" ? "Thẻ" : "Thủ công"}</span></td><td><strong>{formatCurrency(order.total)}</strong></td><td>{formatDate(order.createdAt)}</td><td>{order.paymentStatus === "paid" ? <Badge tone="success"><CheckCircle2 size={12}/>Đã thanh toán</Badge> : order.paymentStatus === "pending" ? <Badge tone="warning"><Clock3 size={12}/>Chờ thanh toán</Badge> : <Badge tone="neutral"><XCircle size={12}/>{order.paymentStatus}</Badge>}</td><td><div className="row-actions">{order.paymentStatus === "pending" && <button className="btn btn-soft btn-sm" onClick={() => store.updateOrderStatus(order.id, "paid")}><CheckCircle2 size={13}/>Xác nhận</button>}<button className="icon-btn" title="Chi tiết đơn" onClick={() => setDetailId(order.id)}><MoreHorizontal size={15}/></button></div></td></tr>)}</tbody></table></div></section>

    <Modal open={Boolean(detail)} onClose={() => setDetailId(null)} title={detail?.orderCode ?? "Chi tiết đơn hàng"} description={detail ? `${detail.customerName} • ${detail.customerEmail}` : ""}><div className="order-detail"><div><span>Sản phẩm</span><strong>{detail?.productName}</strong></div><div><span>Giá trị</span><strong>{formatCurrency(detail?.total ?? 0)}</strong></div><div><span>Phương thức</span><strong>{detail?.paymentMethod}</strong></div><div><span>Ngày tạo</span><strong>{detail ? formatDate(detail.createdAt) : ""}</strong></div></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setDetailId(null)}>Đóng</button>{detail?.paymentStatus === "pending" && <button className="btn btn-primary" onClick={() => store.updateOrderStatus(detail.id, "paid")}><CheckCircle2 size={15}/>Xác nhận thanh toán</button>}{detail?.paymentStatus === "paid" && <button className="btn btn-danger" onClick={() => store.updateOrderStatus(detail.id, "refunded")}><XCircle size={15}/>Đánh dấu hoàn tiền</button>}</div></Modal>
  </AppShell>;
}
