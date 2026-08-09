# Audit hiện trạng ingestion — trước khi tích hợp Knowledge Ingestion Fabric V3 (folder 27)

Ngày: 2026-08-09
Theo yêu cầu `docs/AUDIT_FIRST.md` trong gói nguồn — audit trước, không viết migration trước khi audit xong.
Phương pháp: grep toàn repo cho từng cơ chế nêu trong `AUDIT_FIRST.md`, đọc route/lib thật, rồi **đối chiếu với số dòng thật trên production** (không suy đoán từ code).

## Số dòng thật trên production (đo trực tiếp, 2026-08-09)

| Bảng | Số dòng |
|---|---|
| `ingestion_sources` | **0** |
| `ingestion_runs` | **0** |
| `ingestion_segments` | **0** |
| `ingestion_mappings` | **0** |
| `input_sessions` | 1 |
| `assets` | **0** |
| `content_items` | 104 |
| `brain_inbox_items` | 0 |
| `curriculum_documents` | 102 |

## Bảng audit chính

| Component | Path | Reader | Writer | Keep | Wrap | Migrate | Deprecate | Risk |
|---|---|---|---|---|---|---|---|---|
| **Input Gateway (Phase 1-7)** — DOCX/PDF/Image/HTML cho Compose Editor | `packages/input-core/*`, `lib/input/*`, `app/api/input/**`, bảng `input_sessions` (migration 0021) | Editor (`components/editor/editor-workspace.tsx`) | `app/api/input/sessions/[id]/{commit,retry,recover,cancel,preview}` | ✅ **KEEP làm primary** | — | — | — | Thấp — đây là hệ thống production thật, có state machine đầy đủ (`created→...→committing→completed`/`recovery_required`/`failed`/`cancelled`), có `idempotency_key`, retry/recover đã test (Phase 2-7 validator PASS). Đây chính là thứ module 27 mô tả là "Kernel", chỉ khác tên. |
| **Document Queue** — xử lý PDF/DOCX/OCR bất đồng bộ | `lib/queue/document-queue.ts` (BullMQ + Redis, fallback in-memory khi thiếu `REDIS_URL`), `services/document-processor/` (Python worker), `app/processing/page.tsx` | `app/processing`, editor | `enqueueDocumentJob` | ✅ **KEEP** | Có thể wrap thêm `ingestion.*` domain event khi cần | — | — | Thấp — đã có `DOCUMENT_JOB_ATTEMPTS`, backoff, `removeOnComplete`/`removeOnFail`. |
| **"Universal Ingestion" (v4.5)** — `ingestion_sources`/`ingestion_runs`/`ingestion_segments`/`ingestion_mappings` | `supabase/migrations/0011_h2obook_v45_universal_ingestion.sql` | *(không ai đọc `ingestion_sources`/`ingestion_segments`/`ingestion_mappings` — 0 kết quả grep trong `app/`, `lib/`, `components/`)* | `app/api/ingestion/jobs/route.ts` ghi `ingestion_runs` | — | — | — | ⚠️ **DEPRECATE (đánh dấu, không xóa)** | Trung bình — bảng có cột `content_hash` đúng như module 27 muốn, nhưng **không route nào trong UI gọi `/api/ingestion/jobs`** (đã grep xác nhận — chỉ có `app/ingestion/page.tsx` gọi `/api/ingestion/url`, không gọi `/jobs`). 4 bảng đều **0 dòng trên production từ khi tạo**. Đây là hàng tồn kho kiến trúc kiểu `career_stage_programs` (đã deprecate ở audit trước) — xây một lần rồi bị bỏ quên, không phải bị "thiếu tích hợp". |
| **`/ingestion` (Nhập nội dung)** — Markdown/HTML/URL/transcript/podcast RSS | `app/ingestion/page.tsx`, `packages/ingestion-core/*` (`previewIngestion`/`ingest`) | Sidebar `"Nhập nội dung"` (`components/layout/sidebar.tsx:28`) — **route thật, có trong nav** | Ghi thẳng vào Zustand `store.createBook()` + `localStorage` — **không đụng `input_sessions`, không đụng `ingestion_runs`, không đụng Supabase content nào** | ✅ **KEEP** phần rule-based parser | 🔶 **WRAP**: nên log 1 domain_event khi tạo bản thảo, hiện chưa có audit trail nào cho hành động này | — | — | Trung bình — đây là **con đường nạp nội dung thứ 3**, hoàn toàn tách biệt khỏi Input Gateway lẫn "Universal Ingestion". Không dedup, không org-scoped write (chỉ local). Đây chính là kiểu phân mảnh mà module 27 mô tả đúng. |
| **H2O Brain Curator** — review queue phân loại asset vào giáo trình | `lib/brain/*` (`rules.ts`, `admin.ts`, `service.ts`, `ai-parse.ts`, `providers/gemini.ts`), bảng `brain_inbox_items`/`brain_suggestions`/`brain_memory_signals`/`brain_rules` (migration 0044) | `/academy-admin/brain` | `attachResource()` hiện có — **không có write path riêng** | ✅ **KEEP, đây chính là "H2O Brain" mà module 27 muốn** | — | — | — | Thấp — đã làm đúng nguyên tắc "Brain chỉ suggest, Admin duyệt" mà `CLAUDE_INTEGRATION_PROMPT.md` §9 yêu cầu, từ trước khi module 27 tồn tại. `brain_inbox_items` đang 0 dòng vì chưa có gì trong `assets` để phân loại (assets cũng đang 0 dòng). |
| **Curriculum seed engine** — nạp giáo trình 6 giai đoạn | `lib/curriculum/seed.ts`, `lib/curriculum/upgrade-content-v2.ts`, bảng `curriculum_documents` (migration 0045) | `/academy-admin/stages` | Batch insert/update theo `seed_key` | ✅ **KEEP** | — | — | — | Thấp — đây là script nạp nội dung theo manifest (idempotent theo `seed_key`), không phải ingestion tương tác. Không thuộc phạm vi hợp nhất của module 27 (không phải đường người dùng tải file lên). |
| **Content hash / dedup thật** | `assets.checksum` (migration 0005) | — | `uploadAsset()` trong `lib/assets/asset-client.ts` — **`checksum` là tham số optional, không có nơi nào tự tính SHA-256 phía server, không có API nào tra cứu trùng lặp theo hash** | — | — | ❌ **THIẾU THẬT — cần xây** | — | Đây là **khoảng trống có thật**, đúng như module 27 chẩn đoán. Không phải do 3 hệ thống trên thiếu dedup riêng lẻ — là chưa hề có dedup theo nội dung ở bất kỳ đâu trong repo. `assets` đang 0 dòng trên production nên rủi ro hiện tại bằng 0, nhưng sẽ tăng ngay khi Admin bắt đầu tải file lên qua `/ingestion` hoặc thư viện asset. |
| **Content Catalog** | `content_items` (migration 0041) | Content Canvas, `/academy-admin/stages/[stageId]` | `attachCatalogResource()`, `lib/curriculum/seed.ts` | ✅ **KEEP — đây chính là "Content Catalog" mà module 27 muốn, đã tồn tại** | — | — | — | Thấp — 104 dòng thật, đã kiểm chứng nhiều lần trong các phiên trước. |
| **Domain events** | `capture_domain_event()` trigger, bảng `domain_events` | nhiều route | `curriculum_documents`, `career_stages`, `academy_stage_nodes`, `brain_*` đều có trigger | ✅ **KEEP, reuse cho `ingestion.*` events nếu wrap `/ingestion`** | — | — | — | Thấp. |
| Gói nguồn `docling-client.ts`, `worker/docling/app.py` (microservice Python mới) | folder 27 | — | — | — | — | — | **Chưa triển khai** | Đây là service **hoàn toàn mới**, chưa tồn tại trong repo dưới bất kỳ hình thức nào — không phải "trùng lặp cần dọn", mà là **quyết định hạ tầng mới** (thêm 1 Docker service + chi phí vận hành), cần bạn xác nhận trước khi làm, không phải việc tự động audit ra. |

## Kết luận đối chiếu với nguyên tắc "một orchestrator" của `CLAUDE.md`

> "One input orchestrator: Do not add another disconnected importer. New work must converge into the shared Input Gateway and Semantic Content Model."

Repo hiện có **đúng 3 con đường nạp nội dung độc lập, không con đường nào là "trùng lặp cần xóa"** — mỗi con đường phục vụ một đích khác nhau và đều đang sống:

1. **Input Gateway** (`input_sessions`) → tạo **sách** trong Compose Editor.
2. **`/ingestion`** (Markdown/HTML/URL/transcript) → cũng tạo **sách**, nhưng đi vòng qua Zustand/localStorage, không qua `input_sessions`.
3. **Curriculum seed + H2O Brain** → nạp **tài liệu giáo trình** vào `career_stage_resources`.

Module 27 gọi đây là "5 cơ chế cần hợp nhất" (Quick Import / Universal Ingestion / Document Queue / Word Import / PDF Import). Audit thật cho thấy: **"Universal Ingestion" (v4.5) đã chết từ trước — không phải một cơ chế sống cần hợp nhất, mà là rác kiến trúc cần dọn**. Document Queue + Word/PDF Import **đã là cùng một hệ thống** (Input Gateway), không phải 3 cơ chế tách rời. Cơ chế phân mảnh thật duy nhất là `/ingestion` đi vòng qua Input Gateway cho cùng một đích (tạo sách).

## Khuyến nghị phạm vi — KHÔNG xây toàn bộ Kernel V3 như gói nguồn mô tả

Gói nguồn đề xuất: Source Registry + Source Version + Ingestion Run + Semantic Artifact (4 bảng mới) + Docling Python microservice + Admin Ingestion Center hợp nhất 8 tab + dedup/versioning engine + RAG-ready. Đây là khối lượng công việc nhiều tuần, đụng vào cả 2 luồng sống thật (Compose Editor và Academy), và tự nó vi phạm đúng nguyên tắc `CLAUDE.md` nếu làm sai: 4 bảng mới đó **chính là một Content Store song song thứ hai**, trong khi `input_sessions` + `brain_inbox_items` + `content_items` đã cộng lại làm đúng việc đó.

Đề xuất phạm vi thật, additive, rủi ro thấp, đã làm trong lượt này:

1. **Xây dedup thật** (đã làm) — điền đúng khoảng trống duy nhất được xác nhận: SHA-256 tính phía server (từ file thật trong R2, không tin giá trị client gửi lên) khi upload asset, tra cứu trùng lặp theo `(organization_id, checksum)` trước khi tạo asset mới. Trả về `duplicate` trong response — không chặn upload, chỉ cung cấp thông tin để UI sau này quyết định. Đây là phần **duy nhất** trong toàn bộ audit không có gì tương đương đã tồn tại. Giới hạn: chỉ hash file ≤64MB (video/audio lớn không được dedup — hợp lý vì buffer cả file vào RAM của serverless function, đã ghi rõ trong code, không giấu).
2. **Đánh dấu deprecated 4 bảng "Universal Ingestion" chết** (đã làm) — `comment on table` trong migration mới, không xóa gì, đúng nguyên tắc "không xóa legacy ở release đầu". Route `/api/ingestion/jobs` giữ nguyên (không ai gọi nhưng cũng không hại gì khi giữ).
3. ~~Wrap `/ingestion` bằng domain_event~~ — **rút lại sau khi kiểm tra kỹ hơn**: `/ingestion` tạo sách hoàn toàn ở local (Zustand + localStorage), cố ý offline-first theo đúng nguyên tắc `CLAUDE.md`. Thêm domain_event nghĩa là hoặc (a) bắt luồng này phụ thuộc mạng chỉ để ghi log — đổi hành vi một tính năng đang chạy tốt, hoặc (b) ghi log về một `book`/`knowledge_source` chưa từng tồn tại trên server (vì bản thảo chỉ nằm trong localStorage cho tới khi người dùng tự lưu) — vô nghĩa. Ban đầu tôi đánh giá đây là "việc nhỏ, an toàn" — sau khi đọc kỹ luồng thật thì không phải vậy. Không làm, để tránh vá một thứ chưa chắc cần vá.
4. **KHÔNG** xây Source Registry/Version/Run/Artifact mới, **KHÔNG** xây Docling microservice, **KHÔNG** xây Admin Ingestion Center hợp nhất trong lượt này — đây là quyết định hạ tầng lớn, cần bạn xác nhận rõ ràng trước, đúng như bạn đã dặn "audit trước, tích hợp sau".

Việc chọn có làm bước 4 (Docling worker + Admin Ingestion Center) hay không là quyết định sản phẩm/hạ tầng, không phải chi tiết kỹ thuật — cần bạn quyết.
