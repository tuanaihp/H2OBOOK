"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Crown, ShieldCheck, Store } from "lucide-react";

type Order = { id: string; orderCode: string; total: number; currency: string; paymentStatus: string; orderStatus: string; createdAt: string };
type Membership = { id: string; planName: string; status: string; startsAt: string; expiresAt: string | null };
type Entitlement = { id: string; resourceType: string; permission: string; expiresAt: string | null };

function formatVnd(value: number, currency: string) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: currency || "VND", maximumFractionDigits: 0 }).format(value);
}
function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function BusinessOperationsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/business/operations");
      const json = await res.json();
      if (res.ok) { setOrders(json.orders ?? []); setMembership(json.membership ?? null); setEntitlements(json.entitlements ?? []); }
      setLoading(false);
    })();
  }, []);

  return <>
    <section className="h2o-student-page-head">
      <div><span>QUYỀN LỢI &amp; VẬN HÀNH</span><h1>Đơn hàng, membership và quyền truy cập của bạn</h1><p>Chỉ hiển thị dữ liệu của riêng bạn — không phải doanh thu hay đơn hàng của người khác.</p></div>
      <Link href="/academy/courses" className="h2o-student-primary"><Store size={16} />Knowledge Store</Link>
    </section>

    <div className="h2o-student-dashboard-grid">
      <section className="h2o-student-card">
        <header className="h2o-student-card-head"><div><span><Crown size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />MEMBERSHIP</span><h2>{membership ? membership.planName : "Chưa có membership"}</h2></div></header>
        <div style={{ padding: 18, fontSize: 12, color: "#354152" }}>
          {membership ? <>
            <p>Trạng thái: <strong>{membership.status}</strong></p>
            <p>Bắt đầu: {formatDate(membership.startsAt)}</p>
            {membership.expiresAt && <p>Hết hạn: {formatDate(membership.expiresAt)}</p>}
          </> : <p style={{ color: "#8d97a6" }}>Nâng cấp membership để mở thêm công cụ kinh doanh — quyền mua lẻ vẫn được giữ nguyên dù membership hết hạn.</p>}
        </div>
      </section>

      <section className="h2o-student-card">
        <header className="h2o-student-card-head"><div><span><ShieldCheck size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />QUYỀN TRUY CẬP</span><h2>{entitlements.length} quyền đang hoạt động</h2></div></header>
        <div style={{ padding: 18 }}>
          {!entitlements.length ? <p style={{ color: "#8d97a6" }}>Chưa có quyền mua lẻ nào.</p> : (
            <div style={{ display: "grid", gap: 6 }}>{entitlements.slice(0, 6).map((e) => <div key={e.id} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}><span>{e.resourceType} · {e.permission}</span>{e.expiresAt && <em style={{ fontStyle: "normal", color: "#8d97a6" }}>đến {formatDate(e.expiresAt)}</em>}</div>)}</div>
          )}
        </div>
      </section>
    </div>

    <section className="h2o-student-card" style={{ marginTop: 20 }}>
      <header className="h2o-student-card-head"><div><span><CreditCard size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />ĐƠN HÀNG CỦA TÔI</span><h2>{orders.length} đơn</h2></div></header>
      <div style={{ padding: 18 }}>
        {loading ? <p>Đang tải…</p> : !orders.length ? <p style={{ color: "#8d97a6" }}>Chưa có đơn hàng nào.</p> : (
          <div style={{ display: "grid", gap: 8 }}>
            {orders.map((order) => (
              <div key={order.id} style={{ display: "flex", justifyContent: "space-between", padding: 10, borderRadius: 10, border: "1px solid #edf0f2", fontSize: 12 }}>
                <div><strong>{order.orderCode}</strong><div style={{ color: "#8d97a6", marginTop: 2 }}>{formatDate(order.createdAt)}</div></div>
                <div style={{ textAlign: "right" }}><strong>{formatVnd(order.total, order.currency)}</strong><div style={{ color: order.paymentStatus === "paid" ? "#177a54" : "#a05a13", marginTop: 2 }}>{order.paymentStatus}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  </>;
}
