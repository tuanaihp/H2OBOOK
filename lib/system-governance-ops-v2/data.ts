import type { AuditEntry, RuntimeService, SecurityControl } from "./types";

export const runtimeServices: RuntimeService[] = [
  { id: "next", name: "Next.js Web", description: "Dashboard, Studio, Reader và Store", status: "healthy", required: true },
  { id: "smart", name: "Smart Core Local", description: "Tóm tắt, quiz, flashcard, lịch ôn và preflight local", status: "healthy", required: true },
  { id: "pwa", name: "Offline / PWA", description: "Local workspace, service worker và backup", status: "healthy", required: true },
  { id: "supabase", name: "Supabase", description: "Auth, PostgreSQL, RLS và Realtime", status: "warning", required: true },
  { id: "r2", name: "Cloudflare R2", description: "Private assets, signed URL và CDN", status: "warning", required: true },
  { id: "redis", name: "Redis / BullMQ", description: "Import, export, OCR và automation", status: "warning", required: true },
  { id: "scanner", name: "File Scanner", description: "Kiểm tra file tải lên trước khi cấp quyền đọc", status: "warning", required: true },
  { id: "payment", name: "Payment Provider", description: "Checkout, webhook và entitlement", status: "warning", required: true },
  { id: "email", name: "Email Provider", description: "Mời học viên, hóa đơn và nhắc gia hạn", status: "warning", required: true },
  { id: "ai", name: "AI Gateway", description: "Lớp hỗ trợ tùy chọn, không ảnh hưởng core", status: "optional", required: false },
  { id: "monitoring", name: "Monitoring", description: "Error tracking, trace và cảnh báo", status: "optional", required: false },
];

export const securityControls: SecurityControl[] = [
  { id: "rls", name: "Row Level Security", description: "Tách dữ liệu theo organization và role", status: "missing" },
  { id: "signed", name: "Private signed URLs", description: "R2 chỉ mở bằng URL có hạn và đúng workspace", status: "missing" },
  { id: "webhook", name: "Webhook signature", description: "HMAC, retry và event idempotency", status: "missing" },
  { id: "queue", name: "Queue isolation", description: "Worker xác minh workspace trước khi xử lý", status: "missing" },
  { id: "audit", name: "Audit log", description: "Theo dõi publish, payment, role và export", status: "warning" },
  { id: "session", name: "Authenticated session", description: "Session Supabase xác minh ở Production", status: "warning" },
];

export const auditEntries: AuditEntry[] = [
  { id: "a1", actor: "Thủy H2O", action: "xuất bản", target: "Kỹ thuật nền trong trẻo v2", createdAt: "28/07/2026 18:34", severity: "success" },
  { id: "a2", actor: "Lumi Beauty", action: "yêu cầu đồng bộ", target: "Giáo trình Makeup Master v4", createdAt: "27/07/2026 18:34", severity: "warning" },
  { id: "a3", actor: "Giảng viên Mai", action: "đã chấm", target: "Phân tích cấu trúc khuôn mặt", createdAt: "26/07/2026 18:34", severity: "info" },
];

export const migrationReadiness = [
  { id: "0001", label: "Core + RLS", ready: true },
  { id: "0002", label: "Training & Commerce", ready: true },
  { id: "0003", label: "Workflow & Licensing", ready: true },
  { id: "0004", label: "Production Core", ready: true },
  { id: "0005", label: "Security Hardening", ready: true },
  { id: "restore", label: "Restore test & backup policy", ready: false },
];

export const cloudSnapshots = [
  { id: "snap-35", version: "v3.5", createdAt: "28/07/2026 23:10", size: "18.4 MB", status: "latest" },
  { id: "snap-34", version: "v3.4", createdAt: "27/07/2026 22:05", size: "17.9 MB", status: "available" },
  { id: "snap-33", version: "v3.3", createdAt: "26/07/2026 21:40", size: "17.2 MB", status: "available" },
];

import type {
  AdmissionLead,
  ApprovalRequest,
  AutomationWorkflow,
  ImportBatch,
  NotificationTemplate,
  OperationsHealthService,
  ProductConfigurationItem,
  SupportTicket,
} from "./types";

export const admissionLeads: AdmissionLead[] = [
  { id: "lead-1", name: "Phạm Ngọc Mai", phone: "0977 112 233", product: "Membership Academy Pro", owner: "Chưa phân công", source: "Website", value: 9588000, stage: "new", nextActionAt: "31/07/2026 10:00" },
  { id: "lead-2", name: "Nguyễn Minh Anh", phone: "0901 234 567", product: "Makeup Chuyên Nghiệp 3 Tháng", owner: "Lan Nguyễn", source: "Facebook Ads", value: 19800000, stage: "consulted", nextActionAt: "31/07/2026 14:00" },
  { id: "lead-3", name: "Lê Hoàng Yến", phone: "0912 778 899", product: "Makeup Cá Nhân", owner: "Lê Tân H2O", source: "Giới thiệu", value: 3600000, stage: "qualified", nextActionAt: "01/08/2026 09:30" },
  { id: "lead-4", name: "Trần Thu Hà", phone: "0988 456 123", product: "Makeup Advance Master", owner: "Thủy H2O", source: "TikTok", value: 12900000, stage: "deposit", nextActionAt: "31/07/2026 16:00" },
];

export const approvalRequests: ApprovalRequest[] = [
  { id: "approval-1", title: "Makeup Pro K27 · Chương 6", kind: "course", requester: "Lan Nguyễn", risk: "medium", status: "pending", checklistDone: 2, checklistTotal: 3, createdAt: "30/07/2026" },
  { id: "approval-2", title: "Cấp bằng tốt nghiệp K26", kind: "certificate", requester: "Academic Ops", risk: "high", status: "pending", checklistDone: 1, checklistTotal: 2, createdAt: "30/07/2026" },
  { id: "approval-3", title: "Landing Makeup Advance Master", kind: "landing", requester: "Marketing", risk: "medium", status: "changes_requested", checklistDone: 1, checklistTotal: 3, createdAt: "29/07/2026" },
];

export const automationWorkflows: AutomationWorkflow[] = [
  { id: "wf-1", name: "Lead mới → giao tư vấn viên", trigger: "lead.created", steps: ["Phân công theo vòng", "Gửi Zalo chào mừng", "Tạo nhắc việc sau 24 giờ"], status: "active", runs: 842, errors: 4, lastRunAt: "31/07/2026 08:21" },
  { id: "wf-2", name: "Thanh toán đủ → cấp tài khoản", trigger: "order.paid", steps: ["Cập nhật hồ sơ", "Xếp lớp", "Tạo tài khoản", "Gửi thư mời"], status: "active", runs: 184, errors: 1, lastRunAt: "31/07/2026 07:55" },
  { id: "wf-3", name: "Đủ điều kiện → tạo bằng", trigger: "course.completed", steps: ["Kiểm tra rubric", "Tạo certificate", "Gửi QR xác minh"], status: "draft", runs: 0, errors: 0 },
];

export const importBatches: ImportBatch[] = [
  { id: "import-1", fileName: "leads-facebook-july.csv", owner: "Marketing", entity: "leads", rows: 240, validRows: 231, errorRows: 9, status: "ready" },
  { id: "import-2", fileName: "hoc-vien-k26.xlsx", owner: "Academic Ops", entity: "students", rows: 22, validRows: 22, errorRows: 0, status: "completed" },
];

export const notificationTemplates: NotificationTemplate[] = [
  { id: "nt-1", name: "Xác nhận đặt cọc", event: "admission.deposit_paid", channels: ["email", "zalo", "in_app"], status: "active", sent: 128, errors: 2 },
  { id: "nt-2", name: "Nhắc hạn nộp bài", event: "student.assignment_due", channels: ["push", "in_app"], status: "active", sent: 842, errors: 7 },
  { id: "nt-3", name: "Cấp chứng nhận", event: "certificate.issued", channels: ["email", "zalo"], status: "active", sent: 96, errors: 0 },
];

export const productConfigurationItems: ProductConfigurationItem[] = [
  { id: "pc-1", label: "Homepage sections", description: "Thứ tự, trạng thái và CTA của trang chủ", group: "public_academy", status: "active", updatedAt: "30/07/2026" },
  { id: "pc-2", label: "Featured books", description: "Sách nổi bật và thứ tự hiển thị", group: "catalog", status: "active", updatedAt: "30/07/2026" },
  { id: "pc-3", label: "Featured courses", description: "Khóa học nổi bật, lớp và lịch khai giảng", group: "catalog", status: "active", updatedAt: "30/07/2026" },
  { id: "pc-4", label: "Membership plans", description: "Quyền lợi, chu kỳ và giá công khai", group: "pricing", status: "active", updatedAt: "29/07/2026" },
  { id: "pc-5", label: "SEO & social preview", description: "Metadata, Open Graph và schema", group: "seo", status: "active", updatedAt: "29/07/2026" },
  { id: "ff-1", label: "Public Academy V5", description: "Public Academy unified experience", group: "feature_flag", status: "active", updatedAt: "31/07/2026" },
  { id: "ff-2", label: "Academic Operations V2", description: "Learning administration unified experience", group: "feature_flag", status: "active", updatedAt: "31/07/2026" },
  { id: "ff-3", label: "Global Neural Design", description: "Global neural visual layer", group: "feature_flag", status: "active", updatedAt: "31/07/2026" },
  { id: "ff-4", label: "Knowledge Universe Hero", description: "Public neural knowledge hero", group: "feature_flag", status: "active", updatedAt: "31/07/2026" },
  { id: "ff-5", label: "System Governance Operations V2", description: "System and Operations unified control plane", group: "feature_flag", status: "draft", updatedAt: "31/07/2026" },
];

export const supportTickets: SupportTicket[] = [
  { id: "H2O-260730-001", title: "Chưa nhận được tài khoản học viên", requester: "Trần Thu Hà", category: "account", priority: "high", status: "open", createdAt: "30/07/2026 08:40" },
  { id: "H2O-260729-014", title: "Không tải được video bài tập", requester: "Nguyễn Minh Anh", category: "assignment", priority: "normal", status: "in_progress", assignee: "Support H2O", createdAt: "29/07/2026 16:20" },
  { id: "H2O-260728-009", title: "Sai lịch buổi thực hành", requester: "Lan Nguyễn", category: "course", priority: "normal", status: "waiting_customer", assignee: "Academic Ops", createdAt: "28/07/2026 11:15" },
];

export const operationsHealthServices: OperationsHealthService[] = [
  { id: "db", name: "Supabase Database", detail: "Query và RLS sẵn sàng", status: "active", latencyMs: 82, lastCheckedAt: "31/07/2026 08:40" },
  { id: "r2", name: "Cloudflare R2", detail: "Private bucket và signed URL sẵn sàng", status: "active", latencyMs: 118, lastCheckedAt: "31/07/2026 08:40" },
  { id: "redis", name: "Redis Queue", detail: "Không có job lỗi", status: "active", latencyMs: 24, queueDepth: 0, lastCheckedAt: "31/07/2026 08:40" },
  { id: "document", name: "Document Worker", detail: "Thời gian xử lý cao hơn bình thường", status: "monitoring", latencyMs: 1480, queueDepth: 3, lastCheckedAt: "31/07/2026 08:40" },
  { id: "publishing", name: "Publishing Worker", detail: "EPUB, PDF và SCORM sẵn sàng", status: "active", latencyMs: 315, queueDepth: 1, lastCheckedAt: "31/07/2026 08:40" },
  { id: "email", name: "Email Provider", detail: "Delivery rate 98.7%", status: "active", latencyMs: 222, lastCheckedAt: "31/07/2026 08:40" },
  { id: "payment", name: "Payment Provider", detail: "Webhook signatures verified", status: "active", latencyMs: 280, lastCheckedAt: "31/07/2026 08:40" },
  { id: "webhook", name: "Webhooks", detail: "No retry backlog", status: "active", latencyMs: 91, queueDepth: 0, lastCheckedAt: "31/07/2026 08:40" },
];
