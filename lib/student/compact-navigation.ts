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
export interface CompactNavGroup { id: "home" | "curriculum" | "learn" | "create" | "teach" | "business"; label: string; items: CompactNavItem[] }

function learnerGroups(context: UserAccessContext): CompactNavGroup[] {
  const groups: CompactNavGroup[] = [
    { id: "home", label: "HOME", items: [{ id: "smart-home", label: "Smart Home", href: "/student" }] },
    {
      // Academy 60-session course. Collapsible group with a Google-Calendar-style view per lane;
      // sits above LEARN because for an Academy student this is the spine of their programme.
      id: "curriculum", label: "CHƯƠNG TRÌNH ĐÀO TẠO",
      items: ([
        { id: "curriculum-schedule", label: "Lịch học", href: "/student/makeup-journey", feature: "learn.journey" },
        { id: "curriculum-training", label: "Học training", href: "/student/makeup-journey/training", feature: "learn.journey" },
        { id: "curriculum-practice", label: "Học thực hành", href: "/student/makeup-journey/practice", feature: "learn.journey" },
        { id: "curriculum-hair", label: "Bới tóc", href: "/student/makeup-journey/hair", feature: "learn.journey" }
      ] satisfies CompactNavItem[]).filter((item) => !item.feature || hasFeature(context, item.feature))
    },
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
        // Used to point at /student/mentor — a leftover from before Design Library existed, so
        // "My Tools" opened the AI chat instead of any tool. Design Library (cover/profile/card/
        // certificate templates a student fills in and saves) is real and was reachable only by
        // typing the URL directly; this is the one place it belongs in nav.
        { id: "my-tools", label: "Công cụ của tôi", href: "/student/design-library" }
      ]
    });
  }

  // H2OBOOK Business Growth & Commerce Engine V1: 4 items max, tools live inside each page as
  // locked/unlocked cards (BusinessAccessSnapshot), never as separate sidebar entries — so every
  // item here is unconditionally visible to any non-guest/non-admin/owner account, same as before.
  groups.push({
    id: "business", label: "BUSINESS",
    items: [
      { id: "business-command", label: "Trung tâm kinh doanh", href: "/student/business" },
      { id: "business-customers", label: "Khách hàng & bán hàng", href: "/student/business/customers" },
      { id: "business-growth", label: "Nội dung & tăng trưởng", href: "/student/business/growth" },
      { id: "business-operations", label: "Quyền lợi & vận hành", href: "/student/business/operations" }
    ]
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

/**
 * Which single sidebar entry the current path belongs to.
 *
 * Only one entry may read as active. The obvious test — pathname === href || pathname.startsWith(
 * `${href}/`) — matched "Smart Home" (/student) on every student page, so two entries lit up at
 * once. The longest matching href wins here, so /student/business/customers resolves to that item
 * rather than to its ancestors. Returns nulls for a path outside the navigation entirely.
 */
function findItem(groups: CompactNavGroup[], itemId: string): { itemId: string | null; groupId: string | null } {
  for (const group of groups) if (group.items.some((item) => item.id === itemId)) return { itemId, groupId: group.id };
  return { itemId: null, groupId: null };
}

/**
 * `/student/missions/[missionId]` and `/student/document/[id]` are not in the nav item list at
 * all (they aren't standalone destinations), so the length-matching loop below would leave both
 * dark. Resolved explicitly first, using the launch context where the caller has it rather than
 * guessing from the path alone (v5/32-.../CLAUDE_H2OBOOK_LEARN_OUTCOME_OS_V4.md §5): a Mission
 * always lights up "Hành trình của tôi"; a Reader opened `from=mission` does too (so leaving to
 * read a bound resource doesn't look like you left the Journey), while any other Reader launch
 * (library, unspecified) lights up "Thư viện của tôi" — the same page it linked back to before this
 * context existed.
 */
export function resolveActiveItem(groups: CompactNavGroup[], pathname: string, context?: { source?: string | null }): { itemId: string | null; groupId: string | null } {
  if (pathname.startsWith("/student/missions/")) return findItem(groups, "journey");
  if (pathname.startsWith("/student/document/")) return findItem(groups, context?.source === "mission" ? "journey" : "library");

  let itemId: string | null = null;
  let groupId: string | null = null;
  let matchedLength = -1;
  for (const group of groups) {
    for (const item of group.items) {
      const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (matches && item.href.length > matchedLength) {
        matchedLength = item.href.length;
        itemId = item.id;
        groupId = group.id;
      }
    }
  }
  return { itemId, groupId };
}

export function toAccountRole(role: string): AccountRole {
  if (role === "student") return "student";
  if (role === "teacher") return "instructor";
  if (role === "owner") return "owner";
  if (role === "admin" || role === "designer" || role === "partner") return "admin";
  return "guest";
}
