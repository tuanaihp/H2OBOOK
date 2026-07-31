"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, ReceiptText, Search, ShieldCheck } from "lucide-react";
import { demoOrders } from "@/lib/business-ops-v1/data";
import { emitBusinessEvent } from "@/lib/business-ops-v1/events";
import type { DemoOrder } from "@/lib/business-ops-v1/types";
import { BusinessPageHeader, BusinessPipelineBar, Metric, Panel, StatusBadge, formatVnd } from "../business-ops-shared";
import styles from "../business-ops-v1.module.css";

export function OrdersEntitlementsV1() {
  const [orders, setOrders] = useState(demoOrders);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => orders.filter((order) => `${order.code} ${order.customer} ${order.product}`.toLowerCase().includes(query.toLowerCase())), [orders, query]);
  const confirm = (id: string) => {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, payment: "paid", entitlement: "granted" } : order));
    emitBusinessEvent({ name: "business_payment_confirmed", surface: "orders", action: "manual_confirm", entityId: id });
    emitBusinessEvent({ name: "business_entitlement_granted", surface: "orders", action: "grant_access", entityId: id });
  };
  const paid = orders.filter((order) => order.payment === "paid");
  return <div className={styles.surface}><BusinessPageHeader eyebrow="ORDER, PAYMENT & ENTITLEMENT" title="Đơn hàng" description="Một trạng thái duy nhất từ checkout tới payment, entitlement và nguồn doanh thu."/><BusinessPipelineBar active="orders"/><div className={styles.metricGrid}><Metric label="Tổng đơn" value={String(orders.length)} note="Tất cả kênh bán" icon={<ReceiptText/>}/><Metric label="Đã thanh toán" value={String(paid.length)} note={formatVnd(paid.reduce((sum, order) => sum + order.total, 0))} icon={<CheckCircle2/>} tone="success"/><Metric label="Chờ thanh toán" value={String(orders.filter((order) => order.payment === "pending").length)} note="Chưa cấp entitlement" icon={<Clock3/>} tone="warning"/><Metric label="Đã cấp quyền" value={String(orders.filter((order) => order.entitlement === "granted").length)} note="Idempotent access" icon={<ShieldCheck/>} tone="blue"/></div><Panel title="Order Registry" description="Payment webhook và xác nhận thủ công phải cùng đi qua một idempotency key."><div className={styles.toolbar}><label><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã đơn, khách hàng, sản phẩm..."/></label></div><div className={styles.tableWrap}><table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Thanh toán</th><th>Giá trị</th><th>Trạng thái</th><th>Quyền</th><th/></tr></thead><tbody>{filtered.map((order) => <tr key={order.id}><td><strong>{order.code}</strong><small>{order.createdAt}</small></td><td><strong>{order.customer}</strong><small>{order.email}</small></td><td>{order.product}</td><td>{order.method}</td><td><strong>{formatVnd(order.total)}</strong></td><td><StatusBadge status={order.payment}/></td><td><StatusBadge status={order.entitlement}/></td><td>{order.payment === "pending" ? <button className={styles.softButton} onClick={() => confirm(order.id)}>Xác nhận</button> : <span className={styles.doneText}>Hoàn tất</span>}</td></tr>)}</tbody></table></div></Panel></div>;
}
