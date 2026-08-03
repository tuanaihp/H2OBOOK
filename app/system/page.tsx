import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { resolveOrganizationAccess } from "@/lib/auth/api";
import { SystemCommandCenterClient } from "./system-command-center-client";

// System Command Center (H2OBOOK System Control Plane V2). Server-enforced: role is
// re-resolved from the session here, not trusted from any client state — a direct URL hit by a
// non-admin/owner account is redirected before any system data is fetched, on top of the same
// check independently enforced again by /api/system/health.
export default async function SystemPage() {
  const user = await requireCurrentUser();
  const access = await resolveOrganizationAccess(user, undefined, ["admin", "owner"]);
  if (!access) redirect("/dashboard");
  return <SystemCommandCenterClient />;
}
