import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { operationsFeatures } from "@/lib/operations/feature";
import { canAccessOperationsArea } from "@/lib/operations/permissions";
import { toOperationsRole } from "@/lib/operations/role-bridge";

export const dynamic = "force-dynamic";

// `platform_admin` does not exist in the repository's `member_role` enum yet, so
// this area is unreachable by design until a real platform-admin contract and
// route guard ship. Keep NEXT_PUBLIC_PLATFORM_ADMIN_V1=false in production.
export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  if (!operationsFeatures.platformAdmin) redirect("/dashboard");
  const user = await requireCurrentUser();
  const role = toOperationsRole(user.role);
  if (!role || !canAccessOperationsArea(role, "platform_admin")) redirect("/dashboard");
  return <>{children}</>;
}
