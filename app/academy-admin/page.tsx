import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { resolveOrganizationAccess } from "@/lib/auth/api";
import { AcademyDashboardClient } from "./academy-dashboard-client";

// Academy Control Center Dashboard. Role is re-resolved server-side (never trusted from client
// state) and non-admin/owner sessions are redirected before any data is fetched — mirrors
// app/system/page.tsx's pattern from the System Control Plane module.
export default async function AcademyAdminPage() {
  const user = await requireCurrentUser();
  const access = await resolveOrganizationAccess(user, undefined, ["admin", "owner"]);
  if (!access) redirect("/dashboard");
  return <AcademyDashboardClient />;
}
