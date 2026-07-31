"use client";

import { useMemo, useState } from "react";
import { BookOpen, ExternalLink, Flag, LayoutTemplate, Search, Settings2, Tags } from "lucide-react";
import { productConfigurationItems } from "@/lib/system-governance-ops-v2/data";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { Panel, SystemPageHeader } from "../system-shared";
import { OperationsStatus } from "../operations-shared";
import styles from "../system-governance-ops-v2.module.css";

const icons = { public_academy: LayoutTemplate, catalog: BookOpen, pricing: Tags, seo: Search, feature_flag: Flag };

export function OperationsProductConfigV2() {
  const [query, setQuery] = useState("");
  const publicItems = useMemo(() => productConfigurationItems.filter((item) => item.group !== "feature_flag" && item.label.toLowerCase().includes(query.toLowerCase())), [query]);
  const flags = productConfigurationItems.filter((item) => item.group === "feature_flag");
  const open = (id: string) => emitSystemEvent("operations_product_config_opened", { configId: id });
  return <>
    <SystemPageHeader eyebrow="H2OBOOK OPERATIONS" title="Product Configuration" description="Quản trị nội dung public site, catalog, giá, CTA, SEO và feature flags mà không sửa code." actions={<button className={styles.primaryButton}><Settings2/> Mở cấu hình</button>}/>
    <div className={styles.opsToolbar}><label className={styles.opsSearch}><Search/><input value={query} onChange={(event: { target: { value: string } }) => setQuery(event.target.value)} placeholder="Tìm cấu hình..."/></label></div>
    <Panel title="Public Academy" description="Hero, sách nổi bật, khóa học, Strategy Hub, membership và SEO." icon={<Settings2/>}><div className={styles.configList}>{publicItems.map((item) => { const Icon = icons[item.group]; return <button key={item.id} onClick={() => open(item.id)}><span className={styles.opsIconBox}><Icon/></span><span><strong>{item.label}</strong><small>{item.description} · cập nhật {item.updatedAt}</small></span><OperationsStatus status={item.status === "active" ? "active" : "draft"}/><ExternalLink/></button>; })}</div></Panel>
    <Panel title="Feature Flags" description="Bật/tắt an toàn, có fallback và audit; không rollback database." icon={<Flag/>}><div className={styles.configList}>{flags.map((item) => <button key={item.id} onClick={() => open(item.id)}><span className={styles.opsIconBox}><Flag/></span><span><strong>{item.label}</strong><small>{item.description} · cập nhật {item.updatedAt}</small></span><OperationsStatus status={item.status === "active" ? "active" : "draft"}/><ExternalLink/></button>)}</div></Panel>
  </>;
}
