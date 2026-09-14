import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decideApprovalRequest, isApprovalDecision } from "@/lib/operations/live-data";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Record an approval decision. The update is conditional on status='pending' so two reviewers
 *  deciding at once can't overwrite each other — the loser gets APPROVAL_NOT_PENDING back. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo || !isSupabaseConfigured()) return NextResponse.json({ error: "DEMO_MODE", message: "Không thể duyệt thật trong chế độ demo." }, { status: 409 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "APPROVAL_NOT_FOUND" }, { status: 404 });

  const body = await request.json().catch(() => null) as { decision?: unknown; decisionNote?: unknown } | null;
  if (!isApprovalDecision(body?.decision)) return NextResponse.json({ error: "INVALID_DECISION" }, { status: 400 });
  const note = typeof body?.decisionNote === "string" ? body.decisionNote : undefined;

  const access = await resolveOrganizationAccess(auth.user!, undefined, ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  try {
    const approval = await decideApprovalRequest(supabase, access.organizationId, id, body!.decision, auth.user!.id, note);
    if (!approval) return NextResponse.json({ error: "APPROVAL_NOT_PENDING", message: "Yêu cầu này đã được xử lý hoặc không tồn tại." }, { status: 409 });
    return NextResponse.json({ ok: true, approval });
  } catch {
    return NextResponse.json({ error: "APPROVAL_DECIDE_FAILED", message: "Không ghi nhận được quyết định.", retryable: true }, { status: 500 });
  }
}
