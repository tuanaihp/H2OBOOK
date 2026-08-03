import Link from "next/link";
import { Bot, Brain, CheckCircle2, Lock, NotebookPen, Sparkles, Wand2 } from "lucide-react";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getStudentCourseSummaries } from "@/lib/academy/student-course";
import { loadOutcomeAccessContext } from "@/lib/student/outcome-access";
import { DEFAULT_LEARN_CREATE_MAPPINGS, resolveLearnToCreateLink } from "@/lib/student/learn-to-create";

export const dynamic = "force-dynamic";

// "Học & ghi nhớ" (LEARN tab 2/4, module 11). Reuses real signals across modules 8/10: due
// flashcards (0006), Knowledge Space notes (0026's learner_notes), in-progress Knowledge Spaces
// (0026's knowledge_space_progress) — no new table, no demo data.
export default async function LearnAndMemoryPage() {
  const user = await requireCurrentUser();
  const [courses, access] = await Promise.all([getStudentCourseSummaries(user), loadOutcomeAccessContext(user.id, user.role)]);
  const activeCourses = courses.filter((course) => course.access);
  const currentCourse = activeCourses.find((course) => course.progressPercent < 100) ?? activeCourses[0] ?? null;
  const createSuggestions = DEFAULT_LEARN_CREATE_MAPPINGS.map((mapping) => resolveLearnToCreateLink(mapping.triggerKey, {}, access)).filter((link) => link !== null);

  let dueCards: { id: string; front: string }[] = [];
  let notes: { id: string; title: string; body: string; knowledge_space_id: string }[] = [];
  let inProgressSpaces: { knowledge_space_id: string; percent: number; knowledge_spaces: { title: string; slug: string } | null }[] = [];

  if (isSupabaseConfigured() && !user.demo) {
    const admin = createSupabaseAdminClient();
    const organizationId = await configuredAcademyOrganizationId();
    if (admin && organizationId) {
      const [cardsRes, notesRes, spacesRes] = await Promise.all([
        admin.from("flashcards").select("id,front").eq("user_id", user.id).eq("organization_id", organizationId).lte("next_review_at", new Date().toISOString()).order("next_review_at", { ascending: true }).limit(8),
        admin.from("learner_notes").select("id,title,body,knowledge_space_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        admin.from("knowledge_space_progress").select("knowledge_space_id,percent,knowledge_spaces(title,slug)").eq("user_id", user.id).lt("percent", 100).order("updated_at", { ascending: false }).limit(5)
      ]);
      dueCards = (cardsRes.data ?? []).map((row) => ({ id: String(row.id), front: String(row.front) }));
      notes = (notesRes.data ?? []).map((row) => ({ id: String(row.id), title: String(row.title ?? ""), body: String(row.body ?? ""), knowledge_space_id: String(row.knowledge_space_id) }));
      inProgressSpaces = (spacesRes.data ?? []) as unknown as typeof inProgressSpaces;
    }
  }

  return <>
    <section className="h2o-student-page-head">
      <div><span>HỌC &amp; GHI NHỚ</span><h1>Nơi bạn ôn lại và giữ kiến thức</h1><p>Bài đang học, thẻ ôn đến hạn, ghi chú và kho tri thức — tất cả ở một chỗ.</p></div>
    </section>

    <div className="h2o-student-dashboard-grid">
      <section className="h2o-student-card">
        <header className="h2o-student-card-head"><div><span>BÀI ĐANG HỌC</span><h2>{currentCourse?.title ?? "Chưa có khóa học nào"}</h2></div></header>
        <div style={{ padding: 18 }}>
          {currentCourse ? <>
            <div style={{ height: 6, borderRadius: 99, background: "#eee", overflow: "hidden", marginBottom: 12 }}><i style={{ display: "block", height: "100%", width: `${currentCourse.progressPercent}%`, background: "linear-gradient(90deg,#50d7e2,#8875eb)" }} /></div>
            <Link href={`/student/courses/${currentCourse.slug}`} className="btn btn-primary btn-sm">Tiếp tục học</Link>
          </> : <p style={{ color: "#8d97a6" }}>Đăng ký khóa học để bắt đầu hành trình.</p>}
        </div>
      </section>

      <section className="h2o-student-card">
        <header className="h2o-student-card-head"><div><span><Brain size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />ÔN TẬP</span><h2>{dueCards.length} thẻ đến hạn</h2></div></header>
        <div style={{ padding: 18 }}>
          {dueCards.length === 0 ? <p style={{ color: "#8d97a6" }}>Không có thẻ nào đến hạn hôm nay.</p> : <>
            <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 12, color: "#354152" }}>{dueCards.slice(0, 4).map((card) => <li key={card.id}>{card.front}</li>)}</ul>
            <Link href="/study" className="btn btn-primary btn-sm"><Sparkles size={14} />Ôn ngay</Link>
          </>}
        </div>
      </section>
    </div>

    <div className="h2o-student-dashboard-grid second">
      <section className="h2o-student-card">
        <header className="h2o-student-card-head"><div><span><NotebookPen size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />GHI CHÚ</span><h2>Ghi chú gần đây</h2></div></header>
        <div style={{ padding: 18 }}>
          {notes.length === 0 ? <p style={{ color: "#8d97a6" }}>Chưa có ghi chú nào — mở một Knowledge Space và ghi lại điều bạn học được.</p> : (
            <div style={{ display: "grid", gap: 10 }}>{notes.map((note) => <div key={note.id} style={{ padding: 10, borderRadius: 10, border: "1px solid #edf0f2", fontSize: 12 }}>{note.title && <strong>{note.title}</strong>}<div style={{ color: "#718092" }}>{note.body.slice(0, 140)}</div></div>)}</div>
          )}
        </div>
      </section>

      <section className="h2o-student-card">
        <header className="h2o-student-card-head"><div><span>KHO TRI THỨC</span><h2>Đang học dở</h2></div></header>
        <div style={{ padding: 18 }}>
          {inProgressSpaces.length === 0 ? <p style={{ color: "#8d97a6" }}>Chưa có Knowledge Space nào đang học dở.</p> : (
            <div style={{ display: "grid", gap: 8 }}>{inProgressSpaces.map((space) => space.knowledge_spaces && <Link key={space.knowledge_space_id} href={`/student/spaces/${space.knowledge_spaces.slug}`} style={{ display: "flex", justifyContent: "space-between", padding: 10, borderRadius: 10, border: "1px solid #edf0f2", textDecoration: "none", color: "inherit", fontSize: 12 }}><span>{space.knowledge_spaces.title}</span><strong>{space.percent}%</strong></Link>)}</div>
          )}
        </div>
      </section>
    </div>

    <section className="h2o-student-card" style={{ marginTop: 20 }}>
      <header className="h2o-student-card-head"><div><span><Wand2 size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />LEARN → CREATE</span><h2>Biến kiến thức thành thành quả</h2></div><Link href="/student/create">Mở Studio</Link></header>
      <div style={{ padding: 18, display: "grid", gap: 8 }}>
        {createSuggestions.map((link) => link.locked ? (
          <div key={link.recipeSlug} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, borderRadius: 10, border: "1px solid #edf0f2", fontSize: 12, opacity: 0.6 }}>
            <span>{link.title}</span><span style={{ display: "flex", alignItems: "center", gap: 4, color: "#a05a13", fontSize: 10 }}><Lock size={12} />{link.lockReason}</span>
          </div>
        ) : (
          <Link key={link.recipeSlug} href={link.href} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, borderRadius: 10, border: "1px solid #edf0f2", textDecoration: "none", color: "inherit", fontSize: 12 }}>
            <span>{link.title}</span><span style={{ color: "#8875eb" }}>Tạo ngay →</span>
          </Link>
        ))}
      </div>
    </section>

    <section className="h2o-student-card" style={{ marginTop: 20 }}>
      <div style={{ padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div><strong style={{ display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={16} color="#22c55e" />Cần hỏi thêm?</strong><p style={{ margin: "4px 0 0", color: "#8d97a6", fontSize: 12 }}>H2O Mentor trả lời dựa trên đúng nội dung bạn đang học.</p></div>
        <Link href="/student/mentor" className="btn btn-primary"><Bot size={15} />Hỏi giảng viên</Link>
      </div>
    </section>
  </>;
}
