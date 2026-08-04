import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Download, Sparkles } from "lucide-react";
import { PublicShell } from "@/components/marketing/public-shell";
import { findPublicStrategy, publicStrategies } from "@/lib/public-site/content";
export function generateStaticParams(){return publicStrategies.map(strategy=>({slug:strategy.slug}))}
// §4.5: previously every strategy detail page shared the root layout's generic default title.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const strategy = findPublicStrategy(slug);
  if (!strategy) return {};
  return { title: strategy.title, description: strategy.summary, openGraph: { title: strategy.title, description: strategy.summary, type: "article" } };
}
export default async function StrategyDetail({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const strategy=findPublicStrategy(slug);if(!strategy)notFound();return <PublicShell><section className="h2o-strategy-detail-hero"><div className="h2o-public-container"><Link href="/academy/strategies" className="h2o-back-link"><ArrowLeft/>Strategy Hub</Link><span style={{background:strategy.accent}}>{strategy.category}</span><h1>{strategy.title}</h1><p>{strategy.summary}</p><div><Clock3/>{strategy.readingMinutes} phút đọc · Cập nhật theo dữ liệu vận hành nghề</div></div></section><section className="h2o-public-section"><div className="h2o-public-container h2o-strategy-detail-grid"><article><span className="h2o-public-eyebrow">PLAYBOOK STRUCTURE</span><h2>Từ vấn đề đến hành động có thể đo lường.</h2><ol className="h2o-strategy-sections">{strategy.sections.map((section,index)=><li key={section}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{section}</strong><p>Nội dung phân tích, ví dụ thực tế và checklist triển khai cho giai đoạn này.</p></div></li>)}</ol></article><aside><Sparkles/><span>BỘ CÔNG CỤ ĐI KÈM</span><h3>Tải về và dùng ngay trong công việc.</h3>{strategy.tools.map(tool=><div key={tool}><CheckCircle2/><span><strong>{tool}</strong><small>Template H2OBOOK có thể sao chép</small></span></div>)}<Link href="/login"><Download/>Mở playbook trong H2OBOOK</Link></aside></div></section><section className="h2o-detail-intelligence"><div className="h2o-public-container"><Sparkles/><div><span>RECOMMENDED NEXT STEP</span><h2>Áp dụng chiến lược trong một lộ trình có hướng dẫn.</h2><p>H2OBOOK kết nối playbook với khóa học, nhiệm vụ và dashboard theo dõi.</p></div><Link href="/academy/courses/kinh-doanh-nghe-makeup">Xem khóa phù hợp <ArrowRight/></Link></div></section></PublicShell>}
