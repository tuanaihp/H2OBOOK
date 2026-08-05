"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// The audit reported /forgot-password as "blocked by middleware". It was not blocked — it did not
// exist, and middleware sends every unknown non-public path to /login, which looks identical from
// the outside. So this is the missing flow rather than a routing fix: a student who forgets their
// password had no way back into their account at all.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("Hệ thống chưa được cấu hình. Vui lòng liên hệ học viện."); return; }
    setState("sending");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`
    });
    // Deliberately not surfacing "no such account": telling a stranger which emails are registered
    // turns this form into an account-enumeration oracle. Same message either way.
    if (resetError && !/user not found/i.test(resetError.message)) {
      setState("idle");
      setError("Không gửi được email khôi phục. Vui lòng thử lại sau ít phút.");
      return;
    }
    setState("sent");
  }

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
    <div style={{ width: "min(100%,440px)" }}>
      <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#7c6f76" }}><ArrowLeft size={15} />Quay lại đăng nhập</Link>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 34, margin: "16px 0 8px" }}>Quên mật khẩu</h1>

      {state === "sent" ? (
        <div style={{ display: "flex", gap: 12, padding: 18, borderRadius: 14, background: "#eafaf3", color: "#177a54" }}>
          <MailCheck size={20} style={{ flex: "none" }} />
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
            Nếu <strong>{email}</strong> có tài khoản tại H2OBOOK, chúng tôi đã gửi một liên kết đặt lại mật khẩu.
            Hãy kiểm tra hộp thư (kể cả mục spam). Liên kết chỉ dùng được một lần.
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#7c6f76", margin: "0 0 20px" }}>
            Nhập email bạn dùng để đăng ký. Chúng tôi sẽ gửi liên kết để bạn đặt mật khẩu mới.
          </p>
          <label htmlFor="reset-email" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Email</label>
          <input id="reset-email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="ban@email.com"
            style={{ width: "100%", boxSizing: "border-box", padding: 13, borderRadius: 11, border: "1px solid #e8e2e5", fontSize: 14 }} />
          {error && <p style={{ marginTop: 10, fontSize: 13, color: "#b22949" }}>{error}</p>}
          <button type="submit" disabled={state === "sending" || !email.trim()}
            style={{ width: "100%", marginTop: 16, padding: 14, borderRadius: 11, border: 0, background: "linear-gradient(90deg,#b30d59,#8146dc)", color: "#fff", fontSize: 14, fontWeight: 800, opacity: state === "sending" ? 0.65 : 1 }}>
            {state === "sending" ? "Đang gửi…" : "Gửi liên kết đặt lại"}
          </button>
        </form>
      )}
    </div>
  </main>;
}
