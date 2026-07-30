import type { CurrentUser } from "@/lib/auth/current-user";
import type { OperationsRole } from "@/types/operations";

// The Operations Foundation role model is a superset of the repository's real
// `member_role` enum (owner, admin, designer, partner, teacher, student) so that
// admissions/support/finance/content_manager/platform_admin can be designed for
// now and wired to real accounts once those roles exist in the database contract.
// "designer" and "partner" have no Operations Foundation area yet, so they bridge to null.
const bridgeableRoles: readonly OperationsRole[] = ["owner", "admin", "teacher", "student"];

export function toOperationsRole(role: CurrentUser["role"]): OperationsRole | null {
  return (bridgeableRoles as readonly string[]).includes(role) ? (role as OperationsRole) : null;
}
