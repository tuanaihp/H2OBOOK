import type { Flashcard, KnowledgeSource, LearningGoal, LearningNote, ReusableBlock, SmartSettings, StudySession } from "@/types/domain";

export const seedSmartSettings: SmartSettings = {
  aiEnabled: false,
  assistMode: "local",
  offlineFirst: true,
  autoGenerateStudyCards: true,
  reduceMotion: false,
  highContrast: false,
  focusMode: false
};

export const seedLearningGoals: LearningGoal[] = [
  { id: "goal_foundation", title: "Hoàn thành kỹ thuật nền trong trẻo", description: "Đọc giáo trình, ôn flashcard và hoàn thành bài thực hành.", targetDate: new Date(Date.now() + 21 * 86400000).toISOString(), progress: 68, status: "active", bookId: "book_makeup_pro", createdAt: new Date().toISOString() },
  { id: "goal_teacher", title: "Chuẩn hóa bộ tài liệu khóa chuyên nghiệp", description: "Duyệt nội dung và xuất bản phiên bản học viên.", targetDate: new Date(Date.now() + 14 * 86400000).toISOString(), progress: 42, status: "active", bookId: "book_makeup_pro", createdAt: new Date().toISOString() }
];

export const seedLearningNotes: LearningNote[] = [
  { id: "note_01", bookId: "book_makeup_pro", title: "Ba nguyên tắc nền trong", content: "Chuẩn bị da đủ ẩm, dùng lượng nền mỏng và kiểm soát lớp phủ theo vùng.", tags: ["nền", "thực hành"], pinned: true, updatedAt: new Date().toISOString() }
];

export const seedFlashcards: Flashcard[] = [
  { id: "card_01", bookId: "book_makeup_pro", front: "Vì sao phải chuẩn bị da trước lớp nền?", back: "Giúp bề mặt ổn định, tăng độ bám và giảm hiện tượng mốc hoặc tách nền.", tags: ["nền"], difficulty: 2, nextReviewAt: new Date().toISOString(), intervalDays: 1, reviewCount: 1, correctCount: 1, createdAt: new Date().toISOString() },
  { id: "card_02", bookId: "book_makeup_pro", front: "Nguyên tắc dùng lượng foundation?", back: "Bắt đầu thật mỏng, tăng dần theo vùng cần che phủ thay vì phủ dày toàn mặt.", tags: ["foundation"], difficulty: 2, nextReviewAt: new Date(Date.now() + 86400000).toISOString(), intervalDays: 2, reviewCount: 2, correctCount: 2, createdAt: new Date().toISOString() },
  { id: "card_03", bookId: "book_makeup_pro", front: "Khi nào nên phủ phấn nhiều hơn?", back: "Tập trung vùng tiết dầu hoặc cần cố định, giữ các vùng còn lại mỏng để bảo toàn độ trong.", tags: ["phấn phủ"], difficulty: 3, nextReviewAt: new Date().toISOString(), intervalDays: 1, reviewCount: 0, correctCount: 0, createdAt: new Date().toISOString() }
];

export const seedStudySessions: StudySession[] = [
  { id: "session_01", bookId: "book_makeup_pro", mode: "read", durationMinutes: 24, completedItems: 8, note: "Đã đọc chương nền và ghi chú ba điểm chính.", startedAt: new Date(Date.now() - 86400000).toISOString(), completedAt: new Date(Date.now() - 86400000 + 24 * 60000).toISOString() }
];

export const seedKnowledgeSources: KnowledgeSource[] = [
  { id: "source_book", title: "Giáo trình Makeup Chuyên Nghiệp", sourceType: "book", status: "ready", bookId: "book_makeup_pro", tags: ["makeup", "giáo trình"], createdAt: new Date().toISOString() },
  { id: "source_notes", title: "Ghi chú lớp nền trong trẻo", sourceType: "note", status: "ready", tags: ["nền", "ghi chú"], createdAt: new Date().toISOString() }
];

export const seedReusableBlocks: ReusableBlock[] = [
  { id: "block_objective", name: "Mục tiêu bài học", category: "lesson", description: "Khối tiêu đề, mô tả và ba mục tiêu đầu ra.", preview: "01", elementCount: 5, isSystem: true },
  { id: "block_steps", name: "Quy trình từng bước", category: "lesson", description: "Trình bày quy trình 4–6 bước có số thứ tự.", preview: "02", elementCount: 10, isSystem: true },
  { id: "block_practice", name: "Bài tập thực hành", category: "practice", description: "Yêu cầu, thời lượng, tài sản cần chuẩn bị và tiêu chí tự chấm.", preview: "03", elementCount: 8, isSystem: true },
  { id: "block_rubric", name: "Rubric đánh giá", category: "assessment", description: "Bảng tiêu chí chấm điểm dùng cho giáo viên và học viên.", preview: "04", elementCount: 12, isSystem: true },
  { id: "block_expert", name: "Giới thiệu chuyên gia", category: "profile", description: "Ảnh, tên, chức danh, mô tả và thông tin liên hệ theo Brand Kit.", preview: "05", elementCount: 9, isSystem: true },
  { id: "block_cta", name: "CTA khóa học", category: "marketing", description: "Khối kêu gọi đăng ký với QR, lợi ích và thông tin liên hệ.", preview: "06", elementCount: 7, isSystem: true }
];
