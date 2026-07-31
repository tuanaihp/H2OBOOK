import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  GraduationCap,
  HeartHandshake,
  LineChart,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
} from "lucide-react";
import { IntelligenceBadge, PublicShell } from "@/components/marketing/public-shell";
import type { PublicAcademyPageKey, PublicAcademyViewModel } from "@/lib/public-academy-v5/types";
import { formatVnd } from "@/lib/public-site/content";
import { TrackedLink } from "@/components/public-home-v3/tracked-link";
import { AcademyCatalogClient } from "./catalog-client";
import { MembershipEnrollmentClient } from "./membership-enrollment-client";
import { PublicLoginExperience } from "./public-login-experience";
import styles from "./public-academy-v5.module.css";

function PageHero({ page, viewModel, dark = false }: { page: PublicAcademyPageKey; viewModel: PublicAcademyViewModel; dark?: boolean }) {
  const content = viewModel.config.pageTitles[page];
  return <section className={`${styles.pageHero} ${dark ? styles.darkHero : ""}`} data-academy-page={page}>
    <div className="h2o-public-container">
      <IntelligenceBadge>{content.eyebrow}</IntelligenceBadge>
      <h1>{content.title}</h1>
      <p>{content.description}</p>
    </div>
  </section>;
}

function JourneyCta({ viewModel, eyebrow, title, dark = false }: { viewModel: PublicAcademyViewModel; eyebrow: string; title: string; dark?: boolean }) {
  return <section className={`${styles.journeyCta} ${dark ? styles.darkCta : ""}`}>
    <div className="h2o-public-container">
      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
      </div>
      <TrackedLink href={viewModel.config.conversion.journeyHref} section="academy-cta" action="open-journey">
        {viewModel.config.conversion.journeyLabel}<ArrowRight aria-hidden="true" />
      </TrackedLink>
    </div>
  </section>;
}

export function PublicAcademyAboutPage({ viewModel }: { viewModel: PublicAcademyViewModel }) {
  const iconMap = {
    book: BookOpen,
    practice: GraduationCap,
    people: UsersRound,
    growth: HeartHandshake,
  } as const;

  return <PublicShell>
    <section className={styles.aboutHero}>
      <div className="h2o-public-container">
        <div className={styles.aboutCopy}>
          <IntelligenceBadge>{viewModel.config.pageTitles.about.eyebrow}</IntelligenceBadge>
          <h1>{viewModel.config.about.heroTitle}</h1>
          <p>{viewModel.config.about.heroDescription}</p>
          <TrackedLink href={viewModel.config.conversion.academyHref} className="h2o-public-primary large" section="about" action="open-programs">
            {viewModel.config.conversion.academyLabel}<ArrowRight aria-hidden="true" />
          </TrackedLink>
        </div>
        <div className={styles.founderCard}>
          <div className={styles.founderAura} />
          <small>{viewModel.config.about.founderRole}</small>
          <strong>{viewModel.config.about.founderName}</strong>
          <p>{viewModel.config.about.founderDescription}</p>
          <div><b>{viewModel.config.about.experienceYears}</b><span>Năm làm nghề và đào tạo</span></div>
        </div>
      </div>
    </section>

    <section className={styles.valuesSection}>
      <div className="h2o-public-container">
        <div className={styles.valuesGrid}>{viewModel.values.map((value) => {
          const Icon = iconMap[value.icon];
          return <article key={value.id}>
            <Icon aria-hidden="true" />
            <h2>{value.title}</h2>
            <p>{value.description}</p>
          </article>;
        })}</div>
      </div>
    </section>

    <section className={styles.methodSection}>
      <div className="h2o-public-container">
        <div>
          <small>PHƯƠNG PHÁP ĐÀO TẠO</small>
          <h2>Học trong lớp là khởi đầu. Trưởng thành ở thực tế.</h2>
        </div>
        <div>
          <p>H2OBOOK giúp học viên tiếp tục học sau mỗi buổi trên lớp: đọc lại giáo trình, ôn flashcard, xem checklist, thực hành, nộp bài và theo dõi tiến độ kỹ năng.</p>
          <p>Giảng viên nhìn thấy không chỉ điểm số mà còn cả hành trình: học viên đang mạnh ở đâu, cần luyện gì và mốc nghề nghiệp tiếp theo là gì.</p>
          <TrackedLink href="/academy/learning-paths" section="about" action="open-method">Xem phương pháp theo lộ trình <ArrowRight aria-hidden="true" /></TrackedLink>
        </div>
      </div>
    </section>
  </PublicShell>;
}

export function PublicAcademyBooksPage({ viewModel }: { viewModel: PublicAcademyViewModel }) {
  return <PublicShell>
    <PageHero page="books" viewModel={viewModel} />
    <main className={styles.catalogMain}>
      <div className="h2o-public-container">
        <AcademyCatalogClient items={viewModel.books} kind="book" placeholder="Tìm sách, kỹ thuật hoặc chủ đề..." />
      </div>
    </main>
    <JourneyCta viewModel={viewModel} eyebrow="KHÔNG BIẾT NÊN ĐỌC CUỐN NÀO TRƯỚC?" title="Chọn lộ trình nghề, H2OBOOK sẽ gợi ý đúng bộ sách." />
  </PublicShell>;
}

export function PublicAcademyCoursesPage({ viewModel }: { viewModel: PublicAcademyViewModel }) {
  return <PublicShell>
    <PageHero page="courses" viewModel={viewModel} />
    <main className={styles.catalogMain}>
      <div className="h2o-public-container">
        <AcademyCatalogClient items={viewModel.courses} kind="course" placeholder="Tìm khóa học hoặc kỹ năng..." />
      </div>
    </main>
    <JourneyCta viewModel={viewModel} eyebrow="CẦN TƯ VẤN LỘ TRÌNH?" title="Bắt đầu từ mục tiêu nghề nghiệp, không bắt đầu từ danh sách khóa học." />
  </PublicShell>;
}

export function PublicAcademyStrategiesPage({ viewModel }: { viewModel: PublicAcademyViewModel }) {
  return <PublicShell>
    <PageHero page="strategies" viewModel={viewModel} />
    <main className={styles.catalogMain}>
      <div className="h2o-public-container">
        <AcademyCatalogClient items={viewModel.strategies} kind="strategy" placeholder="Tìm chiến lược, vấn đề hoặc công cụ..." />
      </div>
    </main>
    <section className={styles.businessCta}>
      <div className="h2o-public-container">
        <BriefcaseBusiness aria-hidden="true" />
        <div><small>BEAUTY BUSINESS SYSTEM</small><h2>Học kỹ thuật để làm nghề. Học chiến lược để phát triển nghề.</h2></div>
        <TrackedLink href="/academy/courses/kinh-doanh-nghe-makeup" section="strategies" action="open-business-course">Xem khóa kinh doanh <ArrowRight aria-hidden="true" /></TrackedLink>
      </div>
    </section>
  </PublicShell>;
}

export function PublicAcademyLearningPathsPage({ viewModel }: { viewModel: PublicAcademyViewModel }) {
  return <PublicShell>
    <PageHero page="learning-paths" viewModel={viewModel} dark />
    <main className={styles.pathMain}>
      <div className="h2o-public-container">
        <div className={styles.pathTimeline}>{viewModel.learningPaths.map((path) => <article key={path.id} className={path.active ? styles.activePath : undefined}>
          <div className={styles.pathIndex}>{path.index}</div>
          <div className={styles.pathCard}>
            <small>{path.duration}</small>
            <h2>{path.title}</h2>
            <p>{path.description}</p>
            <ul>{path.skills.map((skill) => <li key={skill}><CheckCircle2 aria-hidden="true" />{skill}</li>)}</ul>
            <TrackedLink href={path.recommendationHref} section="learning-paths" action="open-stage" resourceType="page" resourceId={path.id}>Xem nội dung phù hợp <ArrowRight aria-hidden="true" /></TrackedLink>
          </div>
        </article>)}</div>
      </div>
    </main>
    <section className={styles.diagnosticCta}>
      <div className="h2o-public-container">
        <Sparkles aria-hidden="true" />
        <div><small>CAREER DIAGNOSTIC</small><h2>Bạn đang ở giai đoạn nào?</h2><p>Trả lời một số câu hỏi về kỹ thuật, khách hàng, thương hiệu và vận hành để nhận lộ trình gợi ý.</p></div>
        <TrackedLink href="/academy/learning-paths?diagnostic=1" section="learning-paths" action="start-diagnostic">Bắt đầu đánh giá <ArrowRight aria-hidden="true" /></TrackedLink>
      </div>
    </section>
  </PublicShell>;
}


export function PublicAcademyMembershipPage({ viewModel }: { viewModel: PublicAcademyViewModel }) {
  return <PublicShell>
    <PageHero page="membership" viewModel={viewModel} />
    <main className={styles.membershipMain}>
      <div className="h2o-public-container">
        <div className={styles.membershipGrid}>{viewModel.membershipPlans.map((plan) => <article key={plan.id} className={`${styles.membershipCard} ${plan.featured ? styles.membershipFeatured : ""}`}>
          {plan.featured && <span className={styles.recommendedBadge}>Được lựa chọn nhiều</span>}
          <small>{plan.name}</small>
          <h2>{formatVnd(plan.price)}<span>/{plan.period}</span></h2>
          <p>{plan.description}</p>
          <em>{plan.audience}</em>
          <ul>{plan.features.map((feature) => <li key={feature}><CheckCircle2 aria-hidden="true" />{feature}</li>)}</ul>
          <a href={`?plan=${plan.id}#membership-enrollment`}>Bắt đầu với gói này <ArrowRight aria-hidden="true" /></a>
        </article>)}</div>

        <section className={styles.membershipPrivacy}>
          <ShieldCheck aria-hidden="true" />
          <div><strong>{viewModel.config.membership.privacyTitle}</strong><p>{viewModel.config.membership.privacyDescription}</p></div>
        </section>
      </div>
    </main>

    <section className={styles.membershipCheckout} id="membership-enrollment">
      <div className="h2o-public-container">
        <div className={styles.checkoutCopy}>
          <small>ENROLLMENT & CHECKOUT</small>
          <h2>{viewModel.config.membership.checkoutTitle}</h2>
          <p>{viewModel.config.membership.checkoutDescription}</p>
          <ul>
            <li><Mail aria-hidden="true" />Email xác nhận ngay khi đăng ký</li>
            <li><LockKeyhole aria-hidden="true" />Tài khoản và quyền học tách biệt, cấp qua Auth</li>
            <li><ShieldCheck aria-hidden="true" />Thanh toán được xác nhận bằng webhook</li>
          </ul>
        </div>
        <MembershipEnrollmentClient plans={viewModel.membershipPlans} />
      </div>
    </section>

    <section className={styles.membershipFinal}>
      <div className="h2o-public-container">
        <small>START YOUR KNOWLEDGE JOURNEY</small>
        <h2>{viewModel.config.membership.finalTitle}<br /><span>{viewModel.config.membership.finalHighlight}</span></h2>
        <TrackedLink href={viewModel.config.conversion.loginHref} section="membership" action="open-login">{viewModel.config.conversion.loginLabel}<ArrowRight aria-hidden="true" /></TrackedLink>
      </div>
    </section>
  </PublicShell>;
}

export function PublicAcademyLoginPage({ viewModel }: { viewModel: PublicAcademyViewModel }) {
  return <PublicLoginExperience config={viewModel.config.auth} />;
}

export function PublicAcademyPreviewHub({ viewModel }: { viewModel: PublicAcademyViewModel }) {
  const links = [
    ["Giới thiệu", "/academy/public-suite-v5-preview/about", Trophy],
    ["Sách", "/academy/public-suite-v5-preview/books", BookOpen],
    ["Khóa học", "/academy/public-suite-v5-preview/courses", GraduationCap],
    ["Lộ trình", "/academy/public-suite-v5-preview/learning-paths", LineChart],
    ["Strategy Hub", "/academy/public-suite-v5-preview/strategies", BriefcaseBusiness],
    ["Membership", "/academy/public-suite-v5-preview/membership", HeartHandshake],
    ["Đăng nhập", "/academy/public-suite-v5-preview/login", LockKeyhole],
  ] as const;

  return <PublicShell><section className={styles.previewHub}><div className="h2o-public-container">
    <IntelligenceBadge>PUBLIC ACADEMY V5 PREVIEW</IntelligenceBadge>
    <h1>Một hệ giao diện công khai thống nhất cho toàn bộ H2OBOOK.</h1>
    <p>Nguồn dữ liệu: <strong>{viewModel.source}</strong>. Hãy kiểm tra từng tab trước khi thay các route đang chạy.</p>
    <div>{links.map(([label, href, Icon]) => <TrackedLink href={href} key={href} section="preview-hub" action="open-preview"><Icon aria-hidden="true" /><span>{label}</span><ArrowRight aria-hidden="true" /></TrackedLink>)}</div>
  </div></section></PublicShell>;
}
