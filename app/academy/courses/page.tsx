import Link from "next/link";
import { ArrowRight, CheckCircle2, CirclePlay, GraduationCap, Layers3, Search } from "lucide-react";
import { PublicShell } from "@/components/marketing/public-shell";
import { formatVnd, publicCourses } from "@/lib/public-site/content";
import { PublicAcademyCoursesPage } from "@/components/public-academy-v5";
import { isPublicAcademyV5Enabled } from "@/lib/public-academy-v5/feature";
import { loadPublicAcademyV5 } from "@/lib/public-academy-v5/loader.server";
export const metadata={title:"Khóa học Makeup & Kinh doanh nghề | H2OBOOK"};
export default async function CoursesPage(){
  if(isPublicAcademyV5Enabled()) return <PublicAcademyCoursesPage viewModel={await loadPublicAcademyV5()}/>;
  return <LegacyCoursesPage/>;
}
/** Pre-V5 Courses page. Kept intact so NEXT_PUBLIC_PUBLIC_ACADEMY_V5=false restores it verbatim. */
function LegacyCoursesPage(){return <PublicShell><section className="h2o-public-subhero course"><div className="h2o-public-container"><span>LEARN · PRACTICE · GROW</span><h1>Khóa học dẫn từ kiến thức đến năng lực làm nghề.</h1><p>Mỗi lộ trình kết nối bài học, sách, nhiệm vụ, đánh giá và bản đồ kỹ năng cá nhân.</p></div></section><section className="h2o-public-section"><div className="h2o-public-container"><div className="h2o-catalog-toolbar"><div><Search/><input placeholder="Tìm khóa học hoặc kỹ năng..."/></div><div className="h2o-filter-pills"><button className="active">Tất cả</button><button>Khóa nghề</button><button>Nâng cao</button><button>Kinh doanh</button><button>AI</button></div></div><div className="h2o-public-course-grid catalog">{publicCourses.map(course=><article key={course.slug} className={course.featured?"featured":""}><div className="h2o-course-aura" style={{background:course.accent}}/><div className="h2o-course-meta"><span>{course.category}</span><span>{course.level}</span></div><h3>{course.title}</h3><p>{course.subtitle}</p><div className="h2o-course-stats"><span><CirclePlay/>{course.lessons} bài</span><span><Layers3/>{course.duration}</span></div><ul>{course.outcomes.slice(0,3).map(item=><li key={item}><CheckCircle2/>{item}</li>)}</ul><footer><strong>{formatVnd(course.price)}</strong><Link href={`/academy/courses/${course.slug}`}>Xem chi tiết <ArrowRight/></Link></footer></article>)}</div></div></section><section className="h2o-catalog-cta"><div className="h2o-public-container"><GraduationCap/><div><span>Cần tư vấn lộ trình?</span><h2>Bắt đầu từ mục tiêu nghề nghiệp, không bắt đầu từ danh sách khóa học.</h2></div><Link href="/academy/learning-paths">Tìm lộ trình <ArrowRight/></Link></div></section></PublicShell>}
