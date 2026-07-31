import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { rateLimit, requestIdentity } from "@/lib/security/rate-limit";
import { emitDomainEvent, recordServerAnalytics } from "@/lib/domain/events";
import { isSupabaseConfigured } from "@/lib/runtime-config";

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const limit = await rateLimit(requestIdentity(request, "public-membership-lead"), 10, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const body = await request.json().catch(() => null) as {
    planId?: string;
    productId?: string;
    customerName?: string;
    customerEmail?: string;
    phone?: string;
    goal?: string;
    consent?: boolean;
    website?: string;
    elapsedMs?: number;
    source?: string;
  } | null;

  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  if (clean(body.website, 200) || Number(body.elapsedMs ?? 0) < 800) return NextResponse.json({ ok: true });

  const name = clean(body.customerName, 120);
  const email = clean(body.customerEmail, 180).toLowerCase();
  const phone = clean(body.phone, 40);
  const goal = clean(body.goal, 500);
  const planId = clean(body.planId, 80);

  if (name.length < 2) return NextResponse.json({ error: "VALID_NAME_REQUIRED" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "VALID_EMAIL_REQUIRED" }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 8) return NextResponse.json({ error: "VALID_PHONE_REQUIRED" }, { status: 400 });
  if (!body.consent) return NextResponse.json({ error: "CONSENT_REQUIRED" }, { status: 400 });
  if (!planId) return NextResponse.json({ error: "PLAN_REQUIRED" }, { status: 400 });

  const organizationId = process.env.PUBLIC_ACADEMY_ORGANIZATION_ID;
  if (isSupabaseConfigured() && !organizationId) {
    return NextResponse.json({ error: "PUBLIC_ACADEMY_ORGANIZATION_ID_REQUIRED" }, { status: 503 });
  }
  const source = clean(body.source, 80) || "public-membership-v2";
  const leadPayload = {
    planId,
    productId: clean(body.productId, 80) || null,
    name,
    email,
    phone,
    goal,
    source,
    consentAt: new Date().toISOString(),
  };

  if (organizationId) {
    await emitDomainEvent({
      organizationId,
      resourceType: "membership_lead",
      resourceId: null,
      eventName: "membership.lead_submitted",
      payload: leadPayload,
    }).catch(() => null);
  }

  await recordServerAnalytics({
    organizationId: organizationId ?? null,
    anonymousId: crypto.createHash("sha256").update(email).digest("hex").slice(0, 32),
    eventName: "lead_submitted",
    resourceType: "membership_plan",
    resourceId: planId,
    sessionId: request.headers.get("x-session-id"),
    properties: { planId, productId: leadPayload.productId, source, hasGoal: Boolean(goal) },
  }).catch(() => null);

  return NextResponse.json({ ok: true, mode: organizationId ? "event-recorded" : "analytics-only" });
}
