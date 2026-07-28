export type LocalSmartAction = "outline" | "rewrite" | "quiz" | "summary" | "brand_copy" | "translate" | "accessibility" | "flashcards" | "keywords";

const STOP_WORDS = new Set([
  "và", "là", "của", "có", "cho", "trong", "một", "những", "các", "được", "với", "khi", "để", "từ", "này", "đó", "theo", "về", "hoặc", "nên", "sẽ", "thì", "đã", "đang", "rất", "như", "the", "and", "for", "with", "that", "this", "from", "into", "are", "was", "were"
]);

function normalize(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function sentences(text: string) {
  return normalize(text).split(/(?<=[.!?…])\s+|\n+/).map((item) => item.trim()).filter((item) => item.length > 18);
}

function words(text: string) {
  return normalize(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

export function extractKeywords(text: string, limit = 8) {
  const counts = new Map<string, { display: string; count: number }>();
  normalize(text).toLowerCase().replace(/[^a-zà-ỹ0-9\s]/gi, " ").split(/\s+/).filter(Boolean).forEach((display) => {
    const key = display.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (key.length <= 2 || STOP_WORDS.has(key)) return;
    const current = counts.get(key);
    counts.set(key, { display: current?.display ?? display, count: (current?.count ?? 0) + 1 });
  });
  return [...counts.values()].sort((a, b) => b.count - a.count || b.display.length - a.display.length).slice(0, limit).map((item) => item.display);
}

export function localSummary(text: string, maxSentences = 4) {
  const list = sentences(text);
  if (!list.length) return normalize(text).slice(0, 480);
  const keywords = extractKeywords(text, 10);
  const scored = list.map((sentence, index) => ({
    sentence,
    index,
    score: keywords.reduce((sum, keyword) => sum + (sentence.toLowerCase().includes(keyword) ? 2 : 0), 0) + (index === 0 ? 3 : 0) + Math.min(2, sentence.length / 140)
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, maxSentences).sort((a, b) => a.index - b.index).map((item) => `• ${item.sentence}`).join("\n");
}

export function localOutline(text: string) {
  const clean = normalize(text);
  const headings = clean.split("\n").filter((line) => /^(#{1,3}\s+|\d+[.)]\s+|[A-ZÀ-Ỹ][A-ZÀ-Ỹ\s]{5,})/.test(line.trim())).slice(0, 8);
  if (headings.length >= 3) return headings.map((heading, index) => `${index + 1}. ${heading.replace(/^#{1,3}\s+/, "")}`).join("\n");
  const keys = extractKeywords(clean, 6);
  return [
    "Mục tiêu và kết quả đầu ra",
    keys[0] ? `Nền tảng: ${keys[0]}` : "Kiến thức nền tảng",
    keys[1] ? `Quy trình: ${keys[1]}` : "Quy trình từng bước",
    keys[2] ? `Thực hành: ${keys[2]}` : "Ví dụ và thực hành",
    "Lỗi thường gặp và cách khắc phục",
    "Checklist tự đánh giá",
    "Bài tập áp dụng"
  ].map((item, index) => `${index + 1}. ${item}`).join("\n");
}

export function localRewrite(text: string) {
  const clean = normalize(text);
  const list = sentences(clean);
  if (!list.length) return clean;
  return list.map((sentence, index) => `${index + 1}. ${sentence.replace(/^[-•\d.)\s]+/, "")}`).join("\n");
}

export function localQuiz(text: string, count = 5) {
  const list = sentences(text);
  const keys = extractKeywords(text, count);
  return Array.from({ length: Math.min(count, Math.max(3, keys.length || 3)) }, (_, index) => {
    const key = keys[index] ?? `ý chính ${index + 1}`;
    const source = list[index % Math.max(1, list.length)] ?? normalize(text).slice(0, 180);
    return `${index + 1}. Hãy giải thích “${key}” bằng lời của bạn.\n   Gợi ý kiểm tra: ${source.slice(0, 150)}${source.length > 150 ? "…" : ""}`;
  }).join("\n\n");
}

export function localFlashcards(text: string, count = 6) {
  const list = sentences(text);
  const keys = extractKeywords(text, count);
  return keys.map((key, index) => ({
    front: `Điều cần nhớ về “${key}” là gì?`,
    back: (list.find((sentence) => sentence.toLowerCase().includes(key)) ?? list[index] ?? normalize(text)).slice(0, 240),
    tags: [key]
  }));
}

export function localAccessibility(text: string) {
  const clean = normalize(text);
  const issues: string[] = [];
  const list = sentences(clean);
  if (list.some((sentence) => sentence.length > 220)) issues.push("Có câu dài hơn 220 ký tự; nên chia nhỏ để dễ đọc.");
  if (clean.split("\n\n").some((paragraph) => paragraph.length > 700)) issues.push("Có đoạn văn quá dài; nên thêm tiêu đề phụ hoặc danh sách.");
  if (!/[.!?…]$/.test(clean)) issues.push("Nội dung chưa kết thúc bằng dấu câu rõ ràng.");
  if ((clean.match(/https?:\/\//g) ?? []).length > 3) issues.push("Có nhiều liên kết; nên thêm mô tả mục đích cho từng liên kết.");
  return issues.length ? issues.map((issue) => `• ${issue}`).join("\n") : "• Không phát hiện vấn đề đọc hiểu nghiêm trọng.\n• Hãy bổ sung alt text cho hình ảnh và kiểm tra độ tương phản trước khi xuất bản.";
}

export function runLocalSmart(action: LocalSmartAction, text: string, context?: { workspaceName?: string; bookTitle?: string }) {
  const clean = normalize(text) || "Nội dung chưa được cung cấp.";
  const prefix = context?.bookTitle ? `Sách: ${context.bookTitle}\n\n` : "";
  switch (action) {
    case "outline": return `${prefix}ĐỀ CƯƠNG LOCAL\n${localOutline(clean)}`;
    case "rewrite": return `${prefix}PHIÊN BẢN CẤU TRÚC LẠI\n${localRewrite(clean)}`;
    case "quiz": return `${prefix}BỘ CÂU HỎI TỰ LUYỆN\n${localQuiz(clean)}`;
    case "summary": return `${prefix}TÓM TẮT LOCAL\n${localSummary(clean)}`;
    case "brand_copy": return `${prefix}${context?.workspaceName ?? "H2OBOOK"} giúp biến kiến thức thành bài học rõ ràng, có thể thực hành và tái sử dụng.\n\n${clean}`;
    case "translate": return `${prefix}CHẾ ĐỘ KHÔNG AI\nTính năng dịch tự động cần bộ máy dịch tùy chọn. Bạn vẫn có thể chỉnh sửa hoặc dán bản dịch thủ công mà không ảnh hưởng các chức năng khác.`;
    case "accessibility": return `${prefix}KIỂM TRA KHẢ NĂNG TIẾP CẬN\n${localAccessibility(clean)}`;
    case "keywords": return `${prefix}TỪ KHÓA\n${extractKeywords(clean, 12).map((word) => `#${word}`).join("  ")}`;
    case "flashcards": return `${prefix}FLASHCARD GỢI Ý\n${localFlashcards(clean).map((card, index) => `${index + 1}. ${card.front}\n   ${card.back}`).join("\n\n")}`;
  }
}
