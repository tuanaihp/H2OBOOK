import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BookOpen, Bot, CheckCircle2, ChevronRight, CirclePlay, Compass, GraduationCap, Layers3, LineChart, ShieldCheck, Sparkles, Star, Target, Trophy, UsersRound } from "lucide-react";
import { BrandBookStack, FutureOrb, IntelligenceBadge, PublicShell, SectionHeading } from "@/components/marketing/public-shell";
import { formatVnd, learningPaths, membershipPlans, publicBooks, publicCourses, publicStrategies, successStories } from "@/lib/public-site/content";
import { KnowledgeUniverseHero } from "@/components/knowledge-universe";
import { isKnowledgeUniverseHeroEnabled } from "@/lib/knowledge-universe/feature";
import { PublicHomeV3 } from "@/components/public-home-v3";
import { isPublicHomeV3Enabled } from "@/lib/public-home-v3/feature";
import { loadPublicHomeV3 } from "@/lib/public-home-v3/loader.server";

/** Pre-4.16 public hero. Kept intact so NEXT_PUBLIC_KNOWLEDGE_UNIVERSE_HERO_V1=false restores it verbatim. */
function LegacyPublicHero() {
  return <section className="h2o-public-hero">
    <div className="h2o-public-container h2o-public-hero-grid">
      <div className="h2o-public-hero-copy">
        <IntelligenceBadge>H2O AI KNOWLEDGE UNIVERSE</IntelligenceBadge>
        <h1>Biến kiến thức nghề Makeup thành <em>năng lực làm nghề</em> và một sự nghiệp bền vững.</h1>
        <p>Học kỹ thuật, luyện thực hành, xây thương hiệu và phát triển công việc trong một hệ sinh thái sách, khóa học và trợ lý học tập thông minh.</p>
        <div className="h2o-public-hero-actions"><Link className="h2o-public-primary large" href="/academy/learning-paths">Khám phá lộ trình học <ArrowRight/></Link><Link className="h2o-public-secondary large" href="/academy/books"><BookOpen/>Xem thư viện sách</Link></div>
        <div className="h2o-public-trust-row"><span><strong>10+</strong><small>Năm kinh nghiệm</small></span><span><strong>184+</strong><small>Học viên trong hệ thống</small></span><span><strong>3 trong 1</strong><small>Sách · Học · Kinh doanh</small></span></div>
      </div>
      <div className="h2o-public-hero-visual"><BrandBookStack/><FutureOrb/><div className="h2o-floating-progress"><span><Target/>Hành trình của bạn</span><strong>68%</strong><div><i style={{width:"68%"}}/></div><small>Tiếp theo: Makeup cô dâu cấp 2</small></div></div>
    </div>
  </section>;
}

export default async function PublicHomePage() {
  if (process.env.NEXT_PUBLIC_PUBLIC_SITE_V2 === "false") redirect("/dashboard");
  if (isPublicHomeV3Enabled()) {
    const viewModel = await loadPublicHomeV3();
    return <PublicHomeV3 viewModel={viewModel} hero={isKnowledgeUniverseHeroEnabled() ? <KnowledgeUniverseHero/> : undefined}/>;
  }
  return <LegacyPublicHomePage/>;
}

/** Pre-Public-Home-V3 page. Kept intact so NEXT_PUBLIC_PUBLIC_HOME_V3=false restores it verbatim. */
function LegacyPublicHomePage() {
  return <PublicShell>
    {isKnowledgeUniverseHeroEnabled() ? <KnowledgeUniverseHero/> : <LegacyPublicHero/>}

    <section className="h2o-public-section h2o-ecosystem-section"><div className="h2o-public-container"><SectionHeading eyebrow="ONE INTELLIGENT ECOSYSTEM" title="Một hệ sinh thái, ba giá trị tạo nên người làm nghề toàn diện." description="Không chỉ xem video. H2OBOOK kết nối kiến thức, thực hành và chiến lược phát triển nghề trong cùng một hành trình."/><div className="h2o-ecosystem-grid">
      <article><div><BookOpen/></div><span>01</span><h3>Sách chuyên môn</h3><p>Giáo trình có cấu trúc, tìm kiếm, ghi chú, flashcard và cập nhật trực tiếp từ chuyên gia.</p><Link href="/academy/books">Khám phá sách <ArrowRight/></Link></article>
      <article><div><GraduationCap/></div><span>02</span><h3>Khóa học thực hành</h3><p>Lộ trình bài học, nhiệm vụ, rubric chấm điểm, Skill Map và phản hồi từ giảng viên.</p><Link href="/academy/courses">Xem khóa học <ArrowRight/></Link></article>
      <article><div><LineChart/></div><span>03</span><h3>Chiến lược phát triển nghề</h3><p>Có khách, định giá, content, tư vấn, vận hành, đội nhóm và xây studio/học viện.</p><Link href="/academy/strategies">Mở Strategy Hub <ArrowRight/></Link></article>
    </div></div></section>

    <section className="h2o-public-section"><div className="h2o-public-container"><SectionHeading eyebrow="PROFESSIONAL KNOWLEDGE LIBRARY" title="Thư viện được xây từ những vấn đề thật của nghề Makeup." description="Mỗi cuốn sách là một hệ thống kiến thức có thể đọc, tìm kiếm, thực hành và dùng lại." actionHref="/academy/books" actionLabel="Xem toàn bộ thư viện"/><div className="h2o-public-book-grid">{publicBooks.slice(0,4).map((book,index)=><Link href={`/academy/books/${book.slug}`} key={book.slug} className="h2o-public-book-card"><div className="h2o-public-book-cover" style={{background:book.accent}}><span>{book.category}</span><small>H2OBOOK · {String(index+1).padStart(2,"0")}</small><h3>{book.title}</h3><i/></div><div><strong>{book.title}</strong><p>{book.subtitle}</p><span>{book.pages} trang · {book.readingMinutes} phút</span><b>{formatVnd(book.price)}</b></div></Link>)}</div></div></section>

    <section className="h2o-public-section h2o-course-section"><div className="h2o-public-container"><SectionHeading eyebrow="LEARN · PRACTICE · GROW" title="Khóa học không dừng ở bài giảng — mà dẫn đến năng lực làm nghề." description="Mỗi khóa học kết nối giáo trình, video, bài tập, Skill Map, đánh giá và trải nghiệm thực tế." actionHref="/academy/courses" actionLabel="Xem tất cả khóa học"/><div className="h2o-public-course-grid">{publicCourses.slice(0,3).map(course=><article key={course.slug} className={course.featured?"featured":""}><div className="h2o-course-aura" style={{background:course.accent}}/><div className="h2o-course-meta"><span>{course.category}</span><span>{course.level}</span></div><h3>{course.title}</h3><p>{course.subtitle}</p><div className="h2o-course-stats"><span><CirclePlay/>{course.lessons} bài</span><span><Layers3/>{course.duration}</span></div><ul>{course.outcomes.slice(0,3).map(item=><li key={item}><CheckCircle2/>{item}</li>)}</ul><footer><strong>{formatVnd(course.price)}</strong><Link href={`/academy/courses/${course.slug}`}>Xem chi tiết <ChevronRight/></Link></footer></article>)}</div></div></section>

    <section className="h2o-public-section h2o-path-section"><div className="h2o-public-container"><SectionHeading eyebrow="CAREER NAVIGATION SYSTEM" title="Không học lan man. Mỗi giai đoạn đều có một bản đồ rõ ràng." description="Chọn điểm bắt đầu phù hợp, biết kỹ năng cần đạt và nội dung cần học để tiến tới mốc nghề nghiệp tiếp theo." actionHref="/academy/learning-paths" actionLabel="Xem bản đồ chi tiết"/><div className="h2o-path-timeline">{learningPaths.map((path,index)=><article key={path.id} className={index===1?"active":""}><div><span>{path.index}</span><i/></div><small>{path.duration}</small><h3>{path.title}</h3><p>{path.description}</p><ul>{path.skills.map(skill=><li key={skill}>{skill}</li>)}</ul></article>)}</div></div></section>

    <section className="h2o-public-section h2o-intelligence-section"><div className="h2o-public-container h2o-intelligence-grid"><div><IntelligenceBadge>STUDENT LEARNING COMMAND CENTER</IntelligenceBadge><h2>Mỗi học viên có một bảng điều khiển học tập riêng.</h2><p>Đăng nhập và biết ngay hôm nay cần học gì, còn thiếu kỹ năng nào, bài tập nào sắp đến hạn và mốc nghề nghiệp tiếp theo là gì.</p><div className="h2o-intelligence-points"><span><Target/><b>Nhiệm vụ hôm nay</b><small>Ưu tiên theo tiến độ thực tế</small></span><span><Compass/><b>Skill Map</b><small>Nhìn thấy năng lực đã đạt và còn thiếu</small></span><span><Bot/><b>H2O Mentor</b><small>Rule-based local, AI tùy chọn</small></span><span><TrophyIcon/><b>Portfolio & chứng nhận</b><small>Lưu bằng chứng năng lực nghề</small></span></div><Link className="h2o-public-primary" href="/student">Xem trải nghiệm học viên <ArrowRight/></Link></div><div className="h2o-command-preview"><header><span><i>H₂</i>Learning Command</span><small>18 ngày trong hành trình</small></header><div className="h2o-command-welcome"><small>CHÀO BUỔI SÁNG, MINH ANH</small><h3>Hôm nay mình tiến thêm một bước nhé.</h3><div><strong>68%</strong><span><i style={{width:"68%"}}/></span></div></div><div className="h2o-command-mission"><span>NHIỆM VỤ HÔM NAY</span><strong>Nền cô dâu trong trẻo</strong><p>35 phút · 2/4 bước hoàn thành</p><div><i style={{width:"50%"}}/></div></div><div className="h2o-command-skills"><span>Kỹ thuật nền <b>86%</b></span><span>Makeup cô dâu <b>68%</b></span><span>Tóc ứng dụng <b>72%</b></span></div></div></div></section>

    <section className="h2o-public-section"><div className="h2o-public-container"><SectionHeading eyebrow="STRATEGY INTELLIGENCE HUB" title="Kiến thức làm nghề phải đi cùng năng lực kinh doanh." description="Các playbook, checklist và case study được thiết kế riêng cho Makeup Artist, studio và học viện." actionHref="/academy/strategies" actionLabel="Mở Strategy Hub"/><div className="h2o-strategy-grid">{publicStrategies.slice(0,6).map(strategy=><Link href={`/academy/strategies/${strategy.slug}`} key={strategy.slug}><span style={{background:strategy.accent}}>{strategy.category}</span><h3>{strategy.title}</h3><p>{strategy.summary}</p><footer><small>{strategy.readingMinutes} phút đọc</small><ArrowRight/></footer></Link>)}</div></div></section>

    <section className="h2o-public-section h2o-real-world-section"><div className="h2o-public-container h2o-real-world-grid"><div className="h2o-real-world-visual"><div className="h2o-stage-card"><small>REAL-WORLD EXPERIENCE</small><strong>Makeup Show<br/>Team Practice</strong><span>Time · Quality · Teamwork</span></div><div className="h2o-stage-orbit"><UsersRound/><span>Professional<br/>Environment</span></div></div><div><span className="h2o-public-eyebrow">LEARN IN CLASS · GROW IN REALITY</span><h2>Học trong lớp là khởi đầu. Trưởng thành ở môi trường thực tế.</h2><p>Học viên được vận dụng makeup, làm tóc, teamwork, xử lý tình huống và quản lý thời gian trong các Makeup Show và dự án thật.</p><ul><li><CheckCircle2/>Làm việc theo tiêu chuẩn chất lượng và thời gian</li><li><CheckCircle2/>Gặp gỡ ban tổ chức, nghệ sĩ và khách hàng thật</li><li><CheckCircle2/>Xây portfolio và uy tín thương hiệu cá nhân</li></ul><Link href="/academy/success-stories">Xem câu chuyện học viên <ArrowRight/></Link></div></div></section>

    <section className="h2o-public-section"><div className="h2o-public-container"><SectionHeading eyebrow="STUDENT TRANSFORMATION" title="Kết quả không chỉ là chứng chỉ — mà là sự tự tin bước ra làm nghề."/><div className="h2o-story-grid">{successStories.map(story=><article key={story.name}><Star/><blockquote>“{story.quote}”</blockquote><strong>{story.name}</strong><span>{story.role}</span><p>{story.result}</p></article>)}</div></div></section>

    <section className="h2o-public-section h2o-membership-section"><div className="h2o-public-container"><SectionHeading eyebrow="MEMBERSHIP" title="Chọn mức đồng hành phù hợp với giai đoạn của bạn." description="Bắt đầu từ thư viện kiến thức hoặc tham gia lộ trình đầy đủ với bài tập, Skill Map và Strategy Hub."/><div className="h2o-membership-grid">{membershipPlans.map(plan=><article key={plan.id} className={plan.featured?"featured":""}>{plan.featured&&<span className="h2o-plan-popular">Được lựa chọn nhiều</span>}<small>{plan.name}</small><h3>{formatVnd(plan.price)}<span>/{plan.period}</span></h3><p>{plan.description}</p><ul>{plan.features.map(item=><li key={item}><CheckCircle2/>{item}</li>)}</ul><Link href="/academy/membership">Xem quyền lợi <ArrowRight/></Link></article>)}</div></div></section>

    <section className="h2o-public-final-cta"><div className="h2o-public-container"><div><ShieldCheck/><span>H2OBOOK LEARNING SYSTEM</span><h2>Bạn không cần học mọi thứ cùng lúc.<br/><em>Bạn chỉ cần một lộ trình đúng.</em></h2><p>Khám phá hệ sinh thái tri thức và tìm điểm bắt đầu phù hợp với hành trình nghề nghiệp của bạn.</p><div><Link className="h2o-public-primary large" href="/academy/learning-paths">Tìm lộ trình phù hợp <ArrowRight/></Link><Link className="h2o-public-secondary large" href="/login">Đăng nhập học viên</Link></div></div><FutureOrb label="Your next right step"/></div></section>
  </PublicShell>;
}

function TrophyIcon(){return <Trophy/>}
