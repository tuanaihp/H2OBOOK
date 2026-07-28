import crypto from "node:crypto";

export type CheckoutInput = { orderId: string; orderCode: string; amount: number; currency: string; customerEmail: string; returnUrl: string };
export type CheckoutResult = { provider: string; checkoutUrl?: string; qrPayload?: string; transactionId: string; status: "pending" | "paid" };
export type PaymentEvent = { eventId: string; orderId?: string; orderCode?: string; transactionId: string; status: "paid" | "failed" | "refunded"; raw: unknown };

export interface PaymentProvider {
  name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyWebhook(payload: string, signature: string | null): Promise<PaymentEvent>;
}

class ManualPaymentProvider implements PaymentProvider {
  name = "manual";
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    return { provider: this.name, transactionId: `manual_${input.orderCode}`, status: "pending", qrPayload: `H2OBOOK|${input.orderCode}|${input.amount}|${input.currency}` };
  }
  async verifyWebhook(payload: string, signature: string | null): Promise<PaymentEvent> {
    if (process.env.NEXT_PUBLIC_APP_MODE === "production") {
      const secret = process.env.PAYMENT_WEBHOOK_SECRET;
      if (!secret || !signature) throw new Error("INVALID_WEBHOOK_SIGNATURE");
      const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) throw new Error("INVALID_WEBHOOK_SIGNATURE");
    }
    const data = JSON.parse(payload) as Record<string, string>;
    return { eventId: data.eventId ?? crypto.randomUUID(), orderId: data.orderId, orderCode: data.orderCode, transactionId: data.transactionId ?? crypto.randomUUID(), status: (data.status as PaymentEvent["status"]) ?? "paid", raw: data };
  }
}

class GenericPaymentProvider implements PaymentProvider {
  name = process.env.PAYMENT_PROVIDER ?? "generic";
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!process.env.PAYMENT_CHECKOUT_URL) throw new Error("PAYMENT_CHECKOUT_URL_NOT_CONFIGURED");
    const response = await fetch(process.env.PAYMENT_CHECKOUT_URL, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.PAYMENT_API_KEY ?? ""}` }, body: JSON.stringify(input), cache: "no-store" });
    if (!response.ok) throw new Error(`PAYMENT_CHECKOUT_FAILED_${response.status}`);
    const data = await response.json() as CheckoutResult;
    return { ...data, provider: this.name };
  }
  async verifyWebhook(payload: string, signature: string | null): Promise<PaymentEvent> {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret || !signature) throw new Error("INVALID_WEBHOOK_SIGNATURE");
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) throw new Error("INVALID_WEBHOOK_SIGNATURE");
    const data = JSON.parse(payload) as Record<string, unknown>;
    return { eventId: String(data.eventId ?? crypto.randomUUID()), orderId: data.orderId ? String(data.orderId) : undefined, orderCode: data.orderCode ? String(data.orderCode) : undefined, transactionId: String(data.transactionId ?? crypto.randomUUID()), status: String(data.status ?? "paid") as PaymentEvent["status"], raw: data };
  }
}

export function paymentProvider(): PaymentProvider {
  return !process.env.PAYMENT_PROVIDER || process.env.PAYMENT_PROVIDER === "manual" ? new ManualPaymentProvider() : new GenericPaymentProvider();
}
