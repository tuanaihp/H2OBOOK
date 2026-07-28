import { describe, expect, it } from "vitest";
import { localFlashcards, runLocalSmart } from "@/lib/local-smart-engine";

describe("local smart engine", () => {
  const text = "Chuẩn bị da giúp lớp nền bám tốt. Chọn kem nền theo loại da. Tán nền mỏng từng lớp để giữ độ trong trẻo.";
  it("summarizes without an AI provider", () => {
    const result = runLocalSmart("summary", text);
    expect(result.length).toBeGreaterThan(20);
  });
  it("creates review cards locally", () => {
    const cards = localFlashcards(text);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0]?.front).toBeTruthy();
  });
});
