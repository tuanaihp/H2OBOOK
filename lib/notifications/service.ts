import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Real table (migration 0002), real RLS ("notifications self" — user_id=auth.uid() only), but
// nothing in the app ever read or wrote it before 2026-08-14: the student topbar's bell showed a
// hardcoded "2" (components/student/student-shell.tsx), not real data. Admin-granted access
// (Stage/Membership/Course — lib/academy-admin/entitlements.ts) now writes here; the bell now reads
// it for real. Writes use the admin/service client since the grant runs under the ADMIN's session,
// not the student's — the same reason recordStage1SkillEvidence (lib/stage1-learning-os/skill-
// evidence.ts) needs the admin client to write on a different user's behalf.
export interface CreateNotificationInput {
  organizationId: string;
  userId: string;
  title: string;
  message: string;
  notificationType?: string;
  href?: string | null;
}

// Best-effort by design: a failed notification insert must never roll back or fail the real grant
// it is describing — same "never block the caller's actual mutation" rule emitDomainEvent follows.
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  try {
    await admin.from("notifications").insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      title: input.title,
      message: input.message,
      notification_type: input.notificationType ?? "system",
      href: input.href ?? null
    });
  } catch { /* best-effort, never blocks the caller */ }
}
