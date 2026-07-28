"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, BrainCircuit, Menu, Sparkles } from "lucide-react";

export function PublicHeader() {
  const [mobileOpen,setMobileOpen]=useState(false);
  return <header className="h2o-public-header">
    <div className="h2o-public-container h2o-public-header-inner">
      <Link href="/" className="h2o-public-logo" aria-label="H2OBOOK Academy">
        <span>H₂</span><div><strong>H2OBOOK</strong><small>by ThuyH2O Makeup</small></div>
      </Link>
      <nav className="h2o-public-nav" aria-label="Điều hướng công khai">
        <Link href="/academy/books">Sách</Link>
        <Link href="/academy/courses">Khóa học</Link>
        <Link href="/academy/strategies">Strategy Hub</Link>
        <Link href="/academy/learning-paths">Lộ trình nghề</Link>
        <Link href="/academy/about">Về ThuyH2O</Link>
      </nav>
      <div className="h2o-public-actions">
        <Link href="/login" className="h2o-public-login">Đăng nhập</Link>
        <Link href="/academy/membership" className="h2o-public-primary">Khám phá học viện <ArrowRight size={15}/></Link>
        <button className="h2o-public-menu" aria-label="Mở menu" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(!mobileOpen)}><Menu/></button>
      </div>
    </div>
    {mobileOpen&&<nav className="h2o-public-mobile-panel"><Link href="/academy/books" onClick={()=>setMobileOpen(false)}>Sách</Link><Link href="/academy/courses" onClick={()=>setMobileOpen(false)}>Khóa học</Link><Link href="/academy/strategies" onClick={()=>setMobileOpen(false)}>Strategy Hub</Link><Link href="/academy/learning-paths" onClick={()=>setMobileOpen(false)}>Lộ trình nghề</Link><Link href="/academy/about" onClick={()=>setMobileOpen(false)}>Về ThuyH2O</Link><Link href="/login" onClick={()=>setMobileOpen(false)}>Đăng nhập</Link></nav>}
  </header>;
}

export function PublicFooter() {
  return <footer className="h2o-public-footer">
    <div className="h2o-public-container h2o-public-footer-grid">
      <div className="h2o-footer-brand"><span>H₂</span><div><strong>H2OBOOK</strong><p>Hệ sinh thái sách, khóa học và chiến lược phát triển nghề Makeup.</p></div></div>
      <div><strong>Khám phá</strong><Link href="/academy/books">Thư viện sách</Link><Link href="/academy/courses">Khóa học</Link><Link href="/academy/strategies">Strategy Hub</Link></div>
      <div><strong>Hành trình</strong><Link href="/academy/learning-paths">Lộ trình nghề</Link><Link href="/academy/success-stories">Câu chuyện học viên</Link><Link href="/academy/membership">Membership</Link></div>
      <div><strong>Kết nối</strong><Link href="/academy/about">ThuyH2O Makeup Academy</Link><Link href="/login">Đăng nhập học viên</Link><Link href="/portal/thuyh2o-academy">Academy Portal</Link></div>
    </div>
    <div className="h2o-public-container h2o-public-footer-bottom"><span>© 2026 H2OBOOK · ThuyH2O Makeup Academy</span><span>Core hoạt động độc lập AI · AI là lớp hỗ trợ tùy chọn</span></div>
  </footer>;
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="h2o-public-site"><PublicHeader/><main>{children}</main><PublicFooter/></div>;
}

export function FutureOrb({ label = "H2O Knowledge AI" }: { label?: string }) {
  return <div className="h2o-future-orb-wrap" aria-label={label}>
    <div className="h2o-future-orb"><span>H₂</span><i/><i/><i/></div>
    <div className="h2o-orb-status"><Sparkles size={13}/><span>{label}</span><small>Local-first intelligence</small></div>
  </div>;
}

export function SectionHeading({ eyebrow, title, description, actionHref, actionLabel }: { eyebrow: string; title: string; description?: string; actionHref?: string; actionLabel?: string }) {
  return <div className="h2o-section-heading"><div><span>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{actionHref && actionLabel && <Link href={actionHref}>{actionLabel}<ArrowRight size={15}/></Link>}</div>;
}

export function IntelligenceBadge({ children }: { children: React.ReactNode }) {
  return <span className="h2o-intelligence-badge"><BrainCircuit size={13}/>{children}</span>;
}

export function BrandBookStack() {
  return <div className="h2o-book-stack" aria-hidden="true">
    <div className="h2o-stack-book stack-one"><small>MASTER CLASS</small><strong>Professional<br/>Makeup<br/>Knowledge</strong></div>
    <div className="h2o-stack-book stack-two"><small>STRATEGY</small><strong>Beauty<br/>Business<br/>System</strong></div>
    <div className="h2o-stack-book stack-three"><small>AI WORKFLOW</small><strong>Future<br/>Academy<br/>Playbook</strong></div>
    <div className="h2o-stack-grid"><BookOpen/><span>Books</span><Sparkles/><span>Courses</span></div>
  </div>;
}
