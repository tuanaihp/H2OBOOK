import Link from "next/link";
import { ArrowRight, BookOpen, Search, SlidersHorizontal } from "lucide-react";
import { PublicShell, SectionHeading } from "@/components/marketing/public-shell";
import { formatVnd, publicBooks } from "@/lib/public-site/content";
import { PublicAcademyBooksPage } from "@/components/public-academy-v5";
import { isPublicAcademyV5Enabled } from "@/lib/public-academy-v5/feature";
import { loadPublicAcademyV5 } from "@/lib/public-academy-v5/loader.server";

export const metadata = { title: "Thư viện sách chuyên môn | H2OBOOK" };
export default async function PublicBooksPage(){
  if(isPublicAcademyV5Enabled()) return <PublicAcademyBooksPage viewModel={await loadPublicAcademyV5()}/>;
  return <LegacyPublicBooksPage/>;
}
/** Pre-V5 Books page. Kept intact so NEXT_PUBLIC_PUBLIC_ACADEMY_V5=false restores it verbatim. */
function LegacyPublicBooksPage(){return <PublicShell><section className="h2o-public-subhero"><div className="h2o-public-container"><span>PROFESSIONAL KNOWLEDGE LIBRARY</span><h1>Thư viện sách dành cho người làm nghề Makeup.</h1><p>Đọc theo vấn đề, lưu ghi chú, tạo flashcard và kết nối trực tiếp với khóa học phù hợp.</p></div></section><section className="h2o-public-section"><div className="h2o-public-container"><div className="h2o-catalog-toolbar"><div><Search/><input placeholder="Tìm sách, kỹ thuật hoặc chủ đề..."/></div><button><SlidersHorizontal/>Tất cả chủ đề</button></div><div className="h2o-public-book-grid catalog">{publicBooks.map((book,index)=><Link href={`/academy/books/${book.slug}`} key={book.slug} className="h2o-public-book-card"><div className="h2o-public-book-cover" style={{background:book.accent}}><span>{book.category}</span><small>H2OBOOK · {String(index+1).padStart(2,"0")}</small><h3>{book.title}</h3><i/></div><div><strong>{book.title}</strong><p>{book.subtitle}</p><span>{book.pages} trang · {book.readingMinutes} phút · {book.level}</span><b>{formatVnd(book.price)}</b></div></Link>)}</div></div></section><section className="h2o-catalog-cta"><div className="h2o-public-container"><BookOpen/><div><span>Không biết nên đọc cuốn nào trước?</span><h2>Chọn lộ trình nghề, H2OBOOK sẽ gợi ý đúng bộ sách.</h2></div><Link href="/academy/learning-paths">Xem lộ trình <ArrowRight/></Link></div></section></PublicShell>}
