import type { AiRubricCriterion } from "@/lib/h2obook/ai/types";

/**
 * Built-in product rubric for the learner's finished Makeup photos.
 *
 * This is deliberately separate from the attendance/training/practice rubrics managed by an
 * instructor. Those rubrics measure the learning process; this one measures the visible finished
 * product and is used only by the image-analysis workflow. Keep the total at 100.
 */
export const MAKEUP_PRODUCT_IMAGE_RUBRIC: readonly AiRubricCriterion[] = [
  {
    id: "makeup-product-foundation",
    label: "Lớp nền & xử lý khuyết điểm",
    maxScore: 18,
    description: "Nền mỏng, đều màu, đúng sắc độ da; che phủ vừa đủ, không mốc/cakey và sạch vùng cánh mũi, khóe miệng.",
  },
  {
    id: "makeup-product-brows",
    label: "Lông mày & độ cân đối",
    maxScore: 10,
    description: "Dáng mày phù hợp cấu trúc gương mặt, hai bên cân đối; đầu mày mềm, thân và đuôi gọn, màu hài hòa.",
  },
  {
    id: "makeup-product-eyes",
    label: "Mắt & chuyển màu",
    maxScore: 14,
    description: "Bố cục màu mắt đúng layout, chuyển màu sạch và có chiều sâu; hai mắt cân đối, không lem hoặc đọng phấn.",
  },
  {
    id: "makeup-product-lashes",
    label: "Mi, eyeliner & độ gọn chân mi",
    maxScore: 10,
    description: "Mi ôm sát chân mi thật, cân hai bên, không hở keo; eyeliner sạch, đúng hướng và phù hợp dáng mắt.",
  },
  {
    id: "makeup-product-structure",
    label: "Khối, bắt sáng & cấu trúc gương mặt",
    maxScore: 10,
    description: "Khối và bắt sáng đúng cấu trúc, ranh giới được tán mềm; tạo chiều sâu mà không bẩn, xám hoặc nặng mặt.",
  },
  {
    id: "makeup-product-blush",
    label: "Má & độ chuyển tone",
    maxScore: 8,
    description: "Vị trí má nâng gương mặt, chuyển màu mượt, sắc độ vừa phải và kết nối tự nhiên với mắt, môi và nền.",
  },
  {
    id: "makeup-product-lips",
    label: "Son môi & viền môi",
    maxScore: 10,
    description: "Viền môi gọn và cân, màu son đều, xử lý khóe môi sạch; dáng và màu môi phù hợp tổng thể layout.",
  },
  {
    id: "makeup-product-layout",
    label: "Layout, tỷ lệ & hòa sắc tổng thể",
    maxScore: 15,
    description: "Đúng chủ đề và tone yêu cầu; tỷ lệ các chi tiết hài hòa, có điểm nhấn, phù hợp mẫu và thể hiện tư duy thẩm mỹ.",
  },
  {
    id: "makeup-product-finish",
    label: "Độ hoàn thiện & sạch nghề",
    maxScore: 5,
    description: "Tổng thể sạch, tinh gọn, không lem/rơi phấn/keo thừa; sản phẩm sẵn sàng chụp cận cảnh và bàn giao khách.",
  },
] as const;

export const MAKEUP_PRODUCT_IMAGE_MAX_SCORE = MAKEUP_PRODUCT_IMAGE_RUBRIC.reduce((sum, criterion) => sum + criterion.maxScore, 0);

export function isMakeupProductImageRubric(snapshot: ReadonlyArray<{ id: string; maxScore?: number }>): boolean {
  const expectedIds = new Set(MAKEUP_PRODUCT_IMAGE_RUBRIC.map((criterion) => criterion.id));
  const isBuiltIn = snapshot.length === MAKEUP_PRODUCT_IMAGE_RUBRIC.length
    && snapshot.every((criterion) => expectedIds.has(criterion.id));
  const isConfigured = snapshot.length > 0
    && snapshot.every((criterion) => criterion.id.startsWith("makeup-product-config-"))
    && snapshot.reduce((sum, criterion) => sum + Number(criterion.maxScore ?? 0), 0) === 100;
  return isBuiltIn || isConfigured;
}
