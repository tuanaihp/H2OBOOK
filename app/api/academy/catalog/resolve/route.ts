import { NextResponse } from "next/server";
import { getAcademyTarget, type AcademyTargetType } from "@/lib/academy/catalog";
import { ensureAcademyCatalogProduct, resolveAcademyOrganization } from "@/lib/academy/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { rateLimit, requestIdentity } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const limit = await rateLimit(requestIdentity(request, "academy-catalog-resolve"), 12, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const body = await request.json().catch(() => null) as { targetType?: AcademyTargetType; targetSlug?: string } | null;
  if (!body?.targetType || !body.targetSlug || !getAcademyTarget(body.targetType, body.targetSlug)) return NextResponse.json({ error: "TARGET_NOT_FOUND" }, { status: 404 });
  const target = getAcademyTarget(body.targetType, body.targetSlug)!;
  if (!isSupabaseConfigured()) return NextResponse.json({ productId: null, amount: target.price, currency: "VND", mode: "demo" });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
  const organization = await resolveAcademyOrganization(admin);
  if (!organization) return NextResponse.json({ error: "ACADEMY_ORGANIZATION_NOT_CONFIGURED" }, { status: 503 });
  try {
    const product = await ensureAcademyCatalogProduct(admin, String(organization.id), body.targetType, body.targetSlug);
    return NextResponse.json({ productId: product.id, amount: Number(product.price), currency: product.currency, mode: "production" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "CATALOG_SYNC_FAILED" }, { status: 400 });
  }
}
