"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { formatCurrency } from "@/lib/utils";
import { ArrowRight, BookCopy, BookOpen, Brain, CheckCircle2, CircleDollarSign, Clock3, CloudCog, FileCheck2, GraduationCap, HeartPulse, ListChecks, LockKeyhole, Plus, Sparkles, Target, Users, WandSparkles } from "lucide-react";
import { H2OBrainCore } from "@/components/brand/h2o-brain-core";

export default function DashboardPage() {
  const store = useAppStore();
  const paidRevenue = store.orders.filter((order) => order.paymentStatus === "paid").reduce((sum, order) => sum + order.total, 0);
  const activeStudents = store.students.filter((student) => student.status === "active").length;
  const dueCards = store.flashcards.filter((card) => new Date(card.nextReviewAt).getTime() <= Date.now()).length;
  const pendingGrades = store.assignments.reduce((sum, item) => sum + Math.max(0, item.submissionCount - item.gradedCount), 0);
  const pendingReviews = store.reviews.filter((review) => review.status === "in_review" || review.status === "changes_requested").length;
  const todayPriorities = [
    { label: `Ôn ${dueCards} flashcard đến hạn`, note: "Smart Core local", href: "/study", icon: Brain, tone: "aqua" },
    { label: `Phản hồi ${pendingGrades} bài thực hành`, note: "Giảng viên duyệt", href: "/assignments", icon: CheckCircle2, tone: "violet" },
    { label: `Xử lý ${pendingReviews} bản duyệt`, note: "Workflow xuất bản", href: "/reviews", icon: FileCheck2, tone: "rose" }
  ];
  return <AppShell>
    <section className="quantum-dashboard-hero">
      <div className="hero-copy"><span className="eyebrow">H2OBOOK PROFESSIONAL EDITOR 4.14</span><h1>Chào {store.workspace.ownerName}.<br/><em>Hôm nay mình tiếp tục điều gì?</em></h1><p>Một không gian thống nhất để tạo sách, học, dạy và kinh doanh. AI là tùy chọn; nền tảng cốt lõi luôn hoạt động độc lập.</p><div className="hero-actions"><Link href="/books" className="btn btn-primary"><Plus size={17}/>Tạo sách mới</Link><Link href="/learn" className="btn btn-secondary"><GraduationCap size={17}/>Tiếp tục học</Link></div></div>
      <div className="hero-intelligence-card"><div className="intelligence-orb"><H2OBrainCore rings={false}/></div><div><small>SMART CORE STATUS</small><strong>{store.smartSettings.aiEnabled ? "AI hỗ trợ đang bật" : "Local-first · 0 token"}</strong><p>Editor, Reader, Quiz, Flashcard, Search, Preflight và Store sẵn sàng.</p></div><Link href="/smart-settings">Thiết lập <ArrowRight size={13}/></Link></div>
    </section>

    <section className="smart-metric-grid dashboard-metrics">
      <article><span><BookOpen/></span><div><strong>{store.books.filter((book) => !book.archivedAt).length}</strong><small>Sách đang quản lý</small></div><i>{store.books.filter((book) => book.status === "published").length} published</i></article>
      <article><span><Users/></span><div><strong>{activeStudents}</strong><small>Học viên hoạt động</small></div><i>{store.classes.filter((item) => item.status === "active").length} lớp</i></article>
      <article><span><Target/></span><div><strong>{Math.round(store.learningGoals.reduce((sum, goal) => sum + goal.progress, 0) / Math.max(1, store.learningGoals.length))}%</strong><small>Tiến độ mục tiêu</small></div><i>{dueCards} thẻ ôn</i></article>
      <article><span><CircleDollarSign/></span><div><strong>{formatCurrency(paidRevenue)}</strong><small>Doanh thu ghi nhận</small></div><i>{store.orders.filter((order) => order.paymentStatus === "pending").length} chờ</i></article>
    </section>

    <div className="smart-home-grid">
      <section className="section-card priority-card"><div className="section-head"><div><h2>Ưu tiên hôm nay</h2><p>Đề xuất bằng quy tắc vận hành, không cần AI.</p></div><span className="core-status-pill"><Clock3 size={13}/>Hôm nay</span></div><div className="section-body priority-list">{todayPriorities.map(({ label, note, href, icon: Icon, tone }) => <Link key={href} href={href}><span className={`priority-icon ${tone}`}><Icon/></span><span><strong>{label}</strong><small>{note}</small></span><ArrowRight size={15}/></Link>)}</div></section>
      <section className="section-card continue-card"><div className="section-head"><div><h2>Tiếp tục dự án</h2><p>Những sách được cập nhật gần đây.</p></div><Link href="/books" className="text-link">Xem tất cả <ArrowRight size={13}/></Link></div><div className="section-body continue-book-list">{store.books.slice(0,4).map((book, index) => <Link href={`/editor/${book.id}`} key={book.id}><div className="continue-cover" style={{ background: book.cover }}><span>{String(index + 1).padStart(2,"0")}</span></div><div><strong>{book.title}</strong><small>{book.pages.length} trang · phiên bản {book.version}</small><div className="micro-progress"><i style={{ width: `${Math.min(96, 35 + index * 14)}%` }}/></div></div><ArrowRight size={15}/></Link>)}</div></section>
    </div>

    <section className="smart-module-grid">
      <Link href="/knowledge"><span><Sparkles/></span><div><strong>Knowledge Space</strong><small>{store.knowledgeSources.length} nguồn tri thức · tìm kiếm local</small></div><ArrowRight/></Link>
      <Link href="/blocks"><span><WandSparkles/></span><div><strong>Block Library</strong><small>{store.reusableBlocks.length} khối tái sử dụng</small></div><ArrowRight/></Link>
      <Link href="/clones"><span><BookCopy/></span><div><strong>Brand Clone</strong><small>{store.clones.filter((clone) => clone.status !== "synced").length} bản cần đồng bộ</small></div><ArrowRight/></Link>
      <Link href="/content-health"><span><HeartPulse/></span><div><strong>Preflight</strong><small>Kiểm tra trước xuất bản</small></div><ArrowRight/></Link>
    </section>

    <section className="production-health-strip">
      <div><CloudCog/><span><strong>Cloud là tùy chọn</strong><small>Local workspace vẫn hoạt động khi chưa kết nối Supabase.</small></span></div>
      <div><ListChecks/><span><strong>Worker tách riêng</strong><small>PDF/OCR lớn chỉ dùng khi có hạ tầng; file nhỏ vẫn import trong trình duyệt.</small></span></div>
      <div><LockKeyhole/><span><strong>Quyền và bảo mật</strong><small>RLS, signed URL và audit đã sẵn sàng cho production.</small></span></div>
    </section>
  </AppShell>;
}
