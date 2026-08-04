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
        const body = <>
          {locked && <span className="h2oc-recipe-lock"><Lock size={13} />{reason}</span>}
          <strong>{recipe.title}</strong>
          <p>{recipe.description}</p>
          <small>{recipe.estimatedMinutes} phút · {recipe.expectedOutputs.join(" · ")}</small>
        </>;
        const style = { "--recipe-accent": recipe.accent } as React.CSSProperties;
        // A locked recipe renders as a plain element, not a Link. It previously stayed a Link to
        // href="#" neutralised by an onClick preventDefault — but this is a Server Component, and
        // React refuses to serialise a function prop for a Client Component, so the whole page
        // threw during render the moment any recipe was locked. That never showed up while testing
        // with an owner account (everything unlocked); a real student account, which is exactly
        // what the new self-signup flow creates, locks recipes and hit it on first visit.
        if (locked) {
          return <div key={recipe.slug} aria-disabled className="h2oc-recipe-card" style={style}>{body}</div>;
        }
        return <Link key={recipe.slug} href={`/student/create/new?recipe=${recipe.slug}${lessonId ? `&lessonId=${lessonId}` : ""}${spaceId ? `&spaceId=${spaceId}` : ""}`} className="h2oc-recipe-card" style={style}>{body}</Link>;
      })}
    </div>

    <section className="h2o-student-card" style={{ marginTop: 20 }}>
      <header className="h2o-student-card-head"><div><span>THÀNH QUẢ CỦA TÔI</span><h2>Dự án gần đây</h2></div><Link href="/student/create/projects">Xem tất cả</Link></header>
      <div className="h2o-student-card-head" style={{ borderTop: "1px solid var(--student-line,#eee)", paddingTop: 14 }}><p style={{ margin: 0, color: "#718092", fontSize: 12 }}>Mở &ldquo;Dự án của tôi&rdquo; trong menu bên trái để xem toàn bộ thành quả đã tạo.</p></div>
    </section>
  </>;
}
