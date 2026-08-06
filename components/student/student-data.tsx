"use client";
import { createContext, useContext, useEffect, useState } from "react";

// One source of truth for who the student is and how far along they are.
//
// Before this existed, each student screen answered those two questions for itself and each got a
// different answer: the sidebar read the real session, the dashboard fell back to the Zustand demo
// seed until its own fetch resolved, and the profile page never left the demo seed at all. The
// result was a signed-in owner seeing "Nguyen Van Tuan 78%" in the sidebar, "Tuan 0%" on the
// dashboard, "Anh 78%" after a reload and "Nguyễn Minh Anh" on the profile — four answers, one
// person. The demo seed is sample data for a signed-out tour; blending it with a real session is
// what made the product look like it had lost track of who was using it.
//
// The shell provides this once. Screens read it and never reach for store.students again.

export interface StudentIdentity {
  name: string;
  email: string;
  role: string;
  demo: boolean;
}

export interface StudentSummary {
  user: { name: string; email: string };
  courseProgress: number;
  mastery: number;
  activeCourses: number;
  completedLessons: number;
  totalLessons: number;
  nextCourse: { slug: string; title: string } | null;
  skillMastery: { key: string; label: string; masteryPercent: number; nextAction?: string }[];
  todayTasks: { title: string; description: string; href: string; estimatedMinutes: number }[];
  unlockedStageIds?: string[];
  mode: "demo" | "production";
}

interface StudentDataValue {
  identity: StudentIdentity | null;
  summary: StudentSummary | null;
  /** False until the summary request settles, so screens can hold off rather than guess. */
  loaded: boolean;
  /** True when a real session is driving the screen; demo seed must stay out in that case. */
  live: boolean;
}

const StudentDataContext = createContext<StudentDataValue>({ identity: null, summary: null, loaded: false, live: false });

export function StudentDataProvider({ identity, children }: { identity?: StudentIdentity; children: React.ReactNode }) {
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/summary", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: StudentSummary | null) => { if (!cancelled) setSummary(payload); })
      .catch(() => null)
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const live = Boolean(identity && !identity.demo);
  return <StudentDataContext.Provider value={{ identity: identity ?? null, summary, loaded, live }}>{children}</StudentDataContext.Provider>;
}

export function useStudentData(): StudentDataValue {
  return useContext(StudentDataContext);
}

/**
 * The name to show. Comes from the session, which is known at first paint, so it never flickers
 * from a demo name to the real one. Falls back to a neutral word rather than to a sample person —
 * showing someone else's name is worse than showing none.
 */
export function useStudentName(fallback = "Học viên"): string {
  const { identity, summary, live } = useStudentData();
  if (live && identity?.name) return identity.name;
  if (!live && summary?.user.name) return summary.user.name;
  return identity?.name || fallback;
}

/**
 * Progress as a percentage, or null while it is genuinely unknown. Null is deliberate: a caller
 * that renders nothing is honest, whereas a caller defaulting to a demo 78% is the bug this file
 * exists to remove.
 */
export function useStudentProgress(): number | null {
  const { summary, loaded, live } = useStudentData();
  if (summary?.mode === "production") return summary.mastery;
  if (live) return loaded ? 0 : null;
  return summary?.mastery ?? null;
}
