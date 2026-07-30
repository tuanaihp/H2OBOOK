"use client";

import { FormEvent, useState } from "react";
import { BookOpen, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AcceptInvitePage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (password.length < 8) { setError("Mật khẩu cần ít nhất 8 ký tự."); return; }
    if (password !== confirm) { setError("Hai mật khẩu chưa khớp."); return; }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("Supabase chưa được cấu hình."); setBusy(false); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setBusy(false); return; }
    await fetch("/api/auth/claim-access", { method: "POST" }).catch(() => null);
    setDone(true);
    setTimeout(() => { window.location.href = "/student"; }, 900);
  };
  return <main className="auth-page single"><section className="auth-panel"><form className="auth-card" onSubmit={submit}><span className="auth-logo dark"><BookOpen/>H2OBOOK</span><span className="eyebrow">STUDENT INVITATION</span><h2>Hoàn tất tài khoản học viên</h2><p>Đặt mật khẩu để lần sau bạn có thể đăng nhập và tiếp tục đúng tiến độ.</p>{error&&<div className="auth-error">{error}</div>}{done&&<div className="auth-message"><CheckCircle2/>Tài khoản đã sẵn sàng. Đang mở không gian học...</div>}<label className="field"><span>Mật khẩu mới</span><input className="input" type="password" minLength={8} required value={password} onChange={(event)=>setPassword(event.target.value)} autoComplete="new-password"/></label><label className="field"><span>Nhập lại mật khẩu</span><input className="input" type="password" minLength={8} required value={confirm} onChange={(event)=>setConfirm(event.target.value)} autoComplete="new-password"/></label><div className="auth-trust-inline"><ShieldCheck/>Phiên mời được xác thực bởi Supabase Auth.</div><button className="btn btn-primary auth-submit" disabled={busy||done}>{busy?<LoaderCircle className="spin"/>:null}Kích hoạt và vào học</button></form></section></main>;
}
