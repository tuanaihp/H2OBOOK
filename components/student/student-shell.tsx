"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { Bell, BookOpen, Bot, Brain, Briefcase, ChevronDown, ChevronRight, CircleUserRound, ClipboardCheck, Compass, FolderKanban, GraduationCap, Home, LibraryBig, LogOut, Menu, Search, ShoppingBag, Sparkles, TrendingUp, Trophy, UsersRound, Wand2 } from "lucide-react";
import { NeuralHeaderSignal } from "@/components/global-neural";
import { buildCompactNavigation, resolveActiveItem, toAccountRole } from "@/lib/student/compact-navigation";

// Compact Navigation Upgrade V2: HOME / LEARN / CREATE (if unlocked) / BUSINESS instead of the
// previous flat 8-item list. Group membership and unlock rules live in
// lib/student/compact-navigation.ts (buildCompactNavigation) — this component only renders it.
const GROUP_ICONS: Record<string, typeof Home> = { home: Home, learn: GraduationCap, create: FolderKanban, business: ShoppingBag, teach: ClipboardCheck };
const ITEM_ICONS: Record<string, typeof Home> = {
  "smart-home": Home, journey: GraduationCap, "learn-memory": Brain, library: LibraryBig, practice: ClipboardCheck,
  studio: Wand2, "my-projects": FolderKanban, "my-tools": Bot, store: ShoppingBag, "account-commerce": Trophy,
  "business-command": Briefcase, "business-customers": UsersRound, "business-growth": TrendingUp, "business-operations": Trophy
};

const NAV_OPEN_STATE_KEY = "h2o-student-nav-open-groups";

export function StudentShell({ children, currentUser }: { children: React.ReactNode; currentUser?: { name: string; email: string; role: string; demo: boolean } }) {
  const pathname = usePathname();
  const store = useAppStore();
  const activeStudent = store.students.find((student) => student.status === "active") ?? store.students[0];
  const studentName = currentUser && !currentUser.demo ? currentUser.name : activeStudent?.name ?? "H2O Student";
  const groups = buildCompactNavigation({ role: toAccountRole(currentUser?.role ?? "student"), subscription: "basic" });
  const flatItems = groups.flatMap((group) => group.items);
  const { itemId: activeItemId, groupId: activeGroupId } = resolveActiveItem(groups, pathname);

  // Undefined means "not decided by the user yet" and falls back to: open when this is the group
  // you are currently in, collapsed otherwise. Keeping the first render free of any stored value
  // is what makes it hydration-safe — usePathname() gives the server and the client the same
  // answer, and the remembered preferences are merged in only after mount.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(NAV_OPEN_STATE_KEY);
      if (stored) setOpenGroups((current) => ({ ...(JSON.parse(stored) as Record<string, boolean>), ...current }));
    } catch { /* private mode or corrupt value — fall back to the defaults */ }
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    try { window.localStorage.setItem(NAV_OPEN_STATE_KEY, JSON.stringify(openGroups)); }
    catch { /* nothing to do — collapsing still works for this session */ }
  }, [openGroups, preferencesLoaded]);

  // Navigating into a group always reveals it, even one the user had collapsed earlier — otherwise
  // arriving from the mobile bar, a search result or a deep link would leave the page you are on
  // hidden behind a closed group.
  useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroups((current) => (current[activeGroupId] ? current : { ...current, [activeGroupId]: true }));
  }, [activeGroupId]);

  return <div className="h2o-student-shell">
    <aside className="h2o-student-sidebar">
      <Link href="/student" className="h2o-student-brand"><span>H₂</span><div><strong>H2OBOOK</strong><small>Learning Universe</small></div></Link>
      <div className="h2o-student-profile-mini"><div>{studentName.split(" ").slice(-1)[0]?.slice(0,1) ?? "H"}</div><span><small>Học viên</small><strong>{studentName}</strong><em>{activeStudent?.progress ?? 0}% hành trình</em></span></div>
      {groups.map((group) => {
        // A one-item group (HOME) has nothing to reveal, so it stays a plain label rather than
        // becoming a control that visibly does nothing.
        const collapsible = group.items.length > 1;
        const open = collapsible ? openGroups[group.id] ?? group.id === activeGroupId : true;
        const panelId = `h2o-nav-panel-${group.id}`;
        const GroupIcon = GROUP_ICONS[group.id] ?? Compass;
        return <nav key={group.id} className="h2oc-nav-group" data-open={open} data-has-active={group.id === activeGroupId}>
          {collapsible
            ? <button type="button" className="h2oc-nav-group-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenGroups((current) => ({ ...current, [group.id]: !open }))}>
                <GroupIcon aria-hidden="true"/>
                <span>{group.label}</span>
                <em aria-hidden="true">{group.items.length}</em>
                <ChevronDown aria-hidden="true" className="h2oc-nav-group-chevron"/>
              </button>
            : <span className="h2oc-nav-group-label">{group.label}</span>}
          {/* inert keeps a collapsed group's links out of tab order and off screen readers — the
              height animation alone would leave them reachable but invisible. */}
          <div id={panelId} className="h2oc-nav-group-panel" inert={!open}>
            <div className="h2oc-nav-group-items">
              {group.items.map((item) => <Link key={item.id} href={item.href} className={cn(item.id === activeItemId ? "active" : "")} aria-current={item.id === activeItemId ? "page" : undefined}>
                {(() => { const Icon = ITEM_ICONS[item.id] ?? GROUP_ICONS[group.id] ?? Compass; return <Icon/>; })()}
                <span>{item.label}</span>
              </Link>)}
            </div>
          </div>
        </nav>;
      })}
      <div className="h2o-student-plan"><Sparkles/><div><strong>Academy Pro</strong><span>18 ngày trong hành trình</span><div><i style={{width:"68%"}}/></div></div></div>
      <div className="h2o-student-sidebar-bottom"><Link href="/academy/courses"><BookOpen/>Khám phá thêm khóa học</Link><form action="/api/auth/logout" method="post"><button type="submit"><LogOut/>Đăng xuất</button></form></div>
    </aside>
    <main className="h2o-student-main">
      <header className="h2o-student-topbar"><button className="h2o-student-mobile-menu" aria-label="Mở menu"><Menu/></button><div className="h2o-student-search"><Search/><input placeholder="Tìm bài học, sách hoặc kỹ năng..."/><kbd>⌘ K</kbd></div><NeuralHeaderSignal compact/><Link href="/student/mentor" className="h2o-student-mentor-quick"><Sparkles/>Hỏi H2O Mentor</Link><button className="h2o-student-icon-btn"><Bell/><i>2</i></button><Link href="/student/profile" className="h2o-student-user"><CircleUserRound/><span><strong>{studentName}</strong><small>Academy Student</small></span><ChevronRight/></Link></header>
      <div className="h2o-student-content">{children}</div>
    </main>
    <nav className="h2o-student-mobile-nav">{flatItems.slice(0, 5).map((item) => { const Icon = ITEM_ICONS[item.id] ?? Compass; return <Link key={item.id} href={item.href} className={cn(item.id === activeItemId ? "active" : "")} aria-current={item.id === activeItemId ? "page" : undefined}><Icon/><span>{item.label.replace(" của tôi", "").replace(" & đánh giá", "")}</span></Link>; })}</nav>
  </div>;
}
