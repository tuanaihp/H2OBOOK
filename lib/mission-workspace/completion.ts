// Mission Workspace V2 (docs/mission-workspace-v2, §3 "Readiness != Completion"). This is a DISPLAY
// layer only — it never decides completion. The real completion gate stays exactly what it already
// was (lib/learn-outcome/student.ts's completeSelfReportedMission/submitEvidence's verified branch/
// teacherVerifyMission, all gated by completion_policy, writing student_mission_states.state — the
// one and only source of truth `mission.displayState` reads). What was missing was a way to show the
// student/admin an itemized "what's left" list instead of one aggregate sentence; this function
// builds that list from data the Mission Workspace already loaded, nothing new is fetched or stored.
export interface CompletionRequirement {
  id: string;
  label: string;
  required: boolean;
  satisfied: boolean;
  source: "workspace" | "action" | "evidence" | "teacher_review" | "metric";
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

export function getMissionCompletionChecklist(input: {
  blocks: { id: string; label: string; required: boolean }[];
  values: { blockId: string; value: unknown }[];
  actions: { id: string; title: string; required: boolean; status: string }[];
  evidence: { note?: string; assetId?: string }[];
  completionPolicy: string;
  displayState: string;
}): CompletionRequirement[] {
  const valueByBlock = new Map(input.values.filter((v) => isPresent(v.value)).map((v) => [v.blockId, v.value]));
  const items: CompletionRequirement[] = [];

  for (const block of input.blocks.filter((b) => b.required)) {
    items.push({ id: `workspace:${block.id}`, label: block.label, required: true, satisfied: valueByBlock.has(block.id), source: "workspace" });
  }
  for (const action of input.actions.filter((a) => a.required)) {
    items.push({ id: `action:${action.id}`, label: action.title, required: true, satisfied: action.status === "completed", source: "action" });
  }

  const needsEvidence = input.completionPolicy === "evidence_required" || input.completionPolicy === "teacher_verified";
  if (needsEvidence) {
    items.push({ id: "evidence:submitted", label: "Nộp minh chứng", required: true, satisfied: input.evidence.length > 0, source: "evidence" });
  }
  if (input.completionPolicy === "teacher_verified") {
    items.push({ id: "teacher:verified", label: "Giáo viên xác nhận", required: true, satisfied: input.displayState === "verified" || input.displayState === "result_achieved", source: "teacher_review" });
  }
  if (input.completionPolicy === "metric_based") {
    // No metric-threshold engine exists in the schema yet (audit: docs/mission-workspace-v2/01_PRODUCTION_AUDIT.md)
    // — reporting this honestly as an unresolved requirement rather than inventing a threshold check
    // that would either always pass (fake) or block forever (wrong). NOT VERIFIED, flagged plainly.
    items.push({ id: "metric:threshold", label: "Đạt chỉ số/KPI (chưa có engine kiểm tra tự động)", required: true, satisfied: input.displayState === "result_achieved", source: "metric" });
  }

  return items;
}
