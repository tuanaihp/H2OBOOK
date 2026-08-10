import {
  Activity, BadgeCheck, BellRing, BookOpenCheck, Bot, Brain, Building2, CheckCheck, CircleDollarSign, Compass,
  CloudCog, FileInput, GraduationCap, HeartHandshake, LayoutDashboard, LibraryBig, LifeBuoy, ListChecks,
  LockKeyhole, MessageSquareText, PackageSearch, PlugZap, School, Settings2, ShieldCheck, UsersRound, Workflow
} from "lucide-react";

export const customerRoutes = [
  { href: "/customer", label: "Tổng quan đăng ký", icon: LayoutDashboard },
  { href: "/customer/onboarding", label: "Hồ sơ nhập học", icon: ListChecks },
  { href: "/customer/orders", label: "Đơn hàng", icon: PackageSearch },
  { href: "/customer/payments", label: "Thanh toán", icon: CircleDollarSign }
];

export const instructorRoutes = [
  { href: "/instructor", label: "Command Center", icon: LayoutDashboard },
  { href: "/instructor/classes", label: "Lớp của tôi", icon: School },
  { href: "/instructor/brain-studio", label: "H2O Brain Studio", icon: Brain },
  { href: "/instructor/assessments", label: "Bài cần chấm", icon: BookOpenCheck },
  { href: "/instructor/students", label: "Tiến độ học viên", icon: UsersRound }
];

export const operationsRoutes = [
  { href: "/operations", label: "Operations Overview", icon: LayoutDashboard },
  { href: "/operations/admissions", label: "CRM & Admissions", icon: GraduationCap },
  { href: "/operations/support", label: "Support Center", icon: LifeBuoy },
  { href: "/operations/approvals", label: "Approval Center", icon: CheckCheck },
  { href: "/operations/notifications", label: "Notification Center", icon: BellRing },
  { href: "/operations/import-center", label: "Data Import Center", icon: FileInput },
  { href: "/operations/automation-center", label: "Automation Center", icon: Workflow },
  { href: "/operations/product-config", label: "Product Configuration", icon: Settings2 },
  { href: "/operations/system-health", label: "System Health", icon: CloudCog }
];

export const systemRoutes = [
  { href: "/system", label: "System Command Center", icon: CloudCog },
  { href: "/security", label: "Bảo mật", icon: LockKeyhole },
  { href: "/integrations", label: "Tích hợp", icon: PlugZap }
];

export const academyAdminRoutes = [
  { href: "/academy-admin", label: "Tổng quan đào tạo", icon: LayoutDashboard },
  { href: "/academy-admin/stages", label: "Giai đoạn & lộ trình", icon: Compass },
  { href: "/academy-admin/journey", label: "Journey Map", icon: Workflow },
  { href: "/academy-admin/content", label: "Kho nội dung Academy", icon: LibraryBig },
  { href: "/academy-admin/brain", label: "H2O Brain", icon: Brain },
  { href: "/academy-admin/programs", label: "Khóa học video", icon: GraduationCap },
  { href: "/academy-admin/distribution", label: "Phân phối & cấp quyền", icon: BadgeCheck }
];

export const platformRoutes = [
  { href: "/platform-admin", label: "Platform Overview", icon: LayoutDashboard },
  { href: "/platform-admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/platform-admin/plans", label: "Plans & Quotas", icon: BadgeCheck },
  { href: "/platform-admin/system-health", label: "Platform Health", icon: Activity }
];

export const operationsRouteManifest = {
  public: ["/verify/[certificateNo]"],
  customer: customerRoutes.map((item) => item.href),
  instructor: instructorRoutes.map((item) => item.href),
  operations: operationsRoutes.map((item) => item.href),
  system: systemRoutes.map((item) => item.href),
  academyAdmin: academyAdminRoutes.map((item) => item.href),
  platformAdmin: platformRoutes.map((item) => item.href)
};
