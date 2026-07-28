import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { sendEmail } from "@/lib/email/provider";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json() as { to?: string; organizationId?: string };
  const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!body.to || !/^\S+@\S+\.\S+$/.test(body.to)) return NextResponse.json({ error: "EMAIL_REQUIRED" }, { status: 400 });
  const result = await sendEmail({
    to: body.to,
    subject: "H2OBOOK – Kiểm tra kết nối email",
    html: "<h2>Kết nối thành công</h2><p>Hệ thống H2OBOOK đã gửi được email production.</p>"
  });
  return NextResponse.json({ ...result, organizationId: access.organizationId });
}
