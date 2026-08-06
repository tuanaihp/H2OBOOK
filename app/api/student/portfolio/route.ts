import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getCurrentUser } from "@/lib/auth/current-user";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getPortfolioSubmissions } from "@/lib/student/assignments";

// Portfolio is derived, never entered by hand: an item exists because an instructor marked a
// graded submission portfolio_ready. That is what makes it evidence rather than a claim, and it is
// why the profile page has no "add work" button.
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const user = await getCurrentUser();
  const organizationId = await configuredAcademyOrganizationId();
  if (!user || user.demo || !organizationId) return NextResponse.json({ mode: "demo", items: [] });

  const submissions = await getPortfolioSubmissions(user.id, organizationId);
  return NextResponse.json({
    mode: "production",
    items: submissions.map(({ assignmentTitle, attempt }) => ({
      id: attempt.id,
      title: assignmentTitle,
      score: attempt.score,
      approvedAt: attempt.gradedAt,
      summary: attempt.textResponse.slice(0, 180)
    }))
  });
}
