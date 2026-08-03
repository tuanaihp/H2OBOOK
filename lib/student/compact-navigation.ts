// Compact learner navigation (H2OBOOK Compact Navigation Upgrade V2, adapted).
// Ported from v5/9-h2obook-compact-navigation-upgrade-v2/src/domain/{compact-types,feature-access,
// compact-navigation}.ts. This governs ONLY the post-login learner/instructor shell — the public
// landing page and the existing Admin/Owner workspace navigation (components/layout/sidebar.tsx)
// are untouched by this file and must stay that way.

export type AccountRole = "guest" | "student" | "instructor" | "reviewer" | "admin" | "owner";
export type SubscriptionTier = "guest" | "basic" | "membership_professional";

export type LearnerFeature =
  | "learn.journey" | "learn.library" | "learn.practice"
  | "create.learning_journal" | "create.my_projects" | "create.my_assets"
  | "business.storefront" | "business.member_benefits"
  | "teach.classes" | "teach.grading" | "teach.students" | "teach.feedback";

export interface UserAccessContext {
  role: AccountRole;
  subscription: SubscriptionTier;
}

const BASIC_FEATURES: LearnerFeature[] = ["learn.journey", "learn.library", "learn.practice", "create.learning_journal", "business.storefront"];
const SUBSCRIPTION_FEATURES: Record<SubscriptionTier, LearnerFeature[]> = {
  guest: [],
  basic: [],
  membership_professional: ["create.my_projects", "create.my_assets", "business.member_benefits"]
};
const CREATE_TOOL_FEATURES: LearnerFeature[] = ["create.learning_journal", "create.my_projects", "create.my_assets"];
const INSTRUCTOR_FEATURES: LearnerFeature[] = ["teach.classes", "teach.grading", "teach.students", "teach.feedback"];

export function hasFeature(context: UserAccessContext, feature: LearnerFeature): boolean {
  if (context.role === "owner" || context.role === "admin") return true;
  if ((context.role === "instructor" || context.role === "reviewer") && INSTRUCTOR_FEATURES.includes(feature)) return true;
  if (context.role !== "guest" && BASIC_FEATURES.includes(feature)) return true;
  return (SUBSCRIPTION_FEATURES[context.subscription] ?? []).includes(feature);
}

export function hasAnyFeature(context: UserAccessContext, features: LearnerFeature[]): boolean {
  return features.some((feature) => hasFeature(context, feature));
}

export interface CompactNavItem { id: string; label: string; href: string; feature?: LearnerFeature }
export interface CompactNavGroup { id: "home" | "learn" | "create" | "teach" | "business"; label: string; items: CompactNavItem[] }

function learnerGroups(context: UserAccessContext): CompactNavGroup[] {
  const groups: CompactNavGroup[] = [
    { id: "home", label: "HOME", items: [{ id: "smart-home", label: "Smart Home", href: "/student" }] },
    {
      id: "learn", label: "LEARN",
      items: ([
        { id: "journey", label: "Hành trình của tôi", href: "/student/courses", feature: "learn.journey" },
        { id: "learn-memory", label: "Học & ghi nhớ", href: "/student/learn", feature: "learn.journey" },
        { id: "library", label: "Thư viện của tôi", href: "/student/library", feature: "learn.library" },
        { id: "practice", label: "Thực hành & kết quả", href: "/student/assignments", feature: "learn.practice" }
      ] satisfies CompactNavItem[]).filter((item) => !item.feature || hasFeature(context, item.feature))
    }
  ];

  if (hasAnyFeature(context, CREATE_TOOL_FEATURES)) {
    groups.push({
      id: "create", label: "CREATE",
      items: [
        { id: "studio", label: "Studio", href: "/student/create" },
        { id: "my-projects", label: "Dự án của tôi", href: "/student/create/projects" },
        { id: "my-tools", label: "Công cụ của tôi", href: "/student/mentor" }
      ]
    });
  }

  groups.push({
    id: "business", label: "BUSINESS",
    items: ([
      { id: "store", label: "Knowledge Store", href: "/academy/courses", feature: "business.storefront" },
      { id: "account-commerce", label: "Quyền lợi & đơn hàng", href: "/student/courses" }
    ] satisfies CompactNavItem[]).filter((item) => !item.feature || hasFeature(context, item.feature))
  });

  return groups;
}

function instructorGroups(context: UserAccessContext): CompactNavGroup[] {
  const groups = learnerGroups(context);
  groups.push({
    id: "teach", label: "TEACH",
    items: ([
      { id: "my-classes", label: "Lớp của tôi", href: "/instructor/classes", feature: "teach.classes" },
      { id: "grading", label: "Bài cần chấm", href: "/instructor/assessments", feature: "teach.grading" },
      { id: "assigned-students", label: "Học viên được giao", href: "/instructor/students", feature: "teach.students" }
    ] satisfies CompactNavItem[]).filter((item) => !item.feature || hasFeature(context, item.feature))
  });
  return groups;
}

/**
 * §0 of the source module: guests keep the existing long public landing page with no app
 * sidebar, and Admin/Owner keep the existing workspace navigation untouched — this function
 * only ever returns real groups for student/instructor/reviewer roles.
 */
export function buildCompactNavigation(context: UserAccessContext): CompactNavGroup[] {
  if (context.role === "guest" || context.role === "admin" || context.role === "owner") return [];
  if (context.role === "instructor" || context.role === "reviewer") return instructorGroups(context);
  return learnerGroups(context);
}

export function toAccountRole(role: string): AccountRole {
  if (role === "student") return "student";
  if (role === "teacher") return "instructor";
  if (role === "owner") return "owner";
  if (role === "admin" || role === "designer" || role === "partner") return "admin";
  return "guest";
}
