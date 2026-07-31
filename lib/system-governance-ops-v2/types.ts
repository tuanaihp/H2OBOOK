export type SystemSurface =
  | "account"
  | "admin"
  | "assist-control"
  | "cloud-sync"
  | "enterprise"
  | "integrations"
  | "offline"
  | "security"
  | "settings"
  | "smart-settings"
  | "operations"
  | "operations-admissions"
  | "operations-approvals"
  | "operations-automation-center"
  | "operations-import-center"
  | "operations-notifications"
  | "operations-product-config"
  | "operations-support"
  | "operations-system-health";

export type SystemGroup = "personal" | "governance" | "operations";
export type HealthStatus = "healthy" | "warning" | "offline" | "optional" | "monitoring";
export type OperationalStatus = "new" | "active" | "paused" | "draft" | "pending" | "completed" | "failed" | "in_progress" | "waiting_customer" | "changes_requested";

export interface SystemSurfaceDefinition {
  id: SystemSurface;
  label: string;
  description: string;
  route: string;
  requiredRoles: string[];
  group: SystemGroup;
}

export interface RuntimeService {
  id: string;
  name: string;
  description: string;
  status: HealthStatus;
  required: boolean;
  lastCheckedAt?: string;
}

export interface SecurityControl {
  id: string;
  name: string;
  description: string;
  status: "active" | "missing" | "warning";
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
  severity: "info" | "warning" | "success";
}

export interface AdmissionLead {
  id: string;
  name: string;
  phone: string;
  product: string;
  owner: string;
  source: string;
  value: number;
  stage: "new" | "contacted" | "consulted" | "qualified" | "deposit" | "paid" | "enrolled";
  nextActionAt?: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  kind: "course" | "certificate" | "landing" | "marketplace" | "content";
  requester: string;
  risk: "low" | "medium" | "high";
  status: "pending" | "changes_requested" | "approved";
  checklistDone: number;
  checklistTotal: number;
  createdAt: string;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  trigger: string;
  steps: string[];
  status: "active" | "paused" | "draft";
  runs: number;
  errors: number;
  lastRunAt?: string;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  owner: string;
  entity: "leads" | "students" | "products" | "orders" | "content";
  rows: number;
  validRows: number;
  errorRows: number;
  status: "uploaded" | "mapping" | "ready" | "committing" | "completed" | "rolled_back" | "failed";
}

export interface NotificationTemplate {
  id: string;
  name: string;
  event: string;
  channels: Array<"email" | "zalo" | "push" | "telegram" | "in_app">;
  status: "active" | "paused" | "draft";
  sent: number;
  errors: number;
}

export interface ProductConfigurationItem {
  id: string;
  label: string;
  description: string;
  group: "public_academy" | "catalog" | "pricing" | "seo" | "feature_flag";
  status: "active" | "draft" | "disabled";
  updatedAt: string;
}

export interface SupportTicket {
  id: string;
  title: string;
  requester: string;
  category: "account" | "assignment" | "course" | "payment" | "content" | "technical";
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting_customer" | "resolved";
  assignee?: string;
  createdAt: string;
}

export interface OperationsHealthService {
  id: string;
  name: string;
  detail: string;
  status: "active" | "monitoring" | "degraded" | "offline";
  latencyMs?: number;
  queueDepth?: number;
  lastCheckedAt: string;
}
