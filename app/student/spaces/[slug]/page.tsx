import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { buildStudentManifest } from "@/lib/learning-intelligence/service";
import { KnowledgeSpacePlayer } from "@/components/student/knowledge-space-player";

export const dynamic = "force-dynamic";

export default async function StudentKnowledgeSpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireCurrentUser();
  if (user.demo) notFound(); // Brain Learning Space has no demo dataset yet — see integration report.
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) notFound();
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const manifest = await buildStudentManifest(supabase, organizationId, slug, user.id);
  if (!manifest) notFound();
  return <KnowledgeSpacePlayer manifest={manifest} organizationId={organizationId} />;
}
