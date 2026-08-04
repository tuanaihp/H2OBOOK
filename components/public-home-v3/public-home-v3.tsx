import type { ReactNode } from "react";
import { H2OBrainCore } from "@/components/brand/h2o-brain-core";
import {
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  CirclePlay,
  Compass,
  GraduationCap,
  Layers3,
  LineChart,
  ShieldCheck,
  Target,
  Trophy,
  UsersRound,
} from "lucide-react";
import { formatVnd, learningPaths, membershipPlans, successStories } from "@/lib/public-site/content";
import { IntelligenceBadge, PublicShell, SectionHeading } from "@/components/marketing/public-shell";
import type { PublicHomeSectionKey, PublicHomeViewModel } from "@/lib/public-home-v3/types";
import { JourneyPlanner } from "./journey-planner";
import { PublicHomeSectionObserver } from "./section-observer";
import { TrackedLink } from "./tracked-link";
import styles from "./public-home-v3.module.css";

function pickBySlug<T extends { slug: string }>(items: T[], slugs: string[], limit: number) {
  const map = new Map(items.map((item) => [item.slug, item]));
  const selected = slugs.map((slug) => map.get(slug)).filter((item): item is T => Boolean(item));
  return [...selected, ...items.filter((item) => !slugs.includes(item.slug))].slice(0, limit);
}

export function PublicHomeV3({ viewModel, hero }: { viewModel: PublicHomeViewModel; hero?: ReactNode }) {
  const visible = new Set(viewModel.config.sectionOrder.filter((key) => !viewModel.config.hiddenSections.includes(key)));
  const books = pickBySlug(viewModel.books, viewModel.config.featuredBookSlugs, 4);
  const courses = pickBySlug(viewModel.courses, viewModel.config.featuredCourseSlugs, 3);
  const strategies = pickBySlug(viewModel.strategies, viewModel.config.featuredStrategySlugs, 6);

  const sections: Record<PublicHomeSectionKey, ReactNode> = {
    ecosystem: <section className="h2o-public-section h2o-ecosystem-section" data-public-home-section="ecosystem" key="ecosystem"><div className="h2o-public-container"><SectionHeading eyebrow="ONE INTELLIGENT ECOSYSTEM" title="Một hệ sinh thái, ba năng lực phải được phát triển cùng nhau." description="Sách cung cấp hệ thống kiến thức. Khóa học chuyển kiến thức thành năng lực. Strategy Hub biến năng lực thành giá trị nghề nghiệp."/><div className="h2o-ecosystem-grid">
      <article><div><BookOpen/></div><span>01</span><h3>Sách chuyên môn</h3><p>Giáo trình có cấu trúc, tìm kiếm, ghi chú, flashcard và cập nhật trực tiếp từ chuyên gia.</p><TrackedLink href="/academy/books" section="ecosystem" action="open-books">Khám phá sách <ArrowRight/></TrackedLink></article>
      <article><div><GraduationCap/></div><span>02</span><h3>Khóa học thực hành</h3><p>Lộ trình bài học, nhiệm vụ, rubric chấm điểm, Skill Map và phản hồi từ giảng viên.</p><TrackedLink href="/academy/courses" section="ecosystem" action="open-courses">Xem khóa học <ArrowRight/></TrackedLink></article>
      <article><div><LineChart/></div><span>03</span><h3>Chiến lược phát triển nghề</h3><p>Có khách, định giá, content, tư vấn, vận hành, đội nhóm và xây studio/học viện.</p><TrackedLink href="/academy/strategies" section="ecosystem" action="open-strategies">Mở Strategy Hub <ArrowRight/></TrackedLink></article>
    </div></div></section>,

    "journey-planner": <div className="h2o-public-section" data-public-home-section="journey-planner" key="journey-planner"><div className="h2o-public-container"><JourneyPlanner recommendations={viewModel.recommendations}/></div></div>,

    books: <section className="h2o-public-section" data-public-home-section="books" key="books"><div className="h2o-public-container"><SectionHeading eyebrow="PROFESSIONAL KNOWLEDGE LIBRARY" title="Thư viện được xây từ những vấn đề thật của nghề Makeup." description="Mỗi cuốn sách là một hệ thống kiến thức có thể đọc, tìm kiếm, thực hành và dùng lại." actionHref="/academy/books" actionLabel="Xem toàn bộ thư viện"/><div className="h2o-public-book-grid">{books.map((book,index)=><TrackedLink href={`/academy/books/${book.slug}`} key={book.slug} className="h2o-public-book-card" section="books" action="open-book" resourceType="book" resourceId={book.slug}><div className="h2o-public-book-cover" style={{background:book.accent}}><span>{book.category}</span><small>H2OBOOK · {String(index+1).padStart(2,"0")}</small><h3>{book.title}</h3><i/></div><div><strong>{book.title}</strong><p>{book.subtitle}</p><span>{book.pages} trang · {book.readingMinutes} phút</span><b>{formatVnd(book.price)}</b></div></TrackedLink>)}</div></div></section>,

    courses: <section className="h2o-public-section h2o-course-section" data-public-home-section="courses" key="courses"><div className="h2o-public-container"><SectionHeading eyebrow="LEARN · PRACTICE · GROW" title="Khóa học không dừng ở bài giảng — mà dẫn đến năng lực làm nghề." description="Mỗi khóa học kết nối giáo trình, video, bài tập, Skill Map, đánh giá và trải nghiệm thực tế." actionHref="/academy/courses" actionLabel="Xem tất cả khóa học"/><div className="h2o-public-course-grid">{courses.map(course=><article key={course.slug} className={course.featured?"featured":""}><div className="h2o-course-aura" style={{background:course.accent}}/><div className="h2o-course-meta"><span>{course.category}</span><span>{course.level}</span></div><h3>{course.title}</h3><p>{course.subtitle}</p><div className="h2o-course-stats"><span><CirclePlay/>{course.lessons} bài</span><span><Layers3/>{course.duration}</span></div><ul>{course.outcomes.slice(0,3).map(item=><li key={item}><CheckCircle2/>{item}</li>)}</ul><footer><strong>{formatVnd(course.price)}</strong><TrackedLink href={`/academy/courses/${course.slug}`} section="courses" action="open-course" resourceType="product" resourceId={course.slug}>Xem chi tiết <ArrowRight/></TrackedLink></footer></article>)}</div></div></section>,

    "career-path": <section className="h2o-public-section h2o-path-section" data-public-home-section="career-path" key="career-path"><div className="h2o-public-container"><SectionHeading eyebrow="CAREER NAVIGATION SYSTEM" title="Không học lan man. Mỗi giai đoạn đều có một bản đồ rõ ràng." description="Mỗi mốc nghề nghiệp phải liên kết với kỹ năng, nội dung, bài thực hành và chỉ số hoàn thành." actionHref="/academy/learning-paths" actionLabel="Xem bản đồ chi tiết"/><div className="h2o-path-timeline">{learningPaths.map((path,index)=><article key={path.id} className={index===1?"active":""}><div><span>{path.index}</span><i/></div><small>{path.duration}</small><h3>{path.title}</h3><p>{path.description}</p><ul>{path.skills.map(skill=><li key={skill}>{skill}</li>)}</ul></article>)}</div></div></section>,

    "student-command": <section className="h2o-public-section h2o-intelligence-section" data-public-home-section="student-command" key="student-command"><div className="h2o-public-container h2o-intelligence-grid"><div><IntelligenceBadge>STUDENT LEARNING COMMAND CENTER</IntelligenceBadge><h2>Mỗi học viên có một bảng điều khiển học tập riêng.</h2><p>Đăng nhập và biết ngay hôm nay cần học gì, còn thiếu kỹ năng nào, bài tập nào sắp đến hạn và mốc nghề nghiệp tiếp theo là gì.</p><div className="h2o-intelligence-points"><span><Target/><b>Nhiệm vụ hôm nay</b><small>Ưu tiên theo tiến độ thực tế</small></span><span><Compass/><b>Skill Map</b><small>Năng lực đã đạt và còn thiếu</small></span><span><Bot/><b>H2O Mentor</b><small>Rule-based local, AI tùy chọn</small></span><span><Trophy/><b>Portfolio & chứng nhận</b><small>Lưu bằng chứng năng lực nghề</small></span></div><TrackedLink className="h2o-public-primary" href="/student" section="student-command" action="open-student-preview">Xem trải nghiệm học viên <ArrowRight/></TrackedLink></div><div className="h2o-command-preview"><header><span><i>H₂</i>Learning Command</span><small>18 ngày trong hành trình</small></header><div className="h2o-command-welcome"><small>CHÀO BUỔI SÁNG, MINH ANH</small><h3>Hôm nay mình tiến thêm một bước nhé.</h3><div><strong>68%</strong><span><i style={{width:"68%"}}/></span></div></div><div className="h2o-command-mission"><span>NHIỆM VỤ HÔM NAY</span><strong>Nền cô dâu trong trẻo</strong><p>35 phút · 2/4 bước hoàn thành</p><div><i style={{width:"50%"}}/></div></div><div className="h2o-command-skills"><span>Kỹ thuật nền <b>86%</b></span><span>Makeup cô dâu <b>68%</b></span><span>Tóc ứng dụng <b>72%</b></span></div></div></div></section>,

    strategy: <section className="h2o-public-section" data-public-home-section="strategy" key="strategy"><div className="h2o-public-container"><SectionHeading eyebrow="STRATEGY INTELLIGENCE HUB" title="Kiến thức làm nghề phải đi cùng năng lực kinh doanh." description="Các playbook, checklist và case study được thiết kế riêng cho Makeup Artist, studio và học viện." actionHref="/academy/strategies" actionLabel="Mở Strategy Hub"/><div className="h2o-strategy-grid">{strategies.map(strategy=><TrackedLink href={`/academy/strategies/${strategy.slug}`} key={strategy.slug} section="strategy" action="open-strategy" resourceType="product" resourceId={strategy.slug}><span style={{background:strategy.accent}}>{strategy.category}</span><h3>{strategy.title}</h3><p>{strategy.summary}</p><footer><small>{strategy.readingMinutes} phút đọc</small><ArrowRight/></footer></TrackedLink>)}</div></div></section>,

    "real-world": <section className="h2o-public-section h2o-real-world-section" data-public-home-section="real-world" key="real-world"><div className="h2o-public-container h2o-real-world-grid"><div className="h2o-real-world-visual"><div className="h2o-stage-card"><small>REAL-WORLD EXPERIENCE</small><strong>Makeup Show<br/>Team Practice</strong><span>Time · Quality · Teamwork</span></div><div className="h2o-stage-orbit"><UsersRound/><span>Professional<br/>Environment</span></div></div><div><span className="h2o-public-eyebrow">LEARN IN CLASS · GROW IN REALITY</span><h2>Học trong lớp là khởi đầu. Trưởng thành ở môi trường thực tế.</h2><p>Học viên vận dụng makeup, làm tóc, teamwork, xử lý tình huống và quản lý thời gian trong Makeup Show và dự án thật.</p><ul><li><CheckCircle2/>Làm việc theo tiêu chuẩn chất lượng và thời gian</li><li><CheckCircle2/>Gặp ban tổ chức, nghệ sĩ và khách hàng thật</li><li><CheckCircle2/>Xây portfolio và uy tín thương hiệu cá nhân</li></ul><TrackedLink href="/academy/success-stories" section="real-world" action="open-stories">Xem câu chuyện học viên <ArrowRight/></TrackedLink></div></div></section>,

    "success-stories": <section className="h2o-public-section" data-public-home-section="success-stories" key="success-stories"><div className="h2o-public-container"><SectionHeading eyebrow="STUDENT TRANSFORMATION" title="Kết quả không chỉ là chứng chỉ — mà là bằng chứng năng lực." description="Mỗi câu chuyện cần gắn với khóa học, kỹ năng đạt được, bài thực hành và kết quả nghề nghiệp có thể kiểm chứng."/><div className="h2o-story-grid">{successStories.map(story=><article key={story.name}><blockquote>“{story.quote}”</blockquote><strong>{story.name}</strong><span>{story.role}</span><p>{story.result}</p></article>)}</div></div></section>,

    membership: <section className="h2o-public-section h2o-membership-section" data-public-home-section="membership" key="membership"><div className="h2o-public-container"><SectionHeading eyebrow="MEMBERSHIP" title="Chọn mức đồng hành phù hợp với giai đoạn của bạn." description="Bắt đầu từ thư viện kiến thức hoặc tham gia lộ trình đầy đủ với bài tập, Skill Map và Strategy Hub."/><div className="h2o-membership-grid">{membershipPlans.map(plan=><article key={plan.id} className={plan.featured?"featured":""}>{plan.featured&&<span className="h2o-plan-popular">Được lựa chọn nhiều</span>}<small>{plan.name}</small><h3>{formatVnd(plan.price)}<span>/{plan.period}</span></h3><p>{plan.description}</p><ul>{plan.features.map(item=><li key={item}><CheckCircle2/>{item}</li>)}</ul><TrackedLink href={`/academy/membership?plan=${plan.id}`} section="membership" action="open-plan" resourceType="product" resourceId={plan.id}>Xem quyền lợi <ArrowRight/></TrackedLink></article>)}</div></div></section>,

    "final-cta": <section className="h2o-public-final-cta" data-public-home-section="final-cta" key="final-cta"><div className="h2o-public-container"><div><ShieldCheck/><span>H2OBOOK LEARNING SYSTEM</span><h2>Bạn không cần học mọi thứ cùng lúc.<br/><em>Bạn cần một điểm bắt đầu đúng.</em></h2><p>Chọn lộ trình, khám phá nội dung phù hợp và để hệ thống theo dõi hành trình nghề nghiệp của bạn.</p><div><TrackedLink className="h2o-public-primary large" href={viewModel.config.conversion.primaryCtaHref} section="final-cta" action="primary">{viewModel.config.conversion.primaryCtaLabel} <ArrowRight/></TrackedLink><TrackedLink className="h2o-public-secondary large" href={viewModel.config.conversion.secondaryCtaHref} section="final-cta" action="secondary">{viewModel.config.conversion.secondaryCtaLabel}</TrackedLink></div></div><div className={styles.finalCore}><H2OBrainCore size="min(320px,34vw)" label={`${viewModel.config.socialProof.students}+ Learning Twin`}/></div></div></section>,
  };

  return <PublicShell>
    <PublicHomeSectionObserver />
    {hero ?? <DefaultHero viewModel={viewModel} />}
    {viewModel.config.sectionOrder.filter((key) => visible.has(key)).map((key) => sections[key])}
  </PublicShell>;
}

function DefaultHero({ viewModel }: { viewModel: PublicHomeViewModel }) {
  return <section className={styles.defaultHero} data-public-home-section="hero"><div className="h2o-public-container"><div className={styles.heroCopy}><IntelligenceBadge>H2O NEURAL KNOWLEDGE SYSTEM</IntelligenceBadge><h1>Một bộ não tri thức kết nối toàn bộ hành trình nghề Makeup.</h1><p>Sách, khóa học, bài thực hành, lộ trình và chiến lược được liên kết thành một hệ thống học tập có thể đo lường.</p><div className={styles.heroActions}><TrackedLink className="h2o-public-primary large" href={viewModel.config.conversion.primaryCtaHref} section="hero" action="primary">{viewModel.config.conversion.primaryCtaLabel} <ArrowRight/></TrackedLink><TrackedLink className="h2o-public-secondary large" href={viewModel.config.conversion.secondaryCtaHref} section="hero" action="secondary">{viewModel.config.conversion.secondaryCtaLabel}</TrackedLink></div><div className={styles.heroMetrics}>{viewModel.config.heroMetrics.map(metric=><span key={metric.id}><strong>{metric.value}</strong><small>{metric.label}</small></span>)}</div></div><div className={styles.heroCore}><div><span>H₂</span></div><i/><i/><i/><small>Knowledge Core</small></div></div></section>;
}
