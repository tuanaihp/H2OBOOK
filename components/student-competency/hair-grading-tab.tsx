"use client";
import { GradingForm } from "./grading-form";

// Spec §E: Hair is graded fully separately from Makeup, and its rubric is deliberately seeded
// with zero criteria until Admin approves and configures the real Hair structure via Supabase
// (migration 0060 header) — GradingForm's empty-rubric state below is the intended state here
// until that happens, not a bug.
export function HairGradingTab({ classId, roster, initialStudentId }: { classId: string; roster: { studentId: string; name: string }[]; initialStudentId?: string }) {
  return <GradingForm classId={classId} roster={roster} initialStudentId={initialStudentId} category="hair" sessionTypeFilter={["practice_hair"]}
    emptyRubricHint="Rubric Tóc chưa có tiêu chí — Admin cần thêm rubric_criteria cho rubric 'hair' qua Supabase trước khi chấm điểm (spec: không hard-code cấu trúc Hair chưa được duyệt)." />;
}
