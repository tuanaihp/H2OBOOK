"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { BookOpen, LoaderCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Was previously the "create a brand-new workspace as Owner" form (role:"owner" in the signUp
// metadata) — but this is the page /login's "Chưa có tài khoản?" link sends prospective STUDENTS
// to. A student clicking that link would instantly become the full Owner of a brand-new, empty
// workspace instead of joining the real academy as a student. Now signs up with role:"student"
// (handle_new_user() only auto-creates a new owner workspace when role stays at its "owner"
// default, so this alone stops that) and then calls /api/auth/register-student to join the real,
// server-configured academy organization — role and target workspace are never client-chosen.
export function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setMessage("Demo Mode không cần đăng ký. Hãy khám phá /student để xem trải nghiệm học viên."); setLoading(false); return; }
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name, role: "student" }, emailRedirectTo: `${window.location.origin}/auth/callback` }
    });
    if (error) { setMessage(error.message); setLoading(false); return; }
    await fetch("/api/auth/register-student", { method: "POST" }).catch(() => null);
    setMessage("Đã tạo tài khoản học viên. Nếu email cần xác nhận, hãy kiểm tra hộp thư trước khi đăng nhập.");
    setLoading(false);
  };
  return <main className="auth-page single"><section className="auth-panel"><form className="auth-card" onSubmit={submit}>
    <span className="auth-logo dark"><BookOpen />H2OBOOK</span>
    <span className="eyebrow">STUDENT ACCOUNT</span>
    <h2>Tạo tài khoản học viên</h2>
    <p>Bắt đầu miễn phí với kiến thức nền tảng, mở thêm giai đoạn khi bạn sẵn sàng nâng cấp.</p>
    {message && <div className="auth-message">{message}</div>}
    <label className="field"><span>Họ tên</span><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></label>
    <label className="field"><span>Email</span><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
    <label className="field"><span>Mật khẩu</span><input className="input" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
    <button className="btn btn-primary auth-submit" disabled={loading}>{loading ? <LoaderCircle className="spin" /> : null}Tạo tài khoản học viên</button>
    <p className="auth-switch">Đã có tài khoản? <Link href="/login">Đăng nhập</Link></p>
  </form></section></main>;
}
