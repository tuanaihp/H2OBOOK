import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listSupportTickets } from "@/lib/operations/live-data";

/** Operations Support Center: the organization's real support_tickets (audit C-OPS), newest first. */
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo || !isSupabaseConfigured()) return NextResponse.json({ mode: "demo", tickets: [] });

  const access = await resolveOrganizationAccess(auth.user!, undefined, ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN", message: "Chỉ chủ sở hữu hoặc quản trị viên được xem yêu cầu hỗ trợ." }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  try {
    const tickets = await listSupportTickets(supabase, access.organizationId);
    return NextResponse.json({ mode: "production", tickets });
  } catch {
    return NextResponse.json({ error: "TICKETS_LOAD_FAILED", message: "Không tải được danh sách yêu cầu hỗ trợ.", retryable: true }, { status: 500 });
  }
}
