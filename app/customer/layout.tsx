import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { operationsFeatures } from "@/lib/operations/feature";
import { canAccessOperationsArea } from "@/lib/operations/permissions";
import { toOperationsRole } from "@/lib/operations/role-bridge";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  if (!operationsFeatures.customerPortal) redirect("/dashboard");
  const user = await requireCurrentUser();
  const role = toOperationsRole(user.role);
  if (!role || !canAccessOperationsArea(role, "customer")) redirect("/dashboard");
  return <>{children}</>;
}
