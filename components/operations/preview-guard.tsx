import "server-only";

import { notFound, redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { resolveOrganizationAccess } from "@/lib/auth/api";

/**
 * Shared gate for every `*-preview` operations surface (audit F7): the feature flag decides
 * existence (404 when off), and only owner/admin may view what is still unfinished — previews
 * show unshipped workflows and seeded structures that would mislead teachers, partners or
 * students. A visible banner marks the surface as a preview so nobody mistakes it for production.
 */
export async function OpsPreviewLayout({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  if (!enabled) notFound();
  const user = await requireCurrentUser();
  if (!user.demo) {
    const access = await resolveOrganizationAccess(user, undefined, ["owner", "admin"]);
    if (!access) redirect("/dashboard");
  }
  return (
    <>
      <div
        role="status"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "6px 16px",
          background: "#fff7ed",
          color: "#9a3412",
          borderBottom: "1px solid #fed7aa",
          fontSize: 12,
          fontWeight: 600
        }}
      >
        BẢN XEM TRƯỚC — module này chưa hoàn thiện; dữ liệu và hành vi không phải production.
      </div>
      {children}
    </>
  );
}
