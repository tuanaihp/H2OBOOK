// Create Outcome Studio V1 (adapted from v5/10-h2obook-create-outcome-studio-upgrade-v1).
// Recipe catalog stays static app data — same convention as lib/public-site/content.ts for the
// academy catalog — since this repo does not yet have a database-backed recipe/membership-tier
// model. requiredStageKey maps 1:1 onto lib/student/experience.ts's studentCareerStages ids.

export type OutcomeType = "portfolio" | "toolkit" | "casebook" | "brand_profile" | "content_plan" | "pricing_kit" | "sales_playbook" | "workbook" | "certificate" | "custom";
export type EditorMode = "guided" | "standard" | "pro";
export type RecipeAvailability = "unlocked" | "stage_locked" | "membership_locked" | "hidden";

export interface OutcomeRecipe {
  slug: string;
  title: string;
  description: string;
  outcomeType: OutcomeType;
  estimatedMinutes: number;
  requiredStageKey?: string;
  requiresMembership?: boolean;
  editorMode: EditorMode;
  sections: { key: string; label: string; placeholder: string; weight: number }[];
  expectedOutputs: string[];
  accent: string;
}

export interface RecipeResolution {
  recipe: OutcomeRecipe;
  availability: RecipeAvailability;
  reason?: string;
}

export const OUTCOME_RECIPES: OutcomeRecipe[] = [
  {
    slug: "learning-workbook", title: "Sổ tay kiến thức của tôi",
    description: "Gom ghi chú, bài tập và insight thành tài liệu riêng của bạn.",
    outcomeType: "workbook", estimatedMinutes: 20, editorMode: "guided",
    sections: [
      { key: "learning_goal", label: "Mục tiêu học", placeholder: "Bạn muốn thành thạo điều gì?", weight: 1 },
      { key: "notes", label: "Ghi chú chính", placeholder: "Những điểm quan trọng nhất từ bài học...", weight: 2 },
      { key: "practice", label: "Thực hành", placeholder: "Bạn đã luyện tập gì?", weight: 2 },
      { key: "reflection", label: "Tự đánh giá", placeholder: "Điều gì bạn làm tốt, điều gì cần cải thiện?", weight: 1 }
    ],
    expectedOutputs: ["Sổ tay web", "Link quay lại bài học"], accent: "#287989"
  },
  {
    slug: "kit-checklist", title: "Checklist túi đồ nghề cá nhân",
    description: "Danh sách đã có, cần mua và ưu tiên ngân sách.",
    outcomeType: "toolkit", estimatedMinutes: 15, requiredStageKey: "foundation", editorMode: "guided",
    sections: [
      { key: "mission", label: "Mục tiêu bộ đồ nghề", placeholder: "Bạn cần bộ đồ nghề cho việc gì?", weight: 1 },
      { key: "checklist", label: "Danh sách đã có / cần mua", placeholder: "Liệt kê từng món...", weight: 2 },
      { key: "budget", label: "Kế hoạch ngân sách", placeholder: "Ước tính chi phí...", weight: 1 }
    ],
    expectedOutputs: ["Checklist cá nhân", "Kế hoạch ngân sách"], accent: "#2b8798"
  },
  {
    slug: "practice-casebook", title: "Casebook kinh nghiệm thực chiến",
    description: "Lưu tình trạng khách, quy trình xử lý và bài học rút ra.",
    outcomeType: "casebook", estimatedMinutes: 25, requiredStageKey: "practice", editorMode: "guided",
    sections: [
      { key: "client_context", label: "Bối cảnh khách hàng", placeholder: "Tình trạng, yêu cầu của khách...", weight: 1 },
      { key: "process", label: "Quy trình xử lý", placeholder: "Các bước bạn đã thực hiện...", weight: 2 },
      { key: "before_after", label: "Trước / sau", placeholder: "Mô tả kết quả trước và sau...", weight: 2 },
      { key: "reflection", label: "Bài học rút ra", placeholder: "Điều gì bạn học được?", weight: 1 }
    ],
    expectedOutputs: ["Case thực chiến", "Bản gửi giảng viên"], accent: "#6b5a9f"
  },
  {
    slug: "portfolio-first", title: "Portfolio đầu tiên",
    description: "Biến ảnh Before/After và bài thực hành thành hồ sơ năng lực.",
    outcomeType: "portfolio", estimatedMinutes: 35, requiredStageKey: "first-client", requiresMembership: true, editorMode: "standard",
    sections: [
      { key: "profile", label: "Giới thiệu bản thân", placeholder: "Bạn là ai, chuyên môn gì?", weight: 1 },
      { key: "case_study", label: "Case tiêu biểu", placeholder: "3-5 case bạn tự hào nhất...", weight: 3 },
      { key: "services", label: "Dịch vụ cung cấp", placeholder: "Bạn nhận làm gì?", weight: 1 },
      { key: "cta", label: "Kêu gọi liên hệ", placeholder: "Cách khách hàng liên hệ bạn...", weight: 1 }
    ],
    expectedOutputs: ["Portfolio web", "Link công khai", "QR Portfolio"], accent: "#8a2b61"
  },
  {
    slug: "pricing-kit", title: "Bảng giá và gói dịch vụ",
    description: "Gói cơ bản, tiêu chuẩn, cao cấp cùng chính sách cọc.",
    outcomeType: "pricing_kit", estimatedMinutes: 30, requiredStageKey: "professional", requiresMembership: true, editorMode: "guided",
    sections: [
      { key: "packages", label: "Các gói dịch vụ", placeholder: "Cơ bản / tiêu chuẩn / cao cấp...", weight: 2 },
      { key: "costs", label: "Chi phí & phát sinh", placeholder: "Chi phí gốc, phụ phí...", weight: 1 },
      { key: "policies", label: "Chính sách đặt cọc", placeholder: "Điều khoản đặt cọc, huỷ lịch...", weight: 1 }
    ],
    expectedOutputs: ["Bảng giá", "Chính sách đặt cọc"], accent: "#d29c32"
  }
];

export function getRecipe(slug: string) {
  return OUTCOME_RECIPES.find((recipe) => recipe.slug === slug);
}

export interface OutcomeAccessContext {
  isStaff: boolean;
  unlockedStageKeys: string[];
  hasActiveMembership: boolean;
}

export function resolveRecipe(recipe: OutcomeRecipe, context: OutcomeAccessContext): RecipeResolution {
  if (context.isStaff) return { recipe, availability: "unlocked" };
  if (recipe.requiredStageKey && !context.unlockedStageKeys.includes(recipe.requiredStageKey)) {
    return { recipe, availability: "stage_locked", reason: "Hoàn thành giai đoạn trước để mở công cụ này." };
  }
  if (recipe.requiresMembership && !context.hasActiveMembership) {
    return { recipe, availability: "membership_locked", reason: "Công cụ này nằm trong gói Membership." };
  }
  return { recipe, availability: "unlocked" };
}

export function calculateReadinessScore(sections: OutcomeRecipe["sections"], content: Record<string, string>): number {
  const totalWeight = sections.reduce((sum, section) => sum + section.weight, 0) || 1;
  const filledWeight = sections.reduce((sum, section) => sum + (content[section.key]?.trim() ? section.weight : 0), 0);
  return Math.round((filledWeight / totalWeight) * 100);
}
