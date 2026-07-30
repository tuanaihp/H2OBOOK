import { NextResponse } from "next/server";
import { emitDomainEvent, recordServerAnalytics } from "@/lib/domain/events";
import { paymentProvider } from "@/lib/payments/provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureStudentAuthUser } from "@/lib/academy/service";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { escapeEmailHtml } from "@/lib/email/provider";

export async function POST(request: Request) {
  const raw = await request.text();
  try {
    const event = await paymentProvider().verifyWebhook(raw, request.headers.get("x-h2obook-signature") ?? request.headers.get("x-signature"));
    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ ok: true, mode: "demo" });
    const { data: existing } = await admin.from("payment_events").select("id").eq("provider_event_id", event.eventId).maybeSingle();
    if (existing) return NextResponse.json({ ok: true, duplicate: true });
    await admin.from("payment_events").insert({
      provider: process.env.PAYMENT_PROVIDER ?? "manual",
      provider_event_id: event.eventId,
      provider_transaction_id: event.transactionId,
      event_type: `payment.${event.status}`,
      payload: event.raw,
      status: "received"
    });

    if (event.status === "paid" && (event.orderId || event.orderCode)) {
      let query = admin.from("orders").select("id,organization_id,buyer_id,customer_name,customer_email,order_code,total,currency");
      query = event.orderId ? query.eq("id", event.orderId) : query.eq("order_code", event.orderCode!);
      const { data: order } = await query.maybeSingle();
      if (order) {
        let buyerId = order.buyer_id ? String(order.buyer_id) : null;
        if (!buyerId) {
          const provisioned = await ensureStudentAuthUser(admin, {
            organizationId: String(order.organization_id),
            name: String(order.customer_name),
            email: String(order.customer_email)
          });
          buyerId = provisioned.user.id;
          await admin.from("orders").update({ buyer_id: buyerId, updated_at: new Date().toISOString() }).eq("id", order.id);
        }
        await admin.rpc("mark_order_paid", { p_order_id: order.id, p_transaction_id: event.transactionId });
        const { data: items } = await admin.from("order_items").select("product_name,quantity,unit_price,total").eq("order_id", order.id);
        await Promise.all([
          emitDomainEvent({ organizationId: String(order.organization_id), actorId: buyerId, resourceType: "order", resourceId: String(order.id), eventName: "order.paid", payload: { orderCode: order.order_code, total: order.total, currency: order.currency, transactionId: event.transactionId } }),
          recordServerAnalytics({ organizationId: String(order.organization_id), userId: buyerId, eventName: "order.paid", resourceType: "order", resourceId: String(order.id), properties: { orderCode: order.order_code, total: Number(order.total), currency: order.currency } }),
          sendTransactionalEmail({
            admin,
            organizationId: String(order.organization_id),
            userId: buyerId,
            templateKey: "order_paid",
            dedupeKey: String(order.id),
            to: String(order.customer_email),
            subject: `H2OBOOK – Xác nhận thanh toán ${order.order_code}`,
            html: `<h2>Thanh toán thành công</h2><p>Chào ${escapeEmailHtml(order.customer_name)}, H2OBOOK đã nhận thanh toán đơn <strong>${escapeEmailHtml(order.order_code)}</strong>.</p><ul>${(items ?? []).map((item) => `<li>${escapeEmailHtml(item.product_name)} × ${Number(item.quantity)}</li>`).join("")}</ul><p><strong>Tổng cộng: ${new Intl.NumberFormat("vi-VN").format(Number(order.total))} ${escapeEmailHtml(order.currency)}</strong></p><p>Quyền học đã được cấp. Bạn có thể đăng nhập vào H2OBOOK Student.</p>`,
            text: `Đã thanh toán đơn ${order.order_code}. Tổng cộng ${order.total} ${order.currency}.`
          }).catch((error) => console.error("[H2OBOOK order receipt]", error))
        ]);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "WEBHOOK_FAILED" }, { status: 400 });
  }
}
