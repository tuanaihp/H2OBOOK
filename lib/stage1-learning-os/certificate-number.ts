// Pure formatting, kept out of credential.ts (which has "server-only" and touches Supabase) so it is
// testable without a database — same split this folder's other modules (tree-helpers, career-stages
// types) already use.
export function generateCertificateNo(stageSlug: string, sequence: number): string {
  const year = new Date().getFullYear();
  const code = stageSlug.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "STG1";
  return `H2O-${code}-${year}-${String(sequence).padStart(4, "0")}`;
}
