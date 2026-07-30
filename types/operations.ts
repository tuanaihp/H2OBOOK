export type OperationsRole =
  | "owner"
  | "admin"
  | "teacher"
  | "student"
  | "admissions"
  | "support"
  | "finance"
  | "content_manager"
  | "platform_admin";

export type LeadStage = "new" | "contacted" | "consulted" | "qualified" | "deposit" | "paid" | "enrolled" | "lost";
export type TicketStatus = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
export type Priority = "low" | "normal" | "high" | "urgent";
export type ApprovalStatus = "pending" | "approved" | "changes_requested" | "rejected";
export type ImportStatus = "draft" | "validating" | "ready" | "processing" | "completed" | "failed" | "rolled_back";

export type AdmissionLead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  interest: string;
  stage: LeadStage;
  ownerName: string;
  nextActionAt?: string;
  expectedValue: number;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CustomerApplication = {
  id: string;
  leadId: string;
  customerName: string;
  programName: string;
  profileCompletion: number;
  paymentStatus: "unpaid" | "deposit" | "paid" | "refunded";
  onboardingStage: "application" | "documents" | "payment" | "class_assignment" | "account_provisioning" | "completed";
  className?: string;
  accountProvisioned: boolean;
  documents: Array<{ id: string; label: string; status: "missing" | "uploaded" | "verified" }>;
  updatedAt: string;
};

export type InstructorClass = {
  id: string;
  name: string;
  code: string;
  schedule: string;
  studentCount: number;
  progress: number;
  pendingAssessments: number;
  atRiskStudents: number;
  nextSessionAt: string;
  status: "upcoming" | "active" | "completed";
};

export type AssessmentTask = {
  id: string;
  classId: string;
  studentName: string;
  assignmentTitle: string;
  submittedAt: string;
  dueAt: string;
  status: "submitted" | "reviewing" | "changes_requested" | "graded";
  score?: number;
  priority: Priority;
};

export type SupportTicket = {
  id: string;
  code: string;
  requesterName: string;
  requesterType: "lead" | "customer" | "student" | "instructor" | "staff";
  category: "account" | "payment" | "course" | "assignment" | "technical" | "policy";
  subject: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  assigneeName?: string;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalRequest = {
  id: string;
  type: "book" | "course" | "lesson" | "landing" | "design" | "graduation" | "certificate" | "marketplace";
  title: string;
  requesterName: string;
  reviewerName?: string;
  status: ApprovalStatus;
  dueAt?: string;
  riskLevel: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
};

export type NotificationTemplate = {
  id: string;
  eventKey: string;
  name: string;
  channels: Array<"email" | "zalo" | "telegram" | "push" | "in_app">;
  enabled: boolean;
  sentCount: number;
  failureCount: number;
  updatedAt: string;
};

export type DataImportJob = {
  id: string;
  type: "leads" | "students" | "payments" | "classes" | "scores";
  fileName: string;
  rowCount: number;
  validRows: number;
  invalidRows: number;
  status: ImportStatus;
  createdBy: string;
  createdAt: string;
  rollbackAvailable: boolean;
};

export type AutomationRecipe = {
  id: string;
  name: string;
  trigger: string;
  actions: string[];
  status: "active" | "paused" | "draft";
  runCount: number;
  errorCount: number;
  lastRunAt?: string;
};

export type PlatformOrganization = {
  id: string;
  name: string;
  slug: string;
  plan: "creator" | "academy" | "business" | "enterprise";
  status: "trial" | "active" | "past_due" | "suspended";
  memberCount: number;
  studentCount: number;
  storageUsedGb: number;
  storageLimitGb: number;
  monthlyRevenue: number;
  customDomain?: string;
  createdAt: string;
};

export type PlatformIncident = {
  id: string;
  service: "web" | "database" | "storage" | "queue" | "document_worker" | "publishing_worker" | "email" | "payment";
  status: "investigating" | "monitoring" | "resolved";
  severity: "info" | "minor" | "major" | "critical";
  title: string;
  startedAt: string;
  resolvedAt?: string;
};

export type CertificateIssue = {
  id: string;
  certificateNo: string;
  studentName: string;
  courseName: string;
  issuedAt: string;
  instructorName: string;
  status: "valid" | "revoked" | "expired";
  verificationToken: string;
};
