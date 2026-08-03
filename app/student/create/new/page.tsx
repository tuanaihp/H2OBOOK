"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { getRecipe } from "@/lib/student/create-outcome";

// Guided Wizard (§3.4 of the source module), compacted to 3 client-rendered steps rather than 4
// separate routes: (1) confirm outcome + title, (2) confirm source context, (3) create + redirect
// into the guided studio page. See the integration report for what a fuller wizard would add
// (template picker, asset import step) — deferred for this pass.
export default function CreateOutcomeWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recipeSlug = searchParams.get("recipe") ?? "";
  const lessonId = searchParams.get("lessonId") ?? undefined;
  const spaceId = searchParams.get("spaceId") ?? undefined;
  const recipe = getRecipe(recipeSlug);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!recipe) return <div className="h2o-student-card"><div className="h2o-student-card-head"><p>Không tìm thấy công thức này. <a href="/student/create">Quay lại Studio</a></p></div></div>;

  async function createProject() {
    setBusy(true); setError(null);
    const res = await fetch("/api/create/projects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeSlug, title: title.trim() || recipe!.title, sourceLessonId: lessonId, sourceKnowledgeSpaceId: spaceId })
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Không tạo được dự án."); return; }
    router.push(`/student/create/projects/${json.projectId}`);
  }

  return <div className="h2o-student-card" style={{ maxWidth: 640, margin: "0 auto" }}>
    <header className="h2o-student-card-head"><div><span>GUIDED WIZARD</span><h2>{recipe.title}</h2><p>{recipe.description}</p></div></header>
    <div style={{ padding: 20, display: "grid", gap: 16 }}>
      {error && <p style={{ color: "#b22949", margin: 0 }}>{error}</p>}
      {step === 1 && <>
        <label style={{ display: "grid", gap: 6, fontSize: 12 }}>Đặt tên cho thành quả của bạn
          <input value={title} onChange={(event) => setTitle(event.target.value)} style={{ padding: 12, borderRadius: 12, border: "1px solid #dfe3e8" }} />
        </label>
        <button className="btn btn-primary" onClick={() => setStep(2)}>Tiếp theo <ArrowRight size={15} /></button>
      </>}
      {step === 2 && <>
        <div>
          <strong>Nguồn dữ liệu</strong>
          <p style={{ color: "#718092", fontSize: 12 }}>{lessonId || spaceId ? "Sẽ liên kết với bài học bạn vừa học." : "Bắt đầu từ trống — bạn sẽ điền từng phần trong Studio."}</p>
        </div>
        <div>
          <strong>Các phần sẽ điền</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#718092", fontSize: 12 }}>{recipe.sections.map((section) => <li key={section.key}>{section.label}</li>)}</ul>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setStep(1)}><ArrowLeft size={15} /> Quay lại</button>
          <button className="btn btn-primary" disabled={busy} onClick={createProject}>{busy ? "Đang tạo..." : <><CheckCircle2 size={15} /> Tạo & mở Studio</>}</button>
        </div>
      </>}
    </div>
  </div>;
}
