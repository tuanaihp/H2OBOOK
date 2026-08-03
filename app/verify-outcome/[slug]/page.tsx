import { notFound } from "next/navigation";
import { Award, Sparkles } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Public, unauthenticated page. Reads only through get_public_outcome_share() (0027), a
// SECURITY DEFINER RPC that returns exactly the achievement fields — never project content,
// notes, or owner identity — mirroring /verify/[certificateNo] and the shared_results pattern
// from module 8.
export default async function VerifyOutcomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createSupabaseAdminClient();
  const { data } = admin ? await admin.rpc("get_public_outcome_share", { p_slug: slug }) : { data: null };
  const record = Array.isArray(data) ? data[0] : data;
  if (!record) notFound();
  return <section style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "linear-gradient(145deg,#fdf8fb,#f4f7fb)" }}>
    <div style={{ maxWidth: 560, width: "100%", background: "#fff", border: "1px solid #e1e6eb", borderRadius: 24, padding: 32, boxShadow: "0 24px 70px rgba(20,45,77,0.12)" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#50d7e2,#8875eb)", color: "#fff", display: "grid", placeItems: "center", marginBottom: 16 }}><Award /></div>
      <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", color: "#8d1d50", textTransform: "uppercase" }}>H2OBOOK CREATE OUTCOME</span>
      <h1 style={{ fontSize: 26, margin: "8px 0" }}>{record.title}</h1>
      <p style={{ color: "#718092", marginBottom: 20 }}>{record.caption || "Thành quả học tập được tạo bằng H2O Create Outcome Studio."}</p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, borderRadius: 14, background: "#f8fafb" }}>
        <Sparkles color="#8875eb" />
        <div><strong>{record.readiness_score}% hoàn thiện</strong><br /><small style={{ color: "#8d97a6" }}>Loại: {record.outcome_type}</small></div>
      </div>
    </div>
  </section>;
}
