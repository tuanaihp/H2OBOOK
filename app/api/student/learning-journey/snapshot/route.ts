import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { generateCapabilitySnapshot, listCapabilitySnapshots } from "@/lib/learning-journey/snapshots";
import type { CapabilitySnapshotType } from "@/lib/learning-journey/types";

const SNAPSHOT_TYPES: CapabilitySnapshotType[] = ["weekly", "day30", "day60", "day90"];

// On-demand Weekly/Day30/Day60/Day90 capability snapshot — no cron infrastructure exists for this
// yet (vercel.json has no crons array registered), so V1 computes on request rather than inventing a
// scheduler. GET lists history; POST generates and persists a fresh one for the caller's own account.
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const typeParam = new URL(request.url).searchParams.get("type") as CapabilitySnapshotType | null;
  const snapshots = await listCapabilitySnapshots(organizationId, auth.user!.id, typeParam ?? undefined);
  return NextResponse.json({ snapshots });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const body = await request.json().catch(() => null) as { type?: string } | null;
  const type = body?.type as CapabilitySnapshotType | undefined;
  if (!type || !SNAPSHOT_TYPES.includes(type)) return NextResponse.json({ error: "INVALID_SNAPSHOT_TYPE" }, { status: 400 });
  const snapshot = await generateCapabilitySnapshot(organizationId, auth.user!.id, type);
  if (!snapshot) return NextResponse.json({ error: "SNAPSHOT_FAILED" }, { status: 400 });
  return NextResponse.json({ snapshot }, { status: 201 });
}
