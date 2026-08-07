import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { describeAi } from "@/lib/brain/ai";

// Reports whether an AI provider is configured and which model is in use — never the key itself,
// nor any part of it. The browser has no reason to know more than "on or off, and which model".
export async function GET(request: Request) {
  const { response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  return NextResponse.json(describeAi());
}
