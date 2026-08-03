import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { getPendingPortfolioProjects } from "@/lib/teaching/projects";

export async function GET(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const projects = await getPendingPortfolioProjects(access!);
  return NextResponse.json({ projects });
}
