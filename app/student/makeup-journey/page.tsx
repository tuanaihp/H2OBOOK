"use client";

import { MakeupJourney } from "@/components/student/makeup-journey/makeup-journey";

// Student-facing view of the 60-session Makeup course: schedule + per-session evidence upload +
// the instructor's grade once it lands. Backed by /api/student/makeup-journey.
export default function StudentMakeupJourneyPage() {
  return <MakeupJourney />;
}
