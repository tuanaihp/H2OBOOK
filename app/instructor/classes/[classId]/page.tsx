"use client";

import { use as usePromise } from "react";
import { StudentManagementWorkspace } from "@/components/student-competency/student-management-workspace";

export default function ClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = usePromise(params);
  return <StudentManagementWorkspace classId={classId} />;
}
