import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { listStudentStageContextChecks, logStageContextMismatches } from "@/lib/academy-data-link/service";

// Stage Context Validator. GET is a plain read (safe to call from Stage Health/Setup Guide);
// POST additionally writes a domain_event per mismatch found, for the explicit "kiểm tra đồng bộ"
// action on the Data Link page — see lib/academy-data-link/service.ts's logStageContextMismatches
// for why the write is split out of the read.
export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const stageId = new URL(request.url).searchParams.get("stageId") ?? undefined;
  const checks = await listStudentStageContextChecks(access!.organizationId, stageId ? { stageId } : undefined);
  return NextResponse.json({ checks });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const stageId = new URL(request.url).searchParams.get("stageId") ?? undefined;
  const checks = await listStudentStageContextChecks(access!.organizationId, stageId ? { stageId } : undefined);
  await logStageContextMismatches(access!.organizationId, checks);
  return NextResponse.json({ checks });
}
