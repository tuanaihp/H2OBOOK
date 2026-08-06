"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bell, LayoutDashboard, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./operations.module.css";

export type SimpleShellRoute = { href: string; label: string; icon: LucideIcon };

export function SimpleOperationsShell({ title, subtitle, homeHref, routes, children, accentLabel }: { title: string; subtitle: string; homeHref: string; routes: SimpleShellRoute[]; children: React.ReactNode; accentLabel: string }) {
  const pathname = usePathname();
  const router = useRouter();
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      {/* Every SimpleOperationsShell caller sets homeHref to its own sub-app's root — /academy-admin,
          /instructor, /platform-admin, /system — never to the main workspace. So the brand link
          above already returns to "home" in one sense, but there was no way out of the sub-app
          back to /dashboard itself, which is the gap this row closes. Browser back and "về
          Dashboard" are offered together because they answer different questions: back undoes the
          last click (useful mid-flow, e.g. after opening a program's detail page), while Dashboard
          is a fixed escape hatch that works even as the very first click after landing here from an
          external link, when there is no in-app history to go back to. */}
      <div className={styles.shellBackRow}>
        <button type="button" onClick={() => router.back()} aria-label="Quay lại trang trước"><ArrowLeft size={14}/>Quay lại</button>
        <Link href="/dashboard" aria-label="Về Dashboard chính"><LayoutDashboard size={14}/>Dashboard</Link>
      </div>
      <Link href={homeHref} className={styles.brand}><span className={styles.brandMark}>H₂</span><div><strong>{title}</strong><small>{subtitle}</small></div></Link>
      <span className={styles.navTitle}>{accentLabel}</span>
      <nav className={styles.nav}>{routes.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-active={pathname === href || (href !== homeHref && pathname.startsWith(`${href}/`))}><Icon/><span>{label}</span></Link>)}</nav>
      <div className={styles.sidebarBottom}><strong>{accentLabel}</strong><p>Không gian được giới hạn theo vai trò và nhiệm vụ thực tế.</p></div>
    </aside>
    <main className={styles.main}><header className={styles.topbar}><div className={styles.topbarLabel}><span><Sparkles size={16}/></span><div><strong>{title}</strong><small>{subtitle}</small></div></div><div className={styles.topbarActions}><button className={styles.iconButton} aria-label="Thông báo"><Bell size={17}/></button><div className={styles.userPill}><i>H₂</i><div><strong>H2OBOOK User</strong><small>{accentLabel}</small></div></div></div></header><div className={styles.content}>{children}</div></main>
  </div>;
}
