import type {
  AdmissionLead, ApprovalRequest, AssessmentTask, AutomationRecipe, CertificateIssue, CustomerApplication,
  DataImportJob, InstructorClass, NotificationTemplate, PlatformIncident, PlatformOrganization, SupportTicket
} from "@/types/operations";

const now = new Date("2026-07-30T09:00:00+07:00");
const iso = (days: number, hours = 0) => new Date(now.getTime() + days * 86400000 + hours * 3600000).toISOString();

export const seedAdmissionLeads: AdmissionLead[] = [
  { id: "lead_001", name: "Nguyễn Minh Anh", phone: "0901 234 567", email: "minhanh@example.com", source: "Facebook Ads", interest: "Makeup Chuyên Nghiệp 3 Tháng", stage: "consulted", ownerName: "Lan Nguyễn", nextActionAt: iso(0, 3), expectedValue: 19800000, notes: "Muốn học ca sáng, cần tư vấn lịch khai giảng gần nhất.", tags: ["makeup-pro", "ca-sáng"], createdAt: iso(-3), updatedAt: iso(-1) },
  { id: "lead_002", name: "Trần Thu Hà", phone: "0988 456 123", email: "thuha@example.com", source: "TikTok", interest: "Makeup Advance Master", stage: "deposit", ownerName: "Thuỷ H2O", nextActionAt: iso(1), expectedValue: 12900000, notes: "Đã đặt cọc, chờ hoàn thiện hồ sơ.", tags: ["advance", "đã-cọc"], createdAt: iso(-7), updatedAt: iso(0) },
  { id: "lead_003", name: "Lê Hoàng Yến", phone: "0912 778 899", email: "hoangyen@example.com", source: "Giới thiệu", interest: "Makeup Cá Nhân", stage: "qualified", ownerName: "Lễ tân H2O", nextActionAt: iso(2), expectedValue: 3600000, notes: "Ưu tiên lịch cuối tuần.", tags: ["cá-nhân"], createdAt: iso(-2), updatedAt: iso(-1) },
  { id: "lead_004", name: "Phạm Ngọc Mai", phone: "0977 112 233", email: "ngocmai@example.com", source: "Website", interest: "Membership Academy Pro", stage: "new", ownerName: "Chưa phân công", nextActionAt: iso(0, 1), expectedValue: 9588000, notes: "Đã tải brochure, chưa liên hệ.", tags: ["membership", "website"], createdAt: iso(0), updatedAt: iso(0) }
];

export const seedApplications: CustomerApplication[] = [
  { id: "app_001", leadId: "lead_002", customerName: "Trần Thu Hà", programName: "Makeup Advance Master", profileCompletion: 75, paymentStatus: "deposit", onboardingStage: "documents", accountProvisioned: false, documents: [{ id: "doc_1", label: "CCCD", status: "verified" }, { id: "doc_2", label: "Ảnh hồ sơ", status: "uploaded" }, { id: "doc_3", label: "Cam kết học tập", status: "missing" }], updatedAt: iso(0) },
  { id: "app_002", leadId: "lead_003", customerName: "Lê Hoàng Yến", programName: "Makeup Cá Nhân Thông Minh", profileCompletion: 45, paymentStatus: "unpaid", onboardingStage: "payment", accountProvisioned: false, documents: [{ id: "doc_4", label: "Thông tin cá nhân", status: "uploaded" }, { id: "doc_5", label: "Xác nhận lịch học", status: "missing" }], updatedAt: iso(-1) }
];

export const seedInstructorClasses: InstructorClass[] = [
  { id: "ic_001", name: "Makeup Chuyên Nghiệp K27", code: "MUP-K27", schedule: "Thứ 2-4-6 · 08:30", studentCount: 18, progress: 62, pendingAssessments: 7, atRiskStudents: 2, nextSessionAt: iso(1), status: "active" },
  { id: "ic_002", name: "Advance Master A09", code: "ADV-A09", schedule: "Thứ 3-5 · 13:30", studentCount: 12, progress: 38, pendingAssessments: 4, atRiskStudents: 1, nextSessionAt: iso(0, 5), status: "active" },
  { id: "ic_003", name: "Makeup Cá Nhân C18", code: "PER-C18", schedule: "Chủ nhật · 09:00", studentCount: 8, progress: 0, pendingAssessments: 0, atRiskStudents: 0, nextSessionAt: iso(4), status: "upcoming" }
];

export const seedAssessmentTasks: AssessmentTask[] = [
  { id: "assess_001", classId: "ic_001", studentName: "Minh Anh", assignmentTitle: "Nền cô dâu trong trẻo", submittedAt: iso(-1), dueAt: iso(1), status: "submitted", priority: "high" },
  { id: "assess_002", classId: "ic_001", studentName: "Thu Trang", assignmentTitle: "Tóc sóng ứng dụng", submittedAt: iso(-2), dueAt: iso(0), status: "reviewing", priority: "urgent" },
  { id: "assess_003", classId: "ic_002", studentName: "Hoài Phương", assignmentTitle: "Concept cô dâu editorial", submittedAt: iso(-1), dueAt: iso(2), status: "changes_requested", score: 72, priority: "normal" }
];

export const seedSupportTickets: SupportTicket[] = [
  { id: "ticket_001", code: "H2O-260730-001", requesterName: "Trần Thu Hà", requesterType: "customer", category: "account", subject: "Chưa nhận được tài khoản học viên", description: "Đã đặt cọc nhưng chưa nhận email kích hoạt.", priority: "high", status: "open", assigneeName: "Support H2O", createdAt: iso(-1), updatedAt: iso(0) },
  { id: "ticket_002", code: "H2O-260729-014", requesterName: "Nguyễn Minh Anh", requesterType: "student", category: "assignment", subject: "Không tải được video bài tập", description: "Video 480MB bị dừng ở 72%.", priority: "normal", status: "in_progress", assigneeName: "Kỹ thuật", createdAt: iso(-2), updatedAt: iso(-1) },
  { id: "ticket_003", code: "H2O-260728-009", requesterName: "Lan Nguyễn", requesterType: "instructor", category: "course", subject: "Sai lịch buổi thực hành", description: "Cần đổi lịch buổi 18 sang sáng thứ 7.", priority: "normal", status: "waiting_customer", assigneeName: "Academic Ops", createdAt: iso(-3), updatedAt: iso(-1) }
];

export const seedApprovals: ApprovalRequest[] = [
  { id: "approval_001", type: "course", title: "Makeup Pro K27 · Chương 6", requesterName: "Lan Nguyễn", reviewerName: "Thuỷ H2O", status: "pending", dueAt: iso(1), riskLevel: "medium", createdAt: iso(-1), updatedAt: iso(0) },
  { id: "approval_002", type: "certificate", title: "Cấp bằng tốt nghiệp K26", requesterName: "Academic Ops", reviewerName: "Thuỷ H2O", status: "pending", dueAt: iso(0, 5), riskLevel: "high", createdAt: iso(-1), updatedAt: iso(-1) },
  { id: "approval_003", type: "landing", title: "Landing Makeup Advance Master", requesterName: "Marketing", reviewerName: "Brand Manager", status: "changes_requested", dueAt: iso(2), riskLevel: "medium", createdAt: iso(-4), updatedAt: iso(-1) }
];

export const seedNotificationTemplates: NotificationTemplate[] = [
  { id: "notify_001", eventKey: "admission.deposit_paid", name: "Xác nhận đặt cọc", channels: ["email", "zalo", "in_app"], enabled: true, sentCount: 128, failureCount: 2, updatedAt: iso(-3) },
  { id: "notify_002", eventKey: "student.assignment_due", name: "Nhắc hạn nộp bài", channels: ["push", "in_app"], enabled: true, sentCount: 842, failureCount: 7, updatedAt: iso(-2) },
  { id: "notify_003", eventKey: "certificate.issued", name: "Cấp chứng nhận", channels: ["email", "zalo"], enabled: true, sentCount: 96, failureCount: 0, updatedAt: iso(-7) }
];

export const seedImportJobs: DataImportJob[] = [
  { id: "import_001", type: "leads", fileName: "leads-facebook-july.csv", rowCount: 240, validRows: 231, invalidRows: 9, status: "ready", createdBy: "Marketing", createdAt: iso(-1), rollbackAvailable: false },
  { id: "import_002", type: "students", fileName: "hoc-vien-k26.xlsx", rowCount: 22, validRows: 22, invalidRows: 0, status: "completed", createdBy: "Academic Ops", createdAt: iso(-8), rollbackAvailable: true }
];

export const seedAutomationRecipes: AutomationRecipe[] = [
  { id: "auto_001", name: "Lead mới → giao tư vấn viên", trigger: "lead.created", actions: ["Phân công theo vòng", "Gửi Zalo chào mừng", "Tạo nhắc việc sau 24 giờ"], status: "active", runCount: 842, errorCount: 4, lastRunAt: iso(0) },
  { id: "auto_002", name: "Thanh toán đủ → cấp tài khoản", trigger: "order.paid", actions: ["Cập nhật hồ sơ", "Xếp lớp", "Tạo tài khoản", "Gửi thư mời"], status: "active", runCount: 184, errorCount: 1, lastRunAt: iso(-1) },
  { id: "auto_003", name: "Đủ điều kiện → tạo bằng", trigger: "course.completed", actions: ["Kiểm tra rubric", "Tạo certificate", "Gửi QR xác minh"], status: "draft", runCount: 0, errorCount: 0 }
];

export const seedOrganizations: PlatformOrganization[] = [
  { id: "org_001", name: "ThuyH2O Makeup Academy", slug: "thuyh2o", plan: "enterprise", status: "active", memberCount: 14, studentCount: 184, storageUsedGb: 1.8, storageLimitGb: 25, monthlyRevenue: 24000000, customDomain: "book.thuyh2o.vn", createdAt: iso(-480) },
  { id: "org_002", name: "Lumi Beauty Learning", slug: "lumi-beauty", plan: "academy", status: "trial", memberCount: 5, studentCount: 38, storageUsedGb: 0.4, storageLimitGb: 5, monthlyRevenue: 0, createdAt: iso(-18) },
  { id: "org_003", name: "Aurora Bridal Academy", slug: "aurora-bridal", plan: "business", status: "past_due", memberCount: 7, studentCount: 62, storageUsedGb: 4.7, storageLimitGb: 10, monthlyRevenue: 799000, createdAt: iso(-160) }
];

export const seedIncidents: PlatformIncident[] = [
  { id: "incident_001", service: "document_worker", status: "monitoring", severity: "minor", title: "OCR queue tăng thời gian xử lý", startedAt: iso(0, -2) },
  { id: "incident_002", service: "email", status: "resolved", severity: "info", title: "Độ trễ email provider", startedAt: iso(-2), resolvedAt: iso(-2, 1) }
];

export const seedCertificates: CertificateIssue[] = [
  { id: "cert_001", certificateNo: "H2O-MUP-2026-0018", studentName: "Nguyễn Minh Anh", courseName: "Makeup Chuyên Nghiệp 3 Tháng", issuedAt: "2026-07-20T09:00:00+07:00", instructorName: "Thuỷ H2O", status: "valid", verificationToken: "verify-minhanh-0018" },
  { id: "cert_002", certificateNo: "H2O-ADV-2026-0009", studentName: "Trần Thu Hà", courseName: "Makeup Advance Master", issuedAt: "2026-06-12T09:00:00+07:00", instructorName: "Thuỷ H2O", status: "valid", verificationToken: "verify-thuha-0009" }
];
