import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { OUTCOME_RECIPES, resolveRecipe } from "@/lib/student/create-outcome";
import { loadOutcomeAccessContext } from "@/lib/student/outcome-access";

export const dynamic = "force-dynamic";

export default async function CreateOutcomeHubPage({ searchParams }: { searchParams: Promise<{ lessonId?: string; spaceId?: string }> }) {
  const user = await requireCurrentUser();
  const { lessonId, spaceId } = await searchParams;
  const access = await loadOutcomeAccessContext(user.id, user.role);
  const recipes = OUTCOME_RECIPES.map((recipe) => resolveRecipe(recipe, access));

  return <>
    <section className="h2o-student-hero">
      <div>
        <span className="h2o-student-eyebrow"><Sparkles />CREATE OUTCOME STUDIO</span>
        <h1>Hôm nay bạn muốn tạo ra kết quả gì?</h1>
        <p>Biến bài học, ảnh thực hành và kiến thức của bạn thành thành quả có thể lưu lại, xuất ra hoặc chia sẻ.</p>
      </div>
    </section>

    <div className="h2oc-recipe-grid">
      {recipes.map(({ recipe, availability, reason }) => {
        const locked = availability !== "unlocked";
        const href = locked ? "#" : `/student/create/new?recipe=${recipe.slug}${lessonId ? `&lessonId=${lessonId}` : ""}${spaceId ? `&spaceId=${spaceId}` : ""}`;
        return <Link key={recipe.slug} href={href} aria-disabled={locked} className="h2oc-recipe-card" style={{ "--recipe-accent": recipe.accent } as React.CSSProperties} onClick={locked ? (event) => event.preventDefault() : undefined}>
          {locked && <span className="h2oc-recipe-lock"><Lock size={13} />{reason}</span>}
          <strong>{recipe.title}</strong>
          <p>{recipe.description}</p>
          <small>{recipe.estimatedMinutes} phút · {recipe.expectedOutputs.join(" · ")}</small>
        </Link>;
      })}
    </div>

    <section className="h2o-student-card" style={{ marginTop: 20 }}>
      <header className="h2o-student-card-head"><div><span>THÀNH QUẢ CỦA TÔI</span><h2>Dự án gần đây</h2></div><Link href="/student/create/projects">Xem tất cả</Link></header>
      <div className="h2o-student-card-head" style={{ borderTop: "1px solid var(--student-line,#eee)", paddingTop: 14 }}><p style={{ margin: 0, color: "#718092", fontSize: 12 }}>Mở &ldquo;Dự án của tôi&rdquo; trong menu bên trái để xem toàn bộ thành quả đã tạo.</p></div>
    </section>
  </>;
}
