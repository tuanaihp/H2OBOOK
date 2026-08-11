import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface LearningControlSummary {
  stages: { total: number; published: number };
  documents: number;
  missions: number;
  activeStudents: number;
  studentsWithProgress: number;
  /** Modules whose backing table exists but has no rows yet — reported as real zeros, not hidden. */
  flashcards: number;
  knowledgeSpaces: number;
  classes: number;
  assignments: number;
  quizzes: number;
}

/**
 * Org-wide training numbers for the Learning Control Center home (v5/32-.../CLAUDE_INTEGRATION_PROMPT.md
 * §9). Deliberately org-scoped and role-agnostic — an Owner opening LEARN should see "how is training
 * going across the organization", never their own personal flashcard streak, which is what the page
 * showed before (a Zustand demo store: fake mastery %, fake study minutes, fake goals).
 *
 * Every number is a real COUNT against a real table. Several are legitimately 0 today (flashcards,
 * knowledge_spaces, classes, assignments, quizzes) — those subsystems have schema but no production
 * rows yet; reported as real zeros so the gap is visible rather than papered over with demo data.
 */
export async function getLearningControlSummary(organizationId: string): Promise<LearningControlSummary | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const head = { count: "exact" as const, head: true };

  const [stagesTotal, stagesPublished, documents, missions, activeStudents, flashcards, knowledgeSpaces, classes, assignments, quizzes, states] = await Promise.all([
    admin.from("career_stages").select("id", head).eq("organization_id", organizationId),
    admin.from("career_stages").select("id", head).eq("organization_id", organizationId).eq("status", "active"),
    admin.from("curriculum_documents").select("id", head).eq("organization_id", organizationId),
    admin.from("learning_journey_missions").select("id", head).eq("organization_id", organizationId),
    admin.from("organization_members").select("id", head).eq("organization_id", organizationId).eq("role", "student").eq("status", "active"),
    admin.from("flashcards").select("id", head).eq("organization_id", organizationId),
    admin.from("knowledge_spaces").select("id", head).eq("organization_id", organizationId),
    admin.from("classes").select("id", head).eq("organization_id", organizationId),
    admin.from("assignments").select("id", head).eq("organization_id", organizationId),
    admin.from("quizzes").select("id", head).eq("organization_id", organizationId),
    admin.from("student_mission_states").select("student_id").eq("organization_id", organizationId)
  ]);

  const studentsWithProgress = new Set(((states.data ?? []) as { student_id: string }[]).map((r) => r.student_id)).size;

  return {
    stages: { total: stagesTotal.count ?? 0, published: stagesPublished.count ?? 0 },
    documents: documents.count ?? 0,
    missions: missions.count ?? 0,
    activeStudents: activeStudents.count ?? 0,
    studentsWithProgress,
    flashcards: flashcards.count ?? 0,
    knowledgeSpaces: knowledgeSpaces.count ?? 0,
    classes: classes.count ?? 0,
    assignments: assignments.count ?? 0,
    quizzes: quizzes.count ?? 0
  };
}
