// Asset governance vocabulary and filtering. No server import: the filter shape is shared between
// the API and the page, and the page has to build the same query string the API parses.

export const ASSET_TYPES = [
  "image", "video", "audio", "document", "ebook", "book_page", "lesson_material",
  "course_material", "template", "content", "certificate", "student_submission",
  "brand_asset", "operations", "archive", "other"
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

// Subtypes are per type on purpose. One flat list would offer "sales_script" under image, which is
// how a taxonomy stops being used.
export const ASSET_SUBTYPES: Record<string, string[]> = {
  image: ["cover", "thumbnail", "book_page", "makeup_reference", "hair_reference", "before_after", "diagram", "worksheet", "social_post"],
  video: ["lesson", "demonstration", "review", "livestream", "short_form", "student_submission", "marketing"],
  document: ["pdf", "docx", "pptx", "spreadsheet", "checklist", "rubric", "script", "sop", "policy", "contract"],
  content: ["lesson_copy", "social_caption", "sales_script", "email", "landing_copy", "quiz_bank", "flashcard_source"],
  ebook: ["fixed_layout", "reflowable", "image_book", "workbook"]
};

export const CLASSIFICATION_STATUSES = ["unclassified", "classified", "needs_review"] as const;
export type ClassificationStatus = (typeof CLASSIFICATION_STATUSES)[number];

export const REVIEW_STATUSES = ["not_required", "pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const LIFECYCLE_STATUSES = ["active", "archived", "retired"] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const RIGHTS_STATUSES = ["unknown", "owned", "licensed", "restricted"] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export const TYPE_LABEL: Record<string, string> = {
  image: "Ảnh", video: "Video", audio: "Âm thanh", document: "Tài liệu", ebook: "Sách điện tử",
  book_page: "Trang sách", lesson_material: "Học liệu bài học", course_material: "Học liệu khóa học",
  template: "Mẫu thiết kế", content: "Nội dung", certificate: "Chứng nhận",
  student_submission: "Bài nộp học viên", brand_asset: "Tài sản thương hiệu",
  operations: "Vận hành", archive: "Lưu trữ", other: "Khác"
};

export const CLASSIFICATION_LABEL: Record<ClassificationStatus, string> = {
  unclassified: "Chưa phân loại", classified: "Đã phân loại", needs_review: "Cần xem lại"
};
export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  not_required: "Không cần duyệt", pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối"
};
export const LIFECYCLE_LABEL: Record<LifecycleStatus, string> = {
  active: "Đang dùng", archived: "Lưu trữ", retired: "Ngừng dùng"
};
export const RIGHTS_LABEL: Record<RightsStatus, string> = {
  unknown: "Chưa rõ", owned: "Sở hữu", licensed: "Có bản quyền", restricted: "Hạn chế"
};

export const SORTABLE_COLUMNS = ["created_at", "original_name", "title", "size_bytes", "asset_type"] as const;
export type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export const PAGE_SIZE = 50;

export interface AssetFilters {
  search?: string;
  assetType?: string;
  classificationStatus?: string;
  reviewStatus?: string;
  lifecycleStatus?: string;
  folderId?: string;
  tagId?: string;
  /** "unfiled" is a real filter, not the absence of one — it is how orphaned uploads get found. */
  unfiled?: boolean;
}

export interface AssetQuery extends AssetFilters {
  page?: number;
  sortBy?: SortableColumn;
  sortDirection?: "asc" | "desc";
}

export function filtersToQuery(filters: AssetQuery): string {
  const params = new URLSearchParams();
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDirection) params.set("sortDirection", filters.sortDirection);
  if (filters.tagId) params.set("tagId", filters.tagId);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.assetType) params.set("assetType", filters.assetType);
  if (filters.classificationStatus) params.set("classificationStatus", filters.classificationStatus);
  if (filters.reviewStatus) params.set("reviewStatus", filters.reviewStatus);
  if (filters.lifecycleStatus) params.set("lifecycleStatus", filters.lifecycleStatus);
  if (filters.folderId) params.set("folderId", filters.folderId);
  if (filters.unfiled) params.set("unfiled", "1");
  return params.toString();
}

/** Page and sort, validated the same way filters are: anything unrecognised falls back rather than reaching the query. */
export function queryToPaging(params: URLSearchParams): { page: number; sortBy: SortableColumn; sortDirection: "asc" | "desc" } {
  const page = Number(params.get("page") ?? 1);
  const sortBy = params.get("sortBy");
  const direction = params.get("sortDirection");
  return {
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    sortBy: sortBy && (SORTABLE_COLUMNS as readonly string[]).includes(sortBy) ? sortBy as SortableColumn : "created_at",
    sortDirection: direction === "asc" ? "asc" : "desc"
  };
}

export function queryToFilters(params: URLSearchParams): AssetFilters {
  const pick = (key: string, allowed: readonly string[]) => {
    const value = params.get(key);
    return value && allowed.includes(value) ? value : undefined;
  };
  return {
    search: params.get("search") ?? undefined,
    assetType: pick("assetType", ASSET_TYPES),
    classificationStatus: pick("classificationStatus", CLASSIFICATION_STATUSES),
    reviewStatus: pick("reviewStatus", REVIEW_STATUSES),
    lifecycleStatus: pick("lifecycleStatus", LIFECYCLE_STATUSES),
    folderId: params.get("folderId") ?? undefined,
    tagId: params.get("tagId") ?? undefined,
    unfiled: params.get("unfiled") === "1"
  };
}

/** What to call an asset on screen: the curated title if someone gave it one, else the filename. */
export function assetDisplayName(asset: { title?: string | null; original_name?: string | null }): string {
  return asset.title?.trim() || asset.original_name || "Tài sản chưa đặt tên";
}
