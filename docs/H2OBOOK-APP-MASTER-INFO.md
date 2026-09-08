# H2OBOOK — Hồ sơ tổng ứng dụng

> Nguồn chuẩn để con người và AI hiểu, thiết kế, mở rộng và kiểm tra H2OBOOK.
>
> Snapshot: 08/09/2026 · package `h2obook-professional-editor@4.21.0` · `VERSION=4.15.0`.

## 1. Định vị sản phẩm

H2OBOOK là hệ sinh thái tạo–học–dạy–kinh doanh cho Makeup/Beauty Academy. Sản phẩm kết nối sách số, nội dung tri thức, khóa học, lộ trình nghề nghiệp, lớp học, đánh giá năng lực, bán nội dung và vận hành Academy.

Nguyên tắc bất biến: `coreRequiresAI = false`. Editor, Reader, nhập tài liệu, xuất bản, flashcard, lớp học, Growth Reader, thanh toán, marketplace và API phải có local/manual fallback; AI là lớp tùy chọn.

## 2. Quy mô source tree

| Thành phần | Số lượng | Cách kiểm tra |
|---|---:|---|
| Next.js page route | 165 | `app/**/page.tsx` |
| API route | 225 | `app/api/**/route.ts` |
| Component/module UI | 166 | `components/**` |
| Library/service/type | 251 | `lib/**` |
| Supabase migration | 67 | `supabase/migrations/*.sql` |

Đây là inventory source tại snapshot, không phải số màn hình đã nghiệm thu production.

## 3. Bản đồ tổng thể

```text
PUBLIC ACADEMY → STUDENT LEARNING OS → TEACHING / COMPETENCY
       ↓                  ↓                    ↓
CONTENT WORKSPACE → BUSINESS / COMMERCE → SYSTEM / ENTERPRISE
```

## 4. Các vùng chức năng và route

### Public Academy

`/`, `/academy`, `/academy/books`, `/academy/courses`, `/academy/strategies`, `/academy/learning-paths`, `/academy/about`, `/academy/membership`, `/academy/success-stories`.

Giới thiệu thương hiệu, catalog sách/khóa học/strategy, lộ trình nghề nghiệp, membership, enrollment, checkout và public SEO.

Nguồn: `components/public-home-v3`, `components/public-academy-v5`, `lib/public-site`, `lib/public-academy-v5`.

### Workspace tạo nội dung

`/dashboard`, `/books`, `/editor/[bookId]`, `/editor/[bookId]/compose`, `/assets`, `/ingestion`, `/input`, `/blocks`, `/templates`, `/brand-kit`, `/clones`, `/design-library`, `/preflight`, `/publish`, `/bulk-publishing`, `/processing`.

Tạo sách/chương/trang/element; Design Mode; Compose Mode; rich text semantic bằng Tiptap; Text Flow; preflight; asset governance; Brand Kit; linked/independent clone; template/block; xuất HTML, PDF, EPUB, SCORM và xAPI.

Nguồn: `components/editor`, `components/creative-publishing-v1`, `components/assets`, `lib/editor`, `lib/creative-publishing-v1`, `lib/design-library`.

### Unified Content Ingestion

Đầu vào: DOCX, PDF, PNG/JPG/JPEG/JPE, HTML/HTM/XHTML, Markdown, TXT và URL.

Một `InputSession` có state machine, progress, retry, cancel, recovery, idempotency, preview, warning, outline và atomic commit. DOCX/PDF/image/HTML đều có parser hoặc OCR riêng, sanitize, MIME/magic-bytes, size, SSRF, malware và signed asset handling. Production dùng document worker, queue, heartbeat, deadline và stale-session recovery.

Nguồn: `components/input`, `lib/input`, `workers/document-worker`, `lib/queue`.

### Student Learning OS

`/student`, `/student/courses`, `/student/library`, `/student/assignments`, `/student/roadmap`, `/student/mentor`, `/student/profile`, `/student/missions/[missionId]`, `/student/document/[id]`, `/student/spaces/[slug]`.

Smart Home cá nhân; curriculum/lịch học; Journey → Outcome → Milestone → Mission → Evidence → Result; Mission Workspace; Reader ghi chú/highlight/progress; library; flashcard/spaced repetition; goal/note/study session; H2O Mentor/Coach; Skill Map, Skill Passport, daily practice, credential và growth recommendation.

Nguồn: `components/student`, `lib/learning-journey`, `lib/learn-outcome`, `lib/mission-workspace`, `lib/stage1-learning-os`, `lib/h2o-coach`, `lib/student`.

### Academy, Teaching và Competency

`/academy-admin`, `/academy-admin/stages`, `/academy-admin/programs`, `/academy-admin/journey`, `/academy-admin/content`, `/academy-admin/knowledge`, `/academy-admin/coach-builder`, `/instructor`, `/instructor/classes`, `/instructor/classes/[classId]`, `/instructor/students`, `/instructor/assessments`.

Quản trị organization, stage, program, module, lesson, resource; xây Journey/Outcome/Mission/unlock/evidence; lớp/cohort/lịch; ghi danh/entitlement; khóa Makeup 60 buổi; chấm Training/Makeup/Hair; rubric/feedback/audit; competency/graduation; Academy Control Center và data link.

Nguồn: `components/student-competency`, `components/academy-admin`, `lib/academy`, `lib/academy-admin`, `lib/academy-control`, `lib/student-competency`, `lib/teaching`.

### Business và Commerce

`/store`, `/membership`, `/orders`, `/analytics`, `/growth-reader`, `/licensing`, `/marketplace-studio`, `/white-label`, `/student/business`.

Store, pricing, checkout, order, membership, grant/revoke/expiry, entitlement, marketplace listing, licensing/royalty, lead gate, CTA, protected reader/embed, campaign và white-label portal theo domain/logo/màu.

Nguồn: `lib/business`, `lib/business-ops-v1`, `components/business-ops-v1`, `lib/payments`, `lib/content-access`, `lib/growth`.

### System, Operations và Enterprise

`/admin`, `/account`, `/settings`, `/security`, `/integrations`, `/cloud-sync`, `/offline`, `/enterprise`, `/api-gateway`, `/assist-control`, `/operations`, `/platform-admin`, `/system`.

Role/tenant/security; health; admissions; approvals; import/automation/support/notifications/product config; API key/webhook/quota/SSO foundation; AI policy/provider/budget/cache; cloud sync/offline/quota/recovery.

Nguồn: `components/operations`, `components/system-governance-ops-v2`, `lib/system`, `lib/operations`, `lib/enterprise`, `lib/runtime-config`.

## 5. Skill / năng lực sản phẩm

| Skill | Đầu ra |
|---|---|
| Tạo sách & thiết kế | Book, chapter, page, element, layout, brand field |
| Soạn nội dung | BookDocument, outline, rich text semantic |
| Nhập đa định dạng | Preview, normalized content, assets, warnings |
| OCR/phân vùng | Text/image regions, confidence, correction |
| Quản trị tri thức | Knowledge Space, source, unit, binding |
| Thiết kế khóa học | Stage, Program, Module, Lesson, Resource |
| Lộ trình học | Outcome, Milestone, Mission, unlock, evidence |
| Điều phối lớp | Enrollment, progress, assignment, intervention |
| Đánh giá | Rubric, score, feedback, audit, graduation |
| Ôn tập & coaching | Flashcard, schedule, Mentor, Coach, memory |
| Xuất bản | Web, PDF, EPUB, SCORM, xAPI |
| Thương mại | Store, checkout, order, membership, entitlement |
| Tăng trưởng | Lead gate, CTA, campaign, protected reader |
| Vận hành | Admissions, classes, support, approvals, notifications |
| Enterprise | Roles, RLS, API, webhook, audit, health |
| Local-first | Local persistence, deferred sync, recovery, quota |

## 6. AI và Smart Core

Smart Core local xử lý tóm tắt theo quy tắc, outline, câu hỏi, flashcard, accessibility check, lịch học, local search và fallback assist. Provider được phát hiện: local HTTP/Ollama, OpenAI và Gemini; H2O Coach có gateway riêng. AI chỉ chạy khi policy, flag, credential, budget và quyền cho phép; lỗi gateway phải fallback local.

## 7. Thiết kế giao diện

- Hệ hình ảnh: H2OBOOK, H2O Brain, Neural/Knowledge Universe.
- Navy/dark cho hero, sidebar, system; gradient cyan–violet–magenta cho accent/AI/CTA.
- Card trắng, bo góc lớn, border mảnh, shadow nhẹ; serif/display cho hero và sans-serif cho thao tác/dữ liệu.
- Icon: `lucide-react`; responsive breakpoint chính khoảng 900px và 600px.
- Surface: Public Academy, Workspace, Student, Editor, Teaching, Business, System.
- Nút/input chính khoảng 40–42px; trạng thái phải phân biệt draft/published/archived/locked/expired/denied.
- Màn hình chi tiết cần nút quay lại parent; UI tiếng Việt mặc định và có thể chuyển Việt/Anh.

## 8. Kiến trúc và dữ liệu

```text
Next.js App Router + React + TypeScript
  → Shell / Page / Client Component
  → Zustand app-store + editor-store
  → Domain service / selector / access resolver
  → API route + server auth/RLS
  → Supabase PostgreSQL/Auth · R2 · Redis/BullMQ
  → worker · payment · email · monitoring · optional AI
```

`store/app-store.ts` là platform business store; editor store giữ tương tác nặng. Local-first dùng persist/deferred sync; production dùng Supabase/R2/Redis. 67 migration nối từ core, V2/V3/V4 Smart Core đến editor, publishing, ingestion, analytics, AI, Academy, learning, mission, coach, competency, storage và calendar.

## 9. Role và quyền

Role: `owner`, `admin`, `designer`, `partner`, `teacher`, `student`; account role nội bộ gồm `instructor`, `reviewer`, `guest`.

Authorization phải server-side qua `lib/auth`, `lib/operations/permissions`, `lib/teaching/access`, `lib/academy-admin/access`, content-access resolver và Supabase RLS. Frontend hiding không phải authorization.

## 10. Feature flags chính

Public: `NEXT_PUBLIC_PUBLIC_HOME_V3`, `NEXT_PUBLIC_PUBLIC_ACADEMY_V5`, `NEXT_PUBLIC_PUBLIC_MEMBERSHIP_V2`, `NEXT_PUBLIC_AUTH_EXPERIENCE_V2`.

Learning: `NEXT_PUBLIC_STUDENT_EXPERIENCE_V2`, `NEXT_PUBLIC_LEARNING_JOURNEY_LOG_V1`, `NEXT_PUBLIC_LEARNING_CAPABILITY_SNAPSHOTS_V1`, `NEXT_PUBLIC_MISSION_WORKSPACE_V2`, `NEXT_PUBLIC_STAGE1_LEARNING_OS_V1`.

Academy/Business/Platform: `NEXT_PUBLIC_ACADEMY_CONTROL_CENTER_V1`, `NEXT_PUBLIC_INSTRUCTOR_WORKSPACE_V1`, `NEXT_PUBLIC_CREATIVE_PUBLISHING_OPS_V1`, `NEXT_PUBLIC_BUSINESS_COMMERCE_GROWTH_OPS_V1`, `NEXT_PUBLIC_OPERATIONS_CENTER_V1`, `NEXT_PUBLIC_PLATFORM_ADMIN_V1`, `NEXT_PUBLIC_SYSTEM_CONTROL_PLANE_V2`.

Runtime: `NEXT_PUBLIC_APP_MODE`, `NEXT_PUBLIC_UNIFIED_INPUT_ENABLED`, Supabase/R2/Redis/payment/email/scanner variables. Nguồn: `lib/*/feature*.ts`, `lib/runtime-config.ts`, `middleware.ts`, `.env.example`.

## 11. Khoảng trống cần tiếp tục hoàn thiện

1. Chuẩn hóa route registry để loại trừ route legacy/preview trùng nghĩa.
2. Hoàn thiện i18n cho toàn bộ page content; mọi chuỗi UI dùng translation key.
3. Tạo capability matrix machine-readable: role × route × action × data permission × flag.
4. Tạo design token registry machine-readable.
5. Tạo domain event map và API/schema catalog tự động.
6. Hiển thị readiness thực của từng integration.
7. Gắn nhãn rõ dữ liệu demo/live và tài liệu historical/current.
8. Bổ sung E2E critical flow: signup → enrollment → payment → entitlement → learning → grading → graduation → publish.

## 12. Prompt nền cho AI thiết kế

```text
Bạn đang thiết kế trong H2OBOOK: hệ sinh thái tạo sách, tri thức, học tập, giảng dạy và kinh doanh cho Makeup/Beauty Academy.
Giữ các nguyên tắc: local-first, coreRequiresAI=false, AI tùy chọn, tenant-safe, có audit và manual fallback.
Trước khi thiết kế, xác định surface, role, parent route, quyền, feature flag, component tái sử dụng, input/output, loading/empty/error/locked/denied/success, persistence và fallback AI.
Trả về user flow, information architecture, wireframe, UI states, data contract, acceptance criteria và test cases.
Không gọi tính năng là “đã có” nếu chưa tìm thấy route/component/service/API/migration tương ứng.
```

## 13. Nguồn tham chiếu

`README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE-PROFESSIONAL-4.11.md`, `docs/ARCHITECTURE-V4-SMART-CORE.md`, `docs/RELEASE-NOTES-4.14-AI-STUDENT-PUBLIC.md`, `docs/VALIDATION-REPORT-4.13.7-PHASE7.md`, `SOURCE-MANIFEST-4.14.0.txt`, `app/`, `components/`, `lib/`, `supabase/migrations/`.

Khi thêm feature, phải cập nhật tài liệu này với route, skill, component/service, permission/flag, data contract, design surface và test. Khi release đổi, cập nhật snapshot và `CHANGELOG.md`.
