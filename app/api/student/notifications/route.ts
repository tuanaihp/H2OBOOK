import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { listStudentNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/student";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId || auth.user!.demo) return NextResponse.json({ notifications: [], unreadCount: 0 });
  const result = await listStudentNotifications(auth.user!.id, organizationId);
  return NextResponse.json(result);
}

type Body = { action?: "read" | "read_all"; notificationId?: string };

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const body = await request.json().catch(() => null) as Body | null;
  if (body?.action === "read_all") { await markAllNotificationsRead(auth.user!.id, organizationId); return NextResponse.json({ ok: true }); }
  if (body?.action === "read" && body.notificationId) { await markNotificationRead(auth.user!.id, organizationId, body.notificationId); return NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: "ACTION_REQUIRED" }, { status: 400 });
}
