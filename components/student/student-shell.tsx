"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { Bell, BookOpen, Bot, ChevronRight, CircleUserRound, ClipboardCheck, Compass, FolderKanban, GraduationCap, Home, LibraryBig, LogOut, Menu, Search, ShoppingBag, Sparkles, Trophy } from "lucide-react";
import { NeuralHeaderSignal } from "@/components/global-neural";
import { buildCompactNavigation, toAccountRole } from "@/lib/student/compact-navigation";

// Compact Navigation Upgrade V2: HOME / LEARN / CREATE (if unlocked) / BUSINESS instead of the
// previous flat 8-item list. Group membership and unlock rules live in
// lib/student/compact-navigation.ts (buildCompactNavigation) — this component only renders it.
const GROUP_ICONS: Record<string, typeof Home> = { home: Home, learn: GraduationCap, create: FolderKanban, business: ShoppingBag, teach: ClipboardCheck };
const ITEM_ICONS: Record<string, typeof Home> = {
  "smart-home": Home, journey: GraduationCap, library: LibraryBig, practice: ClipboardCheck,
  "my-projects": FolderKanban, "my-tools": Bot, store: ShoppingBag, "account-commerce": Trophy
};

export function StudentShell({ children, currentUser }: { children: React.ReactNode; currentUser?: { name: string; email: string; role: string; demo: boolean } }) {
  const pathname = usePathname();
  const store = useAppStore();
  const activeStudent = store.students.find((student) => student.status === "active") ?? store.students[0];
  const studentName = currentUser && !currentUser.demo ? currentUser.name : activeStudent?.name ?? "H2O Student";
  const groups = buildCompactNavigation({ role: toAccountRole(currentUser?.role ?? "student"), subscription: "basic" });
  const flatItems = groups.flatMap((group) => group.items);

  return <div className="h2o-student-shell">
    <aside className="h2o-student-sidebar">
      <Link href="/student" className="h2o-student-brand"><span>H₂</span><div><strong>H2OBOOK</strong><small>Learning Universe</small></div></Link>
      <div className="h2o-student-profile-mini"><div>{studentName.split(" ").slice(-1)[0]?.slice(0,1) ?? "H"}</div><span><small>Học viên</small><strong>{studentName}</strong><em>{activeStudent?.progress ?? 0}% hành trình</em></span></div>
      {groups.map((group) => <nav key={group.id} className="h2oc-nav-group"><span className="h2oc-nav-group-label">{group.label}</span>
        {group.items.map((item) => <Link key={item.id} href={item.href} className={cn(pathname === item.href || pathname.startsWith(`${item.href}/`) ? "active" : "")}>
          {(() => { const Icon = ITEM_ICONS[item.id] ?? GROUP_ICONS[group.id] ?? Compass; return <Icon/>; })()}
          <span>{item.label}</span>
        </Link>)}
      </nav>)}
      <div className="h2o-student-plan"><Sparkles/><div><strong>Academy Pro</strong><span>18 ngày trong hành trình</span><div><i style={{width:"68%"}}/></div></div></div>
      <div className="h2o-student-sidebar-bottom"><Link href="/academy/courses"><BookOpen/>Khám phá thêm khóa học</Link><form action="/api/auth/logout" method="post"><button type="submit"><LogOut/>Đăng xuất</button></form></div>
    </aside>
    <main className="h2o-student-main">
      <header className="h2o-student-topbar"><button className="h2o-student-mobile-menu" aria-label="Mở menu"><Menu/></button><div className="h2o-student-search"><Search/><input placeholder="Tìm bài học, sách hoặc kỹ năng..."/><kbd>⌘ K</kbd></div><NeuralHeaderSignal compact/><Link href="/student/mentor" className="h2o-student-mentor-quick"><Sparkles/>Hỏi H2O Mentor</Link><button className="h2o-student-icon-btn"><Bell/><i>2</i></button><Link href="/student/profile" className="h2o-student-user"><CircleUserRound/><span><strong>{studentName}</strong><small>Academy Student</small></span><ChevronRight/></Link></header>
      <div className="h2o-student-content">{children}</div>
    </main>
    <nav className="h2o-student-mobile-nav">{flatItems.slice(0, 5).map((item) => { const Icon = ITEM_ICONS[item.id] ?? Compass; return <Link key={item.id} href={item.href} className={cn(pathname === item.href ? "active" : "")}><Icon/><span>{item.label.replace(" của tôi", "").replace(" & đánh giá", "")}</span></Link>; })}</nav>
  </div>;
}
