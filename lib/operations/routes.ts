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
  // Labels renamed per v5/29-H2OBOOK_JOURNEY_MAP_V2_SMART_UPGRADE's docs/ADMIN_NAMING.md — the two
  // routes were easy to conflate ("lộ trình" and "Journey" both read as "the path"), even though
  // one configures the curriculum graph (Stage/Program/Module/Group/Resource) and the other the
  // outcome graph (Outcome/Mission/Action/Evidence/Result). Route and component names are unchanged.
  { href: "/academy-admin/stages", label: "Giai đoạn & Nội dung đào tạo", icon: Compass },
  { href: "/academy-admin/journey", label: "Bản đồ kết quả học viên", icon: Workflow },
  { href: "/academy-admin/content", label: "Kho nội dung Academy", icon: LibraryBig },
  { href: "/academy-admin/brain", label: "H2O Brain", icon: Brain },
  { href: "/academy-admin/programs", label: "Khóa học video", icon: GraduationCap },
  { href: "/academy-admin/distribution", label: "Phân phối & cấp quyền", icon: BadgeCheck },
  // Learning Control Center (v5/32-.../CLAUDE_INTEGRATION_PROMPT.md §9): "Classes & Cohorts" and
  // "Assignment & Review" already exist as real, DB-backed pages — just under /instructor/*, which
  // Owner/Admin already have permission for (lib/operations/permissions.ts) but had no link into
  // from here. Bridged rather than rebuilt: same data, one more entry point.
  { href: "/instructor/classes", label: "Classes & Cohorts", icon: School },
  { href: "/instructor/assessments", label: "Assignment & Review", icon: BookOpenCheck }
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
