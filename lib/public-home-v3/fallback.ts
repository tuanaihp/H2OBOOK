import {
  publicBooks,
  publicCourses,
  publicStrategies,
} from "@/lib/public-site/content";
import type {
  JourneyRecommendation,
  PublicHomeConfig,
  PublicHomeViewModel,
} from "./types";

export const fallbackPublicHomeConfig: PublicHomeConfig = {
  version: 3,
  sectionOrder: [
    "ecosystem",
    "journey-planner",
    "books",
    "courses",
    "career-path",
    "student-command",
    "strategy",
    "real-world",
    "success-stories",
    "membership",
    "final-cta",
  ],
  hiddenSections: [],
  featuredBookSlugs: publicBooks.slice(0, 4).map((item) => item.slug),
  featuredCourseSlugs: publicCourses.slice(0, 3).map((item) => item.slug),
  featuredStrategySlugs: publicStrategies.slice(0, 6).map((item) => item.slug),
  heroMetrics: [
    { id: "sources", label: "Nguồn đã nạp", value: "126" },
    { id: "connections", label: "Liên kết tri thức", value: "1.842" },
    { id: "learning-twins", label: "Learning Twin", value: "184" },
  ],
  socialProof: {
    students: 184,
    yearsExperience: 10,
    completionRate: 86,
    practicalEvents: 18,
  },
  conversion: {
    primaryCtaHref: "/academy/learning-paths",
    primaryCtaLabel: "Tìm lộ trình phù hợp",
    secondaryCtaHref: "/academy/books",
    secondaryCtaLabel: "Khám phá thư viện",
  },
  updatedAt: new Date(0).toISOString(),
};

export const journeyRecommendations: JourneyRecommendation[] = [
  {
    stage: "new",
    goal: "technique",
    title: "Lộ trình nền tảng nghề Makeup",
    summary: "Bắt đầu từ kỹ thuật nền, cấu trúc khuôn mặt, tóc cơ bản và thực hành có hướng dẫn.",
    href: "/academy/courses/makeup-chuyen-nghiep-3-thang",
    relatedBookSlugs: ["giao-trinh-makeup-chuyen-nghiep", "ky-thuat-nen-trong-treo"],
    relatedCourseSlugs: ["makeup-chuyen-nghiep-3-thang"],
    relatedStrategySlugs: ["co-khach-som-cho-makeup-artist-moi"],
  },
  {
    stage: "new",
    goal: "clients",
    title: "Lộ trình có khách đầu tiên",
    summary: "Biến bài thực hành thành portfolio, xây tệp khách gần và bắt đầu tư vấn đúng cách.",
    href: "/academy/strategies/co-khach-som-cho-makeup-artist-moi",
    relatedBookSlugs: ["xay-thuong-hieu-nghe-makeup"],
    relatedCourseSlugs: ["kinh-doanh-nghe-makeup"],
    relatedStrategySlugs: ["co-khach-som-cho-makeup-artist-moi"],
  },
  {
    stage: "first-clients",
    goal: "brand",
    title: "Lộ trình xây thương hiệu cá nhân",
    summary: "Chuẩn hóa hình ảnh, nội dung, portfolio và trải nghiệm để khách hàng nhớ và giới thiệu.",
    href: "/academy/books/xay-thuong-hieu-nghe-makeup",
    relatedBookSlugs: ["xay-thuong-hieu-nghe-makeup", "chinh-anh-makeup-proart"],
    relatedCourseSlugs: ["chinh-anh-makeup-proart"],
    relatedStrategySlugs: ["content-90-ngay-nghe-makeup"],
  },
  {
    stage: "professional",
    goal: "business",
    title: "Lộ trình vận hành nghề chuyên nghiệp",
    summary: "Định giá, CRM, quy trình dịch vụ, chăm sóc khách và hệ thống đo lường doanh thu.",
    href: "/academy/courses/kinh-doanh-nghe-makeup",
    relatedBookSlugs: ["xay-thuong-hieu-nghe-makeup"],
    relatedCourseSlugs: ["kinh-doanh-nghe-makeup"],
    relatedStrategySlugs: ["dinh-gia-khong-bi-re"],
  },
  {
    stage: "team",
    goal: "automation",
    title: "Lộ trình tự động hóa studio/học viện",
    summary: "Xây dữ liệu, workflow, báo cáo và trợ lý vận hành nhưng không phụ thuộc AI cho nghiệp vụ lõi.",
    href: "/academy/books/ai-tu-dong-hoa-studio",
    relatedBookSlugs: ["ai-tu-dong-hoa-studio"],
    relatedCourseSlugs: ["ai-automation-beauty-business"],
    relatedStrategySlugs: [],
  },
  {
    stage: "academy",
    goal: "business",
    title: "Lộ trình xây studio/học viện",
    summary: "Chuẩn hóa sản phẩm đào tạo, đội ngũ, tài chính, CRM, nội dung và hệ thống tăng trưởng.",
    href: "/academy/learning-paths",
    relatedBookSlugs: ["xay-thuong-hieu-nghe-makeup", "ai-tu-dong-hoa-studio"],
    relatedCourseSlugs: ["kinh-doanh-nghe-makeup", "ai-automation-beauty-business"],
    relatedStrategySlugs: ["dinh-gia-khong-bi-re", "content-90-ngay-nghe-makeup"],
  },
];

export function buildFallbackPublicHomeViewModel(): PublicHomeViewModel {
  return {
    config: fallbackPublicHomeConfig,
    books: publicBooks,
    courses: publicCourses,
    strategies: publicStrategies,
    recommendations: journeyRecommendations,
    source: "fallback",
  };
}
