// Inline Setup Guide reminders (v5/34-.../CLAUDE_INTEGRATION_PROMPT.md "Inline Guide") — placed
// directly inside the Stage Curriculum tab and the Journey Builder so Admin sees "which of the 10
// steps am I on" without leaving the page they're already working in. The full step-by-step with
// real data-driven state lives at /academy-admin/data-link; these are just pointers to it.
import { academyDataLinkFeatures } from "@/lib/academy-data-link/feature-flags";

export function CurriculumInlineGuide() {
  if (!academyDataLinkFeatures.setupGuide) return null;
  return <aside style={{ border: "1px solid #a5f3fc", background: "#ecfeff", borderRadius: 14, padding: 14, marginBottom: 16 }}>
    <strong style={{ fontSize: 12 }}>Bạn đang ở bước 2–3: Xây cấu trúc và gắn học liệu</strong>
    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#0e7490" }}>Tạo Program → Module → Group, sau đó gắn sách, video, SOP, checklist và tool từ Kho nội dung Academy. Khi xong, chuyển sang Bản đồ kết quả học viên để tạo Nhiệm vụ. Xem đầy đủ 10 bước ở <a href="/academy-admin/data-link" style={{ color: "#0e7490", fontWeight: 600 }}>Liên kết dữ liệu</a>.</p>
  </aside>;
}

export function JourneyInlineGuide() {
  if (!academyDataLinkFeatures.setupGuide) return null;
  return <aside style={{ border: "1px solid #ddd6fe", background: "#f5f3ff", borderRadius: 14, padding: 14, marginBottom: 16 }}>
    <strong style={{ fontSize: 12 }}>Bạn đang ở bước 4–9: Biến kiến thức thành hành động</strong>
    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6d28d9" }}>Tạo Kết quả → Chặng → Nhiệm vụ, gắn Học liệu từ Curriculum, rồi thiết lập Việc cần làm → Evidence → Tiêu chí đạt → Kết quả. Kiểm tra như học viên trước khi áp dụng Journey Version. Xem đầy đủ 10 bước ở <a href="/academy-admin/data-link" style={{ color: "#6d28d9", fontWeight: 600 }}>Liên kết dữ liệu</a>.</p>
  </aside>;
}
