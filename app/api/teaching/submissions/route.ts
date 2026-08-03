import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { getSubmissionQueue } from "@/lib/teaching/submissions";

export async function GET(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const submissions = await getSubmissionQueue(access!);
  return NextResponse.json({ submissions });
}
