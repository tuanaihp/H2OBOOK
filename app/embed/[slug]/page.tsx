"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldX } from "lucide-react";

export default function ProtectedEmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState("");
  const [state, setState] = useState<"checking" | "allowed" | "denied">("checking");
  const [token, setToken] = useState("");
  useEffect(() => { void params.then(({ slug: value }) => {
    setSlug(value);
    let origin = location.origin;
    try { if (document.referrer) origin = new URL(document.referrer).origin; } catch {}
    void fetch("/api/reader/embed-authorize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId: value, origin }) })
      .then(async response => ({ ok: response.ok, payload: await response.json() }))
      .then(({ ok, payload }) => { if (ok && payload.allowed) { setToken(payload.token ?? ""); setState("allowed"); } else setState("denied"); })
      .catch(() => setState("denied"));
  }); }, [params]);
  if (state === "checking") return <main className="embed-status"><ShieldCheck/><h1>Đang xác minh tên miền…</h1></main>;
  if (state === "denied") return <main className="embed-status denied"><ShieldX/><h1>Embed chưa được cấp phép</h1><p>Chủ sở hữu cuốn sách chưa cho phép tên miền này.</p></main>;
  return <iframe title="H2OBOOK Protected Reader" className="protected-reader-frame" src={`/reader/${encodeURIComponent(slug)}?embed=1&embed_token=${encodeURIComponent(token)}`} allow="fullscreen"/>;
}
