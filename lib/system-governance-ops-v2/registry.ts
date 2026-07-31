import type { SystemSurfaceDefinition } from "./types";

export const systemSurfaceRegistry: SystemSurfaceDefinition[] = [
  { id: "account", label: "Tài khoản", description: "Hồ sơ, vai trò, phiên và bảo mật cá nhân", route: "/account", requiredRoles: ["student", "teacher", "owner", "admin"], group: "personal" },
  { id: "settings", label: "Workspace", description: "Thông tin workspace, domain, dung lượng và backup", route: "/settings", requiredRoles: ["owner", "admin"], group: "governance" },
  { id: "integrations", label: "Kết nối", description: "Supabase, R2, Redis, email và payment", route: "/integrations", requiredRoles: ["owner", "admin"], group: "governance" },
  { id: "security", label: "Bảo mật", description: "RLS, signed URL, webhook, session và audit", route: "/security", requiredRoles: ["owner", "admin"], group: "governance" },
  { id: "offline", label: "Offline", description: "Local workspace, PWA và backup thủ công", route: "/offline", requiredRoles: ["owner", "admin"], group: "governance" },
  { id: "cloud-sync", label: "Cloud Sync", description: "Snapshot, diff, push, pull và khôi phục", route: "/cloud-sync", requiredRoles: ["owner", "admin"], group: "governance" },
  { id: "assist-control", label: "AI Policy", description: "Ngân sách, tác vụ và dữ liệu gửi ra ngoài", route: "/assist-control", requiredRoles: ["owner", "admin"], group: "governance" },
  { id: "smart-settings", label: "Smart Core", description: "Local-first, flashcard local và accessibility", route: "/smart-settings", requiredRoles: ["owner", "admin"], group: "governance" },
  { id: "enterprise", label: "Enterprise", description: "API keys, webhook, quota và organization", route: "/enterprise", requiredRoles: ["owner", "admin", "platform_admin"], group: "governance" },
  { id: "admin", label: "Production Admin", description: "Runtime health, queue, audit và database readiness", route: "/admin", requiredRoles: ["owner", "admin", "platform_admin"], group: "governance" },
  { id: "operations", label: "Operations Home", description: "Bảng điều hành CRM, support, approval và automation", route: "/operations", requiredRoles: ["owner", "admin", "admissions", "support", "operations"], group: "operations" },
  { id: "operations-admissions", label: "Admissions", description: "Pipeline tuyển sinh từ lead đến cấp tài khoản", route: "/operations/admissions", requiredRoles: ["owner", "admin", "admissions"], group: "operations" },
  { id: "operations-support", label: "Support", description: "Ticket tài khoản, thanh toán, bài học và chính sách", route: "/operations/support", requiredRoles: ["owner", "admin", "support"], group: "operations" },
  { id: "operations-approvals", label: "Approval", description: "Hàng đợi duyệt nội dung, chứng nhận và marketplace", route: "/operations/approvals", requiredRoles: ["owner", "admin", "content_manager", "teacher"], group: "operations" },
  { id: "operations-notifications", label: "Notifications", description: "Template và hiệu suất gửi đa kênh", route: "/operations/notifications", requiredRoles: ["owner", "admin", "support", "admissions"], group: "operations" },
  { id: "operations-import-center", label: "Import Center", description: "Mapping, preview, commit và rollback dữ liệu", route: "/operations/import-center", requiredRoles: ["owner", "admin", "operations"], group: "operations" },
  { id: "operations-automation-center", label: "Automation", description: "Trigger, hành động, lịch sử chạy và lỗi", route: "/operations/automation-center", requiredRoles: ["owner", "admin", "operations"], group: "operations" },
  { id: "operations-product-config", label: "Product Config", description: "Public site, catalog, giá, SEO và feature flags", route: "/operations/product-config", requiredRoles: ["owner", "admin", "content_manager"], group: "operations" },
  { id: "operations-system-health", label: "System Health", description: "Database, storage, queue, workers và providers", route: "/operations/system-health", requiredRoles: ["owner", "admin", "platform_admin"], group: "operations" },
];

export function isSystemSurface(value: string): value is SystemSurfaceDefinition["id"] {
  return systemSurfaceRegistry.some((item) => item.id === value);
}

export function getSystemSurfaceGroup(group: SystemSurfaceDefinition["group"]) {
  return systemSurfaceRegistry.filter((item) => item.group === group);
}
