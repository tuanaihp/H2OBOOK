import { NextResponse } from "next/server";
import { paymentProvider } from "@/lib/payments/provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import { rateLimit, requestIdentity } from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { emitDomainEvent, recordServerAnalytics } from "@/lib/domain/events";

export async function POST(request: Request) {
  const limit = await rateLimit(requestIdentity(request, "checkout"), 12, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const body = await request.json() as {
    productId?: string; customerName?: string; customerEmail?: string; returnUrl?: string;
    orderId?: string; orderCode?: string; amount?: number; currency?: string;
  };
  if (!body.customerEmail || !/^\S+@\S+\.\S+$/.test(body.customerEmail)) return NextResponse.json({ error: "VALID_EMAIL_REQUIRED" }, { status: 400 });

  let orderId = body.orderId ?? crypto.randomUUID();
  let orderCode = body.orderCode ?? `H2B-${Date.now()}`;
  let amount = Number(body.amount ?? 0);
  let currency = body.currency ?? "VND";

  if (isSupabaseConfigured()) {
    if (!body.productId) return NextResponse.json({ error: "PRODUCT_REQUIRED" }, { status: 400 });
    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "PAYMENT_SERVER_NOT_CONFIGURED" }, { status: 503 });
    const { data: product, error: productError } = await admin.from("products").select("id,organization_id,name,price,currency,status,product_type,reference_id,billing_interval").eq("id", body.productId).eq("status", "active").maybeSingle();
    if (productError || !product) return NextResponse.json({ error: "PRODUCT_NOT_AVAILABLE" }, { status: 404 });
    const user = await getCurrentUser();
    orderCode = `H2B-${new Date().toISOString().slice(2,10).replaceAll("-","")}-${Math.floor(1000 + Math.random() * 9000)}`;
    amount = Number(product.price); currency = String(product.currency ?? "VND");
    const { data: order, error: orderError } = await admin.from("orders").insert({
      organization_id: product.organization_id, order_code: orderCode, buyer_id: user?.demo ? null : user?.id ?? null,
      customer_name: body.customerName?.trim() || body.customerEmail.split("@")[0], customer_email: body.customerEmail,
      subtotal: amount, discount: 0, total: amount, currency, payment_method: "online", payment_provider: process.env.PAYMENT_PROVIDER ?? "manual",
      payment_status: "pending", order_status: "created", metadata: { source: "h2obook-checkout" }
    }).select("id").single();
    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 400 });
    orderId = order.id;
    await Promise.all([emitDomainEvent({ organizationId: String(product.organization_id), actorId: user?.demo ? null : user?.id ?? null, resourceType: "order", resourceId: orderId, eventName: "checkout_started", payload: { orderCode, productId: product.id, amount, currency } }), recordServerAnalytics({ organizationId: String(product.organization_id), userId: user?.demo ? null : user?.id ?? null, anonymousId: body.customerEmail.toLowerCase(), eventName: "checkout_started", resourceType: "order", resourceId: orderId, sessionId: request.headers.get("x-session-id"), properties: { orderCode, productId: product.id, amount, currency } })]);
    const { error: itemError } = await admin.from("order_items").insert({ order_id: orderId, product_id: product.id, product_name: product.name, quantity: 1, unit_price: amount, total: amount, entitlement_config: { resourceType: product.product_type, resourceId: product.reference_id, billingInterval: product.billing_interval } });
    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 400 });
  } else if (!orderCode || amount <= 0) {
    return NextResponse.json({ error: "INVALID_DEMO_CHECKOUT" }, { status: 400 });
  }

  const result = await paymentProvider().createCheckout({
    orderId, orderCode, amount, currency, customerEmail: body.customerEmail,
    returnUrl: body.returnUrl ?? `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/orders`
  });
  const admin = createSupabaseAdminClient();
  if (admin && isSupabaseConfigured()) await admin.from("orders").update({ payment_provider: result.provider, provider_transaction_id: result.transactionId, updated_at: new Date().toISOString() }).eq("id", orderId);
  return NextResponse.json({ ...result, orderId, orderCode, amount, currency });
}
