// H2OBOOK System Control Plane V2 (adapted from
// v5/14-h2obook-system-control-plane-operations-intelligence-v2/src/core/types.ts). The source
// module's WorkspaceRole includes mentor/instructor/reviewer/admissions/support_agent/
// operations_manager/system_admin — none of those exist as real public.member_role values (same
// reconciliation already done for lib/teaching/types.ts and lib/business/types.ts). System
// Control Plane access maps onto the two real privileged roles this repo has: admin and owner.
export type WorkspaceRole = "student" | "teacher" | "designer" | "partner" | "admin" | "owner";

export type EnvironmentName = "development" | "preview" | "production";
export type HealthState = "healthy" | "degraded" | "down" | "unknown";
export type ConfigState = "configured" | "missing" | "not_required";
export type ConnectionState = "connected" | "failed" | "not_tested";

export interface ServiceHealthCheck {
  key: string;
  label: string;
  description: string;
  required: boolean;
  configuration: ConfigState;
  connection: ConnectionState;
  operational: HealthState;
  latencyMs?: number;
  checkedAt: string;
  evidenceSource: string;
  message?: string;
}

export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface SystemAlert {
  id: string;
  title: string;
  severity: AlertSeverity;
  serviceKey?: string;
  createdAt: string;
  status: "open";
}

export interface HealthScoreResult {
  score: number;
  state: HealthState;
  requiredTotal: number;
  requiredHealthy: number;
  alerts: SystemAlert[];
  checks: ServiceHealthCheck[];
}

export interface PermissionContext {
  role: WorkspaceRole;
  userId: string;
  workspaceId: string;
}

export type SystemCapability = "system.view" | "system.manage" | "security.view" | "integrations.view" | "audit.view";

export interface SystemAccessSnapshot {
  userId: string;
  organizationId: string;
  role: WorkspaceRole;
  capabilities: SystemCapability[];
}
