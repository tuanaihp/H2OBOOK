import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isTicketStatus, updateSupportTicketStatus } from "@/lib/operations/live-data";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Move a ticket between statuses. The write goes through the caller's RLS-bound client so the
 *  "staff manage" policy stays a second gate after the role check here. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo || !isSupabaseConfigured()) return NextResponse.json({ error: "DEMO_MODE", message: "Không thể cập nhật ticket thật trong chế độ demo." }, { status: 409 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "TICKET_NOT_FOUND" }, { status: 404 });

  const body = await request.json().catch(() => null) as { status?: unknown; assignToMe?: unknown } | null;
  if (!isTicketStatus(body?.status)) return NextResponse.json({ error: "INVALID_TICKET_STATUS" }, { status: 400 });

  const access = await resolveOrganizationAccess(auth.user!, undefined, ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  try {
    const assignee = body?.assignToMe === true ? auth.user!.id : undefined;
    const ticket = await updateSupportTicketStatus(supabase, access.organizationId, id, body!.status, assignee);
    if (!ticket) return NextResponse.json({ error: "TICKET_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true, ticket });
  } catch {
    return NextResponse.json({ error: "TICKET_UPDATE_FAILED", message: "Không cập nhật được yêu cầu hỗ trợ.", retryable: true }, { status: 500 });
  }
}
