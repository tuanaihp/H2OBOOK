import { describe, expect, it } from "vitest";
import { average, hasEnoughEvidence, journeyDayFromDate, periodBounds, summarizeRecurringReasons, trend, MIN_ENTRIES_FOR_EVIDENCE } from "@/lib/learning-journey/metrics";
import { isJourneySkillKey, journeySkillLabel, JOURNEY_SKILLS } from "@/lib/learning-journey/skill-taxonomy";

// docs/H2O_LEARNING_JOURNEY_AUDIT.md — the ones testable without a live Supabase session (lib/
// learning-journey/service.ts, student-context.ts, snapshots.ts all carry "server-only" and cannot
// be imported by Vitest, same limitation every prior folder this session hit).
describe("average / trend (deterministic-only — no fabricated scores)", () => {
  it("returns null for an empty evidence list rather than 0", () => {
    expect(average([])).toBeNull();
  });

  it("ignores non-finite values instead of corrupting the mean", () => {
    expect(average([80, Number.NaN, 90])).toBe(85);
  });

  it("trend is 'unknown' when either half has no evidence yet — never guesses", () => {
    expect(trend([80], [])).toBe("unknown");
    expect(trend([], [80])).toBe("unknown");
  });

  it("trend requires a >=3 point swing to call up/down, otherwise flat", () => {
    expect(trend([90], [80])).toBe("up");
    expect(trend([70], [80])).toBe("down");
    expect(trend([81], [80])).toBe("flat");
  });
});

describe("journeyDayFromDate", () => {
  it("day 1 on the same calendar day it started", () => {
    expect(journeyDayFromDate("2026-08-14T08:00:00Z", "2026-08-14T20:00:00Z")).toBe(1);
  });

  it("clamps to 90 even if the student has been active longer", () => {
    expect(journeyDayFromDate("2026-01-01T00:00:00Z", "2026-08-14T00:00:00Z")).toBe(90);
  });

  it("never goes below 1 (defends against clock skew)", () => {
    expect(journeyDayFromDate("2026-08-14T00:00:00Z", "2026-08-01T00:00:00Z")).toBe(1);
  });
});

describe("summarizeRecurringReasons", () => {
  it("a reason that only occurred once is not 'recurring'", () => {
    expect(summarizeRecurringReasons(["tay run", "chưa quen cọ"])).toEqual([]);
  });

  it("groups exact (trimmed, case-insensitive) repeats and sorts by count desc", () => {
    const result = summarizeRecurringReasons(["Tay run", " tay run ", "chưa quen cọ", "chưa quen cọ", "chưa quen cọ", null, ""]);
    expect(result[0]).toEqual({ reason: "chưa quen cọ", count: 3 });
    expect(result[1]).toEqual({ reason: "tay run", count: 2 });
  });
});

describe("periodBounds / hasEnoughEvidence", () => {
  it("weekly window is 7 days, day90 window is 90 days", () => {
    const now = new Date("2026-08-14T00:00:00Z");
    const weekly = periodBounds("weekly", now);
    const day90 = periodBounds("day90", now);
    expect(weekly.days).toBe(7);
    expect(day90.days).toBe(90);
    expect(weekly.end.getTime()).toBe(now.getTime());
  });

  it("evidence threshold is honest — below it callers must show 'chưa đủ Evidence', not a score", () => {
    expect(hasEnoughEvidence(MIN_ENTRIES_FOR_EVIDENCE - 1)).toBe(false);
    expect(hasEnoughEvidence(MIN_ENTRIES_FOR_EVIDENCE)).toBe(true);
  });
});

describe("skill-taxonomy (reuses lib/student/experience.ts's studentSkills ids, not a second vocabulary)", () => {
  it("skin/face/waves — the 3 keys already written by real Mission-completion evidence — are present", () => {
    for (const key of ["skin", "face", "waves"]) expect(isJourneySkillKey(key)).toBe(true);
  });

  it("rejects a key outside the catalog", () => {
    expect(isJourneySkillKey("not_a_real_skill")).toBe(false);
  });

  it("every skill has a non-empty Vietnamese label", () => {
    for (const skill of JOURNEY_SKILLS) expect(journeySkillLabel(skill.key)).toBe(skill.label);
  });
});
