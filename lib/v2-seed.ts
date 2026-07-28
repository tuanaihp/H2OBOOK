import { defaultBrand, demoBook, libraryBooks } from "@/lib/mock-data";
import type {
  Activity, AnalyticsSnapshot, AppUser, Assignment, BookRecord, CloneRecord,
  CourseClass, Membership, Notification, Order, Product, Quiz, Student,
  TemplateRecord, Workspace
} from "@/types/domain";
import type { BrandProfile } from "@/types/editor";

const now = new Date();
const iso = (days = 0) => new Date(now.getTime() + days * 86400000).toISOString();
const dateOnly = (days = 0) => iso(days).slice(0, 10);

export const seedWorkspace: Workspace = {
  id: "workspace_thuyh2o",
  name: "THUYH2O Makeup Academy",
  slug: "thuyh2o-academy",
  ownerName: "Thủy H2O",
  email: "hello@thuyh2o.vn",
  phone: "0900 000 000",
  plan: "academy",
  storageUsedMb: 1840,
  storageLimitMb: 25600,
  brandColor: "#6f1d46"
};

export const seedUsers: AppUser[] = [
  { id: "user_owner", name: "Thủy H2O", email: "hello@thuyh2o.vn", role: "owner", status: "active", lastSeenAt: iso() },
  { id: "user_designer", name: "Lan Designer", email: "design@thuyh2o.vn", role: "designer", status: "active", lastSeenAt: iso(-1) },
  { id: "user_teacher", name: "Giảng viên Mai", email: "teacher@thuyh2o.vn", role: "teacher", status: "active", lastSeenAt: iso(-2) }
];

export const seedBrands: BrandProfile[] = [
  defaultBrand,
  { ...defaultBrand, id: "brand_lumi", name: "LUMI BEAUTY ACADEMY", expertName: "Nguyễn Minh Anh", expertTitle: "Founder & Beauty Trainer", primaryColor: "#143d4a", secondaryColor: "#e8f3f2", accentColor: "#d5ad64", website: "lumibeauty.vn", email: "hello@lumibeauty.vn", address: "Hà Nội, Việt Nam" },
  { ...defaultBrand, id: "brand_moon", name: "MOON MAKEUP STUDIO", expertName: "Trần Thu Hà", expertTitle: "Professional Makeup Artist", primaryColor: "#3c284c", secondaryColor: "#f0e9f5", accentColor: "#db9da6", website: "moonmakeup.vn", email: "hello@moonmakeup.vn", address: "Quảng Ninh, Việt Nam" }
];

export const seedBooks: BookRecord[] = libraryBooks.map((book, index) => ({
  ...structuredClone(book),
  slug: index === 0 ? "giao-trinh-makeup-chuyen-nghiep" : index === 1 ? "ky-thuat-nen-trong-treo" : "toc-co-dau-ung-dung",
  visibility: index === 0 ? "workspace" : "public",
  category: index === 2 ? "Tóc" : "Makeup",
  tags: index === 0 ? ["makeup", "giáo trình", "chuyên nghiệp"] : index === 1 ? ["nền", "da", "kỹ thuật"] : ["tóc", "cô dâu"],
  price: index === 0 ? 890000 : index === 1 ? 390000 : 590000,
  readingMinutes: index === 0 ? 210 : 95,
  version: index === 2 ? 3 : 2,
  ownerId: "user_owner",
  brandId: "brand_thuyh2o",
  publishedAt: index === 0 ? undefined : iso(-30 - index),
  cloneCount: index === 0 ? 12 : index === 1 ? 8 : 5,
  studentCount: index === 0 ? 124 : index === 1 ? 86 : 42
}));

export const seedTemplates: TemplateRecord[] = [
  { id: "tpl_makeup_master", name: "Giáo trình Makeup Master", description: "Bộ giáo trình nhiều chương, khóa layout và tự điền toàn bộ thương hiệu.", category: "Makeup", sourceBookId: demoBook.id, cover: demoBook.cover, pageCount: demoBook.pages.length, version: 4, price: 1290000, status: "published", visibility: "marketplace", allowLinkedClone: true, cloneCount: 28, updatedAt: iso(-2) },
  { id: "tpl_workbook", name: "Workbook thực hành", description: "Mẫu bài tập, checklist, khu vực ghi chú và chấm điểm học viên.", category: "Đào tạo", sourceBookId: "book_skin", cover: "linear-gradient(135deg,#473039,#b97a8c,#f8e7e7)", pageCount: 36, version: 2, price: 490000, status: "published", visibility: "marketplace", allowLinkedClone: true, cloneCount: 19, updatedAt: iso(-5) },
  { id: "tpl_franchise", name: "Sổ tay vận hành học viện", description: "Template dành cho chuỗi học viện và hệ thống nhượng quyền.", category: "Vận hành", sourceBookId: "book_hair", cover: "linear-gradient(135deg,#1d3540,#527c82,#d7ebe6)", pageCount: 64, version: 3, price: 1890000, status: "published", visibility: "marketplace", allowLinkedClone: true, cloneCount: 11, updatedAt: iso(-7) },
  { id: "tpl_personal", name: "Ebook thương hiệu cá nhân", description: "Mẫu ngắn để chuyên gia ra mắt ebook, thu lead và bán dịch vụ.", category: "Marketing", sourceBookId: "book_skin", cover: "linear-gradient(135deg,#6b3b18,#c77a31,#f4d7a5)", pageCount: 24, version: 1, price: 290000, status: "draft", visibility: "private", allowLinkedClone: false, cloneCount: 0, updatedAt: iso(-1) }
];

export const seedClones: CloneRecord[] = [
  { id: "clone_lumi", templateId: "tpl_makeup_master", targetBookId: "book_makeup_pro", brandId: "brand_lumi", partnerName: "Lumi Beauty Academy", mode: "linked", status: "update_available", sourceVersion: 3, currentTemplateVersion: 4, overrideCount: 12, conflictCount: 0, createdAt: iso(-70), lastSyncedAt: iso(-28) },
  { id: "clone_moon", templateId: "tpl_makeup_master", targetBookId: "book_skin", brandId: "brand_moon", partnerName: "Moon Makeup Studio", mode: "linked", status: "conflict", sourceVersion: 3, currentTemplateVersion: 4, overrideCount: 21, conflictCount: 3, createdAt: iso(-55), lastSyncedAt: iso(-22) },
  { id: "clone_independent", templateId: "tpl_workbook", targetBookId: "book_hair", brandId: "brand_thuyh2o", partnerName: "THUYH2O Academy", mode: "independent", status: "synced", sourceVersion: 2, currentTemplateVersion: 2, overrideCount: 7, conflictCount: 0, createdAt: iso(-18), lastSyncedAt: iso(-18) }
];

export const seedStudents: Student[] = [
  { id: "student_1", name: "Nguyễn Minh Anh", email: "minhanh@example.com", phone: "0912 111 222", classIds: ["class_k26"], progress: 78, completedBooks: 2, status: "active", joinedAt: iso(-90), lastActiveAt: iso() },
  { id: "student_2", name: "Trần Thu Hà", email: "thuha@example.com", phone: "0913 333 444", classIds: ["class_k26"], progress: 46, completedBooks: 1, status: "active", joinedAt: iso(-85), lastActiveAt: iso(-1) },
  { id: "student_3", name: "Lê Ngọc Mai", email: "ngocmai@example.com", phone: "0914 555 666", classIds: ["class_skin"], progress: 100, completedBooks: 4, status: "active", joinedAt: iso(-120), lastActiveAt: iso(-3) },
  { id: "student_4", name: "Phạm Khánh Linh", email: "khanhlinh@example.com", phone: "0915 777 888", classIds: ["class_hair"], progress: 21, completedBooks: 0, status: "active", joinedAt: iso(-25), lastActiveAt: iso(-2) },
  { id: "student_5", name: "Đỗ Quỳnh Trang", email: "quynhtrang@example.com", phone: "0916 999 000", classIds: [], progress: 0, completedBooks: 0, status: "invited", joinedAt: iso(-2), lastActiveAt: iso(-2) }
];

export const seedClasses: CourseClass[] = [
  { id: "class_k26", name: "Makeup Chuyên Nghiệp K26", code: "MUP-K26", teacherId: "user_teacher", teacherName: "Giảng viên Mai", bookIds: ["book_makeup_pro", "book_skin"], studentIds: ["student_1", "student_2"], startDate: dateOnly(-60), endDate: dateOnly(30), status: "active", color: "#6f1d46" },
  { id: "class_skin", name: "Nền Trong Trẻo Ứng Dụng", code: "SKIN-08", teacherId: "user_owner", teacherName: "Thủy H2O", bookIds: ["book_skin"], studentIds: ["student_3"], startDate: dateOnly(-35), endDate: dateOnly(-2), status: "completed", color: "#2f7580" },
  { id: "class_hair", name: "Tóc Cô Dâu Nâng Cao", code: "HAIR-12", teacherId: "user_teacher", teacherName: "Giảng viên Mai", bookIds: ["book_hair"], studentIds: ["student_4"], startDate: dateOnly(-7), endDate: dateOnly(35), status: "active", color: "#805b40" }
];

export const seedAssignments: Assignment[] = [
  { id: "assignment_1", classId: "class_k26", bookId: "book_makeup_pro", title: "Phân tích cấu trúc khuôn mặt", instructions: "Chụp ảnh mẫu chính diện, đánh dấu cấu trúc và ghi nhận phương án hiệu chỉnh.", dueAt: iso(3), maxScore: 100, submissionCount: 18, gradedCount: 12, status: "published" },
  { id: "assignment_2", classId: "class_k26", bookId: "book_skin", title: "Thực hành nền trong trẻo", instructions: "Nộp ảnh before/after và công thức sản phẩm đã sử dụng.", dueAt: iso(7), maxScore: 100, submissionCount: 9, gradedCount: 4, status: "published" },
  { id: "assignment_3", classId: "class_hair", bookId: "book_hair", title: "Form tóc bới thấp", instructions: "Quay video 30 giây thể hiện bốn góc của form tóc.", dueAt: iso(10), maxScore: 100, submissionCount: 4, gradedCount: 0, status: "published" }
];

export const seedQuizzes: Quiz[] = [
  { id: "quiz_1", title: "Kiểm tra nền tảng Makeup", bookId: "book_makeup_pro", chapterName: "Chương 01", passingScore: 70, timeLimitMinutes: 20, attemptCount: 86, averageScore: 82, status: "published", questions: [
    { id: "q1", type: "single", question: "Bước đầu tiên trước khi chọn sản phẩm nền là gì?", options: ["Phân tích da", "Chọn son", "Kẻ mắt", "Tạo khối"], correctAnswers: ["Phân tích da"], explanation: "Phân tích loại da và tình trạng da quyết định quy trình chuẩn bị và lựa chọn sản phẩm.", score: 10 },
    { id: "q2", type: "true_false", question: "Mọi khách hàng đều nên dùng cùng một kỹ thuật nền.", options: ["Đúng", "Sai"], correctAnswers: ["Sai"], explanation: "Kỹ thuật phải thay đổi theo da, khuôn mặt, ánh sáng và mục tiêu sử dụng.", score: 10 }
  ]},
  { id: "quiz_2", title: "Đánh giá kỹ thuật nền", bookId: "book_skin", chapterName: "Hoàn thiện nền", passingScore: 80, timeLimitMinutes: 15, attemptCount: 41, averageScore: 76, status: "published", questions: [] }
];

export const seedProducts: Product[] = [
  { id: "product_book_makeup", type: "book", referenceId: "book_makeup_pro", name: "Giáo trình Makeup Chuyên Nghiệp", description: "Bộ giáo trình hệ thống từ nền tảng đến ứng dụng thực chiến.", cover: demoBook.cover, price: 890000, compareAtPrice: 1290000, status: "active", sales: 84, revenue: 74760000 },
  { id: "product_skin", type: "book", referenceId: "book_skin", name: "Kỹ thuật nền trong trẻo", description: "Phân tích da, lựa chọn sản phẩm và hoàn thiện nền bền đẹp.", cover: "linear-gradient(135deg,#173d4d,#4f95a2,#d7f2ef)", price: 390000, status: "active", sales: 126, revenue: 49140000 },
  { id: "product_template", type: "template", referenceId: "tpl_makeup_master", name: "Template Giáo trình Makeup Master", description: "Quyền clone và cá nhân hóa thương hiệu.", cover: demoBook.cover, price: 1290000, status: "active", sales: 28, revenue: 36120000 },
  { id: "product_membership", type: "membership", referenceId: "academy_monthly", name: "Membership Academy", description: "Truy cập toàn bộ thư viện tài liệu đào tạo.", cover: "linear-gradient(135deg,#31172b,#80395f,#e7b6cd)", price: 299000, billingInterval: "month", status: "active", sales: 146, revenue: 43654000 }
];

export const seedOrders: Order[] = [
  { id: "order_1", orderCode: "H2B-260725-0186", customerName: "Nguyễn Thanh Vy", customerEmail: "vy@example.com", productId: "product_book_makeup", productName: "Giáo trình Makeup Chuyên Nghiệp", total: 890000, paymentMethod: "qr", paymentStatus: "paid", createdAt: iso(-1) },
  { id: "order_2", orderCode: "H2B-260725-0185", customerName: "Lê Bảo Ngọc", customerEmail: "ngoc@example.com", productId: "product_membership", productName: "Membership Academy", total: 299000, paymentMethod: "bank_transfer", paymentStatus: "pending", createdAt: iso(-1) },
  { id: "order_3", orderCode: "H2B-260724-0184", customerName: "Học viện Lumi", customerEmail: "hello@lumibeauty.vn", productId: "product_template", productName: "Template Giáo trình Makeup Master", total: 1290000, paymentMethod: "manual", paymentStatus: "paid", createdAt: iso(-2) }
];

export const seedMemberships: Membership[] = [
  { id: "membership_1", userId: "student_1", userName: "Nguyễn Minh Anh", planName: "Academy Monthly", price: 299000, billingInterval: "month", status: "active", startsAt: iso(-20), renewsAt: iso(10) },
  { id: "membership_2", userId: "student_2", userName: "Trần Thu Hà", planName: "Academy Annual", price: 2990000, billingInterval: "year", status: "active", startsAt: iso(-80), renewsAt: iso(285) },
  { id: "membership_3", userId: "student_4", userName: "Phạm Khánh Linh", planName: "Trial", price: 0, billingInterval: "month", status: "trial", startsAt: iso(-5), renewsAt: iso(2) }
];

export const seedNotifications: Notification[] = [
  { id: "notice_1", title: "Template có phiên bản mới", message: "Giáo trình Makeup Master đã được nâng lên phiên bản 4.", type: "clone", href: "/clones", read: false, createdAt: iso() },
  { id: "notice_2", title: "12 bài nộp đang chờ chấm", message: "Lớp Makeup Chuyên Nghiệp K26 có bài nộp mới.", type: "student", href: "/assignments", read: false, createdAt: iso(-1) },
  { id: "notice_3", title: "Thanh toán thành công", message: "Đơn H2B-260725-0186 đã được thanh toán và cấp quyền.", type: "payment", href: "/orders", read: true, createdAt: iso(-1) }
];

export const seedActivities: Activity[] = [
  { id: "activity_1", actor: "Thủy H2O", action: "xuất bản", target: "Kỹ thuật nền trong trẻo v2", createdAt: iso(-1), tone: "success" },
  { id: "activity_2", actor: "Lumi Beauty", action: "yêu cầu đồng bộ", target: "Giáo trình Makeup Master v4", createdAt: iso(-1), tone: "warning" },
  { id: "activity_3", actor: "Giảng viên Mai", action: "đã chấm 6 bài", target: "Phân tích cấu trúc khuôn mặt", createdAt: iso(-2), tone: "neutral" }
];

export const seedAnalytics: AnalyticsSnapshot[] = Array.from({ length: 14 }, (_, index) => ({
  date: dateOnly(index - 13),
  readers: 62 + ((index * 17) % 51),
  pageViews: 480 + ((index * 91) % 410),
  activeStudents: 78 + ((index * 13) % 39),
  revenue: 1200000 + ((index * 730000) % 4300000)
}));
