"use client";

import Link from "next/link";
import { BookOpen, Boxes, Copy, GitBranch, Plus, Search, Send, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { CreativePageFrame, StatusPill, SurfaceCard, styles } from "../creative-shared";

export function TemplateLibraryV1() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const filtered = useMemo(() => store.templates.filter((item) => (category === "all" || item.category === category) && `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [store.templates, category, query]);
  const categories = Array.from(new Set(store.templates.map((item) => item.category)));

  const clone = (templateId: string) => {
    const brandId = store.activeBrandId || store.brands[0]?.id;
    if (!brandId) return;
    const cloneRecord = store.cloneTemplate(templateId, brandId, "linked");
    if (cloneRecord) window.location.href = `/editor/${cloneRecord.targetBookId}`;
  };

  return <CreativePageFrame active="templates" eyebrow="TEMPLATE OPERATING SYSTEM" title="Kho template sách" description="Template có version, Smart Fields, layer locks và clone policy." actions={<><Link className={styles.secondaryButton} href="/books"><Plus/>Tạo template từ sách</Link><Link className={styles.primaryButton} href="/creative-publishing-v1-preview/clones"><GitBranch/>Trung tâm Clone</Link></>} metrics={[
    { label: "Template", value: store.templates.length },
    { label: "Đã phát hành", value: store.templates.filter((item) => item.status === "published").length },
    { label: "Bản nháp", value: store.templates.filter((item) => item.status === "draft").length },
    { label: "Clone", value: store.clones.length },
  ]}>
    <SurfaceCard title="Template Registry" description="Lọc theo ngành, trạng thái và khả năng Linked Clone." icon={<Boxes/>}>
      <div className={styles.toolbar}><label className={styles.search}><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm template theo ngành, tên sách..."/></label><select className={styles.select} value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Tất cả ngành</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
      <div className={styles.templateGrid}>{filtered.map((template) => <article key={template.id} className={styles.templateCard}><div className={styles.templateCover} style={{ background: template.cover }}><StatusPill tone={template.status === "published" ? "success" : "warning"}>{template.status === "published" ? "Đã phát hành" : "Bản nháp"}</StatusPill><em>v{template.version}</em><small>H2OBOOK MASTER TEMPLATE</small><h3>{template.name}</h3></div><div className={styles.templateBody}><p>{template.description}</p><div className={styles.templateStats}><span><strong>{template.pageCount}</strong> trang</span><span><strong>{template.cloneCount}</strong> clone</span><span><strong>{template.price.toLocaleString("vi-VN")} đ</strong></span></div><div className={styles.inlineBadges}><StatusPill>{template.category}</StatusPill>{template.allowLinkedClone ? <StatusPill tone="info"><GitBranch/>Linked Clone</StatusPill> : null}</div><div className={styles.templateActions}><Link href={`/reader/${template.sourceBookId}`}><BookOpen/>Xem mẫu</Link><button onClick={() => clone(template.id)}><Copy/>Tạo bản thương hiệu</button></div>{template.status === "draft" ? <button className={styles.publishLink} onClick={() => store.publishTemplateVersion(template.id)}><Send/>Phát hành template</button> : null}</div></article>)}</div>
    </SurfaceCard>
    <SurfaceCard title="Template Quality Gate" description="Chỉ template đạt preflight và có clone policy mới được phát hành." tone="dark" icon={<Sparkles/>}>
      <div className={styles.inlineBadges}><StatusPill tone="success">Smart Fields</StatusPill><StatusPill tone="success">Layer Permissions</StatusPill><StatusPill tone="success">Brand Fallback</StatusPill><StatusPill tone="warning">Version Notes</StatusPill></div>
    </SurfaceCard>
  </CreativePageFrame>;
}
