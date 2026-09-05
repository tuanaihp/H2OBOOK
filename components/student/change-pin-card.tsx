"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Voluntary PIN change for students who sign in with phone + PIN. Renders nothing for email/Google
// accounts. The forced first-login change lives in components/student/force-pin-change.tsx.
export function ChangePinCard() {
  const [isPhoneAccount, setIsPhoneAccount] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      setIsPhoneAccount(Boolean(u && !u.email && (u.phone || u.user_metadata?.login_method === "phone")));
    });
  }, []);

  if (!isPhoneAccount) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMsg(null);
    if (!/^\d{6}$/.test(pin)) { setMsg({ tone: "err", text: "Mã PIN mới phải gồm đúng 6 chữ số." }); return; }
    if (pin !== confirm) { setMsg({ tone: "err", text: "Hai lần nhập chưa khớp." }); return; }
    if (/^(\d)\1{5}$/.test(pin) || pin === "123456") { setMsg({ tone: "err", text: "Mã PIN quá dễ đoán." }); return; }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setBusy(false); return; }
    const { error } = await supabase.auth.updateUser({ password: pin, data: { must_change_pin: false } });
    setBusy(false);
    if (error) { setMsg({ tone: "err", text: error.message }); return; }
    setPin(""); setConfirm("");
    setMsg({ tone: "ok", text: "Đã đổi mã đăng nhập." });
  };

  return (
    <section className="h2o-student-card" style={{ marginTop: 18 }}>
      <header className="h2o-student-card-head"><div><span>ĐĂNG NHẬP</span><h2>Đổi mã PIN</h2><p>Mã 6 số bạn dùng để đăng nhập bằng số điện thoại.</p></div></header>
      <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 340, padding: "0 4px 4px" }}>
        <input inputMode="numeric" maxLength={6} placeholder="Mã PIN mới (6 số)" value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          style={{ border: "1px solid #dfe3e8", borderRadius: 10, padding: "10px 12px", fontSize: 16, letterSpacing: 4 }} />
        <input inputMode="numeric" maxLength={6} placeholder="Nhập lại mã PIN mới" value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
          style={{ border: "1px solid #dfe3e8", borderRadius: 10, padding: "10px 12px", fontSize: 16, letterSpacing: 4 }} />
        {msg && <span style={{ fontSize: 12.5, color: msg.tone === "ok" ? "#177a54" : "#b22949" }}>{msg.text}</span>}
        <button type="submit" disabled={busy} className="h2o-student-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6, justifySelf: "start" }}>
          <KeyRound size={15} />{busy ? "Đang lưu…" : "Lưu mã mới"}
        </button>
      </form>
    </section>
  );
}
