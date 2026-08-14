export interface JourneySkill { key: string; label: string }

/**
 * Kept in sync with lib/student/experience.ts's studentSkills ids/labels — the same skill_key
 * vocabulary getSkillMastery() (lib/student/mastery.ts) already aggregates learning_skill_evidence
 * rows by. Daily Log skill tags write into that same table/keys instead of starting a second,
 * disconnected taxonomy — tagging "bridal" or "consult" here starts feeding real mastery data into
 * skills that today only show fabricated demo progress in that curated array.
 */
export const JOURNEY_SKILLS: JourneySkill[] = [
  { key: "skin", label: "Kỹ thuật nền" },
  { key: "face", label: "Phân tích khuôn mặt" },
  { key: "bridal", label: "Makeup cô dâu" },
  { key: "waves", label: "Sóng và texture" },
  { key: "updo", label: "Tóc bới ứng dụng" },
  { key: "consult", label: "Tư vấn khách hàng" },
  { key: "team", label: "Làm việc nhóm" },
  { key: "pricing", label: "Định giá dịch vụ" },
  { key: "brand", label: "Thương hiệu cá nhân" }
];

export const JOURNEY_SKILL_KEYS = JOURNEY_SKILLS.map((s) => s.key);

export function isJourneySkillKey(value: string): boolean {
  return JOURNEY_SKILL_KEYS.includes(value);
}

export function journeySkillLabel(key: string): string {
  return JOURNEY_SKILLS.find((s) => s.key === key)?.label ?? key;
}
