"use client";
import { GradingForm } from "./grading-form";

export function MakeupGradingTab({ classId, roster, initialStudentId }: { classId: string; roster: { studentId: string; name: string }[]; initialStudentId?: string }) {
  return <GradingForm classId={classId} roster={roster} initialStudentId={initialStudentId} category="makeup" sessionTypeFilter={["practice_makeup_hair"]}
    emptyRubricHint="Chưa có rubric Makeup. Chạy scripts/seed-student-competency-rubrics.mjs --apply để tạo." />;
}
