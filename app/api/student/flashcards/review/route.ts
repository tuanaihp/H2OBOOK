import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scheduleFlashcardReview } from "@/lib/student/flashcard-schedule";

// Records one flashcard answer for the signed-in student. Runs through the RLS-scoped server client
// ("flashcards own": user_id = auth.uid() and org membership) and filters by user_id again, so a card
// id from another account can never be rescheduled.
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo) return NextResponse.json({ error: "DEMO_MODE", message: "Chế độ demo không lưu lịch ôn." }, { status: 400 });

  const body = await request.json().catch(() => null) as { cardId?: string; remembered?: boolean } | null;
  if (!body?.cardId || !/^[0-9a-f-]{36}$/i.test(body.cardId) || typeof body.remembered !== "boolean") {
    return NextResponse.json({ error: "INVALID_REVIEW" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });

  const { data: card, error: loadError } = await supabase.from("flashcards")
    .select("id,interval_days,difficulty,review_count,correct_count")
    .eq("id", body.cardId).eq("user_id", auth.user!.id).maybeSingle();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 400 });
  if (!card) return NextResponse.json({ error: "FLASHCARD_NOT_FOUND" }, { status: 404 });

  const next = scheduleFlashcardReview({
    intervalDays: Number(card.interval_days), difficulty: Number(card.difficulty),
    reviewCount: Number(card.review_count), correctCount: Number(card.correct_count)
  }, body.remembered);

  const { error } = await supabase.from("flashcards").update({
    interval_days: next.intervalDays, difficulty: next.difficulty, review_count: next.reviewCount,
    correct_count: next.correctCount, next_review_at: next.nextReviewAt, updated_at: new Date().toISOString()
  }).eq("id", card.id).eq("user_id", auth.user!.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, intervalDays: next.intervalDays, nextReviewAt: next.nextReviewAt });
}
