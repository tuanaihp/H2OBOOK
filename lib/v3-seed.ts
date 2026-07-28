import type {
  AIJob, AutomationRule, CollaborationSession, ContentHealthReport, LicenseAgreement,
  ReviewComment, ReviewRequest, RoyaltyPayout, WhiteLabelPortal
} from "@/types/domain";

const now = Date.now();
const iso = (days = 0) => new Date(now + days * 86400000).toISOString();

export const seedReviews: ReviewRequest[] = [
  {
    id: "review_1", bookId: "book_makeup_pro", title: "Duyệt bản phát hành Makeup Master v3",
    stage: "design", status: "in_review", requestedBy: "Thủy H2O", assigneeIds: ["user_designer", "user_admin"],
    dueAt: iso(2), commentsCount: 3, updatedAt: iso(), checklist: [
      { id: "check_1", label: "Kiểm tra bìa và mục lục", completed: true },
      { id: "check_2", label: "Kiểm tra font tiếng Việt", completed: true },
      { id: "check_3", label: "Kiểm tra ảnh độ phân giải thấp", completed: false }
    ]
  },
  {
    id: "review_2", bookId: "book_skin", title: "Duyệt nội dung Kỹ thuật nền trong trẻo",
    stage: "content", status: "changes_requested", requestedBy: "Giảng viên Mai", assigneeIds: ["user_owner"],
    dueAt: iso(1), commentsCount: 5, updatedAt: iso(-1), checklist: [
      { id: "check_4", label: "Chuẩn hóa thuật ngữ chuyên môn", completed: false },
      { id: "check_5", label: "Bổ sung lưu ý an toàn", completed: true }
    ]
  },
  {
    id: "review_3", bookId: "book_hair", title: "Phê duyệt thương hiệu Giáo trình tóc cô dâu",
    stage: "brand", status: "approved", requestedBy: "Thủy H2O", assigneeIds: ["user_admin"],
    dueAt: iso(-1), commentsCount: 1, approvedBy: "Admin H2O", updatedAt: iso(-1), checklist: [
      { id: "check_6", label: "Logo và màu thương hiệu", completed: true },
      { id: "check_7", label: "Footer bản quyền", completed: true }
    ]
  }
];

export const seedReviewComments: ReviewComment[] = [
  { id: "comment_1", reviewId: "review_1", bookId: "book_makeup_pro", pageId: "page_cover", authorId: "user_designer", authorName: "Designer Linh", message: "Ảnh bìa cần tăng tương phản để tên sách nổi bật hơn.", resolved: false, createdAt: iso() },
  { id: "comment_2", reviewId: "review_1", bookId: "book_makeup_pro", authorId: "user_admin", authorName: "Admin H2O", message: "Đã kiểm tra font tiếng Việt, không còn lỗi dấu.", resolved: true, createdAt: iso(-1) },
  { id: "comment_3", reviewId: "review_2", bookId: "book_skin", authorId: "user_owner", authorName: "Thủy H2O", message: "Sẽ bổ sung phần lưu ý lựa chọn nền theo loại da.", resolved: false, createdAt: iso(-1) }
];

export const seedCollaborationSessions: CollaborationSession[] = [
  {
    id: "session_1", bookId: "book_makeup_pro", lockedPageIds: [], updatedAt: iso(), activeUsers: [
      { userId: "user_owner", name: "Thủy H2O", initials: "TH", color: "#7b214c", pageId: "page_cover", status: "online", lastSeenAt: iso() },
      { userId: "user_designer", name: "Designer Linh", initials: "DL", color: "#2b6cb0", pageId: "page_02", status: "online", lastSeenAt: iso() },
      { userId: "user_admin", name: "Admin H2O", initials: "AD", color: "#2f855a", status: "idle", lastSeenAt: iso() }
    ]
  }
];

export const seedAIJobs: AIJob[] = [
  { id: "ai_1", type: "outline", bookId: "book_makeup_pro", prompt: "Tạo cấu trúc 10 chương cho giáo trình makeup chuyên nghiệp", output: "1. Nền tảng nghề makeup\n2. Vệ sinh và an toàn\n3. Phân tích khuôn mặt\n4. Nền da\n5. Chân mày\n6. Mắt\n7. Môi\n8. Tóc ứng dụng\n9. Quy trình phục vụ\n10. Bài thi tốt nghiệp", provider: "local", status: "completed", createdAt: iso(-1) }
];

export const seedAutomations: AutomationRule[] = [
  { id: "automation_1", name: "Xuất bản xong → tạo thông báo", trigger: "book.published", actions: ["send_notification", "send_webhook"], status: "active", runCount: 38, errorCount: 0, lastRunAt: iso(-1), createdAt: iso(-120) },
  { id: "automation_2", name: "Đơn thanh toán → cấp quyền đọc", trigger: "order.paid", actions: ["grant_access", "send_notification"], status: "active", runCount: 186, errorCount: 2, lastRunAt: iso(), createdAt: iso(-90) },
  { id: "automation_3", name: "Clone có bản mới → tạo nhiệm vụ", trigger: "clone.update_available", actions: ["create_task", "send_notification"], status: "paused", runCount: 12, errorCount: 0, lastRunAt: iso(-4), createdAt: iso(-40) }
];

export const seedLicenses: LicenseAgreement[] = [
  { id: "license_1", templateId: "template_makeup_master", licensorName: "ThuyH2O Makeup", licenseeName: "Lumi Beauty Academy", model: "revenue_share", price: 0, revenueSharePercent: 20, status: "active", startsAt: iso(-60), seats: 120, cloneLimit: 5, clonesUsed: 2, revenue: 38600000 },
  { id: "license_2", templateId: "template_skin", licensorName: "ThuyH2O Makeup", licenseeName: "Mộc Beauty", model: "subscription", price: 1290000, revenueSharePercent: 0, status: "active", startsAt: iso(-25), expiresAt: iso(340), seats: 45, cloneLimit: 3, clonesUsed: 1, revenue: 1290000 }
];

export const seedRoyaltyPayouts: RoyaltyPayout[] = [
  { id: "payout_1", licenseId: "license_1", payeeName: "ThuyH2O Makeup", period: "07/2026", grossRevenue: 12600000, rate: 20, amount: 2520000, status: "pending", createdAt: iso() },
  { id: "payout_2", licenseId: "license_1", payeeName: "ThuyH2O Makeup", period: "06/2026", grossRevenue: 15800000, rate: 20, amount: 3160000, status: "paid", createdAt: iso(-30) }
];

export const seedWhiteLabelPortals: WhiteLabelPortal[] = [
  { id: "portal_1", name: "ThuyH2O Academy Library", slug: "thuyh2o-academy", customDomain: "book.thuyh2o.vn", logoUrl: "", primaryColor: "#6f1d46", accentColor: "#e8a8c3", theme: "light", status: "active", bookIds: ["book_makeup_pro", "book_skin"], memberCount: 184, plan: "business", updatedAt: iso() },
  { id: "portal_2", name: "Lumi Beauty Learning", slug: "lumi-beauty", primaryColor: "#25324a", accentColor: "#d7b56d", logoUrl: "", theme: "light", status: "draft", bookIds: ["book_makeup_pro"], memberCount: 38, plan: "academy", updatedAt: iso(-3) }
];

export const seedContentHealthReports: ContentHealthReport[] = [
  { id: "health_1", bookId: "book_makeup_pro", score: 86, readability: 88, accessibility: 74, brandConsistency: 95, imageQuality: 82, brokenLinks: 1, warnings: ["3 ảnh có độ phân giải thấp", "2 trang thiếu mô tả hình ảnh", "1 liên kết cần kiểm tra"], lastScannedAt: iso() },
  { id: "health_2", bookId: "book_skin", score: 92, readability: 94, accessibility: 88, brandConsistency: 97, imageQuality: 89, brokenLinks: 0, warnings: ["1 tiêu đề có độ tương phản thấp"], lastScannedAt: iso(-1) }
];
