"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Shown by app/student/layout.tsx while user_metadata.must_change_pin is true — the student cannot
// reach any /student page until they replace the admin-issued PIN with one only they know.
export function ForcePinChange({ name }: { name: string }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(pin)) { setError("Mã PIN mới phải gồm đúng 6 chữ số."); return; }
    if (pin !== confirm) { setError("Hai lần nhập mã PIN chưa khớp."); return; }
    if (/^(\d)\1{5}$/.test(pin) || pin === "123456" || pin === "654321") { setError("Mã PIN quá dễ đoán. Chọn 6 số khác."); return; }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("Hệ thống chưa sẵn sàng. Thử lại sau."); setLoading(false); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password: pin, data: { must_change_pin: false } });
    if (updateError) { setError(updateError.message); setLoading(false); return; }
    window.location.href = "/student";
  };

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20, background: "#f4f2fb" }}>
      <form onSubmit={submit} style={{ width: "min(420px, 100%)", background: "#fff", border: "1px solid #e6e1f4", borderRadius: 18, padding: "26px 24px", display: "grid", gap: 12 }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#6e50e8,#a48bff)", color: "#fff" }}><KeyRound size={20} /></span>
        <h1 style={{ margin: 0, fontSize: 19 }}>Đặt mã đăng nhập của bạn</h1>
        <p style={{ margin: 0, fontSize: 13, color: "#6b6480", lineHeight: 1.6 }}>
          Chào {name}. Đây là lần đăng nhập đầu tiên — hãy đổi mã PIN 6 số do trung tâm cấp sang mã chỉ mình bạn biết.
        </p>
        {error && <div style={{ background: "#fbecec", color: "#b22949", borderRadius: 10, padding: "9px 12px", fontSize: 12.5 }}>{error}</div>}
        <label style={{ display: "grid", gap: 5, fontSize: 12.5, fontWeight: 700 }}>
          Mã PIN mới (6 số)
          <input inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{ border: "1px solid #dfe3e8", borderRadius: 10, padding: "10px 12px", fontSize: 18, letterSpacing: 6, fontWeight: 700 }} />
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 12.5, fontWeight: 700 }}>
          Nhập lại mã PIN mới
          <input inputMode="numeric" autoComplete="new-password" maxLength={6} value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{ border: "1px solid #dfe3e8", borderRadius: 10, padding: "10px 12px", fontSize: 18, letterSpacing: 6, fontWeight: 700 }} />
        </label>
        <button type="submit" disabled={loading}
          style={{ marginTop: 4, border: 0, borderRadius: 12, padding: "12px 16px", fontWeight: 800, background: "#6e50e8", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {loading ? <LoaderCircle size={16} className="spin" /> : null}Lưu mã và vào học
        </button>
        <p style={{ margin: 0, display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: "#9a94a8" }}>
          <ShieldCheck size={13} /> Mã PIN được lưu mã hoá. Nếu quên, liên hệ trung tâm để được cấp lại.
        </p>
      </form>
    </main>
  );
}
