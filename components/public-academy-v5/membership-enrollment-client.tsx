"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CreditCard, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import type { PublicMembershipPlan } from "@/lib/public-academy-v5/types";
import { formatVnd } from "@/lib/public-site/content";
import styles from "./public-academy-v5.module.css";

type SubmissionState =
  | { status: "idle" }
  | { status: "submitting"; mode: "lead" | "checkout" }
  | { status: "success"; message: string; orderCode?: string; qrPayload?: string }
  | { status: "error"; message: string };

export function MembershipEnrollmentClient({ plans }: { plans: PublicMembershipPlan[] }) {
  const [selectedPlanId, setSelectedPlanId] = useState(plans.find((plan) => plan.featured)?.id ?? plans[0]?.id ?? "");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [goal, setGoal] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<SubmissionState>({ status: "idle" });
  const startedAt = useRef(Date.now());

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? plans[0],
    [plans, selectedPlanId],
  );

  useEffect(() => {
    const requestedPlan = new URLSearchParams(window.location.search).get("plan");
    if (requestedPlan && plans.some((plan) => plan.id === requestedPlan)) setSelectedPlanId(requestedPlan);
  }, [plans]);

  const validate = () => {
    if (!selectedPlan) return "Vui lòng chọn gói phù hợp.";
    if (fullName.trim().length < 2) return "Vui lòng nhập họ và tên.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Vui lòng nhập email hợp lệ.";
    if (phone.trim().replace(/\D/g, "").length < 8) return "Vui lòng nhập số điện thoại hợp lệ.";
    if (!consent) return "Bạn cần đồng ý để H2OBOOK xử lý thông tin đăng ký.";
    return null;
  };

  const payload = () => ({
    planId: selectedPlan?.id,
    productId: selectedPlan?.productId,
    customerName: fullName.trim(),
    customerEmail: email.trim().toLowerCase(),
    phone: phone.trim(),
    goal: goal.trim(),
    consent,
    website,
    elapsedMs: Date.now() - startedAt.current,
    source: "public-membership-v2",
  });

  const submitLead = async (event?: FormEvent) => {
    event?.preventDefault();
    const error = validate();
    if (error) {
      setState({ status: "error", message: error });
      return;
    }
    setState({ status: "submitting", mode: "lead" });
    try {
      const response = await fetch("/api/public/membership/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await response.json().catch(() => null) as { error?: string; ok?: boolean } | null;
      if (!response.ok) throw new Error(data?.error || "Không thể gửi đăng ký lúc này.");
      setState({ status: "success", message: "Hồ sơ đã được ghi nhận. Học viện sẽ liên hệ để xác nhận lộ trình phù hợp." });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Không thể gửi đăng ký lúc này." });
    }
  };

  const startCheckout = async () => {
    const error = validate();
    if (error || !selectedPlan) {
      setState({ status: "error", message: error || "Vui lòng chọn gói phù hợp." });
      return;
    }
    setState({ status: "submitting", mode: "checkout" });
    try {
      const body = {
        productId: selectedPlan.productId,
        customerName: fullName.trim(),
        customerEmail: email.trim().toLowerCase(),
        amount: selectedPlan.price,
        currency: "VND",
        orderCode: `H2B-${selectedPlan.id.toUpperCase()}-${Date.now()}`,
        returnUrl: `${window.location.origin}/orders`,
      };
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null) as {
        error?: string;
        checkoutUrl?: string;
        qrPayload?: string;
        orderCode?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error || "Không thể tạo phiên thanh toán.");
      if (data?.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      setState({
        status: "success",
        message: "Phiên thanh toán đã được tạo. Học viện sẽ xác nhận sau khi nhận được giao dịch.",
        orderCode: data?.orderCode,
        qrPayload: data?.qrPayload,
      });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Không thể tạo phiên thanh toán." });
    }
  };

  return <form className={styles.enrollmentForm} onSubmit={submitLead}>
    <div className={styles.enrollmentHeader}>
      <div><small>BẠN ĐANG CHỌN</small><strong>{selectedPlan?.name ?? "Membership"}</strong></div>
      <b>{selectedPlan ? formatVnd(selectedPlan.price) : "—"}</b>
    </div>

    <label className={styles.formField}>
      <span>Gói phù hợp</span>
      <select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
        {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
      </select>
    </label>

    <div className={styles.formGrid}>
      <label className={styles.formField}><span>Họ và tên</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyễn Minh Anh" autoComplete="name" /></label>
      <label className={styles.formField}><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@example.com" autoComplete="email" /></label>
      <label className={styles.formField}><span>Số điện thoại</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09xx xxx xxx" autoComplete="tel" /></label>
      <label className={styles.formField}><span>Điều bạn muốn đạt được</span><input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Mục tiêu học tập của bạn" /></label>
    </div>

    <label className={styles.honeypot} aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
    <label className={styles.consentRow}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Tôi đồng ý để H2OBOOK liên hệ và xử lý dữ liệu cho mục đích đăng ký học.</span></label>

    {state.status === "error" && <div className={styles.formError} role="alert">{state.message}</div>}
    {state.status === "success" && <div className={styles.formSuccess} role="status">
      <CheckCircle2 aria-hidden="true" />
      <div><strong>Đã ghi nhận</strong><p>{state.message}</p>{state.orderCode && <small>Mã đơn: {state.orderCode}</small>}{state.qrPayload && <code>{state.qrPayload}</code>}</div>
    </div>}

    <div className={styles.enrollmentActions}>
      <button type="submit" disabled={state.status === "submitting"}>
        {state.status === "submitting" && state.mode === "lead" ? <LoaderCircle className={styles.spin} aria-hidden="true" /> : <Mail aria-hidden="true" />}
        Gửi đăng ký
      </button>
      <button type="button" className={styles.checkoutButton} disabled={state.status === "submitting" || !selectedPlan?.checkoutEnabled} onClick={startCheckout}>
        {state.status === "submitting" && state.mode === "checkout" ? <LoaderCircle className={styles.spin} aria-hidden="true" /> : <CreditCard aria-hidden="true" />}
        Thanh toán online
      </button>
    </div>

    <div className={styles.checkoutTrust}><ShieldCheck aria-hidden="true" /><span>Thanh toán và quyền truy cập được xử lý theo cấu hình payment hiện tại của H2OBOOK.</span></div>
  </form>;
}
