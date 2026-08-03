import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { buildStudentManifest } from "@/lib/learning-intelligence/service";

// User-scoped client only: RLS on knowledge_spaces/versions/sections/blocks (see migration 0026)
// is the single source of truth for what this learner may see. No entitlement re-check here.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ACADEMY_ORGANIZATION_NOT_CONFIGURED" }, { status: 503 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { slug } = await params;
  const manifest = await buildStudentManifest(supabase, organizationId, slug, auth.user!.id);
  if (!manifest) return NextResponse.json({ error: "SPACE_NOT_FOUND_OR_NOT_ENTITLED" }, { status: 404 });
  return NextResponse.json({ manifest });
}
