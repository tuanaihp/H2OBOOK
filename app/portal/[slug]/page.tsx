"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen, ChevronRight, GraduationCap, Search, Sparkles, UsersRound } from "lucide-react";
import { useAppStore } from "@/store/app-store";

export default function WhiteLabelPortalPublicPage() {
  const params = useParams<{ slug: string }>();
  const store = useAppStore();
  const portal = store.whiteLabelPortals.find((item) => item.slug === params.slug);
  if (!portal) return <main className="portal-public-missing"><h1>Portal không tồn tại</h1><p>Đường dẫn có thể chưa được kích hoạt hoặc đã thay đổi.</p><Link href="/white-label">Quay lại quản trị</Link></main>;
  const books = portal.bookIds.map((id) => store.books.find((book) => book.id === id)).filter(Boolean);
  return <main className={`portal-public portal-theme-${portal.theme}`} style={{ "--portal-primary": portal.primaryColor, "--portal-accent": portal.accentColor } as React.CSSProperties}>
    <header className="portal-public-header"><Link href={`/portal/${portal.slug}`} className="portal-public-brand"><span>H2</span><div><strong>{portal.name}</strong><small>Digital Learning Library</small></div></Link><div className="portal-public-search"><Search size={15}/><input placeholder="Tìm sách, chương hoặc bài học..."/></div><nav><Link href="#library">Thư viện</Link><Link href="#membership">Membership</Link><Link className="portal-login" href="/dashboard">Đăng nhập</Link></nav></header>
    <section className="portal-public-hero"><div><span className="portal-public-eyebrow"><Sparkles size={14}/>NỀN TẢNG ĐÀO TẠO TRỰC TUYẾN</span><h1>Học đúng kiến thức.<br/>Luyện đúng kỹ năng.<br/><em>Phát triển đúng hướng.</em></h1><p>Truy cập giáo trình, bài tập và tài liệu chuyên môn được cập nhật trực tiếp từ chuyên gia.</p><div><a href="#library" className="portal-primary-action"><BookOpen size={16}/>Khám phá thư viện</a><a href="#membership" className="portal-secondary-action"><GraduationCap size={16}/>Xem gói học</a></div></div><aside><div className="portal-hero-book"/><div className="portal-hero-book second"/><div className="portal-hero-stat"><UsersRound size={17}/><strong>{portal.memberCount}+</strong><span>thành viên</span></div></aside></section>
    <section className="portal-public-library" id="library"><div className="portal-section-heading"><div><small>THƯ VIỆN NỔI BẬT</small><h2>Nội dung dành cho bạn</h2></div><span>{books.length} đầu sách</span></div><div className="portal-public-books">{books.map((book) => book && <article key={book.id}><div className="portal-public-cover" style={{ background: book.cover }}><span>{book.category}</span><div><small>{book.author}</small><h3>{book.title}</h3></div></div><div><p>{book.subtitle}</p><span>{book.pages.length} trang · {book.readingMinutes} phút</span><Link href={`/reader/${book.id}`}>Mở sách <ChevronRight size={14}/></Link></div></article>)}</div></section>
    <section className="portal-membership-block" id="membership"><div><small>MEMBERSHIP</small><h2>Một tài khoản, toàn bộ thư viện</h2><p>Đọc sách, lưu ghi chú, theo dõi tiến độ và nhận nội dung mới trong suốt thời hạn thành viên.</p></div><div><strong>Academy Membership</strong><span>Truy cập theo tháng hoặc năm</span><ul><li>Toàn bộ sách trong portal</li><li>Bài tập và quiz</li><li>Cập nhật nội dung tự động</li></ul><button>Bắt đầu học ngay</button></div></section>
    <footer className="portal-public-footer"><strong>{portal.name}</strong><span>Powered by H2OBOOK V3</span></footer>
  </main>;
}
