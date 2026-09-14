import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { FlashcardReview, type ReviewCard } from "@/components/student/flashcard-review";

export const dynamic = "force-dynamic";

// Student flashcard review inside the student shell. "Ôn ngay" on /student/learn used to point at the
// workspace /study screen, which middleware bounces students away from — so the button sent learners
// back to /student. Same due-card query as /student/learn; answers go to /api/student/flashcards/review.
export default async function StudentStudyPage() {
  const user = await requireCurrentUser();
  let cards: ReviewCard[] = [];

  if (isSupabaseConfigured() && !user.demo) {
    const admin = createSupabaseAdminClient();
    const organizationId = await configuredAcademyOrganizationId();
    if (admin && organizationId) {
      const { data } = await admin.from("flashcards")
        .select("id,front,back,difficulty,review_count")
        .eq("user_id", user.id).eq("organization_id", organizationId)
        .lte("next_review_at", new Date().toISOString())
        .order("next_review_at", { ascending: true }).limit(50);
      cards = (data ?? []).map((row) => ({ id: String(row.id), front: String(row.front), back: String(row.back), difficulty: Number(row.difficulty), reviewCount: Number(row.review_count) }));
    }
  }

  return <>
    <section className="h2o-student-page-head">
      <div><span>ÔN TẬP</span><h1>Ôn thẻ đến hạn</h1><p>Lịch ôn lặp lại ngắt quãng, tính theo kết quả của bạn — không gọi AI.</p></div>
      <Link href="/student/learn" className="btn btn-secondary btn-sm">← Học &amp; ghi nhớ</Link>
    </section>
    <FlashcardReview cards={cards} demo={user.demo} />
  </>;
}
