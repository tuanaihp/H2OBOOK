// Learn → Create bridge (adapted from
// v5/11-h2obook-learn-mastery-engine-v1/src/core/learnToCreate.ts). Kept as static app data —
// same convention as module 10's OUTCOME_RECIPES — rather than the reference module's
// h2o_learn_create_bridges table (see migration 0028's header for the full reasoning). Unlock
// logic is NOT a separate feature-key system: it reuses create-outcome.ts's resolveRecipe()
// directly, so a recipe is locked/unlocked exactly the same way whether reached from the Create
// Hub or from a Learn CTA — one source of truth, not two parallel access models.
import { OUTCOME_RECIPES, resolveRecipe, type OutcomeAccessContext } from "@/lib/student/create-outcome";

export interface LearnCreateMapping { triggerKey: string; recipeSlug: string; title: string; description: string }

export const DEFAULT_LEARN_CREATE_MAPPINGS: LearnCreateMapping[] = [
  { triggerKey: "lesson.toolkit-checklist", recipeSlug: "personal-makeup-kit-checklist", title: "Tạo Checklist túi đồ nghề cá nhân", description: "Biến kiến thức thành danh sách đồ đã có, còn thiếu và kế hoạch mua theo ngân sách." },
  { triggerKey: "lesson.face-analysis", recipeSlug: "face-analysis-workbook", title: "Tạo Phiếu phân tích khuôn mặt", description: "Lưu cấu trúc, ưu điểm, khuyết điểm và phương án Makeup cho từng mẫu." },
  { triggerKey: "lesson.foundation-technique", recipeSlug: "foundation-before-after-casebook", title: "Tạo Casebook nền Before/After", description: "Ghi lại tình trạng da, sản phẩm, quy trình và kết quả thực hành." },
  { triggerKey: "lesson.personal-brand", recipeSlug: "makeup-artist-brand-kit", title: "Tạo Brand Kit Makeup Artist", description: "Tạo hồ sơ thương hiệu, bảng màu, profile và cover đồng bộ." },
  { triggerKey: "lesson.content-marketing", recipeSlug: "90-day-content-plan", title: "Tạo kế hoạch Content 90 ngày", description: "Chuyển bài học thành lịch nội dung và kịch bản." },
  { triggerKey: "lesson.sales-script", recipeSlug: "wedding-sales-script-vault", title: "Tạo Sales Script cá nhân", description: "Tùy biến kịch bản hỏi giá, follow-up và chốt đặt cọc." }
];

export interface LearnToCreateContext { lessonId?: string; knowledgeSpaceId?: string }

export interface OutcomeRecipeLink { recipeSlug: string; title: string; description: string; href: string; locked: boolean; lockReason?: string }

function buildHref(recipeSlug: string, context: LearnToCreateContext) {
  const params = new URLSearchParams({ recipe: recipeSlug });
  if (context.lessonId) params.set("lessonId", context.lessonId);
  if (context.knowledgeSpaceId) params.set("spaceId", context.knowledgeSpaceId);
  return `/student/create/new?${params.toString()}`;
}

export function resolveLearnToCreateLink(triggerKey: string, context: LearnToCreateContext, access: OutcomeAccessContext): OutcomeRecipeLink | null {
  const mapping = DEFAULT_LEARN_CREATE_MAPPINGS.find((item) => item.triggerKey === triggerKey);
  if (!mapping) return null;
  const recipe = OUTCOME_RECIPES.find((item) => item.slug === mapping.recipeSlug);
  if (!recipe) return null;
  const resolution = resolveRecipe(recipe, access);
  return {
    recipeSlug: mapping.recipeSlug, title: mapping.title, description: mapping.description,
    href: buildHref(mapping.recipeSlug, context), locked: resolution.availability !== "unlocked", lockReason: resolution.reason
  };
}
