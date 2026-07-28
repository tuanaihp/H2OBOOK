import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { getDocumentJob } from "@/lib/queue/document-queue";
import { inputErrorResponse } from "@/lib/input/api-errors";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(); if (auth.response) return auth.response;
    const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
    const access = await resolveOrganizationAccess(auth.user!, organizationId);
    if (!access) throw new Error("WORKSPACE_FORBIDDEN");
    const { id } = await params;
    const job = await getDocumentJob(id);
    if (!job) throw new Error("DOCUMENT_JOB_NOT_FOUND");
    if (job.organizationId !== access.organizationId) throw new Error("JOB_FORBIDDEN");
    return NextResponse.json({ job });
  } catch (error) { return inputErrorResponse(error, request, "DOCUMENT_JOB_READ_FAILED"); }
}
