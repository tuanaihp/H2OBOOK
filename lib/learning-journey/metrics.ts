// Pure, deterministic aggregation helpers — no Supabase import, no "server-only", so these are
// directly unit-testable (same reason lib/mission-workspace/completion.ts has no server import).
// "Metrics phải deterministic. AI chỉ diễn giải" (source spec): every number here comes from real
// rows; nothing is invented when evidence is thin — callers must show "chưa đủ Evidence" instead of
// a fabricated score, never let this module silently coerce missing data to 0.

const MS_PER_DAY = 86_400_000;

export function average(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return null;
  const sum = finite.reduce((a, b) => a + b, 0);
  return Math.round((sum / finite.length) * 10) / 10;
}

export function trend(recent: number[], previous: number[]): "up" | "down" | "flat" | "unknown" {
  const a = average(recent);
  const b = average(previous);
  if (a == null || b == null) return "unknown";
  if (a - b >= 3) return "up";
  if (b - a >= 3) return "down";
  return "flat";
}

/** Day 1 on the same calendar day as startedAt, clamped to the 90-day window. */
export function journeyDayFromDate(startedAtIso: string, atIso: string): number {
  const started = new Date(startedAtIso).getTime();
  const at = new Date(atIso).getTime();
  const diffDays = Math.floor((at - started) / MS_PER_DAY) + 1;
  return Math.min(90, Math.max(1, diffDays));
}

export interface ReasonCount { reason: string; count: number }

/** Groups free-text "suspected reason" entries by exact trimmed/lowercased text. A reason that only
 * ever occurred once is not "recurring" — filtered out by minOccurrences, never inferred by fuzzy
 * matching (fuzzy grouping would be exactly the kind of AI-invented pattern the source spec forbids). */
export function summarizeRecurringReasons(reasons: (string | null | undefined)[], minOccurrences = 2): ReasonCount[] {
  const counts = new Map<string, number>();
  for (const raw of reasons) {
    const key = (raw ?? "").trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minOccurrences)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

export function periodBounds(type: "weekly" | "day30" | "day60" | "day90", now: Date = new Date()): { start: Date; end: Date; days: number } {
  const days = type === "weekly" ? 7 : type === "day30" ? 30 : type === "day60" ? 60 : 90;
  const end = new Date(now);
  const start = new Date(end.getTime() - days * MS_PER_DAY);
  return { start, end, days };
}

/** Evidence is "enough" once there are at least this many logged practice entries in the period —
 * below that, snapshot generation must report "chưa đủ Evidence để đánh giá" rather than a score. */
export const MIN_ENTRIES_FOR_EVIDENCE = 3;

export function hasEnoughEvidence(entriesCount: number): boolean {
  return entriesCount >= MIN_ENTRIES_FOR_EVIDENCE;
}
