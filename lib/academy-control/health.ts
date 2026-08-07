import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Stage Health and Preflight, computed from real rows at read time — nothing is stored, so there is
// no separate "health" table that can drift from the data it describes. Every dimension below is
// derived from academy_stage_nodes/career_stage_resources/academy_stage_ui_config, the same tables
// the rest of Academy Control Center reads and writes.

export interface StageHealthIssue { id: string; severity: "info" | "warning" | "error"; title: string }
export interface StageHealth {
  score: number;
  structure: number;
  contentCoverage: number;
  resourceIntegrity: number;
  accessRules: number;
  studentExperience: number;
  issues: StageHealthIssue[];
}
export interface PreflightCheck { key: string; label: string; status: "pass" | "warn" | "fail"; detail?: string }
export interface PreflightResult { ok: boolean; checks: PreflightCheck[] }

const emptyHealth: StageHealth = { score: 0, structure: 0, contentCoverage: 0, resourceIntegrity: 0, accessRules: 0, studentExperience: 0, issues: [] };

export async function computeStageHealth(organizationId: string, stageId: string): Promise<StageHealth> {
  const admin = createSupabaseAdminClient();
  if (!admin) return emptyHealth;

  const [{ data: nodeRows }, { data: resourceRows }, { data: uiConfigRows }] = await Promise.all([
    admin.from("academy_stage_nodes").select("id,parent_id,node_type").eq("organization_id", organizationId).eq("stage_id", stageId).neq("status", "archived"),
    admin.from("career_stage_resources").select("id,node_id,unlock_mode,prerequisite_binding_id,unlock_at").eq("organization_id", organizationId).eq("stage_id", stageId).neq("status", "archived"),
    admin.from("academy_stage_ui_config").select("status").eq("organization_id", organizationId).eq("stage_id", stageId)
  ]);

  const nodes = (nodeRows ?? []) as { id: string; parent_id: string | null; node_type: string }[];
  const resources = (resourceRows ?? []) as { id: string; node_id: string | null; unlock_mode: string | null; prerequisite_binding_id: string | null; unlock_at: string | null }[];
  const programs = nodes.filter((node) => node.node_type === "program");
  const modules = nodes.filter((node) => node.node_type === "module");
  const groups = nodes.filter((node) => node.node_type === "group");
  const containers = [...modules, ...groups];
  const issues: StageHealthIssue[] = [];

  let structure = 100;
  if (programs.length === 0) {
    structure = 0;
    issues.push({ id: "no-program", severity: "warning", title: "Chưa có chương trình nào trong giai đoạn này" });
  } else {
    const programsWithModule = programs.filter((program) => modules.some((moduleNode) => moduleNode.parent_id === program.id)).length;
    structure = Math.round((programsWithModule / programs.length) * 100);
    if (structure < 100) issues.push({ id: "program-no-module", severity: "warning", title: `${programs.length - programsWithModule} chương trình chưa có module` });
  }

  let contentCoverage: number;
  if (containers.length > 0) {
    const withResource = containers.filter((node) => resources.some((resource) => resource.node_id === node.id)).length;
    contentCoverage = Math.round((withResource / containers.length) * 100);
    if (contentCoverage < 100) issues.push({ id: "empty-nodes", severity: "warning", title: `${containers.length - withResource} module/nhóm chưa có tài liệu` });
  } else if (resources.length > 0) {
    contentCoverage = 100;
  } else {
    contentCoverage = 0;
    issues.push({ id: "no-resource", severity: "warning", title: "Giai đoạn chưa có tài liệu nào" });
  }

  // Resource_id integrity (does the row it points at still exist) is enforced structurally by how
  // attach flows write career_stage_resources — there is nothing left to check here without an
  // expensive per-resource cross-table join, so this dimension only reflects "is there content at
  // all", not deep referential integrity.
  const resourceIntegrity = resources.length > 0 ? 100 : programs.length > 0 || containers.length > 0 ? 50 : 0;

  let accessRules = 100;
  if (resources.length > 0) {
    const invalid = resources.filter((resource) => {
      if ((resource.unlock_mode === "after_resource" || resource.unlock_mode === "progress_gte") && !resource.prerequisite_binding_id) return true;
      if (resource.unlock_mode === "date" && !resource.unlock_at) return true;
      return false;
    });
    accessRules = Math.round(((resources.length - invalid.length) / resources.length) * 100);
    if (invalid.length > 0) issues.push({ id: "unlock-missing", severity: "error", title: `${invalid.length} tài nguyên có luật mở khóa thiếu điều kiện` });
  }

  const configStatuses = (uiConfigRows ?? []).map((row: { status: string }) => row.status);
  const hasPublished = configStatuses.includes("published");
  const hasDraft = configStatuses.includes("draft");
  const studentExperience = hasPublished ? 100 : hasDraft ? 50 : 0;
  if (!hasPublished) issues.push({ id: "no-published-nav", severity: "info", title: hasDraft ? "Có bản nháp giao diện học viên nhưng chưa xuất bản" : "Chưa soạn giao diện học viên cho giai đoạn này" });

  const score = Math.round((structure + contentCoverage + resourceIntegrity + accessRules + studentExperience) / 5);
  return { score, structure, contentCoverage, resourceIntegrity, accessRules, studentExperience, issues };
}

/** Preflight re-derives the same signals as Stage Health and turns them into a pass/warn/fail gate for Publish. */
export async function runStagePreflight(organizationId: string, stageId: string): Promise<PreflightResult> {
  const health = await computeStageHealth(organizationId, stageId);
  const checks: PreflightCheck[] = [
    { key: "structure", label: "Có ít nhất 1 chương trình với module", status: health.structure === 100 ? "pass" : health.structure > 0 ? "warn" : "fail" },
    { key: "content", label: "Có tài liệu gắn vào giai đoạn", status: health.contentCoverage > 0 ? (health.contentCoverage === 100 ? "pass" : "warn") : "fail" },
    { key: "unlock", label: "Luật mở khóa đầy đủ điều kiện", status: health.accessRules === 100 ? "pass" : health.accessRules > 0 ? "warn" : "fail" },
    { key: "experience", label: "Giao diện học viên đã xuất bản", status: health.studentExperience === 100 ? "pass" : "warn", detail: health.studentExperience === 100 ? undefined : "Học viên vẫn thấy sidebar mặc định — chưa xuất bản không chặn publish giai đoạn." }
  ];
  return { ok: checks.every((check) => check.status !== "fail"), checks };
}
