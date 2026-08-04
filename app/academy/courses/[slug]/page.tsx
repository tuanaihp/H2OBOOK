import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, CirclePlay, Clock3, GraduationCap, Layers3, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/marketing/public-shell";
import { AcademyEnrollmentCard } from "@/components/academy/enrollment-card";
import { findPublicCourse, formatVnd, publicCourses } from "@/lib/public-site/content";
export function generateStaticParams(){return publicCourses.map(course=>({slug:course.slug}))}
// §4.5: previously every course detail page shared the root layout's generic default title.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const course = findPublicCourse(slug);
  if (!course) return {};
  const description = course.subtitle || course.description;
  return { title: course.title, description, openGraph: { title: course.title, description, type: "website" } };
}
export default async function CourseDetail({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const course=findPublicCourse(slug);if(!course)notFound();return <PublicShell><section className="h2o-course-detail-hero"><div className="h2o-course-detail-aura" style={{background:course.accent}}/><div className="h2o-public-container h2o-course-detail-grid"><div><Link className="h2o-back-link" href="/academy/courses"><ArrowLeft/>Tất cả khóa học</Link><span className="h2o-public-eyebrow">{course.category} · {course.level}</span><h1>{course.title}</h1><p className="lead">{course.subtitle}</p><p>{course.description}</p><div className="h2o-course-detail-meta"><span><Clock3/><b>{course.duration}</b><small>Thời lượng</small></span><span><CirclePlay/><b>{course.lessons}</b><small>Bài học</small></span><span><Layers3/><b>{course.modules.length}</b><small>Module</small></span></div><div className="h2o-detail-actions"><Link className="h2o-public-primary large" href="#academy-enrollment">Đăng ký học <ArrowRight/></Link><Link className="h2o-public-secondary large" href="/academy/learning-paths">So sánh lộ trình</Link></div></div><aside><span>HỌC PHÍ</span><strong>{formatVnd(course.price)}</strong><small>{course.format}</small><ul>{course.outcomes.map(item=><li key={item}><CheckCircle2/>{item}</li>)}</ul><div><ShieldCheck/>Có giáo trình H2OBOOK, bài tập và theo dõi tiến độ.</div></aside></div></section><section className="h2o-public-section"><div className="h2o-public-container h2o-detail-content-grid"><div><span className="h2o-public-eyebrow">MODULE HỌC</span><h2>Lộ trình được tổ chức theo năng lực.</h2><ol className="h2o-module-list">{course.modules.map((module,index)=><li key={module}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{module}</strong><small>Bài học · thực hành · kiểm tra tiến độ</small></div></li>)}</ol></div><div className="h2o-learning-system-card"><GraduationCap/><span>H2O LEARNING SYSTEM</span><h2>Không chỉ mua video.</h2><p>Bạn có bảng điều khiển học tập, nhiệm vụ hôm nay, Skill Map, thư viện sách và lộ trình nghề nghiệp.</p><Link href="/student">Xem giao diện học viên <ArrowRight/></Link></div></div></section><AcademyEnrollmentCard targetType="course" initialSlug={course.slug} options={[{slug:course.slug,label:course.title,price:course.price}]}/></PublicShell>}
