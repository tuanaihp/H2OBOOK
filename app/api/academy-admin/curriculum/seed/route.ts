import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { seedSixStageCurriculum } from "@/lib/curriculum/seed";

// The seed engine batches its writes (see lib/curriculum/seed.ts for why — the unbatched version was
// close to 800 sequential round trips and this route has no way to tell the browser it is still
// working), so this should finish in a handful of seconds. The explicit ceiling is a safety margin,
// not a requirement for normal operation.
export const maxDuration = 60;

// Loads the six-stage curriculum into the organisation resolved from the session — never from a
// body parameter, so this cannot be pointed at someone else's workspace.
//
// Safe to call repeatedly: every row is keyed by the manifest's seed keys and is insert-if-missing,
// so a second run reports everything as `existing` and changes nothing. Send { "dryRun": true } to
// see the counts without writing.
export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const report = await seedSixStageCurriculum({
    organizationId: access!.organizationId,
    actorUserId: access!.userId,
    dryRun: body?.dryRun === true
  });
  return NextResponse.json(report, { status: report.warnings.length ? 207 : 200 });
}
