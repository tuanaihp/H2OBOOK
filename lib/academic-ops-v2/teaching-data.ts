export type AutomationRule = {
  id: string;
  name: string;
  trigger: string;
  actions: string[];
  active: boolean;
  runs: number;
  lastRun: string;
};

export type ClassProgressRow = {
  id: string;
  name: string;
  email: string;
  scores: Record<string, number>;
};

export type ClassProgressColumn = {
  id: string;
  title: string;
  dueAt: string;
};

export type CollaborationMember = {
  id: string;
  name: string;
  initials: string;
  role: string;
  location: string;
  status: "online" | "idle" | "offline";
};

export type FeedbackItem = {
  id: string;
  author: string;
  book: string;
  page: string;
  message: string;
  date: string;
  resolved: boolean;
};

export type ProcessingJob = {
  id: string;
  type: "pdf_import" | "ocr" | "pdf_export";
  name: string;
  progress: number;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
};

export type ReviewRequest = {
  id: string;
  title: string;
  book: string;
  category: "design" | "content" | "brand";
  status: "preparing" | "reviewing" | "changes" | "approved";
  checklistDone: number;
  checklistTotal: number;
  comments: number;
  updatedAt: string;
};

export type StudentAccessRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  classCode: string;
  progress: number;
  booksCompleted: number;
  lastActive: string;
  status: "learning" | "invited" | "paused";
};

export const automationRules: AutomationRule[] = [
  {
    id: "automation-published",
    name: "Xuất bản xong → tạo thông báo",
    trigger: "book.published",
    actions: ["Tạo thông báo", "Gửi webhook"],
    active: true,
    runs: 38,
    lastRun: "27/07/2026"
  },
  {
    id: "automation-order",
    name: "Đơn thanh toán → cấp quyền đọc",
    trigger: "order.paid",
    actions: ["Cấp entitlement", "Gửi thông báo"],
    active: true,
    runs: 186,
    lastRun: "28/07/2026"
  },
  {
    id: "automation-clone",
    name: "Clone có bản mới → tạo nhiệm vụ",
    trigger: "clone.update_available",
    actions: ["Tạo nhiệm vụ", "Gửi thông báo"],
    active: false,
    runs: 12,
    lastRun: "24/07/2026"
  }
];

export const classProgressColumns: ClassProgressColumn[] = [
  { id: "face-analysis", title: "Phân tích cấu trúc khuôn mặt", dueAt: "31/07/2026" },
  { id: "glass-skin", title: "Thực hành nền trong trẻo", dueAt: "04/08/2026" },
  { id: "hair-form", title: "Form tóc bới thấp", dueAt: "07/08/2026" }
];

export const classProgressRows: ClassProgressRow[] = [
  {
    id: "student-minh-anh",
    name: "Nguyễn Minh Anh",
    email: "minhanh@example.com",
    scores: { "face-analysis": 78, "glass-skin": 69, "hair-form": 42 }
  },
  {
    id: "student-thu-ha",
    name: "Trần Thu Hà",
    email: "thuha@example.com",
    scores: { "face-analysis": 46, "glass-skin": 37, "hair-form": 21 }
  },
  {
    id: "student-ngoc-mai",
    name: "Lê Ngọc Mai",
    email: "ngocmai@example.com",
    scores: { "face-analysis": 92, "glass-skin": 86, "hair-form": 74 }
  }
];

export const collaborationMembers: CollaborationMember[] = [
  { id: "thuy-h2o", name: "Thủy H2O", initials: "TH", role: "Owner", location: "page_cover", status: "online" },
  { id: "designer-linh", name: "Designer Linh", initials: "DL", role: "Designer", location: "page_02", status: "online" },
  { id: "admin-h2o", name: "Admin H2O", initials: "AD", role: "Admin", location: "Hoạt động gần nhất", status: "idle" }
];

export const feedbackItems: FeedbackItem[] = [
  {
    id: "feedback-cover",
    author: "Designer Linh",
    book: "Giáo trình Makeup Chuyên Nghiệp",
    page: "page_cover",
    message: "Ảnh bìa cần tăng tương phản để tên sách nổi bật hơn.",
    date: "28/07/2026",
    resolved: false
  },
  {
    id: "feedback-foundation",
    author: "Thủy H2O",
    book: "Kỹ thuật nền trong trẻo",
    page: "page_03",
    message: "Bổ sung phân loại lớp nền theo loại da.",
    date: "27/07/2026",
    resolved: false
  }
];

export const processingSeed: ProcessingJob[] = [];

export const reviewRequests: ReviewRequest[] = [
  {
    id: "review-design-v3",
    title: "Duyệt bản phát hành Makeup Master v3",
    book: "Giáo trình Makeup Chuyên Nghiệp",
    category: "design",
    status: "reviewing",
    checklistDone: 2,
    checklistTotal: 3,
    comments: 3,
    updatedAt: "30/07/2026"
  },
  {
    id: "review-content-foundation",
    title: "Duyệt nội dung Kỹ thuật nền trong trẻo",
    book: "Kỹ thuật nền trong trẻo",
    category: "content",
    status: "changes",
    checklistDone: 1,
    checklistTotal: 2,
    comments: 5,
    updatedAt: "29/07/2026"
  },
  {
    id: "review-brand-hair",
    title: "Phê duyệt thương hiệu Giáo trình tóc cô dâu",
    book: "Tóc cô dâu ứng dụng",
    category: "brand",
    status: "approved",
    checklistDone: 2,
    checklistTotal: 2,
    comments: 0,
    updatedAt: "28/07/2026"
  }
];

export const studentAccessRows: StudentAccessRow[] = [
  { id: "ma", name: "Nguyễn Minh Anh", email: "minhanh@example.com", phone: "0912 111 222", classCode: "MUP-K26", progress: 78, booksCompleted: 2, lastActive: "28/07/2026", status: "learning" },
  { id: "th", name: "Trần Thu Hà", email: "thuha@example.com", phone: "0913 333 444", classCode: "MUP-K26", progress: 46, booksCompleted: 1, lastActive: "27/07/2026", status: "learning" },
  { id: "nm", name: "Lê Ngọc Mai", email: "ngocmai@example.com", phone: "0914 555 666", classCode: "SKIN-08", progress: 100, booksCompleted: 4, lastActive: "25/07/2026", status: "learning" },
  { id: "kl", name: "Phạm Khánh Linh", email: "khanhlinh@example.com", phone: "0915 777 888", classCode: "HAIR-12", progress: 21, booksCompleted: 0, lastActive: "26/07/2026", status: "learning" },
  { id: "qt", name: "Đỗ Quỳnh Trang", email: "quynhtrang@example.com", phone: "0916 999 000", classCode: "Chưa xếp lớp", progress: 0, booksCompleted: 0, lastActive: "26/07/2026", status: "invited" }
];
