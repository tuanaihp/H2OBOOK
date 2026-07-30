# H2OBOOK Unified Input Engine 4.13.7

> Academy V4.16 đã nối vòng doanh thu, Supabase Auth invite, lesson player, progress/Skill Map, checkout và email giao dịch. Xem [Academy Production Runbook](docs/ACADEMY-PRODUCTION-RUNBOOK.md).

**Professional Authoring & Publishing Engine — Offline-first, AI optional.**

H2OBOOK Professional Editor 4.12 kế thừa toàn bộ codebase Professional 4.11 và bổ sung Compose Engine schema-based, Text Flow Engine cùng giao diện editor lớn, rõ và dễ thao tác hơn. Toàn bộ giai đoạn 4.1–4.11 vẫn được giữ nguyên:

- Production Data Foundation
- Semantic Content & Asset Architecture
- Professional Authoring Editor 2.0 foundation
- Multi-format Publishing Engine
- Universal Content Ingestion
- Data Automation & Bulk Publishing
- Growth Reader & Content Commerce
- Education Collaboration & Accessibility
- Analytics Event Engine
- Optional AI Assistance
- Marketplace & Enterprise Scale

## PDF Dual Import — Phase 3 hoàn thành

- PDF được kiểm tra text layer trước khi xử lý.
- Ba chế độ: giữ nguyên thiết kế, nội dung chỉnh sửa và OCR scan.
- Demo Mode dùng PDF.js; Production Mode dùng PyMuPDF/Tesseract worker.
- Có preview, bounding box, confidence và sửa nội dung trước khi commit.
- Ảnh trích từ PDF được materialize thành Asset record.

## Word Import 2.0 — Phase 2 hoàn thành

- DOCX được chuyển bằng Mammoth `convertToHtml`, không còn `extractRawText()` và chia 1.700 ký tự.
- Giữ heading, paragraph, bold/italic/underline, link, list, table, image, caption, page break và footnote ở mức best effort.
- Có preview, cảnh báo và nút commit rõ ràng vào Compose Engine.
- Python `python-docx` là fallback production và trả trực tiếp `BookDocument`.
- Ảnh Word đi qua Asset/R2/IndexedDB, không lưu Base64 trong JSON sách.

Phase 7 đã hoàn thành ở cấp source dưới dạng **Release Candidate**. Bản phát hành chưa được gắn nhãn production-ready cho tới khi lockfile, full build và các cổng Supabase/Redis/R2/ClamAV/E2E thực tế vượt nghiệm thu.



## Production Hardening — Phase 7 source-complete

- Giới hạn kích thước request, metadata, preview, node, asset, correction và design payload.
- Trace ID và structured logging đã che nội dung nhạy cảm.
- Queue/worker có heartbeat, deadline, cancel polling, stalled recovery, idempotency và exponential backoff.
- Chặn DOCX ZIP bomb, traversal, symlink, encrypted archive và cấu trúc DOCX giả mạo.
- Tăng cường SSRF IPv4/IPv6, MIME confusion, magic bytes và filename traversal.
- RLS Input Session chặt hơn, stale-session recovery và hardened atomic commit RPC.
- Có health endpoint, feature flag rollback, incident/deployment runbook, hostile fixtures và synthetic load benchmark.

Trạng thái phát hành: **source-complete release candidate; `releaseReady=false` cho đến khi các external gates vượt kiểm tra.**

## Unified Orchestrator — Phase 6 hoàn thành

- Một `InputSession` cho DOCX, PDF, Image, HTML, Markdown, TXT và URL.
- State machine, progress, idempotency, retry, cancel và recovery.
- Một giao diện `/input` cho preview, outline, warnings và destination.
- Atomic commit để tạo sách mới, nối chương, thay tài liệu hoặc ghi design pages.
- Worker job được liên kết vào session; session và event được lưu PostgreSQL và phát Realtime.
- Offline chỉ cho phép lưu/khôi phục preview local; không báo giả cloud-completed.

## HTML Import 2.0 — Phase 5 hoàn thành

- Upload trực tiếp `.html`, `.htm`, `.xhtml` và nhập public URL bằng cùng parser server-side JSDOM.
- Không dùng regex làm canonical parser; script, event handler, form, URL nguy hiểm và embed không được phép bị loại bỏ.
- Giữ heading, paragraph, inline marks, link, nested list, table, figure/caption, article/section, audio/video và controlled YouTube/Vimeo embed.
- Relative URL được resolve theo final URL; ảnh từ xa được tải qua SSRF-safe proxy rồi lưu bằng Asset Engine/R2/IndexedDB.
- Có preview sandbox, thống kê, warning và semantic commit vào Compose Engine.

## Image Smart Import — Phase 4 hoàn thành

H2OBOOK hiện có một luồng ảnh thống nhất với bốn chế độ:

- Thêm như image element.
- Dùng làm background toàn trang đã khóa.
- OCR bằng Tesseract thành Semantic Content.
- Tách vùng text/image/ignore thủ công, sắp thứ tự và sửa trước khi commit.

Engine hỗ trợ PNG, JPG, JPEG và JPE; đọc kích thước, alpha, EXIF orientation, DPI và color-profile signals; kiểm tra magic bytes trên object đã upload; lưu ảnh bằng `assetId`; cảnh báo effective DPI và upscale trong preflight. AI không bắt buộc.


## Claude Code Guided Development

Repository này đã tích hợp hướng dẫn để Claude Code triển khai và sửa lỗi Input Engine theo từng giai đoạn mà không bỏ sót:

- `CLAUDE.md`: quy tắc bắt buộc và kiến trúc mục tiêu.
- `docs/claude-code/`: kế hoạch Input Gateway, Word, PDF, Image, HTML, Orchestrator và Production Hardening.
- `.claude/commands/`: các lệnh `/input-status`, `/input-phase`, `/fix-input-error`, `/validate-input`.
- `pnpm audit:input`: kiểm tra nhanh năng lực input hiện tại từ source.
- `pnpm validate:claude-guides`: xác minh tài liệu và cấu trúc hướng dẫn không bị thiếu.

Bắt đầu bằng:

```bash
claude
/input-status
/input-phase 7
```

AI không phải dependency của Input Engine. Mọi phase đều yêu cầu đường xử lý deterministic/manual trước.

## Điểm mới trong Editor 4.12

- Tiptap/ProseMirror thay cho `document.execCommand`.
- Heading, marks, link, list, quote, table, footnote và citation theo semantic schema.
- Text Flow nhiều khung/trang, tự dàn lại và cảnh báo overflow.
- Publishing bridge giữ định dạng rich content.
- Control editor tối thiểu 40–42 px và typography 11–14 px.
- Sách/editor state cũ được migrate, không đổi storage key.

## Nguyên tắc bất biến

`coreRequiresAI = false`

Editor, Reader, nhập tài liệu, xuất bản, flashcard, lớp học, Growth Reader, bulk generation, thanh toán, marketplace và enterprise APIs không phụ thuộc AI. AI mặc định tắt và mọi tác vụ AI đều có local/manual fallback.

## Chạy nhanh ở Demo Mode

```bash
pnpm install
pnpm dev
```

Mở `http://localhost:3000`.

## Kiểm tra trước khi build

```bash
pnpm validate
pnpm validate:imports
pnpm validate:v4
pnpm validate:v41
pnpm validate:v42
pnpm validate:v43
pnpm validate:v44
pnpm validate:v45
pnpm validate:v46
pnpm validate:v47
pnpm validate:v48
pnpm validate:v49
pnpm validate:v410
pnpm validate:v411
pnpm validate:professional
pnpm validate:editor412
pnpm validate:input-phase6
pnpm validate:input-phase7
pnpm test:input-orchestrator
pnpm test:input-hardening
pnpm test:input-load
pnpm validate:migrations
pnpm check:input-storage
pnpm typecheck
pnpm test
pnpm test:sql
pnpm build
pnpm test:e2e
```

> Repository không chứa lockfile được tạo giả. Hãy chạy `pnpm install` trên máy có kết nối registry để tạo `pnpm-lock.yaml`, commit lockfile, sau đó dùng `pnpm install --frozen-lockfile` trong CI.

## Production Mode

1. Sao chép `.env.example` thành `.env.local`.
2. Điền Supabase, R2, Redis, payment, email và security secrets.
3. Chạy migration theo thứ tự `0001` đến `0022`.
4. Chạy:

```bash
docker compose -f docker-compose.production.yml up --build
```

Các service:

- Next.js web
- Redis
- ClamAV
- Document Processor
- Document Worker
- Publishing Worker
- Webhook Worker
- Input Recovery Scheduler
- Webhook Delivery Worker

## Các khu vực chính

- `/dashboard` — Smart Home
- `/books` — quản lý sách
- `/editor/[bookId]` — Design Mode
- `/editor/[bookId]/compose` — Compose Mode
- `/preflight` — kiểm tra trước xuất bản
- `/publish` — PDF/EPUB/SCORM/xAPI
- `/ingestion` — nhập đa nguồn
- `/bulk-publishing` — sinh hàng loạt
- `/growth-reader` — lead gate, CTA, protected embed
- `/reader/[slug]` — Living Reader
- `/embed/[slug]` — protected embed wrapper
- `/remix/[bookId]` — Student Remix
- `/class-view` — Class View
- `/analytics` — analytics sự kiện thật
- `/assist-control` — chính sách AI tùy chọn
- `/marketplace-studio` — marketplace authoring
- `/enterprise` — API key, webhook, quota, SSO foundation

## Public API

API key được tạo tại `/enterprise`. Secret chỉ hiển thị một lần và DB chỉ lưu hash.

```bash
curl -H "Authorization: Bearer h2o_live_..." \
  https://your-domain.com/api/public/v1/books
```

## Publishing

Local export:

- HTML/Web Reader
- PDF qua print browser
- EPUB 3 reflowable
- EPUB 3 fixed-layout
- SCORM 1.2
- SCORM 2004
- xAPI/Tin Can launch package

Production worker:

- Vector PDF bằng Chromium
- Print PDF + Ghostscript foundation
- EPUB package
- SCORM package
- xAPI package
- artifact lưu vào R2

## Webhook

Webhook secret được mã hóa AES-256-GCM bằng `WEBHOOK_ENCRYPTION_KEY`. Domain events tự tạo delivery records; `webhook-worker` ký HMAC, retry exponential và dùng idempotency key.

Các endpoint được tạo trước migration `0018` cần rotate/recreate để có `secret_ciphertext`.

## Tài liệu

- `docs/PHASE-COMPLETION-4.1-4.11.md`
- `docs/ARCHITECTURE-PROFESSIONAL-4.11.md`
- `docs/VALIDATION-REPORT-4.11.md`
- `docs/OWNER-ACTION-CHECKLIST-4.11.md`
- `docs/KNOWN-LIMITATIONS-4.11.md`
- `docs/DEPLOYMENT-GUIDE.md`

## Trạng thái chất lượng

Các validator cấu trúc, import, SQL policy, JavaScript syntax và TypeScript transpile đã chạy thành công trong môi trường đóng gói. Full dependency install, semantic typecheck, Next production build, browser E2E và chuẩn xuất bản bên thứ ba vẫn phải chạy trên máy có Internet và service credentials thật. Xem báo cáo kiểm định và giới hạn đã biết để biết chính xác phạm vi đã xác nhận.

## Tài liệu Editor 4.12

- `docs/RELEASE-NOTES-4.12-EDITOR.md`
- `docs/EDITOR-ENGINE-4.12.md`
- `docs/OWNER-ACTION-CHECKLIST-4.12.md`
- `docs/VALIDATION-REPORT-4.12.md`

## Tài liệu Phase 2

- `docs/RELEASE-NOTES-4.13.2-WORD-IMPORT.md`
- `docs/VALIDATION-REPORT-4.13.2-WORD-IMPORT.md`
- `docs/OWNER-ACTION-CHECKLIST-4.13.2.md`
- `docs/RELEASE-NOTES-4.13.4-IMAGE-SMART-IMPORT.md`
- `docs/VALIDATION-REPORT-4.13.4-IMAGE.md`
- `docs/OWNER-ACTION-CHECKLIST-4.13.4.md`
- `docs/claude-code/progress/PHASE-02-REPORT.md`

Validation command:

```bash
pnpm validate:input-phase2
```

## H2OBOOK 4.14 presentation layers

### Public Academy

- `/`
- `/academy/books`
- `/academy/courses`
- `/academy/strategies`
- `/academy/learning-paths`
- `/academy/about`
- `/academy/membership`
- `/academy/success-stories`

### Student Experience

- `/student`
- `/student/courses`
- `/student/library`
- `/student/assignments`
- `/student/roadmap`
- `/student/mentor`
- `/student/profile`

Enable with:

```env
NEXT_PUBLIC_PUBLIC_SITE_V2=true
NEXT_PUBLIC_STUDENT_EXPERIENCE_V2=true
```

Existing Business/Admin routes are unchanged. Deploy 4.14 through a Git branch and Vercel Preview before merging to the production branch.
