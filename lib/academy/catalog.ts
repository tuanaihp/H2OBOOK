import { membershipPlans, publicCourses } from "@/lib/public-site/content";

export type AcademyTargetType = "course" | "membership";

export type AcademyLessonSeed = {
  slug: string;
  title: string;
  description: string;
  durationSeconds: number;
  skillKeys: string[];
  isPreview: boolean;
};

export type AcademyModuleSeed = {
  slug: string;
  title: string;
  lessons: AcademyLessonSeed[];
};

const lessonPatterns = [
  { prefix: "Tổng quan", description: "Mục tiêu, tiêu chuẩn đầu ra và cách luyện tập hiệu quả.", duration: 540 },
  { prefix: "Kỹ thuật cốt lõi", description: "Giảng giải kỹ thuật theo từng bước và các lỗi thường gặp.", duration: 960 },
  { prefix: "Phân tích tình huống", description: "Quan sát ví dụ thực tế và cách lựa chọn phương án phù hợp.", duration: 720 },
  { prefix: "Thực hành có hướng dẫn", description: "Làm theo checklist, tự đánh giá và lưu bằng chứng năng lực.", duration: 1_080 },
  { prefix: "Ôn tập & kiểm tra", description: "Củng cố kiến thức và xác nhận điều kiện mở kỹ năng tiếp theo.", duration: 600 }
] as const;

function skillKeyForModule(moduleTitle: string) {
  const normalized = academySlug(moduleTitle);
  if (normalized.includes("phan-tich") || normalized.includes("khuon-mat")) return "face";
  if (normalized.includes("nen") || normalized.includes("skin")) return "skin";
  if (normalized.includes("toc") && (normalized.includes("song") || normalized.includes("texture"))) return "waves";
  if (normalized.includes("toc") || normalized.includes("hair")) return "updo";
  if (normalized.includes("tu-van") || normalized.includes("khach")) return "consult";
  if (normalized.includes("team") || normalized.includes("lam-viec")) return "team";
  if (normalized.includes("gia") || normalized.includes("kinh-doanh") || normalized.includes("van-hanh")) return "pricing";
  if (normalized.includes("brand") || normalized.includes("thuong-hieu") || normalized.includes("portfolio")) return "brand";
  return "bridal";
}

export function academySlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getAcademyTarget(type: "course", slug: string): (typeof publicCourses)[number] | null;
export function getAcademyTarget(type: "membership", slug: string): (typeof membershipPlans)[number] | null;
export function getAcademyTarget(type: AcademyTargetType, slug: string): (typeof publicCourses)[number] | (typeof membershipPlans)[number] | null;
export function getAcademyTarget(type: AcademyTargetType, slug: string) {
  if (type === "course") return publicCourses.find((course) => course.slug === slug) ?? null;
  return membershipPlans.find((plan) => plan.id === slug) ?? null;
}

export function buildCourseModules(courseSlug: string): AcademyModuleSeed[] {
  const course = publicCourses.find((item) => item.slug === courseSlug);
  if (!course) return [];

  const base = Math.floor(course.lessons / course.modules.length);
  let remainder = course.lessons % course.modules.length;
  return course.modules.map((moduleTitle, moduleIndex) => {
    const count = base + (remainder-- > 0 ? 1 : 0);
    const moduleSlug = `${String(moduleIndex + 1).padStart(2, "0")}-${academySlug(moduleTitle)}`;
    return {
      slug: moduleSlug,
      title: moduleTitle,
      lessons: Array.from({ length: count }, (_, lessonIndex) => {
        const pattern = lessonPatterns[lessonIndex % lessonPatterns.length];
        return {
          slug: `${moduleSlug}-${String(lessonIndex + 1).padStart(2, "0")}`,
          title: `${pattern.prefix}: ${moduleTitle}`,
          description: pattern.description,
          durationSeconds: pattern.duration,
          skillKeys: [skillKeyForModule(moduleTitle)],
          isPreview: moduleIndex === 0 && lessonIndex === 0
        };
      })
    };
  });
}

export function catalogProductSlug(type: AcademyTargetType, slug: string) {
  return `${type}-${slug}`;
}

export function academyTargetLabel(type: AcademyTargetType, slug: string) {
  const target = getAcademyTarget(type, slug);
  if (!target) return slug;
  return "name" in target ? target.name : target.title;
}
