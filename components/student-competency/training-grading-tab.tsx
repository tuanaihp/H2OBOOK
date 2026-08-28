"use client";
import { GradingForm } from "./grading-form";

// Spec §C: Training rubric is shared by Training Makeup & Tóc and Training Tóc — both session
// types feed the same rubric/form, so this is a thin, explicit wrapper (not a copy) around the
// shared GradingForm rather than a duplicated implementation.
export function TrainingGradingTab({ classId, roster, initialStudentId }: { classId: string; roster: { studentId: string; name: string }[]; initialStudentId?: string }) {
  return <GradingForm classId={classId} roster={roster} initialStudentId={initialStudentId} category="training" sessionTypeFilter={["training_makeup_hair", "training_hair"]}
    emptyRubricHint="Chưa có rubric Training. Chạy scripts/seed-student-competency-rubrics.mjs --apply để tạo." />;
}
