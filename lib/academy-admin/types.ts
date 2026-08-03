// H2OBOOK Academy Control Center V1 (adapted from
// v5/15-h2obook-academy-control-center-v1/src/types.ts). The source module's AcademyRole
// includes system_admin/academy_admin/content_manager/reviewer/operations_manager/admissions/
// support_agent — none exist as real public.member_role values (same reconciliation as modules
// 12/13/14). AcademyRole here is narrowed to what the database can attest; Academy Control
// Center access maps onto the two real privileged roles, admin and owner (see the integration
// report for why Instructor/Content Manager delegated capabilities were not implemented this
// pass).
export type AcademyRole = "student" | "teacher" | "designer" | "partner" | "admin" | "owner";

export type AcademyCapability = "academy.dashboard.read" | "academy.course.read" | "academy.course.write" | "academy.entitlement.read" | "academy.entitlement.grant";

export interface AcademyAdminAccess {
  userId: string;
  organizationId: string;
  role: AcademyRole;
  capabilities: AcademyCapability[];
}

export type CourseStatus = "draft" | "active" | "hidden" | "archived";
export type ModuleLessonStatus = "draft" | "published" | "archived";

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: CourseStatus;
  moduleCount: number;
  lessonCount: number;
  publishedLessonCount: number;
  updatedAt: string;
}

export interface LessonRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  position: number;
  durationSeconds: number;
  videoUrl: string | null;
  status: ModuleLessonStatus;
  isPreview: boolean;
  skillKeys: string[];
}

export interface ModuleRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  position: number;
  status: ModuleLessonStatus;
  lessons: LessonRow[];
}

export interface CourseDetail {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  level: string;
  status: CourseStatus;
  price: number;
  currency: string;
  modules: ModuleRow[];
}
