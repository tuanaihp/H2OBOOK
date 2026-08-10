// Universal Mission Workspace V1 — the "Làm việc" tab's block engine.
// Registry from v5/30-H2OBOOK_SMART_ROADMAP_MISSION_OS_V1/docs/MISSION_BLOCK_REGISTRY.md, with names
// aligned to the existing learning_block_type enum (migration 0026) wherever the concept is the
// same thing (checklist, assignment, result) — see supabase/migrations/0052 for why that table
// itself isn't reused, only its vocabulary.
//
// block_type is not a Postgres enum on the new tables (deliberately): the block list lives inside
// one jsonb column per mission version (migration 0052), so adding a 28th type is a TypeScript
// change, not a migration — matching the source package's own emphasis on Admin composing Missions
// without a page/migration per Mission.

export type MissionBlockType =
  | "text" | "textarea" | "number" | "select" | "multi_select" | "checkbox" | "date"
  | "note" | "checklist" | "table" | "kpi" | "action_plan" | "kanban"
  | "resource" | "tool" | "assignment"
  | "file" | "image" | "video" | "link" | "evidence"
  | "calculator" | "ai_question" | "ai_analysis"
  | "result_summary" | "result_metric" | "result_card";

export const MISSION_BLOCK_GROUPS: { label: string; types: MissionBlockType[] }[] = [
  { label: "Nhập liệu", types: ["text", "textarea", "number", "select", "multi_select", "checkbox", "date"] },
  { label: "Cấu trúc", types: ["note", "checklist", "table", "kpi", "action_plan", "kanban"] },
  { label: "Tham chiếu canonical", types: ["resource", "tool", "assignment"] },
  { label: "Bằng chứng", types: ["file", "image", "video", "link", "evidence"] },
  { label: "Thông minh", types: ["calculator", "ai_question", "ai_analysis"] },
  { label: "Kết quả", types: ["result_summary", "result_metric", "result_card"] }
];

export const MISSION_BLOCK_LABEL: Record<MissionBlockType, string> = {
  text: "Văn bản ngắn", textarea: "Văn bản dài", number: "Số", select: "Chọn 1", multi_select: "Chọn nhiều",
  checkbox: "Checkbox", date: "Ngày", note: "Ghi chú", checklist: "Checklist", table: "Bảng", kpi: "KPI",
  action_plan: "Kế hoạch hành động", kanban: "Kanban", resource: "Tài liệu (canonical)", tool: "Công cụ (canonical)",
  assignment: "Bài tập (canonical)", file: "File", image: "Ảnh", video: "Video", link: "Link", evidence: "Bằng chứng",
  calculator: "Máy tính", ai_question: "Câu hỏi AI", ai_analysis: "Phân tích AI",
  result_summary: "Tóm tắt kết quả", result_metric: "Chỉ số kết quả", result_card: "Result Card"
};

/**
 * Types whose config is just label + required + options — everything the shared config form
 * handles today. Reference-binding types (resource/tool/assignment) and evidence/result types have
 * their own dedicated config UI instead; see components/academy-admin/mission-workspace-builder.tsx.
 */
export const GENERIC_CONFIG_TYPES = new Set<MissionBlockType>([
  "text", "textarea", "number", "select", "multi_select", "checkbox", "date",
  "note", "table", "kpi", "action_plan", "kanban", "calculator", "ai_question", "ai_analysis",
  "video", "image", "link", "result_metric", "result_card"
]);

export interface MissionBlock {
  id: string;
  type: MissionBlockType;
  label: string;
  required: boolean;
  position: number;
  /** Only for resource/tool/assignment blocks — an id into the mission's own bindings (migration 0050), never a copy of canonical content. */
  bindingId?: string;
  /** Free-form per-type config (options for select, columns for table, etc.) — never canonical content. */
  options?: Record<string, unknown>;
}

export interface MissionWorkspaceConfig {
  id: string;
  journeyVersionId: string;
  missionId: string;
  schemaVersion: string;
  blocks: MissionBlock[];
  updatedAt: string;
}

export interface StudentBlockValue {
  blockId: string;
  value: unknown;
  status: "draft" | "saved";
  updatedAt: string;
}
