"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Second half of the recovery flow. The email link lands on /auth/callback, which exchanges the
// code for a session and then sends the visitor here; by the time this renders there is a real
// session, so setting the password is a plain updateUser rather than anything token-shaped.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setHasSession(false); return; }
    supabase.auth.getUser().then(({ data }) => setHasSession(Boolean(data.user))).catch(() => setHasSession(false));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("Mật khẩu cần ít nhất 8 ký tự."); return; }
    if (password !== confirm) { setError("Hai lần nhập mật khẩu chưa khớp."); return; }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("Hệ thống chưa được cấu hình."); return; }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) { setError(updateError.message); return; }
    router.replace("/student");
  }

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
    <div style={{ width: "min(100%,440px)" }}>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 34, margin: "0 0 8px" }}>Đặt mật khẩu mới</h1>

      {hasSession === false ? (
        <>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#7c6f76" }}>
            Liên kết đặt lại đã hết hạn hoặc đã được dùng. Hãy yêu cầu một liên kết mới.
          </p>
          <Link href="/forgot-password" style={{ display: "inline-block", marginTop: 12, padding: "13px 18px", borderRadius: 11, background: "linear-gradient(90deg,#b30d59,#8146dc)", color: "#fff", fontSize: 14, fontWeight: 800 }}>Gửi lại liên kết</Link>
        </>
      ) : (
        <form onSubmit={submit}>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#7c6f76", margin: "0 0 20px" }}>Chọn mật khẩu mới cho tài khoản của bạn.</p>
          <label htmlFor="new-password" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Mật khẩu mới</label>
          <input id="new-password" name="password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: 13, borderRadius: 11, border: "1px solid #e8e2e5", fontSize: 14 }} />
          <label htmlFor="confirm-password" style={{ display: "block", fontSize: 13, fontWeight: 700, margin: "14px 0 6px" }}>Nhập lại mật khẩu</label>
          <input id="confirm-password" name="confirmPassword" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: 13, borderRadius: 11, border: "1px solid #e8e2e5", fontSize: 14 }} />
          {error && <p style={{ marginTop: 10, fontSize: 13, color: "#b22949" }}>{error}</p>}
          <button type="submit" disabled={busy || hasSession === null}
            style={{ width: "100%", marginTop: 16, padding: 14, borderRadius: 11, border: 0, background: "linear-gradient(90deg,#b30d59,#8146dc)", color: "#fff", fontSize: 14, fontWeight: 800, opacity: busy ? 0.65 : 1 }}>
            {busy ? "Đang lưu…" : "Lưu mật khẩu mới"}
          </button>
        </form>
      )}
    </div>
  </main>;
}
