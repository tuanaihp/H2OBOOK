import {
  learningPaths as existingLearningPaths,
  membershipPlans as existingMembershipPlans,
  publicBooks,
  publicCourses,
  publicStrategies,
} from "@/lib/public-site/content";
import type {
  PublicAcademyCatalogItem,
  PublicAcademyConfig,
  PublicAcademyLearningPath,
  PublicAcademyValue,
  PublicAcademyViewModel,
  PublicMembershipPlan,
} from "./types";

function normalizeBook(book: (typeof publicBooks)[number], index: number): PublicAcademyCatalogItem {
  return {
    id: book.slug,
    slug: book.slug,
    href: `/academy/books/${book.slug}`,
    kind: "book",
    title: book.title,
    subtitle: book.subtitle,
    category: book.category,
    level: index < 1 ? "Nền tảng → Chuyên nghiệp" : index < 3 ? "Trung cấp" : "Ứng dụng",
    accent: book.accent,
    price: book.price,
    tags: [book.category, "Sách chuyên môn", "H2OBOOK"],
    metrics: [
      { label: "Trang", value: String(book.pages) },
      { label: "Phút đọc", value: String(book.readingMinutes) },
    ],
    outcomes: [
      "Đọc theo vấn đề và tìm lại nhanh",
      "Ghi chú, bookmark và kết nối bài học",
      "Dùng lại như checklist thực hành",
    ],
    featured: index < 3,
  };
}

function normalizeCourse(course: (typeof publicCourses)[number]): PublicAcademyCatalogItem {
  return {
    id: course.slug,
    slug: course.slug,
    href: `/academy/courses/${course.slug}`,
    kind: "course",
    title: course.title,
    subtitle: course.subtitle,
    category: course.category,
    level: course.level,
    accent: course.accent,
    price: course.price,
    tags: [course.category, course.level, "Khóa học"],
    metrics: [
      { label: "Bài học", value: String(course.lessons) },
      { label: "Thời lượng", value: course.duration },
    ],
    outcomes: course.outcomes,
    featured: Boolean(course.featured),
  };
}

function normalizeStrategy(strategy: (typeof publicStrategies)[number]): PublicAcademyCatalogItem {
  return {
    id: strategy.slug,
    slug: strategy.slug,
    href: `/academy/strategies/${strategy.slug}`,
    kind: "strategy",
    title: strategy.title,
    subtitle: strategy.summary,
    category: strategy.category,
    accent: strategy.accent,
    tags: [strategy.category, "Playbook", "Checklist"],
    metrics: [{ label: "Phút đọc", value: String(strategy.readingMinutes) }],
    outcomes: [
      "Có playbook và checklist áp dụng",
      "Liên kết với sách và khóa học liên quan",
      "Đo bằng hành động thay vì chỉ đọc",
    ],
  };
}

function normalizeMembership(plan: (typeof existingMembershipPlans)[number]): PublicMembershipPlan {
  const entitlementMap: Record<string, string[]> = {
    library: ["library", "reader", "bookmarks", "strategy-hub"],
    academy: ["library", "courses", "assignments", "skill-map", "mentor-local"],
    business: ["academy", "strategy-intelligence", "operations-templates", "coaching", "ai-workflow-lab"],
  };
  return {
    id: plan.id,
    name: plan.name,
    price: plan.price,
    period: plan.period === "năm" ? "năm" : "tháng",
    description: plan.description,
    features: plan.features,
    featured: Boolean(plan.featured),
    audience: plan.id === "library"
      ? "Người muốn đọc, ôn tập và cập nhật kiến thức"
      : plan.id === "academy"
        ? "Học viên cần lộ trình, bài tập và đánh giá tiến độ"
        : "Makeup Artist hoặc chủ studio đang xây hệ thống kinh doanh",
    entitlementKeys: entitlementMap[plan.id] ?? [],
    checkoutEnabled: true,
  };
}

export const fallbackPublicAcademyConfig: PublicAcademyConfig = {
  version: 5,
  pageTitles: {
    about: {
      eyebrow: "THUYH2O MAKEUP ACADEMY",
      title: "Đào tạo người làm nghề bằng kiến thức có hệ thống và trải nghiệm thực tế.",
      description: "H2OBOOK biến kinh nghiệm nghề nghiệp thành giáo trình, bài tập, lộ trình và hệ thống hỗ trợ học viên phát triển dài hạn.",
    },
    books: {
      eyebrow: "PROFESSIONAL KNOWLEDGE LIBRARY",
      title: "Thư viện sách dành cho người làm nghề Makeup.",
      description: "Đọc theo vấn đề, lưu ghi chú, tạo flashcard và kết nối trực tiếp với khóa học phù hợp.",
    },
    courses: {
      eyebrow: "LEARN · PRACTICE · GROW",
      title: "Khóa học dẫn từ kiến thức đến năng lực làm nghề.",
      description: "Mỗi lộ trình kết nối bài học, sách, nhiệm vụ, đánh giá và bản đồ kỹ năng cá nhân.",
    },
    "learning-paths": {
      eyebrow: "CAREER NAVIGATION SYSTEM",
      title: "Một bản đồ nghề nghiệp rõ ràng cho từng giai đoạn.",
      description: "Không cần học tất cả. Chỉ cần biết điểm hiện tại, mốc tiếp theo và kỹ năng cần hoàn thành.",
    },
    strategies: {
      eyebrow: "STRATEGY INTELLIGENCE HUB",
      title: "Chiến lược dành riêng cho nghề Makeup và Beauty Business.",
      description: "Playbook, checklist, template và case study giúp biến tay nghề thành một hệ thống kinh doanh bền vững.",
    },
    membership: {
      eyebrow: "H2OBOOK MEMBERSHIP",
      title: "Một tài khoản, một hệ sinh thái học tập và phát triển nghề.",
      description: "Chọn mức đồng hành phù hợp: đọc sách, học kỹ năng hoặc xây hệ thống kinh doanh Beauty.",
    },
  },
  featuredBookSlugs: publicBooks.slice(0, 5).map((item) => item.slug),
  featuredCourseSlugs: publicCourses.slice(0, 6).map((item) => item.slug),
  featuredStrategySlugs: publicStrategies.slice(0, 6).map((item) => item.slug),
  conversion: {
    journeyHref: "/academy/learning-paths",
    journeyLabel: "Xem lộ trình",
    academyHref: "/academy/courses",
    academyLabel: "Khám phá học viện",
    loginHref: "/login",
    loginLabel: "Đăng nhập học viên",
  },
  about: {
    founderName: "Thủy H2O",
    founderRole: "Founder · Educator",
    founderDescription: "Makeup Artist · Giảng viên · Nhà phát triển hệ thống đào tạo nghề",
    experienceYears: "10+",
    heroTitle: "Đào tạo người làm nghề bằng kiến thức có hệ thống và trải nghiệm thực tế.",
    heroDescription: "H2OBOOK được xây để biến kinh nghiệm nghề nghiệp thành giáo trình, bài tập, lộ trình và hệ thống hỗ trợ học viên phát triển dài hạn.",
  },
  membership: {
    checkoutTitle: "Bắt đầu hành trình học thật.",
    checkoutDescription: "Gửi hồ sơ để học viện tư vấn và duyệt tài khoản, hoặc chuyển thẳng sang thanh toán online.",
    privacyTitle: "Dữ liệu học tập thuộc về bạn.",
    privacyDescription: "Core học tập, reader, ghi chú, quiz và tiến độ vẫn hoạt động khi AI tắt. AI chỉ là lớp hỗ trợ được kiểm soát.",
    finalTitle: "Bắt đầu từ thư viện hôm nay.",
    finalHighlight: "Nâng cấp khi bạn cần thêm hỗ trợ.",
  },
  auth: {
    brandTitle: "Hệ điều hành xuất bản và kinh doanh tri thức.",
    brandDescription: "Thiết kế sách, clone thương hiệu, đào tạo học viên và bán membership trong một nền tảng thống nhất.",
    trustTitle: "Production-ready",
    trustDescription: "Auth, RLS, private storage và audit log.",
    loginTitle: "Đăng nhập H2OBOOK",
    loginDescription: "Truy cập đúng không gian tài khoản và tiếp tục hành trình của bạn.",
  },
  updatedAt: new Date(0).toISOString(),
};

export const fallbackPublicAcademyValues: PublicAcademyValue[] = [
  {
    id: "structured-knowledge",
    title: "Kiến thức có cấu trúc",
    description: "Mỗi kỹ thuật được giải thích bằng nguyên lý, quy trình, lỗi thường gặp và tiêu chí đánh giá.",
    icon: "book",
  },
  {
    id: "practice-feedback",
    title: "Thực hành có phản hồi",
    description: "Học viên không chỉ xem bài mà phải thực hành, nộp bằng chứng và nhận góp ý rõ ràng.",
    icon: "practice",
  },
  {
    id: "professional-environment",
    title: "Môi trường chuyên nghiệp",
    description: "Makeup Show, teamwork và dự án thực tế tạo năng lực xử lý tình huống và áp lực chất lượng.",
    icon: "people",
  },
  {
    id: "sustainable-growth",
    title: "Phát triển bền vững",
    description: "Kỹ thuật đi cùng tư duy phục vụ, thương hiệu, kinh doanh và thái độ sống với nghề.",
    icon: "growth",
  },
];

export const fallbackLearningPaths: PublicAcademyLearningPath[] = existingLearningPaths.map((path, index) => ({
  id: path.id,
  index: path.index,
  duration: path.duration,
  title: path.title,
  description: path.description,
  skills: path.skills,
  recommendationHref: `/academy/learning-paths?stage=${path.id}`,
  active: index === 1,
}));

export function buildFallbackPublicAcademyViewModel(): PublicAcademyViewModel {
  return {
    config: fallbackPublicAcademyConfig,
    books: publicBooks.map(normalizeBook),
    courses: publicCourses.map(normalizeCourse),
    strategies: publicStrategies.map(normalizeStrategy),
    learningPaths: fallbackLearningPaths,
    values: fallbackPublicAcademyValues,
    membershipPlans: existingMembershipPlans.map(normalizeMembership),
    source: "fallback",
  };
}
