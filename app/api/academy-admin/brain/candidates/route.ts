import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { loadBrainCandidates } from "@/lib/brain/service";

export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "30");
  const items = await loadBrainCandidates(access!.organizationId, {
    q: url.searchParams.get("q") ?? undefined,
    limit: Number.isFinite(limit) ? limit : undefined
  });
  return NextResponse.json({ items });
}
