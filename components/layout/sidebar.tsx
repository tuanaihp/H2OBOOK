"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, BookCopy, BookOpen, Boxes, Brain, ClipboardCheck, CloudCog, CreditCard, FileCheck2,
  FileQuestion, FolderOpen, GraduationCap, LibraryBig, LockKeyhole, Palette, PlugZap, Settings,
  ShieldCheck, ShoppingBag, Sparkles, Store, UserCircle, Users, WandSparkles, Workflow, Globe2,
  BadgeDollarSign, ListChecks, MessageSquareMore, HeartPulse, LayoutDashboard, Blocks, WifiOff, Import, Send, Sheet, Megaphone, Grid3X3, BotOff, Building2, BadgeCheck, LifeBuoy
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { operationsFeatures } from "@/lib/operations/feature";

const domains = [
  { id: "home", label: "Home", icon: LayoutDashboard, href: "/dashboard", links: [] },
  { id: "learn", label: "Learn", icon: GraduationCap, href: "/learn", links: [
    { href: "/learn", label: "Hành trình học", icon: GraduationCap },
    { href: "/study", label: "Ôn tập thông minh", icon: Brain },
    { href: "/knowledge", label: "Không gian tri thức", icon: LibraryBig },
    { href: "/library", label: "Thư viện học", icon: BookOpen },
    { href: "/classes", label: "Lớp học", icon: Users },
    { href: "/assignments", label: "Bài tập", icon: ClipboardCheck },
    { href: "/quizzes", label: "Quiz", icon: FileQuestion }
  ]},
  { id: "create", label: "Create", icon: WandSparkles, href: "/books", links: [
    { href: "/assets", label: "Kho tài sản", icon: FolderOpen },
    { href: "/ingestion", label: "Nhập nội dung", icon: Import },
    { href: "/blocks", label: "Block Library", icon: Blocks },
    { href: "/books", label: "Dự án sách", icon: BookOpen },
    { href: "/brand-kit", label: "Brand Kit", icon: Palette },
    { href: "/templates", label: "Template", icon: Boxes },
    { href: "/design-library", label: "Thư viện thiết kế", icon: Palette },
    { href: "/clones", label: "Brand Clone", icon: BookCopy },
    { href: "/bulk-publishing", label: "Bulk Publishing", icon: Sheet },
    { href: "/editor/book_makeup_pro", label: "H2OBOOK Studio", icon: WandSparkles },
    { href: "/content-health", label: "Preflight", icon: HeartPulse },
    { href: "/publish", label: "Publish Center", icon: Send }
  ]},
  { id: "teach", label: "Teach", icon: Users, href: "/students", links: [
    { href: "/students", label: "Học viên", icon: Users },
    { href: "/class-view", label: "Class View", icon: Grid3X3 },
    { href: "/reviews", label: "Duyệt xuất bản", icon: FileCheck2 },
    { href: "/collaboration", label: "Cộng tác", icon: MessageSquareMore },
    { href: "/automations", label: "Automation", icon: Workflow },
    { href: "/processing", label: "Document Queue", icon: ListChecks }
  ]},
  { id: "business", label: "Business", icon: Store, href: "/store", links: [
    { href: "/store", label: "Book Store", icon: Store },
    { href: "/marketplace-studio", label: "Marketplace Studio", icon: BadgeCheck },
    { href: "/orders", label: "Đơn hàng", icon: ShoppingBag },
    { href: "/membership", label: "Membership", icon: CreditCard },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/growth-reader", label: "Growth Reader", icon: Megaphone },
    { href: "/licensing", label: "Licensing", icon: BadgeDollarSign },
    { href: "/white-label", label: "White-label", icon: Globe2 }
  ]},
  { id: "system", label: "System", icon: Settings, href: "/settings", links: [
    { href: "/admin", label: "Quản trị", icon: ShieldCheck },
    ...(operationsFeatures.systemControlPlane ? [{ href: "/system", label: "System Command Center", icon: CloudCog }] : []),
    ...(operationsFeatures.operationsCenter ? [{ href: "/operations", label: "Operations Center", icon: LifeBuoy }] : []),
    { href: "/enterprise", label: "Enterprise & API", icon: Building2 },
    { href: "/integrations", label: "Tích hợp", icon: PlugZap },
    { href: "/cloud-sync", label: "Cloud Sync", icon: CloudCog },
    { href: "/offline", label: "Offline Center", icon: WifiOff },
    { href: "/security", label: "Bảo mật", icon: LockKeyhole },
    { href: "/account", label: "Tài khoản", icon: UserCircle },
    { href: "/smart-settings", label: "Smart Core", icon: Sparkles },
    { href: "/assist-control", label: "AI Policy", icon: BotOff },
    { href: "/settings", label: "Cài đặt", icon: Settings }
  ]}
];

export function Sidebar() {
  const pathname = usePathname();
  const workspace = useAppStore((state) => state.workspace);
  const smart = useAppStore((state) => state.smartSettings);
  const usage = Math.min(100, Math.round(workspace.storageUsedMb / workspace.storageLimitMb * 100));
  const activeDomain = domains.find((domain) => pathname === domain.href || domain.links.some((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))) ?? domains[0];
  return <aside className="sidebar quantum-sidebar">
    <div className="quantum-rail">
      <Link href="/dashboard" className="quantum-logo" aria-label="H2OBOOK"><span>H₂</span></Link>
      <nav>{domains.map(({ id, label, icon: Icon, href }) => <Link key={id} href={href} className={cn("quantum-rail-link", activeDomain.id === id && "active")} title={label}><Icon/><span>{label}</span></Link>)}</nav>
      <Link href="/ai-studio" className={cn("quantum-assist-link", pathname.startsWith("/ai-studio") && "active")} title="Smart Tools – AI tùy chọn"><Sparkles/><span>Smart</span><i>{smart.aiEnabled ? "AI" : "LOCAL"}</i></Link>
    </div>
    <div className="quantum-context-nav">
      <Link href="/dashboard" className="brand-logo"><div className="brand-mark">H2</div><div className="brand-word"><strong>H2OBOOK</strong><span>Editor 4.14</span></div></Link>
      <div className="context-domain-head"><span>{activeDomain.label}</span><small>{smart.aiEnabled ? "AI hỗ trợ đang bật" : "Core độc lập AI"}</small></div>
      <div className="sidebar-scroll">{activeDomain.links.length ? activeDomain.links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("nav-link", pathname === href || pathname.startsWith(`${href}/`) ? "active" : "")}><Icon/>{label}</Link>) : <div className="context-home-card"><strong>Smart Home</strong><p>Ưu tiên hôm nay, tiến độ học và các dự án đang hoạt động.</p></div>}</div>
      <div className="sidebar-bottom"><div className="plan-card"><div className="plan-title"><strong>{workspace.plan === "academy" ? "Academy Pro" : workspace.plan}</strong><span>{usage}%</span></div><p>{(workspace.storageUsedMb / 1024).toFixed(1)} GB / {(workspace.storageLimitMb / 1024).toFixed(0)} GB dung lượng</p><div className="plan-progress"><span style={{ width: `${usage}%` }}/></div><Link href="/membership">Quản lý gói</Link></div></div>
    </div>
  </aside>;
}
