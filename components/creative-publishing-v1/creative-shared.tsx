"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Archive, Blocks, BookCopy, BookOpen, Boxes, CheckCircle2, FileCheck2, FolderOpen,
  GitBranch, Import, LayoutTemplate, Palette, Send, Sheet, Sparkles, WandSparkles
} from "lucide-react";
import { creativeSurfaceRegistry } from "@/lib/creative-publishing-v1/registry";
import type { CreativeSurface } from "@/lib/creative-publishing-v1/types";
import styles from "./creative-publishing-v1.module.css";

const icons = {
  assets: FolderOpen,
  ingestion: Import,
  blocks: Blocks,
  books: BookOpen,
  "brand-kit": Palette,
  templates: Boxes,
  "design-library": LayoutTemplate,
  clones: BookCopy,
  "bulk-publishing": Sheet,
  editor: WandSparkles,
  "content-health": FileCheck2,
  publish: Send,
} satisfies Record<CreativeSurface, typeof FolderOpen>;

export function CreativePageFrame({
  active,
  eyebrow,
  title,
  description,
  actions,
  metrics,
  children,
}: {
  active: CreativeSurface;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  metrics?: Array<{ label: string; value: string | number; detail?: string }>;
  children: ReactNode;
}) {
  return <div className={styles.page}>
    <CreativePipeline active={active}/>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </header>
    {metrics?.length ? <div className={styles.metrics}>{metrics.map((metric) => <article key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span>{metric.detail ? <small>{metric.detail}</small> : null}</article>)}</div> : null}
    {children}
  </div>;
}

export function CreativePipeline({ active }: { active: CreativeSurface }) {
  const activeDefinition = creativeSurfaceRegistry.find((item) => item.id === active);
  return <section className={styles.pipeline} aria-label="Luồng Creative Publishing">
    <div className={styles.pipelineTitle}><Sparkles/><div><strong>Creative Publishing Core</strong><span>Asset → Content → Design → Quality → Publish</span></div><em>{activeDefinition?.stage ?? 1}/12</em></div>
    <div className={styles.pipelineScroll}>{creativeSurfaceRegistry.map((item) => {
      const Icon = icons[item.id];
      return <Link key={item.id} href={item.previewRoute} className={item.id === active ? styles.pipelineActive : styles.pipelineItem} title={item.label}>
        <span><Icon/></span><small>{item.shortLabel}</small>
      </Link>;
    })}</div>
  </section>;
}

export function SurfaceCard({ title, description, icon, children, tone = "light" }: { title: string; description?: string; icon?: ReactNode; children: ReactNode; tone?: "light" | "dark" | "gradient" }) {
  return <section className={`${styles.card} ${styles[`tone_${tone}`]}`}>
    <div className={styles.cardHead}>{icon ? <span className={styles.cardIcon}>{icon}</span> : null}<div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div></div>
    {children}
  </section>;
}

export function EmptyPanel({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className={styles.empty}><Archive/><strong>{title}</strong><p>{description}</p>{action}</div>;
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  return <span className={`${styles.pill} ${styles[`pill_${tone}`]}`}>{tone === "success" ? <CheckCircle2/> : tone === "warning" ? <GitBranch/> : null}{children}</span>;
}

export { styles };
