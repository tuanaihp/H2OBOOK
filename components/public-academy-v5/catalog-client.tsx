"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Layers3, Search, SlidersHorizontal } from "lucide-react";
import { formatVnd } from "@/lib/public-site/content";
import type { PublicAcademyCatalogItem } from "@/lib/public-academy-v5/types";
import { TrackedLink } from "@/components/public-home-v3/tracked-link";
import styles from "./public-academy-v5.module.css";

const allLabel = "Tất cả";

export function AcademyCatalogClient({
  items,
  kind,
  placeholder,
}: {
  items: PublicAcademyCatalogItem[];
  kind: "book" | "course" | "strategy";
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(allLabel);

  const categories = useMemo(
    () => [allLabel, ...Array.from(new Set(items.map((item) => item.category)))],
    [items],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    return items.filter((item) => {
      const matchesCategory = category === allLabel || item.category === category;
      const haystack = [item.title, item.subtitle, item.category, item.level, ...item.tags]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("vi");
      return matchesCategory && (!normalized || haystack.includes(normalized));
    });
  }, [category, items, query]);

  return <>
    <div className={styles.toolbar}>
      <label className={styles.searchField}>
        <Search aria-hidden="true" />
        <span className={styles.srOnly}>Tìm kiếm</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} />
      </label>
      <div className={styles.filters} aria-label="Lọc theo danh mục">
        {categories.slice(0, 6).map((item) => <button
          type="button"
          key={item}
          className={category === item ? styles.activeFilter : undefined}
          aria-pressed={category === item}
          onClick={() => setCategory(item)}
        >{item}</button>)}
        {categories.length > 6 && <span className={styles.moreFilter}><SlidersHorizontal aria-hidden="true" />{categories.length - 6} nhóm khác</span>}
      </div>
    </div>

    {/* The grid was rendered unconditionally, so a search with no matches left its empty container
        sitting above the message — a blank block where the results used to be. It is skipped
        entirely now, and the empty state takes its place rather than following it. */}
    {filtered.length > 0 && <div className={kind === "book" ? styles.bookGrid : kind === "course" ? styles.courseGrid : styles.strategyGrid}>
      {filtered.map((item, index) => kind === "book"
        ? <BookCard key={item.id} item={item} index={index} />
        : kind === "course"
          ? <CourseCard key={item.id} item={item} />
          : <StrategyCard key={item.id} item={item} />)}
    </div>}

    {!filtered.length && <div className={styles.emptyState}>
      <strong>Chưa tìm thấy nội dung phù hợp.</strong>
      <p>Hãy đổi từ khóa hoặc chọn một nhóm khác.</p>
      <button type="button" onClick={() => { setQuery(""); setCategory(allLabel); }}>Xóa bộ lọc</button>
    </div>}
  </>;
}

function BookCard({ item, index }: { item: PublicAcademyCatalogItem; index: number }) {
  return <TrackedLink href={item.href} className={styles.bookCard} section="academy-books" action="open-book" resourceType="book" resourceId={item.slug}>
    <div className={styles.bookCover} style={{ background: item.accent }}>
      <span>{item.category}</span>
      <small>H2OBOOK · {String(index + 1).padStart(2, "0")}</small>
      <h2>{item.title}</h2>
      <i />
    </div>
    <div className={styles.bookBody}>
      <strong>{item.title}</strong>
      <p>{item.subtitle}</p>
      <div className={styles.metricRow}>{item.metrics.map((metric) => <span key={metric.label}>{metric.value} {metric.label.toLocaleLowerCase("vi")}</span>)}</div>
      {typeof item.price === "number" && <b>{formatVnd(item.price)}</b>}
    </div>
  </TrackedLink>;
}

function CourseCard({ item }: { item: PublicAcademyCatalogItem }) {
  return <article className={`${styles.courseCard} ${item.featured ? styles.featuredCard : ""}`}>
    <div className={styles.courseAura} style={{ background: item.accent }} />
    <div className={styles.courseMeta}><span>{item.category}</span><span>{item.level}</span></div>
    <h2>{item.title}</h2>
    <p>{item.subtitle}</p>
    <div className={styles.courseMetrics}>{item.metrics.map((metric, index) => <span key={metric.label}>{index === 0 ? <Clock3 aria-hidden="true" /> : <Layers3 aria-hidden="true" />}<b>{metric.value}</b> {metric.label}</span>)}</div>
    <ul>{item.outcomes.slice(0, 3).map((outcome) => <li key={outcome}><CheckCircle2 aria-hidden="true" />{outcome}</li>)}</ul>
    <footer>
      {typeof item.price === "number" && <strong>{formatVnd(item.price)}</strong>}
      <TrackedLink href={item.href} section="academy-courses" action="open-course" resourceType="product" resourceId={item.slug}>Xem chi tiết <ArrowRight aria-hidden="true" /></TrackedLink>
    </footer>
  </article>;
}

function StrategyCard({ item }: { item: PublicAcademyCatalogItem }) {
  return <TrackedLink href={item.href} className={styles.strategyCard} section="academy-strategies" action="open-strategy" resourceType="product" resourceId={item.slug}>
    <span className={styles.strategyTag} style={{ background: item.accent }}>{item.category}</span>
    <h2>{item.title}</h2>
    <p>{item.subtitle}</p>
    <div className={styles.tagRow}>{item.tags.slice(0, 3).map((tag) => <small key={tag}>{tag}</small>)}</div>
    <footer><span><Clock3 aria-hidden="true" />{item.metrics[0]?.value ?? "12"} phút đọc</span><ArrowRight aria-hidden="true" /></footer>
  </TrackedLink>;
}
