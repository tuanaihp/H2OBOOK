import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, type EmailMessage } from "./provider";

export async function sendTransactionalEmail(input: EmailMessage & {
  admin?: SupabaseClient | null;
  organizationId?: string | null;
  userId?: string | null;
  templateKey: string;
  dedupeKey: string;
}) {
  const { admin, organizationId, userId, templateKey, dedupeKey, ...message } = input;
  if (admin) {
    const { data: existing } = await admin.from("transactional_email_log").select("id,status").eq("template_key", templateKey).eq("dedupe_key", dedupeKey).maybeSingle();
    if (existing?.status === "sent") return { skipped: true, id: existing.id, provider: "dedupe", accepted: true };
  }
  try {
    const result = await sendEmail(message);
    if (admin) await admin.from("transactional_email_log").upsert({
      organization_id: organizationId ?? null,
      user_id: userId ?? null,
      recipient: message.to.toLowerCase(),
      template_key: templateKey,
      dedupe_key: dedupeKey,
      provider: result.provider,
      provider_message_id: result.id,
      status: "sent",
      sent_at: new Date().toISOString()
    }, { onConflict: "template_key,dedupe_key" });
    return result;
  } catch (error) {
    if (admin) await admin.from("transactional_email_log").upsert({
      organization_id: organizationId ?? null,
      user_id: userId ?? null,
      recipient: message.to.toLowerCase(),
      template_key: templateKey,
      dedupe_key: dedupeKey,
      status: "failed",
      error_message: error instanceof Error ? error.message : "EMAIL_FAILED",
      sent_at: new Date().toISOString()
    }, { onConflict: "template_key,dedupe_key" });
    throw error;
  }
}
