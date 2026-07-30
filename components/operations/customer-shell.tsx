"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { customerRoutes } from "@/lib/operations/routes";
import styles from "./operations.module.css";

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className={styles.customerShell}>
    <header className={styles.customerTop}><Link href="/customer" className={styles.brand}><span className={styles.brandMark}>H₂</span><div><strong>H2OBOOK</strong><small>Admissions Portal</small></div></Link><nav className={styles.customerNav}>{customerRoutes.map((item) => <Link key={item.href} href={item.href} data-active={pathname === item.href}>{item.label}</Link>)}</nav></header>
    <main className={styles.customerMain}>{children}</main>
  </div>;
}
