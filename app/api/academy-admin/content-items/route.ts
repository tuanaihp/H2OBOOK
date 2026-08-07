import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { loadContentCatalog } from "@/lib/academy-control/service";
import { isContentType } from "@/lib/academy-control/types";

export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const q = url.searchParams.get("q") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? "30");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const result = await loadContentCatalog(access!.organizationId, {
    q,
    type: isContentType(type) ? type : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined
  });
  return NextResponse.json(result);
}
