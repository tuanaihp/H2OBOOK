"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BookCopy, BookOpen, Check, Copy, GitBranch, Plus, Search, Send, Sparkles } from "lucide-react";
import type { CloneMode } from "@/types/domain";

export default function TemplatesPage() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [cloneTemplateId, setCloneTemplateId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState(store.activeBrandId);
  const [mode, setMode] = useState<CloneMode>("linked");
  const [partner, setPartner] = useState("");
  const categories = ["Tất cả", ...Array.from(new Set(store.templates.map((item) => item.category)))];
  const filtered = useMemo(() => store.templates.filter((item) => (category === "Tất cả" || item.category === category) && `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [store.templates, category, query]);
  const activeTemplate = store.templates.find((item) => item.id === cloneTemplateId);
  const createClone = () => { if (!cloneTemplateId) return; const clone = store.cloneTemplate(cloneTemplateId, brandId, mode, partner.trim() || undefined); if (clone) { setCloneTemplateId(null); window.location.href = `/editor/${clone.targetBookId}`; } };
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">TEMPLATE OPERATING SYSTEM</span><h1>Kho template sách</h1><p>Thiết kế khóa thành phần, Smart Fields và nhân bản theo thương hiệu.</p></div><div className="header-actions"><Link href="/books" className="btn btn-secondary"><Plus size={16}/>Tạo template từ sách</Link><Link href="/clones" className="btn btn-primary"><GitBranch size={16}/>Trung tâm Clone</Link></div></div>
    <div className="filter-tabs">{categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <section className="section-card"><div className="table-toolbar"><div className="search-box compact"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm template theo ngành, tên sách..."/></div><Badge tone="purple">{filtered.length} template</Badge></div><div className="section-body"><div className="template-grid-v2">{filtered.map((template) => <article className="template-card-v2" key={template.id}><div className="template-cover-v2" style={{ background: template.cover }}><div className="template-cover-top"><Badge tone={template.status === "published" ? "success" : "warning"}>{template.status === "published" ? "Đã phát hành" : "Bản nháp"}</Badge><span>v{template.version}</span></div><div><small>H2OBOOK MASTER TEMPLATE</small><h3>{template.name}</h3></div></div><div className="template-body-v2"><p>{template.description}</p><div className="template-stats"><span><strong>{template.pageCount}</strong> trang</span><span><strong>{template.cloneCount}</strong> clone</span><span><strong>{formatCurrency(template.price)}</strong></span></div><div className="template-tags"><span>{template.category}</span>{template.allowLinkedClone && <span><GitBranch size={11}/>Linked Clone</span>}<span>Cập nhật {formatDate(template.updatedAt)}</span></div><div className="template-actions"><Link className="btn btn-secondary btn-sm" href={`/reader/${template.sourceBookId}`}><BookOpen size={14}/>Xem mẫu</Link><button className="btn btn-primary btn-sm" onClick={() => setCloneTemplateId(template.id)}><Copy size={14}/>Tạo bản thương hiệu</button></div>{template.status === "draft" && <button className="publish-template-link" onClick={() => store.publishTemplateVersion(template.id)}><Send size={13}/>Phát hành template</button>}</div></article>)}</div></div></section>
    <Modal open={Boolean(activeTemplate)} onClose={() => setCloneTemplateId(null)} title={`Clone: ${activeTemplate?.name ?? "Template"}`} description="Hệ thống sẽ sao chép sách, tự điền Brand Profile và áp dụng quyền khóa layer.">
      <div className="clone-wizard"><label className="field"><span>Brand Profile</span><select className="select" value={brandId} onChange={(event) => setBrandId(event.target.value)}>{store.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><label className="field"><span>Tên đối tác</span><input className="input" value={partner} onChange={(event) => setPartner(event.target.value)} placeholder="Để trống sẽ dùng tên Brand Profile"/></label><div className="clone-mode-grid"><button className={mode === "linked" ? "active" : ""} onClick={() => setMode("linked")}><span className="mode-icon"><GitBranch size={20}/></span><strong>Linked Clone</strong><p>Nhận cập nhật từ template gốc, có đối chiếu xung đột.</p>{mode === "linked" && <Check size={16}/>}</button><button className={mode === "independent" ? "active" : ""} onClick={() => setMode("independent")}><span className="mode-icon"><BookCopy size={20}/></span><strong>Independent Clone</strong><p>Bản sao độc lập, không nhận cập nhật từ master.</p>{mode === "independent" && <Check size={16}/>}</button></div></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setCloneTemplateId(null)}>Hủy</button><button className="btn btn-primary" onClick={createClone}><Sparkles size={15}/>Tạo sách và mở Studio</button></div>
    </Modal>
  </AppShell>;
}
