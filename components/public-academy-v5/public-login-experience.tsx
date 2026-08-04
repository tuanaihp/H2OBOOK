"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { BookOpen, BrainCircuit, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PublicAcademyConfig } from "@/lib/public-academy-v5/types";
import styles from "./public-auth-v5.module.css";

function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function roleHome(role?: string): string {
  if (role === "student") return "/student";
  if (role === "teacher") return "/instructor";
  if (["admissions", "support", "finance", "content_manager"].includes(String(role))) return "/operations";
  if (role === "platform_admin") return "/platform-admin";
  return "/dashboard";
}

export function PublicLoginExperience({ config }: { config: PublicAcademyConfig["auth"] }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const demoLinksEnabled = process.env.NEXT_PUBLIC_AUTH_DEMO_LINKS === "true";

  useEffect(() => {
    // §4.2: surface the auth callback's expired/invalid-link redirect instead of a silent failure.
    if (new URLSearchParams(window.location.search).get("error") === "link_expired") {
      setError("Đường dẫn đăng nhập đã hết hạn hoặc đã được dùng. Vui lòng đăng nhập lại hoặc yêu cầu email mới.");
    }
    const saved = window.localStorage.getItem("h2obook-login-email");
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        if (demoLinksEnabled) {
          window.location.href = "/dashboard";
          return;
        }
        throw new Error("Hệ thống đăng nhập chưa được cấu hình.");
      }
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw new Error(authError.message);

      if (remember) window.localStorage.setItem("h2obook-login-email", email.trim());
      else window.localStorage.removeItem("h2obook-login-email");

      await fetch("/api/auth/claim-access", { method: "POST" }).catch(() => null);
      // Safety net for accounts stuck in limbo (e.g. self-registered while Supabase email
      // confirmation was pending, so /api/auth/register-student never ran at signup time):
      // getCurrentUser() already falls back to role "student" for any session with no real
      // organization_members row, so this only ever fires for real students or this exact
      // limbo case — never for an existing admin/teacher/owner account.
      const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" }).catch(() => null);
      const sessionPayload = sessionResponse?.ok ? await sessionResponse.json().catch(() => null) : null;
      if (sessionPayload?.user?.role === "student") await fetch("/api/auth/register-student", { method: "POST" }).catch(() => null);
      const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
      if (next) {
        window.location.href = next;
        return;
      }
      window.location.href = roleHome(sessionPayload?.user?.role);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đăng nhập lúc này.");
      setLoading(false);
    }
  };

  return <main className={styles.authPage}>
    <section className={styles.brandPanel}>
      <div className={styles.brandGlow} />
      <div className={styles.brandInner}>
        <span className={styles.brandLogo}><BookOpen aria-hidden="true" />H2OBOOK</span>
        <div className={styles.neuralBadge}><BrainCircuit aria-hidden="true" /><span><b>Neural Access</b><small>Kết nối đúng không gian theo vai trò</small></span><i /></div>
        <h1>{config.brandTitle}</h1>
        <p>{config.brandDescription}</p>
        <div className={styles.trustCard}><ShieldCheck aria-hidden="true" /><span><strong>{config.trustTitle}</strong><small>{config.trustDescription}</small></span></div>
      </div>
    </section>

    <section className={styles.loginPanel}>
      <form className={styles.loginCard} onSubmit={submit}>
        <span className={styles.eyebrow}>WELCOME BACK</span>
        <h2>{config.loginTitle}</h2>
        <p>{config.loginDescription}</p>

        {error && <div className={styles.error} role="alert">{error}</div>}

        <label className={styles.field}><span>Email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
        <label className={styles.field}><span>Mật khẩu</span><div className={styles.passwordField}><input type={show ? "text" : "password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" /><button type="button" aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShow((value) => !value)}>{show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></div></label>

        <div className={styles.loginRow}>
          <label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Ghi nhớ đăng nhập</label>
          <Link href="/signup">Chưa có tài khoản?</Link>
        </div>

        <button className={styles.submitButton} disabled={loading}>{loading ? <LoaderCircle className={styles.spin} aria-hidden="true" /> : null}Đăng nhập</button>

        {demoLinksEnabled && <div className={styles.demoLinks}><span>Chế độ demo:</span><Link href="/dashboard">Demo quản trị</Link><Link href="/student">Demo học viên</Link></div>}
      </form>
    </section>
  </main>;
}
