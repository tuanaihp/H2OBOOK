"use client";

import { MakeupJourney } from "@/components/student/makeup-journey/makeup-journey";

// "Chương trình đào tạo" — the Academy 60-session course. This is the "Lịch học" lane (all
// session types). /training, /practice and /hair are the filtered lanes.
export default function CurriculumSchedulePage() {
  return <MakeupJourney view="schedule" />;
}
