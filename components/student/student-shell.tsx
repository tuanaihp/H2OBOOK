"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { Bell, BookOpen, Bot, ChevronRight, CircleUserRound, ClipboardCheck, Compass, GraduationCap, Home, LibraryBig, LogOut, Menu, Palette, Search, Sparkles, Trophy } from "lucide-react";
import { NeuralHeaderSignal } from "@/components/global-neural";

const nav = [
  { href: "/student", label: "Tổng quan", icon: Home },
  { href: "/student/courses", label: "Khóa học của tôi", icon: GraduationCap },
  { href: "/student/library", label: "Thư viện", icon: LibraryBig },
  { href: "/student/assignments", label: "Bài tập thực hành", icon: ClipboardCheck },
  { href: "/student/design-library", label: "Thiết kế của tôi", icon: Palette },
  { href: "/student/roadmap", label: "Lộ trình nghề", icon: Compass },
  { href: "/student/mentor", label: "H2O Mentor", icon: Bot },
  { href: "/student/profile", label: "Hồ sơ & thành tựu", icon: Trophy }
];

export function StudentShell({ children, currentUser }: { children: React.ReactNode; currentUser?: { name: string; email: string; role: string; demo: boolean } }) {
  const pathname = usePathname();
  const store = useAppStore();
  const activeStudent = store.students.find((student) => student.status === "active") ?? store.students[0];
  const studentName = currentUser && !currentUser.demo ? currentUser.name : activeStudent?.name ?? "H2O Student";
  return <div className="h2o-student-shell">
    <aside className="h2o-student-sidebar">
      <Link href="/student" className="h2o-student-brand"><span>H₂</span><div><strong>H2OBOOK</strong><small>Learning Universe</small></div></Link>
      <div className="h2o-student-profile-mini"><div>{studentName.split(" ").slice(-1)[0]?.slice(0,1) ?? "H"}</div><span><small>Học viên</small><strong>{studentName}</strong><em>{activeStudent?.progress ?? 0}% hành trình</em></span></div>
      <nav>{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn(pathname === href || (href !== "/student" && pathname.startsWith(`${href}/`)) ? "active" : "")}><Icon/><span>{label}</span>{href === "/student/mentor" && <i>AI</i>}</Link>)}</nav>
      <div className="h2o-student-plan"><Sparkles/><div><strong>Academy Pro</strong><span>18 ngày trong hành trình</span><div><i style={{width:"68%"}}/></div></div></div>
      <div className="h2o-student-sidebar-bottom"><Link href="/academy/courses"><BookOpen/>Khám phá thêm khóa học</Link><form action="/api/auth/logout" method="post"><button type="submit"><LogOut/>Đăng xuất</button></form></div>
    </aside>
    <main className="h2o-student-main">
      <header className="h2o-student-topbar"><button className="h2o-student-mobile-menu" aria-label="Mở menu"><Menu/></button><div className="h2o-student-search"><Search/><input placeholder="Tìm bài học, sách hoặc kỹ năng..."/><kbd>⌘ K</kbd></div><NeuralHeaderSignal compact/><Link href="/student/mentor" className="h2o-student-mentor-quick"><Sparkles/>Hỏi H2O Mentor</Link><button className="h2o-student-icon-btn"><Bell/><i>2</i></button><Link href="/student/profile" className="h2o-student-user"><CircleUserRound/><span><strong>{studentName}</strong><small>Academy Student</small></span><ChevronRight/></Link></header>
      <div className="h2o-student-content">{children}</div>
    </main>
    <nav className="h2o-student-mobile-nav">{nav.slice(0,5).map(({href,label,icon:Icon}) => <Link key={href} href={href} className={cn(pathname === href ? "active" : "")}><Icon/><span>{label.replace(" của tôi","").replace(" thực hành","")}</span></Link>)}</nav>
  </div>;
}
