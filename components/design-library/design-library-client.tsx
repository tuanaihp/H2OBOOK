"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Award, BadgePercent, BookOpenCheck, Facebook, FileUp, Filter, HardDrive, LayoutTemplate, Search, Sparkles, Trash2, UserRound, WandSparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { buildDesignBook } from "@/lib/design-library/build-design-book";
import { buildBulkDesignBooks } from "@/lib/design-library/bulk";
import { convertPolotnoToTemplate, isH2ODesignPack, isPolotnoDesign, parseDesignPack } from "@/lib/design-library/external-templates";
import { DESIGN_CATEGORY_LABELS, DESIGN_LIBRARY_CATALOG } from "@/lib/design-library/catalog";
import type { DesignCategory, DesignStyle, DesignTemplateDefinition } from "@/types/design-library";
import { DesignTemplatePreview } from "./design-template-preview";
import { DesignConfigurator, type DesignCreatePayload } from "./design-configurator";
import styles from "./design-library.module.css";

const categories: Array<{ key: "all" | DesignCategory; label: string; icon: typeof LayoutTemplate }> = [
  { key: "all", label: "Tất cả", icon: LayoutTemplate },
  { key: "fanpage-cover", label: "Cover Fanpage", icon: Facebook },
  { key: "personal-profile", label: "Profile Makeup", icon: UserRound },
  { key: "student-invitation", label: "Thiệp mời học viên", icon: BookOpenCheck },
  { key: "makeup-certificate", label: "Bằng tốt nghiệp", icon: Award },
  { key: "makeup-promotion", label: "Khuyến mãi", icon: BadgePercent }
];

const styleLabels: Record<DesignStyle, string> = {
  "future-luxe": "AI Future Luxe",
  "clean-editorial": "Clean Editorial",
  "soft-glow": "Soft Beauty Glow",
  "burgundy-signature": "Burgundy Signature",
  "monochrome-fashion": "Monochrome Fashion",
  "academy-prestige": "Academy Prestige",
  "flash-sale-energy": "Flash Sale Energy"
};

function StorageQuotaIndicator() {
  const [quota, setQuota] = useState<{ usedBytes: number; limitBytes: number | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/storage/quota").then((response) => response.ok ? response.json() : null).then((data) => { if (!cancelled && data) setQuota(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  if (!quota || quota.limitBytes === null) return null;
  const usedMb = quota.usedBytes / (1024 * 1024);
  const limitMb = quota.limitBytes / (1024 * 1024);
  const percent = Math.min(100, Math.round((quota.usedBytes / quota.limitBytes) * 100));
  return <div className={styles.quotaBadge}>
    <HardDrive size={16}/>
    <div>
      <span>{usedMb.toFixed(0)} MB / {limitMb.toFixed(0)} MB đã dùng</span>
      <div className={styles.quotaBar}><i style={{ width: `${percent}%` }} data-full={percent >= 90}/></div>
    </div>
  </div>;
}

export function DesignLibraryClient({ variant = "workspace" }: { variant?: "workspace" | "student" } = {}) {
  const store = useAppStore();
  const [category, setCategory] = useState<"all" | DesignCategory>("all");
  const [style, setStyle] = useState<"all" | DesignStyle>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DesignTemplateDefinition | null>(null);
  const [sort, setSort] = useState<"recommended" | "trend" | "name">("recommended");
  const [notice, setNotice] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  // Pull optional site-hosted packs once per mount — missing files just mean no extra templates.
  useEffect(() => {
    let cancelled = false;
    fetch("/template-packs/index.json").then((response) => response.ok ? response.json() : null)
      .then((index: { files?: string[] } | null) => Promise.all((index?.files ?? []).map((file) => fetch(`/template-packs/${file}`).then((response) => response.ok ? response.json() : null).catch(() => null))))
      .then((packs) => {
        if (cancelled) return;
        const { templates, warnings } = packs.reduce((acc, pack) => {
          const parsed = parseDesignPack(pack);
          acc.templates.push(...parsed.templates); acc.warnings.push(...parsed.warnings);
          return acc;
        }, { templates: [] as DesignTemplateDefinition[], warnings: [] as string[] });
        if (templates.length) store.importDesignTemplates(templates);
        if (warnings.length) setNotice(warnings.join(" "));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catalog = useMemo(() => [...store.customDesignTemplates, ...DESIGN_LIBRARY_CATALOG], [store.customDesignTemplates]);

  const importTemplateFile = async (file: File) => {
    setNotice("");
    try {
      const json = JSON.parse(await file.text());
      const result = isH2ODesignPack(json)
        ? parseDesignPack(json)
        : isPolotnoDesign(json)
          ? convertPolotnoToTemplate(json, file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "))
          : { templates: [], warnings: ["Định dạng chưa hỗ trợ — dùng file .h2odesign.json (xuất từ Studio) hoặc Polotno JSON."] };
      const count = store.importDesignTemplates(result.templates);
      setNotice(count
        ? `Đã nhập ${count} mẫu${result.warnings.length ? ` — lưu ý: ${result.warnings.join(" ")}` : ""}`
        : `Không có mẫu hợp lệ — ${result.warnings.join(" ") || "file trống."}`);
    } catch {
      setNotice("Không đọc được file — JSON không hợp lệ.");
    }
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = catalog.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (style !== "all" && item.style !== style) return false;
      if (!normalized) return true;
      return `${item.name} ${item.description} ${item.subcategory} ${item.tags.join(" ")}`.toLowerCase().includes(normalized);
    });
    return [...list].sort((a, b) => {
      if (sort === "trend") return (b.trendScore ?? 0) - (a.trendScore ?? 0);
      if (sort === "name") return a.name.localeCompare(b.name, "vi");
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (b.trendScore ?? 0) - (a.trendScore ?? 0);
    });
  }, [catalog, category, style, query, sort]);

  const createDesign = (payload: DesignCreatePayload) => {
    if (!selected) return;
    if (payload.bulkRows?.length) {
      const books = buildBulkDesignBooks({
        rows: payload.bulkRows,
        template: selected,
        brand: payload.brand,
        defaultValues: payload.values,
        targetFormat: payload.targetFormat,
        useBrandKit: payload.useBrandKit
      });
      books.forEach((book) => store.upsertBook(book));
      setSelected(null);
      window.location.href = "/books";
      return;
    }
    const { book } = buildDesignBook({
      template: selected,
      brand: payload.brand,
      values: payload.values,
      targetFormat: payload.targetFormat,
      useBrandKit: payload.useBrandKit
    });
    if (payload.targetBookId && store.appendPagesToBook(payload.targetBookId, book.pages)) {
      setSelected(null);
      window.location.href = `/editor/${payload.targetBookId}`;
      return;
    }
    store.upsertBook(book);
    window.location.href = `/editor/${book.id}`;
  };

  // /student/* pages already render inside StudentShell via app/student/layout.tsx,
  // so the student variant renders unwrapped here to avoid nesting the shell twice.
  const Shell = variant === "student" ? ({ children }: { children: React.ReactNode }) => <>{children}</> : AppShell;
  const isStudent = variant === "student";

  return <Shell>
    <div className={styles.library}>
      <section className={styles.hero}>
        <div className={styles.heroGlow}/><div className={styles.heroGrid}/>
        <div className={styles.heroCopy}>
          <span><WandSparkles size={16}/>H2O MAKEUP DESIGN SYSTEM</span>
          <h1>{isStudent ? "Thiết kế riêng của bạn" : "Thư viện thiết kế dành riêng cho nghề Makeup"}</h1>
          <p>{isStudent ? "Tự tạo cover, profile, thiệp và bằng riêng của bạn từ mẫu có sẵn — lưu vào tài khoản cá nhân và mở trực tiếp trong Editor." : "Tạo cover Fanpage, profile cá nhân, thiệp mời học viên, bằng tốt nghiệp và chương trình khuyến mãi — đồng bộ Brand Kit và mở trực tiếp trong Editor."}</p>
          <div className={styles.heroActions}><button onClick={() => setCategory("fanpage-cover")}><Sparkles size={17}/>Khám phá mẫu nổi bật</button>{!isStudent && <Link href="/brand-kit"><LayoutTemplate size={17}/>Cập nhật Brand Kit</Link>}</div>
          {isStudent && <StorageQuotaIndicator/>}
        </div>
        <div className={styles.heroStats}>
          <article><strong>{catalog.length}</strong><span>Mẫu Makeup chuyên biệt</span></article>
          <article><strong>5</strong><span>Nhóm thiết kế cốt lõi</span></article>
          <article><strong>1-click</strong><span>Áp dụng Brand Kit</span></article>
          {!isStudent && <article><strong>Bulk</strong><span>Tạo bằng/thiệp hàng loạt</span></article>}
        </div>
      </section>

      <nav className={styles.categoryNav} aria-label="Nhóm thiết kế">{categories.map((item) => { const Icon = item.icon; return <button key={item.key} className={category === item.key ? styles.activeCategory : ""} onClick={() => setCategory(item.key)}><Icon size={18}/><span>{item.label}</span></button>; })}</nav>

      <section className={styles.toolbar}>
        <div className={styles.search}><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mẫu: cô dâu, khóa nâng cao, flash sale..."/></div>
        <label><Filter size={16}/><select value={style} onChange={(event) => setStyle(event.target.value as "all" | DesignStyle)}><option value="all">Tất cả phong cách</option>{Object.entries(styleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="recommended">Đề xuất</option><option value="trend">Điểm trend</option><option value="name">Tên A–Z</option></select></label>
        <button className={styles.importButton} onClick={() => importRef.current?.click()}><FileUp size={16}/>Nhập mẫu</button>
        <input ref={importRef} hidden type="file" accept=".json,.h2odesign.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importTemplateFile(file); event.target.value = ""; }}/>
        <span>{filtered.length} mẫu</span>
      </section>

      {notice && <p className={styles.importNotice} role="status">{notice}</p>}

      <section className={styles.templateGrid}>{filtered.map((template) => <article className={styles.templateCard} key={template.id}>
        <button className={styles.previewButton} onClick={() => setSelected(template)} aria-label={`Chọn mẫu ${template.name}`}><DesignTemplatePreview template={template}/></button>
        <div className={styles.cardBody}>
          <div className={styles.cardTitle}><div><small>{DESIGN_CATEGORY_LABELS[template.category]} • {template.subcategory}</small><h2>{template.name}</h2></div>{template.featured && <span>NỔI BẬT</span>}{template.source === "imported" && <span className={styles.importedBadge}>NHẬP NGOÀI</span>}</div>
          <p>{template.description}</p>
          <div className={styles.tags}>{template.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>
          <div className={styles.cardFooter}><div><strong>{template.trendScore ?? 0}</strong><span>Trend score</span></div><div><strong>{template.supportedFormats.length}</strong><span>Kích thước</span></div>{!isStudent && template.bulkCapable && <div><strong>CSV</strong><span>Hàng loạt</span></div>}{template.source === "imported" && <button className={styles.deleteButton} aria-label={`Xóa mẫu ${template.name}`} onClick={() => { if (window.confirm(`Xóa mẫu "${template.name}" khỏi thư viện?`)) store.removeCustomDesignTemplate(template.id); }}><Trash2 size={14}/></button>}<button onClick={() => setSelected(template)}>Dùng mẫu</button></div>
        </div>
      </article>)}</section>

      {selected && <DesignConfigurator template={selected} brands={store.brands} activeBrandId={store.activeBrandId} books={store.books} onClose={() => setSelected(null)} onCreate={createDesign} allowBulk={!isStudent}/>}
    </div>
  </Shell>;
}
