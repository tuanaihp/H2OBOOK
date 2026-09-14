// Local spaced-repetition step shared by the workspace /study screen and the student review API.
// Deterministic and AI-free: remembering roughly doubles the interval (capped at 60 days); forgetting
// resets it to tomorrow. Difficulty drifts 1–5 with the answers.
export type FlashcardScheduleInput = { intervalDays: number; difficulty: number; reviewCount: number; correctCount: number };

export function scheduleFlashcardReview(card: FlashcardScheduleInput, remembered: boolean, now = Date.now()) {
  const intervalDays = remembered ? Math.min(60, Math.max(1, Math.round((card.intervalDays || 1) * 2.2))) : 1;
  return {
    intervalDays,
    difficulty: remembered ? Math.max(1, card.difficulty - 1) : Math.min(5, card.difficulty + 1),
    reviewCount: card.reviewCount + 1,
    correctCount: card.correctCount + (remembered ? 1 : 0),
    nextReviewAt: new Date(now + intervalDays * 86_400_000).toISOString()
  };
}
