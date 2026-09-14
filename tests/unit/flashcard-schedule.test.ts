import { describe, expect, it } from "vitest";
import { scheduleFlashcardReview } from "@/lib/student/flashcard-schedule";

const base = { intervalDays: 3, difficulty: 3, reviewCount: 4, correctCount: 2 };
const now = Date.UTC(2026, 8, 14);

describe("flashcard schedule", () => {
  it("extends the interval when remembered", () => {
    const next = scheduleFlashcardReview(base, true, now);
    expect(next.intervalDays).toBe(7);
    expect(next.difficulty).toBe(2);
    expect(next.correctCount).toBe(3);
    expect(next.nextReviewAt).toBe(new Date(now + 7 * 86_400_000).toISOString());
  });

  it("resets to tomorrow when forgotten", () => {
    const next = scheduleFlashcardReview(base, false, now);
    expect(next.intervalDays).toBe(1);
    expect(next.difficulty).toBe(4);
    expect(next.reviewCount).toBe(5);
    expect(next.correctCount).toBe(2);
  });

  it("caps the interval at 60 days and keeps difficulty in 1–5", () => {
    expect(scheduleFlashcardReview({ ...base, intervalDays: 45, difficulty: 1 }, true, now)).toMatchObject({ intervalDays: 60, difficulty: 1 });
    expect(scheduleFlashcardReview({ ...base, difficulty: 5 }, false, now).difficulty).toBe(5);
  });
});
