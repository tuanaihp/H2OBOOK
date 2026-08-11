import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatVnd } from "@/lib/public-site/content";
import type { GrowthRecommendation } from "./types";

type ProductRow = { id: string; product_type: string; reference_id: string | null; name: string; description: string | null; price: number; currency: string; settings: { publicSlug?: string } | null };
type CourseRow = { id: string; slug: string; title: string; subtitle: string; category: string; level: string; outcomes: string[] };

/**
 * Rules-first Growth Recommendations (v5/32-.../CLAUDE_INTEGRATION_PROMPT.md §8) — reuses the exact
 * entitlement/membership facts lib/academy/student-course.ts's getStudentCourseSummaries already
 * computes for "Khóa học bổ trợ" (this function replaces that section), and the real `products` /
 * `academy_courses` / `memberships` tables. No AI call here: AI may only re-rank/explain later
 * (§12), never invent price, offers or entitlement state — every price/benefit string below comes
 * straight off a real row.
 *
 * Two of the four kinds the source package specifies have no real data source in this org today,
 * confirmed by querying production directly rather than assumed:
 *   - `premium_resource` would come from career_stage_resources rows with access='entitlement_only'
 *     that the student does not yet hold — 0 such rows exist (the whole curriculum is currently
 *     free_preview/stage_locked only). The query below is real and will start returning results the
 *     day Admin marks a resource entitlement-only; it is not stubbed out.
 *   - `membership` is omitted once the student already holds an active membership (test #16 —
 *     never re-sell what they already have), not because the kind itself is unreachable.
 */
export async function getGrowthRecommendations(userId: string, organizationId: string, role: string): Promise<GrowthRecommendation[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const now = new Date().toISOString();
  const privileged = ["owner", "admin", "teacher"].includes(role);

  const [{ data: products }, { data: entitlements }, { data: premiumResourceRows }] = await Promise.all([
    admin.from("products").select("id,product_type,reference_id,name,description,price,currency,settings").eq("organization_id", organizationId).eq("status", "active"),
    admin.from("entitlements").select("resource_type,resource_id,expires_at").eq("organization_id", organizationId).eq("user_id", userId).eq("status", "active"),
    admin.from("career_stage_resources").select("id,title_override,resource_type,resource_id").eq("organization_id", organizationId).eq("access", "entitlement_only")
  ]);

  const activeEntitlements = ((entitlements ?? []) as { resource_type: string; resource_id: string; expires_at: string | null }[])
    .filter((e) => !e.expires_at || e.expires_at > now);
  const hasMembership = privileged || activeEntitlements.some((e) => e.resource_type === "membership");
  const entitledCourseIds = new Set(activeEntitlements.filter((e) => e.resource_type === "course").map((e) => e.resource_id));
  const entitledResourceIds = new Set(activeEntitlements.filter((e) => e.resource_type !== "course" && e.resource_type !== "membership").map((e) => e.resource_id));

  const courseProducts = ((products ?? []) as ProductRow[]).filter((p) => p.product_type === "course" && p.reference_id);
  const membershipProducts = ((products ?? []) as ProductRow[]).filter((p) => p.product_type === "membership");
  const courseIds = courseProducts.map((p) => p.reference_id!) as string[];
  const { data: courseRows } = courseIds.length
    ? await admin.from("academy_courses").select("id,slug,title,subtitle,category,level,outcomes").in("id", courseIds).eq("status", "active")
    : { data: [] };
  const courseById = new Map(((courseRows ?? []) as CourseRow[]).map((c) => [c.id, c]));

  const included: GrowthRecommendation[] = [];
  const courseKind: GrowthRecommendation[] = [];
  for (const product of courseProducts) {
    const course = courseById.get(product.reference_id!);
    if (!course) continue;
    const owned = privileged || hasMembership || entitledCourseIds.has(course.id);
    const item: GrowthRecommendation = {
      id: product.id, kind: owned ? "included" : "course",
      title: course.title, subtitle: course.subtitle || null,
      reason: owned ? "Bạn đã có quyền truy cập khóa học này." : `${course.category || "Khóa học"}${course.level ? ` · ${course.level}` : ""}`.trim(),
      currentGap: null,
      benefits: course.outcomes.slice(0, 4),
      priceLabel: owned ? null : formatVnd(Number(product.price)),
      ctaLabel: owned ? "Học ngay" : "Xem lộ trình",
      href: owned ? `/student/courses/${course.slug}` : `/academy/courses/${course.slug}`
    };
    (owned ? included : courseKind).push(item);
  }

  const premiumResource: GrowthRecommendation[] = ((premiumResourceRows ?? []) as { id: string; title_override: string | null; resource_type: string; resource_id: string }[])
    .filter((r) => !entitledResourceIds.has(r.resource_id) && !hasMembership)
    .map((r) => ({
      id: r.id, kind: "premium_resource" as const, title: r.title_override || "Tài liệu nâng cao", subtitle: null,
      reason: "Nội dung nâng cao ngoài phần miễn phí, cần quyền riêng để mở.", currentGap: null, benefits: [],
      priceLabel: null, ctaLabel: "Xem chi tiết", href: "/student/library"
    }));

  const membership: GrowthRecommendation[] = hasMembership ? [] : membershipProducts.map((product) => ({
    id: product.id, kind: "membership" as const, title: product.name, subtitle: product.description,
    reason: "Mở khóa toàn bộ giai đoạn và tài liệu ngoài phần miễn phí hiện tại.", currentGap: null, benefits: [],
    priceLabel: `${formatVnd(Number(product.price))}/tháng`, ctaLabel: "So sánh quyền lợi",
    href: `/academy/membership?plan=${product.settings?.publicSlug ?? ""}#academy-enrollment`
  }));

  return [...included, ...premiumResource, ...courseKind.slice(0, 3), ...membership];
}
