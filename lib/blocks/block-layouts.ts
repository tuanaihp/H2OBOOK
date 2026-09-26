import type { H2OElement } from "@/types/editor";
import type { ReusableBlock } from "@/types/domain";
import { uid } from "@/lib/utils";

// Deterministic presets for system blocks that ship without an element snapshot. Mirrors the
// makePage() conventions in store/editor-store.ts (794×1123 canvas, same palette and stacking) so
// a block dropped into a book looks like the page templates authors already know.
const base = (type: H2OElement["type"], name: string, extra: Partial<H2OElement>): H2OElement => ({
  id: uid(type), type, name, x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1,
  locked: false, hidden: false, permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: true, canChangeColor: true },
  ...extra
});
const text = (name: string, content: string, extra: Partial<H2OElement>): H2OElement =>
  base("text", name, { text: content, sourceText: content, fontFamily: "Arial", ...extra });
const shape = (name: string, extra: Partial<H2OElement>): H2OElement => base("shape", name, extra);

const BUILDERS: Record<ReusableBlock["category"], (block: ReusableBlock) => H2OElement[]> = {
  lesson: () => [
    text("Tiêu đề khối", "MỤC TIÊU BÀI HỌC", { x: 70, y: 70, width: 654, height: 70, fontSize: 36, fontWeight: 700, fill: "#541b37" }),
    shape("Khung nội dung", { x: 70, y: 170, width: 654, height: 520, fill: "#fdf6f9", cornerRadius: 16 }),
    text("Nội dung", "01  Hiểu đúng khái niệm nền\n\n02  Thực hành theo quy trình chuẩn\n\n03  Tự đánh giá được kết quả", { x: 110, y: 220, width: 574, height: 420, fontSize: 22, lineHeight: 1.5 })
  ],
  practice: () => [
    text("Tiêu đề khối", "BÀI TẬP THỰC HÀNH", { x: 70, y: 70, width: 654, height: 70, fontSize: 36, fontWeight: 700, fill: "#541b37", align: "center" }),
    shape("Khung nội dung", { x: 70, y: 170, width: 654, height: 620, fill: "#ffffff", stroke: "#e8d4dd", strokeWidth: 2, cornerRadius: 16 }),
    text("Yêu cầu", "Yêu cầu:\n\n• Chuẩn bị đầy đủ tài sản\n• Thực hành trong 30 phút\n• Nộp ảnh before/after", { x: 110, y: 220, width: 574, height: 480, fontSize: 21, lineHeight: 1.5 })
  ],
  assessment: () => [
    text("Tiêu đề khối", "RUBRIC ĐÁNH GIÁ", { x: 70, y: 70, width: 654, height: 70, fontSize: 36, fontWeight: 700, fill: "#541b37", align: "center" }),
    shape("Khung nội dung", { x: 70, y: 170, width: 654, height: 560, fill: "#ffffff", stroke: "#e8d4dd", strokeWidth: 2, cornerRadius: 16 }),
    text("Tiêu chí", "Tiêu chí\tĐạt\tChưa đạt\n\nKỹ thuật nền\n\nQuy trình\n\nHoàn thiện", { x: 110, y: 220, width: 574, height: 460, fontSize: 21, lineHeight: 1.6 })
  ],
  profile: () => [
    shape("Ảnh chuyên gia", { x: 70, y: 170, width: 260, height: 340, fill: "#eadfe3", cornerRadius: 16 }),
    text("Tên chuyên gia", "{{expert.name}}", { x: 370, y: 190, width: 354, height: 60, fontSize: 34, fontWeight: 700, fill: "#541b37", bindingKey: "expert.name" }),
    text("Chức danh", "{{expert.title}}", { x: 370, y: 260, width: 354, height: 45, fontSize: 20, fill: "#a44e73", bindingKey: "expert.title" }),
    text("Giới thiệu", "{{expert.bio}}", { x: 370, y: 330, width: 354, height: 180, fontSize: 18, lineHeight: 1.5 }),
    text("Tiêu đề khối", "CHUYÊN GIA ĐỒNG HÀNH", { x: 70, y: 70, width: 654, height: 60, fontSize: 30, fontWeight: 700, fill: "#541b37" })
  ],
  marketing: () => [
    shape("Nền CTA", { x: 70, y: 200, width: 654, height: 560, fill: "#6f1d46", cornerRadius: 24 }),
    text("Tiêu đề CTA", "ĐĂNG KÝ KHÓA HỌC", { x: 110, y: 260, width: 574, height: 90, fontSize: 44, fontWeight: 800, fill: "#ffffff", align: "center" }),
    text("Lợi ích", "Ưu đãi sớm • Tài liệu độc quyền • Cộng đồng hỗ trợ", { x: 110, y: 380, width: 574, height: 80, fontSize: 20, fill: "#f7dce5", align: "center" }),
    text("Liên hệ", "{{brand.website}} • {{brand.phone}}", { x: 110, y: 660, width: 574, height: 50, fontSize: 18, fill: "#f7dce5", align: "center", bindingKey: "brand.website" })
  ]
};

/** Elements for a block: the stored snapshot for user-saved blocks, else the category preset. */
export function buildBlockElements(block: ReusableBlock): H2OElement[] {
  const source = block.elements?.length ? block.elements : BUILDERS[block.category]?.(block) ?? [];
  return structuredClone(source).map((element) => ({ ...element, id: uid(element.type) }));
}
