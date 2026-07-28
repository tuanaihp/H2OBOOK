import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "./current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  return { user, response: null };
}

export function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return null;
}

function isUuid(value?: string) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export async function resolveOrganizationAccess(user: CurrentUser, requestedId?: string, allowedRoles?: string[]) {
  if (user.demo) return { organizationId: requestedId || "workspace_thuyh2o", role: user.role };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  let query = supabase.from("organization_members").select("organization_id,role,status").eq("user_id", user.id).eq("status", "active");
  if (isUuid(requestedId)) query = query.eq("organization_id", requestedId!);
  const { data, error } = await query.order("joined_at", { ascending: true }).limit(1).maybeSingle();
  if (error || !data) return null;
  if (allowedRoles?.length && !allowedRoles.includes(String(data.role))) return null;
  return { organizationId: String(data.organization_id), role: String(data.role) };
}
