import type { AcademyTargetType } from "./catalog";

export type AcademyApplicationStatus = "new" | "approved" | "invited" | "converted" | "rejected";

export type AcademyApplicationRecord = {
  id: string;
  organizationId: string;
  targetType: AcademyTargetType;
  targetSlug: string;
  targetName: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: AcademyApplicationStatus;
  source: string;
  createdAt: string;
  reviewedAt?: string;
  authUserId?: string;
};

export type AcademyDemoStudent = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "invited" | "active";
  joinedAt: string;
  progress: number;
};

type DemoState = { applications: AcademyApplicationRecord[]; students: AcademyDemoStudent[] };

const globalAcademy = globalThis as typeof globalThis & { __h2obookAcademyDemo?: DemoState };

export function academyDemoState(): DemoState {
  globalAcademy.__h2obookAcademyDemo ??= { applications: [], students: [] };
  return globalAcademy.__h2obookAcademyDemo;
}
