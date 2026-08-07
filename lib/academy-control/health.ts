import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Stage Health and Preflight, computed from real rows at read time — nothing is stored, so there is
// no separate "health" table that can drift from the data it describes. Every dimension below is
// derived from academy_stage_nodes/career_stage_resources/academy_stage_ui_config, the same tables
// the rest of Academy Control Center reads and writes.
//
// Everything is built around the batch entry point. The stage list needs health for every stage at
// once, and the first version answered that with one request and one full set of queries per stage —
// six stages meant six serverless invocations, each re-authenticating and re-querying. Loading once
// for the whole organisation and slicing in memory turns that back into a single round trip.

export interface StageHealthIssue { id: string; severity: "info" | "warning" | "error"; title: string }
export interface StageHealth {
  score: number;
  structure: number;
  contentCoverage: number;
  resourceIntegrity: number;
  accessRules: number;
  /** Reported for information only — deliberately excluded from `score`, see scoreStage. */
  studentExperience: number;
  unverifiedResources: number;
  issues: StageHealthIssue[];
}
export interface PreflightCheck { key: string; label: string; status: "pass" | "warn" | "fail"; detail?: string }
export interface PreflightResult { ok: boolean; checks: PreflightCheck[] }

const emptyHealth: StageHealth = { score: 0, structure: 0, contentCoverage: 0, resourceIntegrity: 0, accessRules: 0, studentExperience: 0, unverifiedResources: 0, issues: [] };

// Which table actually backs each resource_type. 'link' and 'roadmap' point at no table at all, so
// a reference of that kind can never be verified and is never counted as broken.
const SOURCE_TABLE: Record<string, string> = {
  book: "books",
  publication: "publications",
  template: "templates",
  knowledge_space: "knowledge_spaces",
  asset: "assets",
  course: "academy_courses"
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type NodeRow = { id: string; stage_id: string; parent_id: string | null; node_type: string };
type ResourceRow = { id: string; stage_id: string; node_id: string | null; resource_type: string; resource_id: string; unlock_mode: string | null; prerequisite_binding_id: string | null; unlock_at: string | null };

interface IntegrityIndex {
  /** Resource row ids whose referenced source row no longer exists. */
  missing: Set<string>;
  /** Resource row ids that cannot be checked at all (external links, or legacy slug-style ids). */
  unverified: Set<string>;
}

/**
 * Works out which resources still point at a row that exists, for every stage at once.
 *
 * career_stage_resources.resource_id is `text`, not a foreign key — it holds a uuid for anything
 * attached through the catalog, but older rows may hold a slug. Only uuid-shaped values are checked;
 * a slug is reported as "unverified" rather than broken, because it may be perfectly valid and
 * calling it an error would be a false alarm. Querying with a non-uuid in the list would also make
 * Postgres fail the whole `in (...)` cast, taking the entire health check down with it.
 *
 * One query per source table for the whole organisation, not per stage: six stages sharing a
 * hundred books ask about those books once.
 */
async function buildIntegrityIndex(organizationId: string, resources: ResourceRow[]): Promise<IntegrityIndex> {
  const index: IntegrityIndex = { missing: new Set(), unverified: new Set() };
  const admin = createSupabaseAdminClient();
  if (!admin) {
    for (const resource of resources) index.unverified.add(resource.id);
    return index;
  }

  const byTable = new Map<string, ResourceRow[]>();
  for (const resource of resources) {
    const table = SOURCE_TABLE[resource.resource_type];
    if (!table || !UUID_PATTERN.test(resource.resource_id)) {
      index.unverified.add(resource.id);
      continue;
    }
    byTable.set(table, [...(byTable.get(table) ?? []), resource]);
  }

  await Promise.all([...byTable].map(async ([table, rows]) => {
    const ids = [...new Set(rows.map((row) => row.resource_id))];
    const { data, error } = await admin.from(table).select("id").eq("organization_id", organizationId).in("id", ids);
    if (error) {
      // A table this deployment does not have is not a data problem with the stage.
      for (const row of rows) index.unverified.add(row.id);
      return;
    }
    const found = new Set((data ?? []).map((row: { id: string }) => String(row.id)));
    for (const row of rows) {
      if (!found.has(row.resource_id)) index.missing.add(row.id);
    }
  }));

  return index;
}

/** Scores one stage from data already in memory. No queries — the caller has loaded everything. */
function scoreStage(nodes: NodeRow[], resources: ResourceRow[], configStatuses: string[], integrity: IntegrityIndex): StageHealth {
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
    if (structure < 100) issues.push({ id: "program-no-module", severity: "warning", title: `${programs.length - programsWithModule} chương trình chưa có học phần` });
  }

  let contentCoverage: number;
  if (containers.length > 0) {
    const withResource = containers.filter((node) => resources.some((resource) => resource.node_id === node.id)).length;
    contentCoverage = Math.round((withResource / containers.length) * 100);
    if (contentCoverage < 100) issues.push({ id: "empty-nodes", severity: "warning", title: `${containers.length - withResource} học phần/nhóm chưa có tài liệu` });
  } else if (resources.length > 0) {
    contentCoverage = 100;
  } else {
    contentCoverage = 0;
    issues.push({ id: "no-resource", severity: "warning", title: "Giai đoạn chưa có tài liệu nào" });
  }

  const unassigned = resources.filter((resource) => !resource.node_id).length;
  if (unassigned > 0 && containers.length > 0) {
    issues.push({ id: "unassigned", severity: "info", title: `${unassigned} tài liệu chưa xếp vào chương trình/học phần nào` });
  }

  const missing = resources.filter((resource) => integrity.missing.has(resource.id)).length;
  const unverified = resources.filter((resource) => integrity.unverified.has(resource.id)).length;
  const checked = resources.length - unverified;
  let resourceIntegrity: number;
  if (checked > 0) {
    resourceIntegrity = Math.round(((checked - missing) / checked) * 100);
    if (missing > 0) issues.push({ id: "missing-source", severity: "error", title: `${missing} tài liệu trỏ tới nội dung đã bị xóa` });
  } else {
    resourceIntegrity = resources.length > 0 ? 100 : 0;
  }
  if (unverified > 0) {
    issues.push({ id: "unverified-source", severity: "info", title: `${unverified} tài liệu không kiểm chứng được (liên kết ngoài hoặc mã cũ dạng slug)` });
  }

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

  const hasPublished = configStatuses.includes("published");
  const hasDraft = configStatuses.includes("draft");
  const studentExperience = hasPublished ? 100 : hasDraft ? 50 : 0;
  if (!hasPublished) issues.push({ id: "no-published-nav", severity: "info", title: hasDraft ? "Có bản nháp giao diện học viên nhưng chưa xuất bản" : "Chưa soạn giao diện học viên cho giai đoạn này" });

  // studentExperience is deliberately NOT part of the score. The Student Experience Builder is not
  // wired to the live sidebar yet, so no stage can legitimately reach 100 there — including it would
  // cap every stage at 80/100 and make the number read as "something is wrong" when nothing is.
  const score = Math.round((structure + contentCoverage + resourceIntegrity + accessRules) / 4);
  return { score, structure, contentCoverage, resourceIntegrity, accessRules, studentExperience, unverifiedResources: unverified, issues };
}

/**
 * Health for every stage in the organisation, in a fixed number of queries regardless of how many
 * stages there are. Restricting by stage in SQL would not help: the stage list wants all of them.
 */
export async function computeStageHealthBatch(organizationId: string): Promise<Map<string, StageHealth>> {
  const result = new Map<string, StageHealth>();
  const admin = createSupabaseAdminClient();
  if (!admin) return result;

  const [{ data: stageRows }, { data: nodeRows }, { data: resourceRows }, { data: uiConfigRows }] = await Promise.all([
    admin.from("career_stages").select("id").eq("organization_id", organizationId).neq("status", "archived"),
    admin.from("academy_stage_nodes").select("id,stage_id,parent_id,node_type").eq("organization_id", organizationId).neq("status", "archived"),
    admin.from("career_stage_resources").select("id,stage_id,node_id,resource_type,resource_id,unlock_mode,prerequisite_binding_id,unlock_at").eq("organization_id", organizationId).neq("status", "archived"),
    admin.from("academy_stage_ui_config").select("stage_id,status").eq("organization_id", organizationId)
  ]);

  const stageIds = ((stageRows ?? []) as { id: string }[]).map((row) => String(row.id));
  const nodes = (nodeRows ?? []) as NodeRow[];
  const resources = (resourceRows ?? []) as ResourceRow[];
  const configs = (uiConfigRows ?? []) as { stage_id: string; status: string }[];
  const integrity = await buildIntegrityIndex(organizationId, resources);

  for (const stageId of stageIds) {
    result.set(stageId, scoreStage(
      nodes.filter((node) => String(node.stage_id) === stageId),
      resources.filter((resource) => String(resource.stage_id) === stageId),
      configs.filter((config) => String(config.stage_id) === stageId).map((config) => config.status),
      integrity
    ));
  }
  return result;
}

export async function computeStageHealth(organizationId: string, stageId: string): Promise<StageHealth> {
  const admin = createSupabaseAdminClient();
  if (!admin) return emptyHealth;

  const [{ data: nodeRows }, { data: resourceRows }, { data: uiConfigRows }] = await Promise.all([
    admin.from("academy_stage_nodes").select("id,stage_id,parent_id,node_type").eq("organization_id", organizationId).eq("stage_id", stageId).neq("status", "archived"),
    admin.from("career_stage_resources").select("id,stage_id,node_id,resource_type,resource_id,unlock_mode,prerequisite_binding_id,unlock_at").eq("organization_id", organizationId).eq("stage_id", stageId).neq("status", "archived"),
    admin.from("academy_stage_ui_config").select("stage_id,status").eq("organization_id", organizationId).eq("stage_id", stageId)
  ]);

  const resources = (resourceRows ?? []) as ResourceRow[];
  const integrity = await buildIntegrityIndex(organizationId, resources);
  return scoreStage(
    (nodeRows ?? []) as NodeRow[],
    resources,
    ((uiConfigRows ?? []) as { status: string }[]).map((config) => config.status),
    integrity
  );
}

/** Preflight re-derives the same signals as Stage Health and turns them into a pass/warn/fail gate for Publish. */
export async function runStagePreflight(organizationId: string, stageId: string): Promise<PreflightResult> {
  const health = await computeStageHealth(organizationId, stageId);
  const missingSource = health.issues.some((issue) => issue.id === "missing-source");
  const checks: PreflightCheck[] = [
    { key: "structure", label: "Có ít nhất 1 chương trình với học phần", status: health.structure === 100 ? "pass" : health.structure > 0 ? "warn" : "fail" },
    { key: "content", label: "Có tài liệu gắn vào giai đoạn", status: health.contentCoverage > 0 ? (health.contentCoverage === 100 ? "pass" : "warn") : "fail" },
    { key: "integrity", label: "Tài liệu trỏ tới nội dung còn tồn tại", status: missingSource ? "fail" : "pass", detail: health.unverifiedResources > 0 ? `${health.unverifiedResources} liên kết ngoài/mã cũ không kiểm chứng được.` : undefined },
    { key: "unlock", label: "Luật mở khóa đầy đủ điều kiện", status: health.accessRules === 100 ? "pass" : health.accessRules > 0 ? "warn" : "fail" },
    { key: "experience", label: "Giao diện học viên đã xuất bản", status: health.studentExperience === 100 ? "pass" : "warn", detail: health.studentExperience === 100 ? undefined : "Học viên vẫn thấy sidebar mặc định — chưa xuất bản không chặn publish giai đoạn." }
  ];
  return { ok: checks.every((check) => check.status !== "fail"), checks };
}
