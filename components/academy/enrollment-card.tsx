"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, CreditCard, LoaderCircle, MailCheck, ShieldCheck } from "lucide-react";
import type { AcademyTargetType } from "@/lib/academy/catalog";

type TargetOption = { slug: string; label: string; price: number };
type FormState = { name: string; email: string; phone: string; message: string; consent: boolean; website: string };

const emptyForm: FormState = { name: "", email: "", phone: "", message: "", consent: true, website: "" };

function friendlyError(code: string) {
  const messages: Record<string, string> = {
    VALID_NAME_REQUIRED: "Vui lòng nhập họ tên đầy đủ.",
    VALID_EMAIL_REQUIRED: "Email chưa đúng định dạng.",
    CONSENT_REQUIRED: "Bạn cần đồng ý để H2OBOOK xử lý thông tin đăng ký.",
    RATE_LIMITED: "Bạn đã gửi quá nhanh. Vui lòng thử lại sau một phút.",
    ACADEMY_ORGANIZATION_NOT_CONFIGURED: "Học viện chưa hoàn tất cấu hình Production. Vui lòng liên hệ quản trị viên."
  };
  return messages[code] ?? code.replaceAll("_", " ");
}

export function AcademyEnrollmentCard({ targetType, initialSlug, options }: { targetType: AcademyTargetType; initialSlug: string; options: TargetOption[] }) {
  const [targetSlug, setTargetSlug] = useState(initialSlug);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState<"application" | "checkout" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [qrPayload, setQrPayload] = useState("");
  const startedAt = useRef(Date.now());
  const target = options.find((item) => item.slug === targetSlug) ?? options[0];

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(targetType === "course" ? "course" : "plan");
    if (requested && options.some((item) => item.slug === requested)) setTargetSlug(requested);
  }, [options, targetType]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function createApplication() {
    const response = await fetch("/api/academy/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType,
        targetSlug,
        ...form,
        elapsedMs: Date.now() - startedAt.current,
        source: targetType === "course" ? "course_detail" : "membership_page",
        utm: Object.fromEntries(["utm_source", "utm_medium", "utm_campaign"].map((key) => [key, new URLSearchParams(window.location.search).get(key) ?? ""]).filter(([, value]) => value))
      })
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; applicationId?: string; duplicate?: boolean };
    if (!response.ok) throw new Error(payload.error ?? "APPLICATION_FAILED");
    return payload;
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setBusy("application"); setError(""); setMessage(""); setQrPayload("");
    try {
      const result = await createApplication();
      setMessage(result.duplicate ? "Hồ sơ của bạn đã có trong hệ thống và đang được xử lý." : "Đã nhận đăng ký. Hãy kiểm tra email xác nhận; học viện sẽ phản hồi sau khi duyệt hồ sơ.");
    } catch (reason) {
      setError(friendlyError(reason instanceof Error ? reason.message : "APPLICATION_FAILED"));
    } finally { setBusy(null); }
  }

  async function checkout() {
    setBusy("checkout"); setError(""); setMessage(""); setQrPayload("");
    try {
      await createApplication();
      const catalogResponse = await fetch("/api/academy/catalog/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetType, targetSlug }) });
      const catalog = await catalogResponse.json() as { productId?: string | null; amount?: number; currency?: string; error?: string };
      if (!catalogResponse.ok) throw new Error(catalog.error ?? "CATALOG_RESOLVE_FAILED");
      const paymentResponse = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: catalog.productId,
          customerName: form.name,
          customerEmail: form.email,
          amount: catalog.amount ?? target.price,
          currency: catalog.currency ?? "VND",
          orderCode: `H2B-${Date.now()}`,
          returnUrl: `${window.location.origin}/student`
        })
      });
      const payment = await paymentResponse.json() as { checkoutUrl?: string; qrPayload?: string; status?: string; orderCode?: string; error?: string };
      if (!paymentResponse.ok) throw new Error(payment.error ?? "CHECKOUT_FAILED");
      if (payment.checkoutUrl) { window.location.assign(payment.checkoutUrl); return; }
      if (payment.qrPayload) {
        setQrPayload(payment.qrPayload);
        setMessage(`Đã tạo đơn ${payment.orderCode ?? "H2OBOOK"}. Dùng nội dung bên dưới để thanh toán; quyền học sẽ được cấp khi webhook xác nhận.`);
      } else setMessage("Thanh toán đã được ghi nhận. H2OBOOK đang cấp quyền truy cập.");
    } catch (reason) {
      setError(friendlyError(reason instanceof Error ? reason.message : "CHECKOUT_FAILED"));
    } finally { setBusy(null); }
  }

  return <section id="academy-enrollment" className="h2o-enrollment-section">
    <div className="h2o-public-container h2o-enrollment-grid">
      <div className="h2o-enrollment-copy"><span>ENROLLMENT & CHECKOUT</span><h2>Bắt đầu hành trình học thật.</h2><p>Gửi hồ sơ để học viện tư vấn và duyệt tài khoản, hoặc chuyển thẳng sang thanh toán online. Mọi trạng thái đều được lưu vào CRM.</p><ul><li><MailCheck/>Email xác nhận ngay khi đăng ký</li><li><ShieldCheck/>Tài khoản và quyền học tách biệt, cấp qua Supabase Auth</li><li><CreditCard/>Thanh toán được xác nhận bằng webhook</li></ul></div>
      <form className="h2o-enrollment-card" onSubmit={submit}>
        <div className="h2o-enrollment-title"><div><small>BẠN ĐANG CHỌN</small><strong>{target?.label}</strong></div><b>{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(target?.price ?? 0)}</b></div>
        {options.length > 1 && <label><span>Gói phù hợp</span><select value={targetSlug} onChange={(event) => setTargetSlug(event.target.value)}>{options.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>}
        <div className="h2o-enrollment-fields"><label><span>Họ và tên</span><input required minLength={2} value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Nguyễn Minh Anh"/></label><label><span>Email</span><input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="ban@example.com"/></label><label><span>Số điện thoại</span><input value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="09xx xxx xxx"/></label><label><span>Điều bạn muốn đạt được</span><input value={form.message} onChange={(event) => update("message", event.target.value)} placeholder="Mục tiêu học tập của bạn"/></label></div>
        <label className="h2o-enrollment-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)}/></label>
        <label className="h2o-enrollment-consent"><input type="checkbox" checked={form.consent} onChange={(event) => update("consent", event.target.checked)}/><span>Tôi đồng ý để H2OBOOK liên hệ và xử lý dữ liệu cho mục đích đăng ký học.</span></label>
        {error && <div className="h2o-enrollment-error">{error}</div>}
        {message && <div className="h2o-enrollment-success"><CheckCircle2/>{message}</div>}
        {qrPayload && <div className="h2o-enrollment-qr"><span>QR / NỘI DUNG CHUYỂN KHOẢN</span><code>{qrPayload}</code></div>}
        <div className="h2o-enrollment-actions"><button type="submit" disabled={Boolean(busy)}>{busy === "application" ? <LoaderCircle className="spin"/> : <MailCheck/>}Gửi đăng ký</button><button type="button" className="pay" disabled={Boolean(busy)} onClick={checkout}>{busy === "checkout" ? <LoaderCircle className="spin"/> : <CreditCard/>}Thanh toán online</button></div>
      </form>
    </div>
  </section>;
}
