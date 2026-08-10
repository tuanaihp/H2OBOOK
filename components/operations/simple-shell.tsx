"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Bell, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./operations.module.css";

export type SimpleShellRoute = { href: string; label: string; icon: LucideIcon };

export function SimpleOperationsShell({ title, subtitle, homeHref, routes, children, accentLabel }: { title: string; subtitle: string; homeHref: string; routes: SimpleShellRoute[]; children: React.ReactNode; accentLabel: string }) {
  const pathname = usePathname();
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      {/* Was router.back() + a separate "Dashboard" link: browser back stepped through whatever the
          user had clicked inside this sub-app, which read as "quay lại lịch sử" (stepping back
          through history) rather than "leaving" it — the user wants one click out to the main
          workspace regardless of how deep they navigated in here. One fixed link now, not two. */}
      <div className={styles.shellBackRow}>
        <Link href="/dashboard" aria-label="Về Dashboard chính"><ArrowLeft size={14}/>Quay lại</Link>
      </div>
      <Link href={homeHref} className={styles.brand}><span className={styles.brandMark}>H₂</span><div><strong>{title}</strong><small>{subtitle}</small></div></Link>
      <span className={styles.navTitle}>{accentLabel}</span>
      <nav className={styles.nav}>{routes.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-active={pathname === href || (href !== homeHref && pathname.startsWith(`${href}/`))}><Icon/><span>{label}</span></Link>)}</nav>
      <div className={styles.sidebarBottom}><strong>{accentLabel}</strong><p>Không gian được giới hạn theo vai trò và nhiệm vụ thực tế.</p></div>
    </aside>
    <main className={styles.main}><header className={styles.topbar}><div className={styles.topbarLabel}><span><Sparkles size={16}/></span><div><strong>{title}</strong><small>{subtitle}</small></div></div><div className={styles.topbarActions}><button className={styles.iconButton} aria-label="Thông báo"><Bell size={17}/></button><div className={styles.userPill}><i>H₂</i><div><strong>H2OBOOK User</strong><small>{accentLabel}</small></div></div></div></header><div className={styles.content}>{children}</div></main>
  </div>;
}
