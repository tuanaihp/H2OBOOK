import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppMode } from "@/lib/runtime-config";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "designer" | "partner" | "teacher" | "student";
  demo: boolean;
  /** Phone + PIN accounts: admin issued/re-issued the PIN, student must set their own before use. */
  mustChangePin: boolean;
};

const demoUser: CurrentUser = {
  id: "demo-owner",
  email: "owner@h2obook.local",
  name: "Thuỷ H2O",
  role: "owner",
  demo: true,
  mustChangePin: false
};

// React cache() deduplicates this per request. A student page render calls it at least twice —
// once in app/student/layout.tsx (requireCurrentUser) and again in the page itself — and each call
// was a full auth round trip plus two table reads to Supabase. Deduped, the second and any further
// caller reuses the first result instead of repeating ~3 network round trips.
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  if (getAppMode() === "demo") return demoUser;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("full_name,phone").eq("id", user.id).maybeSingle(),
    supabase.from("organization_members").select("role").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: true }).limit(1).maybeSingle()
  ]);
  const metadata = user.user_metadata ?? {};
  const dbRole = membership?.role;
  const role = (["owner", "admin", "designer", "partner", "teacher", "student"] as const).includes(dbRole as CurrentUser["role"])
    ? dbRole as CurrentUser["role"]
    : "student";
  return {
    id: user.id,
    email: user.email ?? "",
    // Phone + PIN students have no email — fall back to the admin-set profile name, then the phone.
    name: String(profile?.full_name || metadata.full_name || metadata.name || user.email?.split("@")[0] || profile?.phone || user.phone || "Học viên"),
    role,
    demo: false,
    mustChangePin: metadata.must_change_pin === true
  };
});

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
