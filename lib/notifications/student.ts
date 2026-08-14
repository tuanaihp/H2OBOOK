import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface StudentNotification { id: string; title: string; message: string; notificationType: string; href: string | null; readAt: string | null; createdAt: string }

// Student's own session, not the admin client — RLS ("notifications self", migration 0002) already
// scopes every row to user_id=auth.uid(), so there is nothing here a student could read that isn't
// already theirs.
export async function listStudentNotifications(userId: string, organizationId: string): Promise<{ notifications: StudentNotification[]; unreadCount: number }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { notifications: [], unreadCount: 0 };
  const { data } = await supabase.from("notifications").select("id,title,message,notification_type,href,read_at,created_at")
    .eq("organization_id", organizationId).eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
  const rows = ((data ?? []) as { id: string; title: string; message: string; notification_type: string; href: string | null; read_at: string | null; created_at: string }[])
    .map((row) => ({ id: row.id, title: row.title, message: row.message, notificationType: row.notification_type, href: row.href, readAt: row.read_at, createdAt: row.created_at }));
  return { notifications: rows, unreadCount: rows.filter((row) => !row.readAt).length };
}

export async function markNotificationRead(userId: string, organizationId: string, notificationId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId).eq("user_id", userId).eq("organization_id", organizationId).is("read_at", null);
}

export async function markAllNotificationsRead(userId: string, organizationId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).eq("organization_id", organizationId).is("read_at", null);
}
