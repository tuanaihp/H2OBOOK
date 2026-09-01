// Deterministic, rubric-aware mock provider. NO "server-only" — the pure functions below are
// Vitest-importable (same convention as lib/h2o-coach/offline-engine.ts). This is the default
// H2O_AI_PROVIDER: it always produces a well-formed draft, needs no key and no network.
import type { AiAssessment, AiChatReply, AnalyzeInput, ChatInput } from "./types";

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const rand01 = (seed: string) => hash(seed) / 0xffffffff;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 2) / 2;

const ISSUE_BANK: { match: RegExp; issue: string; rec: string }[] = [
  { match: /n[eề]n|da|skin/i, issue: "Vùng cánh mũi hơi dày", rec: "Giảm lượng nền ở trung tâm mặt, tán mỏng ra ngoài" },
  { match: /m[aà]y|brow|ch[aâ]n m[aà]y/i, issue: "Đầu mày một bên hơi đậm", rec: "Tán mềm đầu mày, kéo màu về đuôi" },
  { match: /m[aắ]t|eye/i, issue: "Đuôi eyeliner chưa cân hai bên", rec: "Kẻ lại đuôi liner đối xứng, soi gương thẳng" },
  { match: /mi|lash/i, issue: "Chân mi chưa gọn", rec: "Làm sạch chân mi, gắn sát chân mi thật" },
  { match: /kh[oố]i|contour/i, issue: "Khối vùng hàm hơi cứng", rec: "Blend mềm ranh giới khối, giảm sắc độ" },
  { match: /m[aá]|m[oô]i|cheek|lip/i, issue: "Màu má/môi lệch tông nhẹ", rec: "Chọn má-môi cùng nhóm màu, chuyển sắc mềm hơn" },
  { match: /th[oờ]i gian|time|layout|quy tr[iì]nh/i, issue: "Kiểm soát tiến độ chưa đều", rec: "Bấm giờ từng bước, không dồn việc cuối giờ" },
];
function issueFor(label: string) {
  return ISSUE_BANK.find((b) => b.match.test(label)) ?? { issue: "Còn điểm chưa gọn ở tiêu chí này", rec: "Xem lại phần demo của giảng viên và làm lại chậm" };
}

export function mockAssessment(input: AnalyzeInput): AiAssessment {
  const rubric = input.rubric.length ? input.rubric : [{ id: "overall", label: "Tổng thể", maxScore: 100 }];
  let base = 78 + Math.round(rand01(input.seed) * 12); // 78–90
  base += input.note.trim().length > 40 ? 2 : input.note.trim().length > 8 ? 0 : -3;
  base += input.imageCount >= 3 ? 3 : input.imageCount >= 1 ? 0 : -8;
  base = clamp(base, 45, 97);

  const criteria = rubric.map((c) => {
    const p = clamp(base / 100 + (rand01(input.seed + "|" + c.id) - 0.5) * 0.16, 0.2, 1);
    const score = clamp(round1(p * c.maxScore), 0, c.maxScore);
    const { issue, rec } = issueFor(c.label);
    const good = score >= c.maxScore * 0.85;
    return {
      criterionId: c.id,
      score,
      maxScore: c.maxScore,
      strength: good ? "Làm tốt tiêu chí này" : "Có nền cơ bản, cần tinh chỉnh",
      issue: good ? "" : issue,
      recommendation: good ? "Giữ nguyên cách làm" : rec,
    };
  });

  const totalScore = round1(criteria.reduce((s, c) => s + c.score, 0));
  const maxScore = criteria.reduce((s, c) => s + c.maxScore, 0) || 100;
  const weakest = [...criteria].filter((c) => c.issue).sort((a, b) => a.score / a.maxScore - b.score / b.maxScore).slice(0, 3);
  const labelOf = (id: string) => rubric.find((r) => r.id === id)?.label ?? id;
  const priorityFixes = weakest.length
    ? weakest.map((c) => `${labelOf(c.criterionId)}: ${c.recommendation}`)
    : ["Giữ phong độ hiện tại, luyện thêm tốc độ trong 60 phút"];

  return {
    totalScore,
    maxScore,
    summary: weakest.length
      ? `Bài làm ổn định, tổng thể hài hoà (${Math.round((totalScore / maxScore) * 100)}%). Cần tập trung cải thiện: ${weakest.map((c) => labelOf(c.criterionId)).join(", ")}.`
      : `Bài làm tốt, đồng đều ở các tiêu chí (${Math.round((totalScore / maxScore) * 100)}%). Duy trì và luyện tốc độ.`,
    priorityFixes,
    criteria,
    provider: "mock",
    model: "mock-heuristic",
    analyzedAt: new Date().toISOString(),
  };
}

export function mockChat(input: ChatInput): AiChatReply {
  const last = input.messages[input.messages.length - 1]?.content.toLowerCase() ?? "";
  const fixes = input.latestAssessment?.priorityFixes ?? [];
  const base = fixes.length
    ? `Ở buổi "${input.sessionTitle}", ưu tiên của em là:\n` + fixes.map((f, i) => `${i + 1}. ${f}`).join("\n")
    : `Buổi "${input.sessionTitle}" chấm theo các tiêu chí: ${input.rubric.map((r) => r.label).join(", ")}. Em bấm "Phân tích bằng AI" trước để mình chỉ cụ thể phần cần sửa.`;

  if (/tr[uư][oơ]c|so s[aá]nh|before|after/.test(last)) {
    return { reply: base + `\n\nĐể so sánh trước/sau: chụp lại 1 ảnh chính diện, 1 ảnh cận mắt và 1 ảnh góc 45° cùng ánh sáng như lần đầu, rồi nộp lại.` };
  }
  if (/checklist|l[aà]m l[aạ]i|c[aá]c b[uư][oơ]c/.test(last)) {
    return { reply: `Checklist làm lại buổi "${input.sessionTitle}":\n` + (fixes.length ? fixes.map((f, i) => `☐ ${i + 1}. ${f}`).join("\n") : input.rubric.map((r, i) => `☐ ${i + 1}. Rà lại: ${r.label}`).join("\n")) };
  }
  if (/[uư]u ti[eê]n|tr[uư][oơ]c ti[eê]n|first/.test(last)) {
    return { reply: fixes.length ? `Sửa trước tiên: ${fixes[0]}` : base };
  }
  return { reply: base + `\n\nMình chỉ dựa trên rubric của buổi này. Em muốn mình đi sâu phần nào?` };
}
