"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Bell, CircleHelp, Sparkles } from "lucide-react";
import { operationsRoutes } from "@/lib/operations/routes";
import styles from "./operations.module.css";

export function OperationsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      {/* See the identical row in SimpleOperationsShell — one fixed link to /dashboard, not
          router.back() through in-app history. */}
      <div className={styles.shellBackRow}>
        <Link href="/dashboard" aria-label="Về Dashboard chính"><ArrowLeft size={14}/>Quay lại</Link>
      </div>
      <Link href="/operations" className={styles.brand}><span className={styles.brandMark}>H₂</span><div><strong>H2OBOOK OPS</strong><small>Business Command</small></div></Link>
      <span className={styles.navTitle}>Operations Centers</span>
      <nav className={styles.nav}>{operationsRoutes.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-active={pathname === href || (href !== "/operations" && pathname.startsWith(`${href}/`))}><Icon/><span>{label}</span></Link>)}</nav>
      <div className={styles.sidebarBottom}><strong>Neural Operations Core</strong><p>CRM, hỗ trợ, phê duyệt, thông báo và automation dùng chung một lớp vận hành.</p></div>
    </aside>
    <main className={styles.main}>
      <header className={styles.topbar}><div className={styles.topbarLabel}><span><Sparkles size={16}/></span><div><strong>Operations Intelligence</strong><small>Local-first · AI tùy chọn</small></div></div><div className={styles.topbarActions}><button className={styles.iconButton} aria-label="Trợ giúp"><CircleHelp size={17}/></button><button className={styles.iconButton} aria-label="Thông báo"><Bell size={17}/></button><div className={styles.userPill}><i>TH</i><div><strong>Thuỷ H2O</strong><small>Workspace Owner</small></div></div></div></header>
      <div className={styles.content}>{children}</div>
    </main>
  </div>;
}
