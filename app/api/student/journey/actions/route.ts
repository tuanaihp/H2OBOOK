import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Every student_learning_actions row for this student — what Tab 4 (Hành động & Kết quả) reads so
// actions Start Mission created (lib/learn-outcome/student.ts) show up here too, not only inside
// the Mission Drawer they came from (docs/learn-outcome-os Release B §10).
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo) return NextResponse.json({ actions: [] });
  const organizationId = await configuredAcademyOrganizationId();
  const admin = createSupabaseAdminClient();
  if (!organizationId || !admin) return NextResponse.json({ actions: [] });
  const { data } = await admin.from("student_learning_actions").select("id,mission_id,source_type,title,status,due_date,completed_at,created_at").eq("organization_id", organizationId).eq("student_id", auth.user!.id).order("created_at", { ascending: false });
  return NextResponse.json({ actions: data ?? [] });
}
