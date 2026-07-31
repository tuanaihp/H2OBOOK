"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Brain,
  ClipboardCheck,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  Network,
  Workflow,
  Table2,
  MessagesSquare,
  ServerCog,
  BadgeCheck,
  UsersRound
} from "lucide-react";
import styles from "./academic-ops.module.css";

const routes = [
  ["dashboard", "Tổng quan", LayoutDashboard],
  ["learn", "Hành trình học", GraduationCap],
  ["knowledge", "Knowledge Space", Network],
  ["library", "Thư viện", LibraryBig],
  ["assignments", "Bài tập", ClipboardCheck],
  ["classes", "Lớp học", BookOpen],
  ["quizzes", "Quiz", FileQuestion],
  ["study", "Ôn tập", Brain],
  ["class-view", "Class View", Table2],
  ["students", "Học viên", UsersRound],
  ["reviews", "Duyệt sách", BadgeCheck],
  ["collaboration", "Cộng tác", MessagesSquare],
  ["automations", "Automation", Workflow],
  ["processing", "Xử lý", ServerCog]
] as const;

export function AcademicOpsFlowBar() {
  const pathname = usePathname();
  const preview = pathname.startsWith("/academic-ops-v2-preview");
  return (
    <nav className={styles.flowBar} aria-label="Academic Operations V2">
      {routes.map(([route, label, Icon]) => {
        const href = preview ? `/academic-ops-v2-preview/${route}` : `/${route}`;
        return (
        <Link key={href} href={href} data-active={pathname === href}>
          <Icon size={14}/>{label}
        </Link>
        );
      })}
    </nav>
  );
}

export function IntelligenceHeader(props: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className={styles.intelligenceHeader}>
      <div>
        <span className={styles.eyebrow}>{props.eyebrow}</span>
        <h1>{props.title}</h1>
        <p>{props.description}</p>
      </div>
      {props.actions ? <div className={styles.headerActions}>{props.actions}</div> : null}
    </header>
  );
}

export function MetricGrid({ items }: { items: Array<{ label: string; value: string; note: string }> }) {
  return (
    <section className={styles.metricGrid}>
      {items.map((item) => (
        <article className={styles.metricCard} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.note}</small>
        </article>
      ))}
    </section>
  );
}
