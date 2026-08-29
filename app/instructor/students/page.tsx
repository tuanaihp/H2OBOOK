"use client";

import { StudentManagementWorkspace } from "@/components/student-competency/student-management-workspace";

// This is the instructor's direct Student Management entry point.  When they have more than one
// assigned class the workspace picks the first available class; a class-detail URL can still be
// used to open a specific class directly.
export default function InstructorStudentsPage() {
  return <StudentManagementWorkspace />;
}
