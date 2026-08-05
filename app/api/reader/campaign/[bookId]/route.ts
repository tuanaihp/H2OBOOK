import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import type { LeadField, ReaderCampaign } from "@h2obook/growth-reader-core";

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
function toCampaign(bookKey: string, row: Record<string, unknown>, embed?: Record<string, unknown> | null): ReaderCampaign {
  return {
    id: String(row.client_key ?? row.id),
    bookId: bookKey,
    name: String(row.name ?? "Reader Growth Campaign"),
    enabled: row.status === "active",
    previewPages: Number(row.preview_pages ?? 5),
    leadGatePage: row.lead_gate_page == null ? null : Number(row.lead_gate_page),
    leadFields: (Array.isArray(row.lead_fields) ? row.lead_fields : ["name", "email"]) as LeadField[],
    downloadRequiresLead: Boolean(row.download_requires_lead),
    ctaPage: row.cta_page == null ? null : Number(row.cta_page),
    ctaLabel: String(row.cta_label ?? "Khám phá khóa học"),
    ctaUrl: String(row.cta_url ?? "/store"),
    allowedDomains: Array.isArray(embed?.allowed_domains) ? embed.allowed_domains.map(String) : [],
    utmCapture: row.utm_capture !== false,
    crmWebhookEnabled: Boolean(row.crm_webhook_enabled)
  };
}

export async function GET(_: Request, context: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await context.params;
  if (!isSupabaseConfigured()) return NextResponse.json({ campaign: null, mode: "demo" });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ campaign: null }, { status: 503 });
  const { data: book } = await admin.from("books").select("id,client_key,status").eq(isUuid(bookId) ? "id" : "client_key", bookId).maybeSingle();
  // A book we do not hold is not an error for the reader — the question is "what gates this book",
  // and "nothing" is a valid answer. Answering 404 made the client treat it as a failure and retry
  // on every page, which is what the demo books (never inserted into `books`) were triggering.
  if (!book) return NextResponse.json({ campaign: null, mode: "unknown-book" });
  const [{ data: campaign }, { data: embed }] = await Promise.all([
    admin.from("reader_campaigns").select("*").eq("book_id", book.id).eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("protected_embeds").select("allowed_domains,enabled,token_ttl_seconds").eq("book_id", book.id).maybeSingle()
  ]);
  return NextResponse.json({ campaign: campaign ? toCampaign(bookId, campaign, embed) : null });
}

export async function PUT(request: Request, context: { params: Promise<{ bookId: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { bookId } = await context.params;
  const body = await request.json().catch(() => null) as { organizationId?: string; campaign?: ReaderCampaign } | null;
  if (!body?.campaign) return NextResponse.json({ error: "CAMPAIGN_REQUIRED" }, { status: 400 });
  const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner", "admin", "designer"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ campaign: body.campaign, mode: "demo" });
  const { data: book } = await client.from("books").select("id,client_key").eq("organization_id", access.organizationId).eq(isUuid(bookId) ? "id" : "client_key", bookId).maybeSingle();
  if (!book) return NextResponse.json({ error: "BOOK_NOT_FOUND" }, { status: 404 });
  const campaign = body.campaign;
  const payload = {
    client_key: campaign.id,
    organization_id: access.organizationId,
    book_id: book.id,
    name: campaign.name,
    status: campaign.enabled ? "active" : "draft",
    preview_pages: campaign.previewPages,
    lead_gate_page: campaign.leadGatePage,
    lead_fields: campaign.leadFields,
    download_requires_lead: campaign.downloadRequiresLead,
    cta_page: campaign.ctaPage,
    cta_label: campaign.ctaLabel,
    cta_url: campaign.ctaUrl,
    utm_capture: campaign.utmCapture,
    crm_webhook_enabled: campaign.crmWebhookEnabled,
    updated_at: new Date().toISOString()
  };
  const { data: saved, error } = await client.from("reader_campaigns").upsert(payload, { onConflict: "client_key" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { error: embedError } = await client.from("protected_embeds").upsert({ organization_id: access.organizationId, book_id: book.id, enabled: true, allowed_domains: campaign.allowedDomains, updated_at: new Date().toISOString() }, { onConflict: "book_id" });
  if (embedError) return NextResponse.json({ error: embedError.message }, { status: 400 });
  return NextResponse.json({ campaign: toCampaign(bookId, saved, { allowed_domains: campaign.allowedDomains }) });
}
