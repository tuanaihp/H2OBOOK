import type { BrandProfile, H2OBook } from "@/types/editor";

export type UserRole = "owner" | "admin" | "designer" | "partner" | "teacher" | "student";
export type BookVisibility = "private" | "workspace" | "public";
export type CloneMode = "linked" | "independent";
export type CloneStatus = "synced" | "update_available" | "conflict";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type MembershipStatus = "trial" | "active" | "past_due" | "cancelled" | "expired";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  email: string;
  phone: string;
  logoUrl?: string;
  plan: "creator" | "academy" | "business";
  storageUsedMb: number;
  storageLimitMb: number;
  customDomain?: string;
  brandColor: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  status: "active" | "invited" | "disabled";
  lastSeenAt: string;
};

export type BookRecord = H2OBook & {
  slug: string;
  visibility: BookVisibility;
  category: string;
  tags: string[];
  price: number;
  readingMinutes: number;
  version: number;
  ownerId: string;
  brandId: string;
  publishedAt?: string;
  archivedAt?: string;
  cloneCount: number;
  studentCount: number;
};

export type TemplateRecord = {
  id: string;
  name: string;
  description: string;
  category: string;
  sourceBookId: string;
  cover: string;
  pageCount: number;
  version: number;
  price: number;
  status: "draft" | "published";
  visibility: "private" | "marketplace";
  allowLinkedClone: boolean;
  cloneCount: number;
  updatedAt: string;
};

export type CloneRecord = {
  id: string;
  templateId: string;
  targetBookId: string;
  brandId: string;
  partnerName: string;
  mode: CloneMode;
  status: CloneStatus;
  sourceVersion: number;
  currentTemplateVersion: number;
  overrideCount: number;
  conflictCount: number;
  createdAt: string;
  lastSyncedAt: string;
};

export type Student = {
  id: string;
  name: string;
  email: string;
  phone: string;
  classIds: string[];
  progress: number;
  completedBooks: number;
  status: "active" | "invited" | "paused";
  joinedAt: string;
  lastActiveAt: string;
};

export type CourseClass = {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  teacherName: string;
  bookIds: string[];
  studentIds: string[];
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "completed";
  color: string;
};

export type Assignment = {
  id: string;
  classId: string;
  bookId?: string;
  pageId?: string;
  title: string;
  instructions: string;
  dueAt: string;
  maxScore: number;
  submissionCount: number;
  gradedCount: number;
  status: "draft" | "published" | "closed";
};

export type QuizQuestion = {
  id: string;
  type: "single" | "multiple" | "true_false" | "short_text";
  question: string;
  options: string[];
  correctAnswers: string[];
  explanation: string;
  score: number;
};

export type Quiz = {
  id: string;
  title: string;
  bookId: string;
  chapterName: string;
  questions: QuizQuestion[];
  passingScore: number;
  timeLimitMinutes: number;
  attemptCount: number;
  averageScore: number;
  status: "draft" | "published";
};

export type Product = {
  id: string;
  type: "book" | "template" | "membership" | "bundle";
  referenceId: string;
  name: string;
  description: string;
  cover: string;
  price: number;
  compareAtPrice?: number;
  billingInterval?: "month" | "year";
  status: "draft" | "active" | "hidden";
  sales: number;
  revenue: number;
};

export type Order = {
  id: string;
  orderCode: string;
  customerName: string;
  customerEmail: string;
  productId: string;
  productName: string;
  total: number;
  paymentMethod: "bank_transfer" | "qr" | "card" | "manual";
  paymentStatus: PaymentStatus;
  createdAt: string;
};

export type Membership = {
  id: string;
  userId: string;
  userName: string;
  planName: string;
  price: number;
  billingInterval: "month" | "year";
  status: MembershipStatus;
  startsAt: string;
  renewsAt: string;
};

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: "book" | "clone" | "student" | "payment" | "system";
  href: string;
  read: boolean;
  createdAt: string;
};

export type Activity = {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
  tone: "neutral" | "success" | "warning";
};

export type AnalyticsSnapshot = {
  date: string;
  readers: number;
  pageViews: number;
  activeStudents: number;
  revenue: number;
};

export type AppDataExport = {
  version: 2;
  exportedAt: string;
  workspace: Workspace;
  brands: BrandProfile[];
  books: BookRecord[];
  templates: TemplateRecord[];
  clones: CloneRecord[];
  students: Student[];
  classes: CourseClass[];
  assignments: Assignment[];
  quizzes: Quiz[];
  products: Product[];
  orders: Order[];
  memberships: Membership[];
};

export type ReviewStage = "content" | "design" | "brand" | "legal" | "final";
export type ReviewStatus = "draft" | "in_review" | "changes_requested" | "approved" | "published";

export type ReviewChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
};

export type ReviewRequest = {
  id: string;
  bookId: string;
  title: string;
  stage: ReviewStage;
  status: ReviewStatus;
  requestedBy: string;
  assigneeIds: string[];
  dueAt: string;
  checklist: ReviewChecklistItem[];
  commentsCount: number;
  approvedBy?: string;
  updatedAt: string;
};

export type ReviewComment = {
  id: string;
  reviewId: string;
  bookId: string;
  pageId?: string;
  elementId?: string;
  authorId: string;
  authorName: string;
  message: string;
  resolved: boolean;
  createdAt: string;
};

export type CollaboratorPresence = {
  userId: string;
  name: string;
  initials: string;
  color: string;
  pageId?: string;
  status: "online" | "idle" | "offline";
  lastSeenAt: string;
};

export type CollaborationSession = {
  id: string;
  bookId: string;
  activeUsers: CollaboratorPresence[];
  lockedPageIds: string[];
  updatedAt: string;
};

export type AIAssistType = "outline" | "rewrite" | "quiz" | "summary" | "brand_copy" | "translate" | "accessibility";
export type AIJob = {
  id: string;
  type: AIAssistType;
  bookId?: string;
  prompt: string;
  output: string;
  provider: "local" | "gateway";
  status: "queued" | "completed" | "failed";
  createdAt: string;
};

export type AutomationTrigger = "book.published" | "review.approved" | "order.paid" | "membership.expiring" | "student.inactive" | "clone.update_available";
export type AutomationAction = "send_notification" | "grant_access" | "create_review" | "sync_clone" | "send_webhook" | "create_task";
export type AutomationRule = {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  status: "active" | "paused";
  runCount: number;
  errorCount: number;
  lastRunAt?: string;
  createdAt: string;
};

export type LicenseAgreement = {
  id: string;
  templateId: string;
  licensorName: string;
  licenseeName: string;
  model: "one_time" | "subscription" | "revenue_share";
  price: number;
  revenueSharePercent: number;
  status: "draft" | "active" | "expired" | "suspended";
  startsAt: string;
  expiresAt?: string;
  seats: number;
  cloneLimit: number;
  clonesUsed: number;
  revenue: number;
};

export type RoyaltyPayout = {
  id: string;
  licenseId: string;
  payeeName: string;
  period: string;
  grossRevenue: number;
  rate: number;
  amount: number;
  status: "pending" | "approved" | "paid";
  createdAt: string;
};

export type WhiteLabelPortal = {
  id: string;
  name: string;
  slug: string;
  customDomain?: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  theme: "light" | "dark" | "system";
  status: "draft" | "active" | "maintenance";
  bookIds: string[];
  memberCount: number;
  plan: "academy" | "business" | "enterprise";
  updatedAt: string;
};

export type ContentHealthReport = {
  id: string;
  bookId: string;
  score: number;
  readability: number;
  accessibility: number;
  brandConsistency: number;
  imageQuality: number;
  brokenLinks: number;
  warnings: string[];
  lastScannedAt: string;
};


export type SmartAssistMode = "local" | "external" | "off";

export type SmartSettings = {
  aiEnabled: boolean;
  assistMode: SmartAssistMode;
  offlineFirst: boolean;
  autoGenerateStudyCards: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  focusMode: boolean;
};

export type LearningGoal = {
  id: string;
  title: string;
  description: string;
  targetDate?: string;
  progress: number;
  status: "active" | "completed" | "paused";
  bookId?: string;
  createdAt: string;
};

export type LearningNote = {
  id: string;
  bookId: string;
  pageId?: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  updatedAt: string;
};

export type Flashcard = {
  id: string;
  bookId?: string;
  pageId?: string;
  front: string;
  back: string;
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  nextReviewAt: string;
  intervalDays: number;
  reviewCount: number;
  correctCount: number;
  createdAt: string;
};

export type StudySession = {
  id: string;
  bookId?: string;
  goalId?: string;
  mode: "read" | "review" | "practice" | "reflect";
  durationMinutes: number;
  completedItems: number;
  note?: string;
  startedAt: string;
  completedAt?: string;
};

export type KnowledgeSource = {
  id: string;
  title: string;
  sourceType: "book" | "pdf" | "docx" | "image" | "audio" | "video" | "url" | "note";
  status: "ready" | "processing" | "error";
  bookId?: string;
  assetId?: string;
  url?: string;
  tags: string[];
  createdAt: string;
};

export type ReusableBlock = {
  id: string;
  name: string;
  category: "lesson" | "practice" | "marketing" | "profile" | "assessment";
  description: string;
  preview: string;
  elementCount: number;
  isSystem: boolean;
};

export type AppDataExportV4 = Omit<AppDataExportV3, "version"> & {
  version: 4;
  smartSettings: SmartSettings;
  learningGoals: LearningGoal[];
  learningNotes: LearningNote[];
  flashcards: Flashcard[];
  studySessions: StudySession[];
  knowledgeSources: KnowledgeSource[];
  reusableBlocks: ReusableBlock[];
};
export type AppDataExportV3 = Omit<AppDataExport, "version"> & {
  version: 3;
  reviews: ReviewRequest[];
  reviewComments: ReviewComment[];
  collaborationSessions: CollaborationSession[];
  aiJobs: AIJob[];
  automations: AutomationRule[];
  licenses: LicenseAgreement[];
  royaltyPayouts: RoyaltyPayout[];
  whiteLabelPortals: WhiteLabelPortal[];
  contentHealthReports: ContentHealthReport[];
};
