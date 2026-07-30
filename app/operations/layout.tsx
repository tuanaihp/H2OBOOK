import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { operationsFeatures } from "@/lib/operations/feature";
import { canAccessOperationsArea } from "@/lib/operations/permissions";
import { toOperationsRole } from "@/lib/operations/role-bridge";

export const dynamic = "force-dynamic";

// admissions/support/finance/content_manager are modeled in the Operations Foundation
// permission table but do not exist in the repository's `member_role` enum yet
// (supabase/migrations/0001_h2obook_core.sql), so real accounts can only reach this
// area as owner/admin until a follow-up migration adds those roles.
export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  if (!operationsFeatures.operationsCenter) redirect("/dashboard");
  const user = await requireCurrentUser();
  const role = toOperationsRole(user.role);
  if (!role || !canAccessOperationsArea(role, "operations")) redirect("/dashboard");
  return <>{children}</>;
}
