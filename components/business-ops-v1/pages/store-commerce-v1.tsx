"use client";

import { useMemo, useState } from "react";
import { CreditCard, Eye, Plus, ShoppingBag, Users, Copy, Search } from "lucide-react";
import { demoProducts } from "@/lib/business-ops-v1/data";
import { emitBusinessEvent } from "@/lib/business-ops-v1/events";
import type { DemoProduct } from "@/lib/business-ops-v1/types";
import { BusinessPageHeader, BusinessPipelineBar, Metric, Panel, StatusBadge, formatVnd } from "../business-ops-shared";
import styles from "../business-ops-v1.module.css";

export function StoreCommerceV1() {
  const [products, setProducts] = useState(demoProducts);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const filtered = useMemo(() => products.filter((product) => (type === "all" || product.type === type) && product.name.toLowerCase().includes(query.toLowerCase())), [products, query, type]);
  const revenue = products.reduce((sum, product) => sum + product.revenue, 0);
  const createDraft = () => {
    const product: DemoProduct = { id: crypto.randomUUID(), name: "Sản phẩm mới", type: "book", price: 0, sales: 0, revenue: 0, status: "draft", cover: "linear-gradient(135deg,#21354d,#69d5df)", description: "Bản nháp mới cần hoàn thiện dữ liệu và quyền truy cập." };
    setProducts((current) => [product, ...current]);
    emitBusinessEvent({ name: "business_action_clicked", surface: "store", action: "create_product", entityId: product.id });
  };
  return <div className={styles.surface}><BusinessPageHeader eyebrow="COMMERCE & PRODUCT CATALOG" title="H2OBOOK Store" description="Một catalog thống nhất cho sách, template, membership, combo và quyền cấp phép." actions={<><button className={styles.secondaryButton}><Eye/>Xem trang public</button><button className={styles.primaryButton} onClick={createDraft}><Plus/>Tạo sản phẩm</button></>}/><BusinessPipelineBar active="store"/><div className={styles.metricGrid}><Metric label="Lượt bán" value={String(products.reduce((sum, item) => sum + item.sales, 0))} note="Tất cả sản phẩm" icon={<ShoppingBag/>}/><Metric label="Doanh thu tích lũy" value={formatVnd(revenue)} note="Trước hoàn tiền" icon={<CreditCard/>} tone="blue"/><Metric label="Membership active" value="2" note="Entitlement định kỳ" icon={<Users/>} tone="success"/><Metric label="Quyền clone" value="3" note="License đã cấp" icon={<Copy/>} tone="warning"/></div><Panel title="Knowledge Commerce Catalog" description="Mỗi sản phẩm phải trỏ tới một nguồn nội dung, mức giá và entitlement policy."><div className={styles.toolbar}><label><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm sản phẩm..."/></label><div>{["all","book","template","membership","bundle"].map((item) => <button key={item} onClick={() => setType(item)} className={type === item ? styles.filterActive : ""}>{item === "all" ? "Tất cả" : item}</button>)}</div></div><div className={styles.productGrid}>{filtered.map((product) => <article className={styles.productCard} key={product.id}><div className={styles.productCover} style={{ background: product.cover }}><small>{product.type.toUpperCase()}</small><strong>{product.name}</strong></div><div className={styles.productBody}><div className={styles.rowBetween}><StatusBadge status={product.status}/><small>{product.sales} lượt bán</small></div><h3>{product.name}</h3><p>{product.description}</p><strong className={styles.price}>{formatVnd(product.price)}</strong><button className={styles.primaryButton} onClick={() => emitBusinessEvent({ name: "business_checkout_started", surface: "store", action: "preview_checkout", entityId: product.id })}><ShoppingBag/>Mua thử sản phẩm</button></div></article>)}</div></Panel></div>;
}
