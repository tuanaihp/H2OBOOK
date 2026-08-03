import { NextResponse } from "next/server";
import { resolveBusinessAccess } from "@/lib/business/request";
import { getReadyCreateAssets } from "@/lib/business/assets";

export async function GET(request: Request) {
  const { access, response } = await resolveBusinessAccess(request);
  if (response) return response;
  const assets = await getReadyCreateAssets(access!);
  return NextResponse.json({ assets });
}
