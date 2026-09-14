import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ADMISSION_LEAD_COLUMNS,
  indexApplicationsByEmail,
  mapAdmissionLeadRow,
  normalizeLeadEmail,
  type AdmissionLeadRow,
  type LinkedApplication
} from "@/lib/operations/admission-leads";

const LEAD_LIMIT = 500;
// Keeps each `email=in.(...)` filter well under PostgREST's URL length limit.
const EMAIL_CHUNK = 80;

/** Operations CRM: the organization's real admission_leads (audit BUG-5), newest activity first. */
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo || !isSupabaseConfigured()) return NextResponse.json({ mode: "demo", leads: [] });

  const access = await resolveOrganizationAccess(auth.user!, await configuredAcademyOrganizationId(), ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN", message: "Chỉ chủ sở hữu hoặc quản trị viên được xem CRM tuyển sinh." }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  const { data, error } = await supabase
    .from("admission_leads")
    .select(ADMISSION_LEAD_COLUMNS)
    .eq("organization_id", access.organizationId)
    .order("updated_at", { ascending: false })
    .limit(LEAD_LIMIT);
  if (error) return NextResponse.json({ error: "LEADS_LOAD_FAILED", message: "Không tải được danh sách khách tuyển sinh.", retryable: true }, { status: 500 });
  const rows = (data ?? []) as unknown as AdmissionLeadRow[];

  // Link each lead to its latest public application so the UI knows whether "Duyệt → gửi invite"
  // approves an application or sends a direct invite. Best effort: without it the CRM still loads.
  let applications = new Map<string, LinkedApplication>();
  const admin = createSupabaseAdminClient();
  const emails = [...new Set(rows.map((row) => normalizeLeadEmail(row.email)).filter(Boolean))];
  if (admin && emails.length) {
    const found: Array<{ id: string; email: string | null; status: string; created_at: string }> = [];
    for (let index = 0; index < emails.length; index += EMAIL_CHUNK) {
      const { data: chunk } = await admin
        .from("academy_applications")
        .select("id,email,status,created_at")
        .eq("organization_id", access.organizationId)
        .in("email", emails.slice(index, index + EMAIL_CHUNK));
      found.push(...((chunk ?? []) as typeof found));
    }
    found.sort((left, right) => right.created_at.localeCompare(left.created_at));
    applications = indexApplicationsByEmail(found);
  }

  return NextResponse.json({
    mode: "production",
    leads: rows.map((row) => mapAdmissionLeadRow(row, applications.get(normalizeLeadEmail(row.email))))
  });
}
