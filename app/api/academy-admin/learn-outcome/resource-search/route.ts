import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { searchResourcesForPicker } from "@/lib/learn-outcome/service";

// The Resource Picker (docs/journey-v2 §8, "BẮT BUỘC" — Admin must never work by pasting a UUID).
// Search by title/summary against real curriculum_documents, scoped to the caller's own org.
export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchResourcesForPicker(access!.organizationId, query);
  return NextResponse.json({ results });
}
