import { requireCurrentUser } from "@/lib/auth/current-user";
import { getStudentCourseSummaries } from "@/lib/academy/student-course";
import { StudentJourneyMap } from "@/components/student/journey-map";

// "Hành trình của tôi" (LEARN tab 1). Was a course catalog; the primary view is now the real Journey
// Map (Outcome -> Milestone -> Mission), read from a published Journey Blueprint
// (lib/learn-outcome/*). Route kept as /student/courses so the sidebar link
// (lib/student/compact-navigation.ts) and every existing deep link into it keep working — only the
// content changes. The old course catalog is not deleted: it renders underneath as "Khóa học bổ
// trợ" (docs/learn-outcome-os's Release B spec §9 — supplementary, not primary).
export default async function StudentCoursesPage() {
  const user = await requireCurrentUser();
  const courses = await getStudentCourseSummaries(user);
  return <StudentJourneyMap supplementaryCourses={courses} />;
}
