import type { OperationsRole } from "@/types/operations";

export type OperationsArea = "customer" | "instructor" | "operations" | "platform_admin" | "certificate_verify";

const permissions: Record<OperationsArea, OperationsRole[]> = {
  customer: ["student", "owner", "admin"],
  instructor: ["teacher", "owner", "admin"],
  operations: ["owner", "admin", "admissions", "support", "finance", "content_manager"],
  platform_admin: ["platform_admin"],
  certificate_verify: ["owner", "admin", "teacher", "student", "admissions", "support", "finance", "content_manager", "platform_admin"]
};

export function canAccessOperationsArea(role: OperationsRole, area: OperationsArea) {
  return permissions[area].includes(role);
}

export function getDefaultRouteForRole(role: OperationsRole) {
  if (role === "platform_admin") return "/platform-admin";
  if (role === "teacher") return "/instructor";
  if (["admissions", "support", "finance", "content_manager"].includes(role)) return "/operations";
  if (role === "student") return "/student";
  return "/dashboard";
}
