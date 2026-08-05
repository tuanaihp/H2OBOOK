"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cloneBookForBrand } from "@/lib/brand-resolver";
import {
  seedActivities, seedAnalytics, seedAssignments, seedBooks, seedBrands, seedClasses,
  seedClones, seedMemberships, seedNotifications, seedOrders, seedProducts, seedQuizzes,
  seedStudents, seedTemplates, seedUsers, seedWorkspace
} from "@/lib/v2-seed";
import {
  seedAIJobs, seedAutomations, seedCollaborationSessions, seedContentHealthReports, seedLicenses,
  seedReviewComments, seedReviews, seedRoyaltyPayouts, seedWhiteLabelPortals
} from "@/lib/v3-seed";
import { uid } from "@/lib/utils";
import { runLocalSmart, localFlashcards } from "@/lib/local-smart-engine";
import { seedFlashcards, seedKnowledgeSources, seedLearningGoals, seedLearningNotes, seedReusableBlocks, seedSmartSettings, seedStudySessions } from "@/lib/v4-seed";
import type { BrandProfile, H2OBook } from "@/types/editor";
import type {
  Activity, AnalyticsSnapshot, AppDataExport, AppUser, Assignment, BookRecord, CloneMode,
  CloneRecord, CourseClass, Membership, Notification, Order, Product, Quiz, Student,
  TemplateRecord, Workspace, AIJob, AIAssistType, AutomationAction, AutomationRule, AutomationTrigger,
  CollaborationSession, ContentHealthReport, LicenseAgreement, ReviewComment, ReviewRequest,
  ReviewStage, ReviewStatus, RoyaltyPayout, WhiteLabelPortal, AppDataExportV3, AppDataExportV4,
  Flashcard, KnowledgeSource, LearningGoal, LearningNote, ReusableBlock, SmartSettings, StudySession
} from "@/types/domain";

type AppState = {
  workspace: Workspace;
  users: AppUser[];
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
  notifications: Notification[];
  activities: Activity[];
  analytics: AnalyticsSnapshot[];
  reviews: ReviewRequest[];
  reviewComments: ReviewComment[];
  collaborationSessions: CollaborationSession[];
  aiJobs: AIJob[];
  automations: AutomationRule[];
  licenses: LicenseAgreement[];
  royaltyPayouts: RoyaltyPayout[];
  whiteLabelPortals: WhiteLabelPortal[];
  contentHealthReports: ContentHealthReport[];
  smartSettings: SmartSettings;
  learningGoals: LearningGoal[];
  learningNotes: LearningNote[];
  flashcards: Flashcard[];
  studySessions: StudySession[];
  knowledgeSources: KnowledgeSource[];
  reusableBlocks: ReusableBlock[];
  activeBrandId: string;
  updateWorkspace: (patch: Partial<Workspace>) => void;
  createBook: (input?: Partial<BookRecord>) => BookRecord;
  upsertBook: (book: H2OBook | BookRecord) => void;
  duplicateBook: (bookId: string) => BookRecord | null;
  publishBook: (bookId: string) => void;
  archiveBook: (bookId: string) => void;
  createBrand: (input: Partial<BrandProfile>) => BrandProfile;
  updateBrand: (brandId: string, patch: Partial<BrandProfile>) => void;
  deleteBrand: (brandId: string) => void;
  setActiveBrand: (brandId: string) => void;
  createTemplateFromBook: (bookId: string, input?: Partial<TemplateRecord>) => TemplateRecord | null;
  publishTemplateVersion: (templateId: string) => void;
  cloneTemplate: (templateId: string, brandId: string, mode: CloneMode, partnerName?: string) => CloneRecord | null;
  syncClone: (cloneId: string) => void;
  resolveCloneConflicts: (cloneId: string) => void;
  createStudent: (input: Pick<Student, "name" | "email"> & Partial<Student>) => Student;
  updateStudent: (studentId: string, patch: Partial<Student>) => void;
  createClass: (input: Partial<CourseClass> & Pick<CourseClass, "name">) => CourseClass;
  updateClass: (classId: string, patch: Partial<CourseClass>) => void;
  enrollStudent: (classId: string, studentId: string) => void;
  createAssignment: (input: Partial<Assignment> & Pick<Assignment, "title" | "classId">) => Assignment;
  updateAssignment: (assignmentId: string, patch: Partial<Assignment>) => void;
  createQuiz: (input: Partial<Quiz> & Pick<Quiz, "title" | "bookId">) => Quiz;
  updateQuiz: (quizId: string, patch: Partial<Quiz>) => void;
  createProduct: (input: Partial<Product> & Pick<Product, "name" | "type" | "referenceId">) => Product;
  updateProduct: (productId: string, patch: Partial<Product>) => void;
  createOrder: (input: Partial<Order> & Pick<Order, "customerName" | "customerEmail" | "productId">) => Order | null;
  updateOrderStatus: (orderId: string, status: Order["paymentStatus"]) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  createReview: (input: { bookId: string; title: string; stage?: ReviewStage; assigneeIds?: string[] }) => ReviewRequest;
  updateReviewStatus: (reviewId: string, status: ReviewStatus) => void;
  toggleReviewChecklist: (reviewId: string, checklistId: string) => void;
  addReviewComment: (input: { reviewId: string; message: string; pageId?: string; elementId?: string }) => ReviewComment | null;
  resolveReviewComment: (commentId: string) => void;
  runAIAssistant: (input: { type: AIAssistType; prompt: string; bookId?: string }) => AIJob;
  createAutomation: (input: { name: string; trigger: AutomationTrigger; actions: AutomationAction[] }) => AutomationRule;
  toggleAutomation: (automationId: string) => void;
  runAutomation: (automationId: string) => void;
  createLicense: (input: Partial<LicenseAgreement> & Pick<LicenseAgreement, "templateId" | "licenseeName" | "model">) => LicenseAgreement;
  updateLicenseStatus: (licenseId: string, status: LicenseAgreement["status"]) => void;
  approveRoyaltyPayout: (payoutId: string) => void;
  createWhiteLabelPortal: (input: Partial<WhiteLabelPortal> & Pick<WhiteLabelPortal, "name">) => WhiteLabelPortal;
  updateWhiteLabelPortal: (portalId: string, patch: Partial<WhiteLabelPortal>) => void;
  scanBookHealth: (bookId: string) => ContentHealthReport | null;
  updateSmartSettings: (patch: Partial<SmartSettings>) => void;
  createLearningGoal: (input: Pick<LearningGoal, "title"> & Partial<LearningGoal>) => LearningGoal;
  updateLearningGoal: (goalId: string, patch: Partial<LearningGoal>) => void;
  createLearningNote: (input: Pick<LearningNote, "bookId" | "title" | "content"> & Partial<LearningNote>) => LearningNote;
  deleteLearningNote: (noteId: string) => void;
  addFlashcardsFromText: (input: { text: string; bookId?: string; pageId?: string }) => Flashcard[];
  reviewFlashcard: (cardId: string, remembered: boolean) => void;
  addStudySession: (input: Partial<StudySession> & Pick<StudySession, "mode" | "durationMinutes">) => StudySession;
  addKnowledgeSource: (input: Partial<KnowledgeSource> & Pick<KnowledgeSource, "title" | "sourceType">) => KnowledgeSource;
  exportData: () => AppDataExportV4;
  importData: (data: AppDataExport | AppDataExportV3 | AppDataExportV4) => void;
  resetDemoData: () => void;
};

function toBookRecord(book: H2OBook | BookRecord, existing?: BookRecord): BookRecord {
  const candidate = book as BookRecord;
  return {
    ...structuredClone(book),
    slug: candidate.slug ?? existing?.slug ?? book.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    visibility: candidate.visibility ?? existing?.visibility ?? "workspace",
    category: candidate.category ?? existing?.category ?? "Chưa phân loại",
    tags: candidate.tags ?? existing?.tags ?? [],
    price: candidate.price ?? existing?.price ?? 0,
    readingMinutes: candidate.readingMinutes ?? existing?.readingMinutes ?? Math.max(5, book.pages.length * 3),
    version: candidate.version ?? existing?.version ?? 1,
    ownerId: candidate.ownerId ?? existing?.ownerId ?? "user_owner",
    brandId: candidate.brandId ?? existing?.brandId ?? "brand_thuyh2o",
    publishedAt: candidate.publishedAt ?? existing?.publishedAt,
    archivedAt: candidate.archivedAt ?? existing?.archivedAt,
    cloneCount: candidate.cloneCount ?? existing?.cloneCount ?? 0,
    studentCount: candidate.studentCount ?? existing?.studentCount ?? 0
  };
}

const resetState = () => ({
  workspace: structuredClone(seedWorkspace), users: structuredClone(seedUsers), brands: structuredClone(seedBrands),
  books: structuredClone(seedBooks), templates: structuredClone(seedTemplates), clones: structuredClone(seedClones),
  students: structuredClone(seedStudents), classes: structuredClone(seedClasses), assignments: structuredClone(seedAssignments),
  quizzes: structuredClone(seedQuizzes), products: structuredClone(seedProducts), orders: structuredClone(seedOrders),
  memberships: structuredClone(seedMemberships), notifications: structuredClone(seedNotifications),
  activities: structuredClone(seedActivities), analytics: structuredClone(seedAnalytics),
  reviews: structuredClone(seedReviews), reviewComments: structuredClone(seedReviewComments),
  collaborationSessions: structuredClone(seedCollaborationSessions), aiJobs: structuredClone(seedAIJobs),
  automations: structuredClone(seedAutomations), licenses: structuredClone(seedLicenses),
  royaltyPayouts: structuredClone(seedRoyaltyPayouts), whiteLabelPortals: structuredClone(seedWhiteLabelPortals),
  contentHealthReports: structuredClone(seedContentHealthReports),
  smartSettings: structuredClone(seedSmartSettings), learningGoals: structuredClone(seedLearningGoals),
  learningNotes: structuredClone(seedLearningNotes), flashcards: structuredClone(seedFlashcards),
  studySessions: structuredClone(seedStudySessions), knowledgeSources: structuredClone(seedKnowledgeSources),
  reusableBlocks: structuredClone(seedReusableBlocks), activeBrandId: "brand_thuyh2o"
});

/**
 * Swaps a stale sample book for its current seed. "Stale" means its cover still reads as the
 * makeup course while claiming to be another book — the exact shape of the shallow-copy bug. A
 * book whose cover has since been edited fails that test and is left alone.
 */
function refreshStaleSampleBooks(books: BookRecord[] | undefined): BookRecord[] {
  const seeds = structuredClone(seedBooks);
  if (!books?.length) return seeds;
  const staleCover = "MAKEUP CHUY\u1ec2N NGHI\u1ec6P";
  return books.map((book) => {
    const seed = seeds.find((candidate) => candidate.id === book.id);
    if (!seed || book.id === "book_makeup_pro") return book;
    const looksStale = book.pages?.[0]?.elements?.some((element) => typeof element.text === "string" && element.text.includes(staleCover));
    return looksStale ? seed : book;
  });
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...resetState(),
      updateWorkspace: (patch) => set((state) => ({ workspace: { ...state.workspace, ...patch } })),
      createBook: (input = {}) => {
        const pageId = uid("page");
        const base: H2OBook = {
          id: uid("book"), title: input.title ?? "Sách mới chưa đặt tên", subtitle: input.subtitle ?? "Bắt đầu xây dựng nội dung của bạn",
          author: input.author ?? get().workspace.ownerName, cover: input.cover ?? "linear-gradient(135deg,#4d1735,#9f5274,#f0c5d5)",
          status: "draft", updatedAt: new Date().toISOString(), pages: [{ id: pageId, name: "Trang bìa", width: 794, height: 1123, background: "#fffaf7", elements: [] }]
        };
        const record = toBookRecord({ ...base, ...input } as BookRecord);
        set((state) => ({ books: [record, ...state.books] }));
        return record;
      },
      upsertBook: (book) => set((state) => {
        const existing = state.books.find((item) => item.id === book.id);
        const record = toBookRecord(book, existing);
        return { books: existing ? state.books.map((item) => item.id === record.id ? record : item) : [record, ...state.books] };
      }),
      duplicateBook: (bookId) => {
        const source = get().books.find((book) => book.id === bookId);
        if (!source) return null;
        const copy = structuredClone(source);
        copy.id = uid("book"); copy.title = `${source.title} — Bản sao`; copy.slug = `${source.slug}-${Date.now()}`;
        copy.status = "draft"; copy.version = 1; copy.publishedAt = undefined; copy.cloneCount = 0; copy.studentCount = 0;
        copy.updatedAt = new Date().toISOString(); copy.pages = copy.pages.map((page) => ({ ...page, id: uid("page"), elements: page.elements.map((element) => ({ ...element, id: uid(element.type) })) }));
        set((state) => ({ books: [copy, ...state.books] }));
        return copy;
      },
      publishBook: (bookId) => set((state) => ({ books: state.books.map((book) => book.id === bookId ? { ...book, status: "published", visibility: "public", version: book.version + 1, publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : book) })),
      archiveBook: (bookId) => set((state) => ({ books: state.books.map((book) => book.id === bookId ? { ...book, archivedAt: new Date().toISOString() } : book) })),
      createBrand: (input) => {
        const brand: BrandProfile = { ...structuredClone(seedBrands[0]), ...input, id: uid("brand"), name: input.name ?? "Thương hiệu mới" };
        set((state) => ({ brands: [...state.brands, brand] }));
        return brand;
      },
      updateBrand: (brandId, patch) => set((state) => ({ brands: state.brands.map((brand) => brand.id === brandId ? { ...brand, ...patch } : brand) })),
      deleteBrand: (brandId) => set((state) => ({ brands: state.brands.filter((brand) => brand.id !== brandId), activeBrandId: state.activeBrandId === brandId ? state.brands[0]?.id ?? "" : state.activeBrandId })),
      setActiveBrand: (brandId) => set({ activeBrandId: brandId }),
      createTemplateFromBook: (bookId, input = {}) => {
        const book = get().books.find((item) => item.id === bookId);
        if (!book) return null;
        const template: TemplateRecord = {
          id: uid("template"), name: input.name ?? `${book.title} — Master Template`, description: input.description ?? book.subtitle,
          category: input.category ?? book.category, sourceBookId: book.id, cover: input.cover ?? book.cover, pageCount: book.pages.length,
          version: 1, price: input.price ?? 0, status: "draft", visibility: input.visibility ?? "private", allowLinkedClone: input.allowLinkedClone ?? true,
          cloneCount: 0, updatedAt: new Date().toISOString()
        };
        set((state) => ({ templates: [template, ...state.templates], books: state.books.map((item) => item.id === bookId ? { ...item, status: "template" } : item) }));
        return template;
      },
      publishTemplateVersion: (templateId) => set((state) => ({
        templates: state.templates.map((template) => template.id === templateId ? { ...template, version: template.version + 1, status: "published", visibility: "marketplace", updatedAt: new Date().toISOString() } : template),
        clones: state.clones.map((clone) => clone.templateId === templateId && clone.mode === "linked" ? { ...clone, status: clone.overrideCount > 15 ? "conflict" : "update_available", currentTemplateVersion: clone.currentTemplateVersion + 1, conflictCount: clone.overrideCount > 15 ? Math.max(1, Math.round(clone.overrideCount / 7)) : 0 } : clone)
      })),
      cloneTemplate: (templateId, brandId, mode, partnerName) => {
        const state = get();
        const template = state.templates.find((item) => item.id === templateId);
        const sourceBook = template ? state.books.find((item) => item.id === template.sourceBookId) : undefined;
        const brand = state.brands.find((item) => item.id === brandId);
        if (!template || !sourceBook || !brand) return null;
        const cloned = cloneBookForBrand(sourceBook, brand);
        const target: BookRecord = toBookRecord({ ...cloned, id: uid("book"), title: `${sourceBook.title} — ${brand.name}`, status: "draft" } as BookRecord);
        target.brandId = brand.id; target.slug = `${sourceBook.slug}-${brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`; target.cloneCount = 0; target.studentCount = 0;
        const clone: CloneRecord = { id: uid("clone"), templateId, targetBookId: target.id, brandId, partnerName: partnerName ?? brand.name, mode, status: "synced", sourceVersion: template.version, currentTemplateVersion: template.version, overrideCount: 0, conflictCount: 0, createdAt: new Date().toISOString(), lastSyncedAt: new Date().toISOString() };
        set((current) => ({ books: [target, ...current.books], clones: [clone, ...current.clones], templates: current.templates.map((item) => item.id === templateId ? { ...item, cloneCount: item.cloneCount + 1 } : item) }));
        return clone;
      },
      syncClone: (cloneId) => set((state) => ({ clones: state.clones.map((clone) => clone.id === cloneId ? { ...clone, sourceVersion: clone.currentTemplateVersion, status: clone.conflictCount ? "conflict" : "synced", lastSyncedAt: new Date().toISOString() } : clone) })),
      resolveCloneConflicts: (cloneId) => set((state) => ({ clones: state.clones.map((clone) => clone.id === cloneId ? { ...clone, conflictCount: 0, status: "synced", sourceVersion: clone.currentTemplateVersion, lastSyncedAt: new Date().toISOString() } : clone) })),
      createStudent: (input) => {
        const student: Student = { id: uid("student"), name: input.name, email: input.email, phone: input.phone ?? "", classIds: input.classIds ?? [], progress: input.progress ?? 0, completedBooks: input.completedBooks ?? 0, status: input.status ?? "invited", joinedAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() };
        set((state) => ({ students: [student, ...state.students] }));
        return student;
      },
      updateStudent: (studentId, patch) => set((state) => ({ students: state.students.map((student) => student.id === studentId ? { ...student, ...patch } : student) })),
      createClass: (input) => {
        const course: CourseClass = { id: uid("class"), name: input.name, code: input.code ?? `H2B-${Date.now().toString().slice(-5)}`, teacherId: input.teacherId ?? "user_owner", teacherName: input.teacherName ?? get().workspace.ownerName, bookIds: input.bookIds ?? [], studentIds: input.studentIds ?? [], startDate: input.startDate ?? new Date().toISOString().slice(0,10), endDate: input.endDate ?? new Date(Date.now()+30*86400000).toISOString().slice(0,10), status: input.status ?? "upcoming", color: input.color ?? get().workspace.brandColor };
        set((state) => ({ classes: [course, ...state.classes] }));
        return course;
      },
      updateClass: (classId, patch) => set((state) => ({ classes: state.classes.map((course) => course.id === classId ? { ...course, ...patch } : course) })),
      enrollStudent: (classId, studentId) => set((state) => ({
        classes: state.classes.map((course) => course.id === classId && !course.studentIds.includes(studentId) ? { ...course, studentIds: [...course.studentIds, studentId] } : course),
        students: state.students.map((student) => student.id === studentId && !student.classIds.includes(classId) ? { ...student, classIds: [...student.classIds, classId], status: "active" } : student)
      })),
      createAssignment: (input) => {
        const assignment: Assignment = { id: uid("assignment"), classId: input.classId, bookId: input.bookId, pageId: input.pageId, title: input.title, instructions: input.instructions ?? "", dueAt: input.dueAt ?? new Date(Date.now()+7*86400000).toISOString(), maxScore: input.maxScore ?? 100, submissionCount: 0, gradedCount: 0, status: input.status ?? "draft" };
        set((state) => ({ assignments: [assignment, ...state.assignments] }));
        return assignment;
      },
      updateAssignment: (assignmentId, patch) => set((state) => ({ assignments: state.assignments.map((assignment) => assignment.id === assignmentId ? { ...assignment, ...patch } : assignment) })),
      createQuiz: (input) => {
        const quiz: Quiz = { id: uid("quiz"), title: input.title, bookId: input.bookId, chapterName: input.chapterName ?? "Toàn bộ sách", questions: input.questions ?? [], passingScore: input.passingScore ?? 70, timeLimitMinutes: input.timeLimitMinutes ?? 15, attemptCount: 0, averageScore: 0, status: input.status ?? "draft" };
        set((state) => ({ quizzes: [quiz, ...state.quizzes] }));
        return quiz;
      },
      updateQuiz: (quizId, patch) => set((state) => ({ quizzes: state.quizzes.map((quiz) => quiz.id === quizId ? { ...quiz, ...patch } : quiz) })),
      createProduct: (input) => {
        const product: Product = { id: uid("product"), type: input.type, referenceId: input.referenceId, name: input.name, description: input.description ?? "", cover: input.cover ?? "linear-gradient(135deg,#4b1835,#ad5d7d)", price: input.price ?? 0, compareAtPrice: input.compareAtPrice, billingInterval: input.billingInterval, status: input.status ?? "draft", sales: 0, revenue: 0 };
        set((state) => ({ products: [product, ...state.products] }));
        return product;
      },
      updateProduct: (productId, patch) => set((state) => ({ products: state.products.map((product) => product.id === productId ? { ...product, ...patch } : product) })),
      createOrder: (input) => {
        const product = get().products.find((item) => item.id === input.productId);
        if (!product) return null;
        const order: Order = { id: uid("order"), orderCode: `H2B-${new Date().toISOString().slice(2,10).replaceAll("-","")}-${Math.floor(1000+Math.random()*8999)}`, customerName: input.customerName, customerEmail: input.customerEmail, productId: product.id, productName: product.name, total: input.total ?? product.price, paymentMethod: input.paymentMethod ?? "qr", paymentStatus: input.paymentStatus ?? "pending", createdAt: new Date().toISOString() };
        set((state) => ({ orders: [order, ...state.orders] }));
        return order;
      },
      updateOrderStatus: (orderId, status) => set((state) => {
        const target = state.orders.find((order) => order.id === orderId);
        const shouldCount = target?.paymentStatus !== "paid" && status === "paid";
        return {
          orders: state.orders.map((order) => order.id === orderId ? { ...order, paymentStatus: status } : order),
          products: shouldCount && target ? state.products.map((product) => product.id === target.productId ? { ...product, sales: product.sales + 1, revenue: product.revenue + target.total } : product) : state.products
        };
      }),
      markNotificationRead: (notificationId) => set((state) => ({ notifications: state.notifications.map((notice) => notice.id === notificationId ? { ...notice, read: true } : notice) })),
      markAllNotificationsRead: () => set((state) => ({ notifications: state.notifications.map((notice) => ({ ...notice, read: true })) })),
      createReview: (input) => {
        const review: ReviewRequest = {
          id: uid("review"), bookId: input.bookId, title: input.title, stage: input.stage ?? "content",
          status: "draft", requestedBy: get().workspace.ownerName, assigneeIds: input.assigneeIds ?? ["user_admin"],
          dueAt: new Date(Date.now() + 3 * 86400000).toISOString(), commentsCount: 0, updatedAt: new Date().toISOString(),
          checklist: [
            { id: uid("check"), label: "Kiểm tra nội dung và chính tả", completed: false },
            { id: uid("check"), label: "Kiểm tra bố cục và thương hiệu", completed: false },
            { id: uid("check"), label: "Xác nhận quyền sử dụng tài sản", completed: false }
          ]
        };
        set((state) => ({ reviews: [review, ...state.reviews] }));
        return review;
      },
      updateReviewStatus: (reviewId, status) => set((state) => ({
        reviews: state.reviews.map((review) => review.id === reviewId ? { ...review, status, approvedBy: status === "approved" ? state.workspace.ownerName : review.approvedBy, updatedAt: new Date().toISOString() } : review),
        notifications: status === "approved" ? [{ id: uid("notice"), title: "Bản duyệt đã được phê duyệt", message: "Một yêu cầu duyệt đã hoàn tất và sẵn sàng xuất bản.", type: "book", href: "/reviews", read: false, createdAt: new Date().toISOString() }, ...state.notifications] : state.notifications
      })),
      toggleReviewChecklist: (reviewId, checklistId) => set((state) => ({ reviews: state.reviews.map((review) => review.id === reviewId ? { ...review, checklist: review.checklist.map((item) => item.id === checklistId ? { ...item, completed: !item.completed } : item), updatedAt: new Date().toISOString() } : review) })),
      addReviewComment: (input) => {
        const review = get().reviews.find((item) => item.id === input.reviewId);
        if (!review || !input.message.trim()) return null;
        const comment: ReviewComment = { id: uid("comment"), reviewId: review.id, bookId: review.bookId, pageId: input.pageId, elementId: input.elementId, authorId: "user_owner", authorName: get().workspace.ownerName, message: input.message.trim(), resolved: false, createdAt: new Date().toISOString() };
        set((state) => ({ reviewComments: [comment, ...state.reviewComments], reviews: state.reviews.map((item) => item.id === review.id ? { ...item, commentsCount: item.commentsCount + 1, updatedAt: new Date().toISOString() } : item) }));
        return comment;
      },
      resolveReviewComment: (commentId) => set((state) => ({ reviewComments: state.reviewComments.map((comment) => comment.id === commentId ? { ...comment, resolved: true } : comment) })),
      runAIAssistant: (input) => {
        const clean = input.prompt.trim() || "Nội dung chưa được cung cấp";
        const book = input.bookId ? get().books.find((item) => item.id === input.bookId) : undefined;
        const output = runLocalSmart(input.type, clean, { workspaceName: get().workspace.name, bookTitle: book?.title });
        const job: AIJob = { id: uid("smart"), type: input.type, bookId: input.bookId, prompt: clean, output, provider: "local", status: "completed", createdAt: new Date().toISOString() };
        set((state) => ({ aiJobs: [job, ...state.aiJobs] }));
        return job;
      },
      createAutomation: (input) => {
        const rule: AutomationRule = { id: uid("automation"), name: input.name, trigger: input.trigger, actions: input.actions, status: "active", runCount: 0, errorCount: 0, createdAt: new Date().toISOString() };
        set((state) => ({ automations: [rule, ...state.automations] }));
        return rule;
      },
      toggleAutomation: (automationId) => set((state) => ({ automations: state.automations.map((rule) => rule.id === automationId ? { ...rule, status: rule.status === "active" ? "paused" : "active" } : rule) })),
      runAutomation: (automationId) => set((state) => ({
        automations: state.automations.map((rule) => rule.id === automationId ? { ...rule, runCount: rule.runCount + 1, lastRunAt: new Date().toISOString() } : rule),
        activities: [{ id: uid("activity"), actor: state.workspace.ownerName, action: "đã chạy automation", target: state.automations.find((rule) => rule.id === automationId)?.name ?? automationId, createdAt: new Date().toISOString(), tone: "success" as const }, ...state.activities].slice(0, 20)
      })),
      createLicense: (input) => {
        const license: LicenseAgreement = { id: uid("license"), templateId: input.templateId, licensorName: input.licensorName ?? get().workspace.name, licenseeName: input.licenseeName, model: input.model, price: input.price ?? 0, revenueSharePercent: input.revenueSharePercent ?? 0, status: input.status ?? "draft", startsAt: input.startsAt ?? new Date().toISOString(), expiresAt: input.expiresAt, seats: input.seats ?? 20, cloneLimit: input.cloneLimit ?? 1, clonesUsed: 0, revenue: 0 };
        set((state) => ({ licenses: [license, ...state.licenses] }));
        return license;
      },
      updateLicenseStatus: (licenseId, status) => set((state) => ({ licenses: state.licenses.map((license) => license.id === licenseId ? { ...license, status } : license) })),
      approveRoyaltyPayout: (payoutId) => set((state) => ({ royaltyPayouts: state.royaltyPayouts.map((payout) => payout.id === payoutId ? { ...payout, status: payout.status === "pending" ? "approved" : "paid" } : payout) })),
      createWhiteLabelPortal: (input) => {
        const portal: WhiteLabelPortal = { id: uid("portal"), name: input.name, slug: input.slug ?? input.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), customDomain: input.customDomain, logoUrl: input.logoUrl ?? "", primaryColor: input.primaryColor ?? get().workspace.brandColor, accentColor: input.accentColor ?? "#e8a8c3", theme: input.theme ?? "light", status: input.status ?? "draft", bookIds: input.bookIds ?? [], memberCount: 0, plan: input.plan ?? "academy", updatedAt: new Date().toISOString() };
        set((state) => ({ whiteLabelPortals: [portal, ...state.whiteLabelPortals] }));
        return portal;
      },
      updateWhiteLabelPortal: (portalId, patch) => set((state) => ({ whiteLabelPortals: state.whiteLabelPortals.map((portal) => portal.id === portalId ? { ...portal, ...patch, updatedAt: new Date().toISOString() } : portal) })),
      scanBookHealth: (bookId) => {
        const book = get().books.find((item) => item.id === bookId);
        if (!book) return null;
        const elementCount = book.pages.reduce((sum, page) => sum + page.elements.length, 0);
        const textElements = book.pages.flatMap((page) => page.elements).filter((item) => item.type === "text");
        const imageElements = book.pages.flatMap((page) => page.elements).filter((item) => item.type === "image");
        const warnings: string[] = [];
        if (book.pages.length < 5) warnings.push("Sách còn ít trang, nên bổ sung nội dung hoặc bài tập.");
        if (imageElements.some((item) => !item.imageUrl)) warnings.push("Có hình ảnh chưa gắn nguồn hiển thị.");
        if (textElements.some((item) => (item.text ?? "").length > 700)) warnings.push("Có khối văn bản quá dài, khó đọc trên điện thoại.");
        if (!book.description) warnings.push("Sách chưa có mô tả phục vụ SEO và Store.");
        const score = Math.max(55, Math.min(98, 94 - warnings.length * 7 + Math.min(4, Math.round(elementCount / 25))));
        const report: ContentHealthReport = { id: uid("health"), bookId, score, readability: Math.max(60, score - 2), accessibility: Math.max(55, score - 8), brandConsistency: Math.min(99, score + 5), imageQuality: imageElements.length ? Math.max(60, score - 4) : 70, brokenLinks: 0, warnings: warnings.length ? warnings : ["Không phát hiện vấn đề nghiêm trọng."], lastScannedAt: new Date().toISOString() };
        set((state) => ({ contentHealthReports: [report, ...state.contentHealthReports.filter((item) => item.bookId !== bookId)] }));
        return report;
      },
      updateSmartSettings: (patch) => set((state) => ({ smartSettings: { ...state.smartSettings, ...patch } })),
      createLearningGoal: (input) => {
        const goal: LearningGoal = { id: uid("goal"), title: input.title, description: input.description ?? "", targetDate: input.targetDate, progress: input.progress ?? 0, status: input.status ?? "active", bookId: input.bookId, createdAt: new Date().toISOString() };
        set((state) => ({ learningGoals: [goal, ...state.learningGoals] }));
        return goal;
      },
      updateLearningGoal: (goalId, patch) => set((state) => ({ learningGoals: state.learningGoals.map((goal) => goal.id === goalId ? { ...goal, ...patch } : goal) })),
      createLearningNote: (input) => {
        const note: LearningNote = { id: uid("note"), bookId: input.bookId, pageId: input.pageId, title: input.title, content: input.content, tags: input.tags ?? [], pinned: input.pinned ?? false, updatedAt: new Date().toISOString() };
        set((state) => ({ learningNotes: [note, ...state.learningNotes] }));
        return note;
      },
      deleteLearningNote: (noteId) => set((state) => ({ learningNotes: state.learningNotes.filter((note) => note.id !== noteId) })),
      addFlashcardsFromText: (input) => {
        const cards: Flashcard[] = localFlashcards(input.text).map((item) => ({ id: uid("card"), bookId: input.bookId, pageId: input.pageId, front: item.front, back: item.back, tags: item.tags, difficulty: 2, nextReviewAt: new Date().toISOString(), intervalDays: 1, reviewCount: 0, correctCount: 0, createdAt: new Date().toISOString() }));
        set((state) => ({ flashcards: [...cards, ...state.flashcards] }));
        return cards;
      },
      reviewFlashcard: (cardId, remembered) => set((state) => ({ flashcards: state.flashcards.map((card) => {
        if (card.id !== cardId) return card;
        const nextInterval = remembered ? Math.min(60, Math.max(1, Math.round(card.intervalDays * 2.2))) : 1;
        return { ...card, reviewCount: card.reviewCount + 1, correctCount: card.correctCount + (remembered ? 1 : 0), difficulty: remembered ? Math.max(1, card.difficulty - 1) as Flashcard["difficulty"] : Math.min(5, card.difficulty + 1) as Flashcard["difficulty"], intervalDays: nextInterval, nextReviewAt: new Date(Date.now() + nextInterval * 86400000).toISOString() };
      }) })),
      addStudySession: (input) => {
        const session: StudySession = { id: uid("session"), bookId: input.bookId, goalId: input.goalId, mode: input.mode, durationMinutes: input.durationMinutes, completedItems: input.completedItems ?? 0, note: input.note, startedAt: input.startedAt ?? new Date().toISOString(), completedAt: input.completedAt ?? new Date().toISOString() };
        set((state) => ({ studySessions: [session, ...state.studySessions] }));
        return session;
      },
      addKnowledgeSource: (input) => {
        const source: KnowledgeSource = { id: uid("source"), title: input.title, sourceType: input.sourceType, status: input.status ?? "ready", bookId: input.bookId, assetId: input.assetId, url: input.url, tags: input.tags ?? [], createdAt: new Date().toISOString() };
        set((state) => ({ knowledgeSources: [source, ...state.knowledgeSources] }));
        return source;
      },
      exportData: () => {
        const state = get();
        return { version: 4, exportedAt: new Date().toISOString(), workspace: state.workspace, brands: state.brands, books: state.books, templates: state.templates, clones: state.clones, students: state.students, classes: state.classes, assignments: state.assignments, quizzes: state.quizzes, products: state.products, orders: state.orders, memberships: state.memberships, reviews: state.reviews, reviewComments: state.reviewComments, collaborationSessions: state.collaborationSessions, aiJobs: state.aiJobs, automations: state.automations, licenses: state.licenses, royaltyPayouts: state.royaltyPayouts, whiteLabelPortals: state.whiteLabelPortals, contentHealthReports: state.contentHealthReports, smartSettings: state.smartSettings, learningGoals: state.learningGoals, learningNotes: state.learningNotes, flashcards: state.flashcards, studySessions: state.studySessions, knowledgeSources: state.knowledgeSources, reusableBlocks: state.reusableBlocks };
      },
      importData: (data) => {
        if (data.version !== 2 && data.version !== 3 && data.version !== 4) throw new Error("Định dạng backup không được hỗ trợ.");
        const v3 = data as AppDataExportV3;
        const v4 = data as AppDataExportV4;
        set({ workspace: data.workspace, brands: data.brands, books: data.books, templates: data.templates, clones: data.clones, students: data.students, classes: data.classes, assignments: data.assignments, quizzes: data.quizzes, products: data.products, orders: data.orders, memberships: data.memberships, reviews: v3.reviews ?? structuredClone(seedReviews), reviewComments: v3.reviewComments ?? structuredClone(seedReviewComments), collaborationSessions: v3.collaborationSessions ?? structuredClone(seedCollaborationSessions), aiJobs: v3.aiJobs ?? [], automations: v3.automations ?? structuredClone(seedAutomations), licenses: v3.licenses ?? [], royaltyPayouts: v3.royaltyPayouts ?? [], whiteLabelPortals: v3.whiteLabelPortals ?? [], contentHealthReports: v3.contentHealthReports ?? [], smartSettings: v4.smartSettings ?? structuredClone(seedSmartSettings), learningGoals: v4.learningGoals ?? structuredClone(seedLearningGoals), learningNotes: v4.learningNotes ?? structuredClone(seedLearningNotes), flashcards: v4.flashcards ?? structuredClone(seedFlashcards), studySessions: v4.studySessions ?? structuredClone(seedStudySessions), knowledgeSources: v4.knowledgeSources ?? structuredClone(seedKnowledgeSources), reusableBlocks: v4.reusableBlocks ?? structuredClone(seedReusableBlocks) });
      },
      resetDemoData: () => set(resetState())
    }),
    {
      name: "h2obook-platform-v2",
      version: 5,
      migrate: (persistedState: unknown, persistedVersion: number) => {
        const previous = (persistedState ?? {}) as Partial<AppState>;
        // v5: the two sibling sample books used to be shallow copies of the makeup course and so
        // carried its pages verbatim. Fixing the seed alone was not enough — this store is
        // persisted, so any browser that had already opened the app kept the stale copies for
        // good. Refresh just those two, and only while they still look like the duplicate, so a
        // book someone actually edited is never overwritten. Everything else is left untouched;
        // a blanket reset here would take real work with it.
        if (persistedVersion >= 5) return previous as AppState;
        if (persistedVersion >= 4) return { ...previous, books: refreshStaleSampleBooks(previous.books) } as AppState;
        return {
          ...resetState(),
          ...previous,
          reviews: previous.reviews ?? structuredClone(seedReviews),
          reviewComments: previous.reviewComments ?? structuredClone(seedReviewComments),
          collaborationSessions: previous.collaborationSessions ?? structuredClone(seedCollaborationSessions),
          aiJobs: previous.aiJobs ?? structuredClone(seedAIJobs),
          automations: previous.automations ?? structuredClone(seedAutomations),
          licenses: previous.licenses ?? structuredClone(seedLicenses),
          royaltyPayouts: previous.royaltyPayouts ?? structuredClone(seedRoyaltyPayouts),
          whiteLabelPortals: previous.whiteLabelPortals ?? structuredClone(seedWhiteLabelPortals),
          contentHealthReports: previous.contentHealthReports ?? structuredClone(seedContentHealthReports),
          smartSettings: previous.smartSettings ?? structuredClone(seedSmartSettings),
          learningGoals: previous.learningGoals ?? structuredClone(seedLearningGoals),
          learningNotes: previous.learningNotes ?? structuredClone(seedLearningNotes),
          flashcards: previous.flashcards ?? structuredClone(seedFlashcards),
          studySessions: previous.studySessions ?? structuredClone(seedStudySessions),
          knowledgeSources: previous.knowledgeSources ?? structuredClone(seedKnowledgeSources),
          reusableBlocks: previous.reusableBlocks ?? structuredClone(seedReusableBlocks),
          books: refreshStaleSampleBooks(previous.books)
        } as AppState;
      }
    }
  )
);
