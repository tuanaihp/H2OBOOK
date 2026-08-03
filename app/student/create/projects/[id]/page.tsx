"use client";
import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Share2 } from "lucide-react";
import { getRecipe } from "@/lib/student/create-outcome";

type Project = { id: string; title: string; recipe_slug: string; readiness_score: number; progress_percent: number; status: string; content: Record<string, string> };

// Guided Mode for this pass: a structured section-by-section content form (not the full
// book_pages/page_elements visual editor — see the integration report for why: the existing
// editor's save_book_document() RPC is staff-only, and widening that RLS surface to every
// student was judged riskier than shipping a lighter, owner-scoped guided form for v1).
export default function OutcomeStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [project, setProject] = useState<Project | null>(null);
  const [content, setContent] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/create/projects/${id}`);
    const json = await res.json();
    if (res.ok) { setProject(json.project); setContent(json.project.content ?? {}); }
  }
  useEffect(() => { load(); }, [id]);

  const recipe = project ? getRecipe(project.recipe_slug) : undefined;

  async function saveSection(key: string, value: string) {
    setSaving(true);
    const res = await fetch(`/api/create/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: { [key]: value } }) });
    const json = await res.json();
    setSaving(false);
    if (res.ok) setProject(json.project);
  }

  async function share() {
    setMessage(null);
    const res = await fetch(`/api/create/projects/${id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caption: `${project?.title} — làm bằng H2OBOOK Create Outcome Studio` }) });
    const json = await res.json();
    if (!res.ok) { setMessage(json.error === "PROJECT_NOT_READY" ? `Cần đạt tối thiểu 60% hoàn thiện để chia sẻ (hiện ${json.details?.readinessScore ?? 0}%).` : (json.error ?? "Không tạo được link chia sẻ.")); return; }
    setShareUrl(json.url);
  }

  if (!project || !recipe) return <p>Đang tải…</p>;

  return <div style={{ display: "grid", gap: 16 }}>
    <Link href="/student/create/projects" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, color: "#8d97a6", textDecoration: "none" }}><ArrowLeft size={14} />Quay lại Dự án của tôi</Link>

    <section className="h2o-student-card">
      <header className="h2o-student-card-head">
        <div><span>{recipe.outcomeType.toUpperCase()}</span><h2>{project.title}</h2></div>
        <div style={{ textAlign: "right" }}><strong>{project.readiness_score}%</strong><br /><small style={{ color: "#8d97a6" }}>Kiểm tra hoàn thiện</small></div>
      </header>
      <div style={{ padding: "0 18px 18px" }}>
        <div style={{ height: 6, borderRadius: 99, background: "#eee", overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${project.readiness_score}%`, background: "linear-gradient(90deg,#50d7e2,#8875eb)" }} /></div>
      </div>
    </section>

    <section className="h2o-student-card">
      <header className="h2o-student-card-head"><div><span>NỘI DUNG</span><h2>Điền từng phần</h2></div></header>
      <div style={{ padding: 18, display: "grid", gap: 16 }}>
        {recipe.sections.map((section) => {
          const filled = Boolean(content[section.key]?.trim());
          return <label key={section.key} style={{ display: "grid", gap: 6, fontSize: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{filled ? <CheckCircle2 size={14} color="#22c55e" /> : <Circle size={14} color="#cbd5e1" />}<strong>{section.label}</strong></span>
            <textarea rows={3} value={content[section.key] ?? ""} placeholder={section.placeholder}
              onChange={(event) => setContent((current) => ({ ...current, [section.key]: event.target.value }))}
              onBlur={(event) => saveSection(section.key, event.target.value)}
              style={{ padding: 12, borderRadius: 12, border: "1px solid #dfe3e8", font: "inherit" }} />
          </label>;
        })}
        {saving && <small style={{ color: "#8d97a6" }}>Đang lưu…</small>}
      </div>
    </section>

    <section className="h2o-student-card">
      <header className="h2o-student-card-head"><div><span>XUẤT & CHIA SẺ</span><h2>Chia sẻ thành quả</h2></div></header>
      <div style={{ padding: 18 }}>
        {message && <p style={{ color: "#a05a13", fontSize: 12 }}>{message}</p>}
        {shareUrl ? <p style={{ fontSize: 12 }}>Đã tạo link công khai: <a href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a></p> : (
          <button className="btn btn-primary" onClick={share}><Share2 size={15} />Tạo link chia sẻ</button>
        )}
        <p style={{ fontSize: 11, color: "#8d97a6", marginTop: 10 }}>Xuất PDF/ảnh sẽ có ở bản cập nhật sau — hiện tại bạn có thể chia sẻ link công khai khi đạt tối thiểu 60% hoàn thiện.</p>
      </div>
    </section>
  </div>;
}
