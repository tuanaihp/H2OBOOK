import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { escapeEmailHtml } from "@/lib/email/provider";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NEXT_PUBLIC_APP_MODE !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, membershipReminders: 0, learningReminders: 0, mode: "demo" });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * 86_400_000);
  const weekKey = now.toISOString().slice(0, 10);
  let membershipReminders = 0;
  let learningReminders = 0;

  const { data: memberships } = await admin.from("memberships").select("id,organization_id,user_id,plan_name,renews_at,expires_at,profiles!inner(email,full_name)")
    .eq("status", "active").gte("renews_at", now.toISOString()).lte("renews_at", inThreeDays.toISOString()).limit(500);
  for (const membership of memberships ?? []) {
    const profileValue = membership.profiles as unknown as { email?: string; full_name?: string } | { email?: string; full_name?: string }[];
    const profile = Array.isArray(profileValue) ? profileValue[0] : profileValue;
    if (!profile?.email) continue;
    await sendTransactionalEmail({
      admin, organizationId: String(membership.organization_id), userId: String(membership.user_id), templateKey: "membership_renewal", dedupeKey: `${membership.id}:${weekKey}`,
      to: profile.email, subject: `H2OBOOK – Gói ${membership.plan_name} sắp đến kỳ gia hạn`,
      html: `<h2>Chào ${escapeEmailHtml(profile.full_name || "bạn")},</h2><p>Gói <strong>${escapeEmailHtml(membership.plan_name)}</strong> sẽ đến kỳ gia hạn vào ${new Date(String(membership.renews_at)).toLocaleDateString("vi-VN")}.</p><p>Hãy kiểm tra phương thức thanh toán để hành trình học không bị gián đoạn.</p>`
    });
    membershipReminders += 1;
  }

  const inactiveBefore = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { data: members } = await admin.from("organization_members").select("organization_id,user_id,created_at,profiles!inner(email,full_name)").eq("role", "student").eq("status", "active").lt("created_at", inactiveBefore).limit(500);
  const userIds = (members ?? []).map((item) => String(item.user_id));
  const { data: recentProgress } = userIds.length ? await admin.from("academy_lesson_progress").select("user_id,last_watched_at").in("user_id", userIds).gte("last_watched_at", inactiveBefore) : { data: [] };
  const activeUsers = new Set((recentProgress ?? []).map((item) => String(item.user_id)));
  for (const member of members ?? []) {
    if (activeUsers.has(String(member.user_id))) continue;
    const profileValue = member.profiles as unknown as { email?: string; full_name?: string } | { email?: string; full_name?: string }[];
    const profile = Array.isArray(profileValue) ? profileValue[0] : profileValue;
    if (!profile?.email) continue;
    await sendTransactionalEmail({
      admin, organizationId: String(member.organization_id), userId: String(member.user_id), templateKey: "learning_inactive", dedupeKey: `${member.user_id}:${weekKey}`,
      to: profile.email, subject: "H2OBOOK – Bài học tiếp theo đang chờ bạn",
      html: `<h2>Chào ${escapeEmailHtml(profile.full_name || "bạn")},</h2><p>Bạn đã tạm dừng hành trình học hơn 7 ngày.</p><p>Chỉ cần quay lại một bài ngắn hôm nay để tiếp tục tiến độ và cập nhật Skill Map.</p>`
    });
    learningReminders += 1;
  }
  return NextResponse.json({ ok: true, membershipReminders, learningReminders, mode: "production" });
}
