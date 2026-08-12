# Academy Data Link V1 — Production Audit

Đọc đủ 16/16 file gói nguồn trước khi audit.

## Route/trang đã audit

| Route | Vai trò hiện tại | Liên quan |
|---|---|---|
| `/academy-admin/stages` | Danh sách Stage + Stage Health (điểm số riêng, KHÔNG liên quan Journey) | dùng `computeStageHealthBatch` (`lib/academy-control/health.ts`) |
| `/academy-admin/stages/[stageId]` | Workspace 1 Stage: Tổng quan/Cấu trúc & nội dung/Bài tập/**Giao diện học viên**/Analytics | tab "Giao diện học viên" đang cho gõ `key` tự do (raw text input, dòng 713) |
| `/academy-admin/journey` | Journey Admin Builder V5 (vừa nâng cấp folder 33) | không đổi gì thêm ở đây ngoài 2 đoạn Inline Guide |
| `/student/courses` | Smart Journey Shell (Roadmap) — badge Stage đã đúng: `String(model.stagePosition).padStart(2,"0")` | **KHÔNG có lỗi** |
| `/student/missions/[missionId]` | Mission Workspace — badge Stage lấy `view.stage.indexLabel` (`components/student/mission-workspace/mission-workspace-client.tsx:122`) | **CÓ LỖI P1 — xem bên dưới** |
| `/student/library` | Danh sách tài liệu theo Stage — nhãn mỗi section cũng dùng `stage.indexLabel` | rủi ro thấp hơn (không phải "badge Stage hiện tại", chỉ là nhãn từng section) nhưng vẫn sửa cho nhất quán |
| Student stage badge/resolver | `app/student/courses/page.tsx` chọn `currentStage` = Stage có position cao nhất trong `getUnlockedStageIds()` | nguồn `career_stages.position/title` đúng — KHÔNG dùng membership/version/index mảng để hiện số |

## Audit schema/service

| Bảng/Service | Vai trò | Kết luận |
|---|---|---|
| `career_stages` | `id, slug, position, index_label, title, ...` — `position` là số thứ tự THẬT (int, do DB tính/sort), `index_label` là text admin gõ tay, có thể lệch (xem `app/academy-admin/stages/page.tsx:213-217` — chính UI admin đã có cảnh báo lệch) | **Nguồn đúng cho badge = `.position`, không phải `.index_label`** |
| `academy_stage_nodes` | Program/Module/Group tự tham chiếu, `node_type` check theo depth (trigger `h2obook_validate_stage_node_depth`) | reuse nguyên |
| `career_stage_resources` | `resource_type/resource_id` polymorphic (book/course/publication/template/knowledge_space/roadmap/link/asset/document), `node_id` trỏ vào `academy_stage_nodes`, `access` enum (free_preview/stage_locked/entitlement_only) | reuse nguyên — đây là "Curriculum placement" thật |
| `content_items` | Catalog/index cho Kho nội dung Academy, KHÔNG phải nơi lưu nội dung (source_table/source_id trỏ về bảng thật) | không cần đụng |
| `learning_journey_missions` + `learning_mission_resource_bindings` | Mission Resource Binding: `resource_type/resource_id` — kiểm tra dữ liệu thật: 100% `resource_type = "document"` (trỏ `curriculum_documents`) | reuse nguyên — join với `career_stage_resources` cùng `resource_type/resource_id` để ra Curriculum origin |
| `lib/content-access/{resolver,facts}.ts` | Resolver truy cập thật theo từng học viên (đã hợp nhất từ 4 nơi khác nhau trước đây) | dùng `career_stage_resources.access` (tĩnh, không theo học viên) cho Resource Inspector phía Admin — đủ cho "access state" tổng quan, không cần chạy resolver đầy đủ per-student ở màn Admin |
| `student_mission_states.blueprint_version_id` | Ghim tiến độ học viên vào version — đã có repoint khi publish (folder 33) | dùng cho Setup Guide bước 10 + Stage Context Validator |
| `domain_events` | `emitDomainEvent()` (`lib/domain/events.ts`) — insert trực tiếp, không cần allowlist riêng cho event name mới | dùng để log `student.stage_context_mismatch` |
| `academy_stage_ui_config` | 1 dòng/version/Stage, `config: {topLevel: NavItemDraft[]}` — **CHƯA nối vào sidebar học viên thật** (comment rõ trong `ExperienceTab`, dòng 703) | giữ nguyên bảng/API, chỉ đổi khuôn dữ liệu ghi (từ danh sách key tự do → 3 mục cố định) và đổi khung hình theo đúng yêu cầu gói nguồn |

## Lỗi P1 thật đã xác nhận: Student Stage badge lệch nguồn giữa 2 màn hình

`app/student/courses/page.tsx` (Roadmap) hiện số Stage bằng `model.stagePosition` — lấy thẳng từ `career_stages.position` (`lib/smart-journey/student.ts:93`), hiển thị `String(position).padStart(2,"0")`.

`lib/mission-workspace/student.ts`'s `findMissionStage()` (dòng 19-34) lấy Stage của Mission bằng `blueprint.stage_id`, nhưng **chỉ trả về `{id, title, indexLabel}`, bỏ hẳn `position`** — và `components/student/mission-workspace/mission-workspace-client.tsx:122` hiện `view.stage.indexLabel` làm badge "Giai đoạn X" trong Mission Workspace.

`index_label` là text admin gõ tay khi tạo Stage (`career_stages.index_label`), không đồng bộ tự động với `position` — file `app/academy-admin/stages/page.tsx` dòng 213-217 đã có sẵn logic tự phát hiện lệch (`stage.indexLabel !== String(index+1).padStart(2,"0")`) cho biết đây là chuyện **đã từng xảy ra thật**, không phải giả định.

**Hậu quả:** cùng một học viên, cùng một Stage thật, Roadmap hiện "Giai đoạn 02" nhưng Mission Workspace của chính Stage đó có thể hiện nhãn khác nếu `index_label` bị gõ lệch hoặc để trống — đúng mô tả P1 trong gói nguồn ("Student Stage badge từng hiển thị sai Giai đoạn").

**Đính chính sau khi kiểm tra dữ liệu thật (lần 1 sửa sai, lần 2 mới đúng):** Lần đầu tôi sửa Mission Workspace sang dùng thẳng `career_stages.position + 1`, tưởng vậy là khớp với Roadmap (Roadmap cũng dùng `.position`). Nhưng khi deploy xong và kiểm tra dữ liệu thật mới phát hiện: `.position` là bộ đếm thô, KHÔNG reset khi Stage bị lưu trữ — 6 Stage đang publish thật của tổ chức này nằm ở `position = 5..10` (không phải `0..5`), vì 6 Stage nháp/test cũ hơn đã chiếm `position 0..4` trước khi bị lưu trữ. Nếu badge thẳng theo `.position + 1`, Stage đầu tiên học viên thật đang học sẽ hiện "Giai đoạn 06" thay vì "01" — vẫn sai, chỉ khác kiểu sai với lần trước (và cả Roadmap cũng đang mắc lỗi này, dù tôi từng đánh giá "KHÔNG có lỗi").

**Fix đúng:** thêm `stageDisplayRank()` (`lib/career-stages/types.ts`) — số thứ tự 1-based tính theo **thứ hạng của Stage trong danh sách Stage đang active**, không phải giá trị `.position` thô. Áp dụng thống nhất ở cả 3 nơi: Roadmap (`lib/smart-journey/student.ts`), Mission Workspace (`lib/mission-workspace/student.ts`), và `/student/library` (`app/api/student/library/route.ts`). Đã xác nhận bằng dữ liệu thật: `stageDisplayRank` cho ra đúng 01→06 khớp 100% với `index_label` mà admin đã đặt cho 6 Stage thật. `index_label` vẫn giữ trong schema (admin có thể dùng làm ghi chú nội bộ) nhưng không còn là nguồn cho bất kỳ badge nào hiện ra với học viên — và `.position` thô cũng không còn được badge trực tiếp nữa, chỉ dùng để sắp xếp.

## Không tạo source-of-truth mới

Xác nhận theo đúng gói nguồn: KHÔNG tạo `academy_data_links`, không tạo bảng resource-mission-link thứ hai (binding thật đã có ở `learning_mission_resource_bindings`), không copy tài liệu, không copy Journey theo học viên, không tạo unlock/progress resolver mới. Toàn bộ `AcademyDataLinkHealth`/`AcademySetupGuide`/`ResourceDataLinkInspector`/`StudentStageContextCheck` là **read-model tính lúc đọc**, giống hệt cách `lib/academy-control/health.ts` đã làm cho Stage Health — không lưu điểm riêng nên không bao giờ lệch dữ liệu gốc.

## Cohort/Assignment

Grep xác nhận không có bảng cohort (giống folder 33). "Assignment & Review" vẫn là source-of-truth bài tập duy nhất — Data Link V1 không đụng vào, tab "Bài tập" trong Stage Workspace vẫn hiện `InfoPanel` trỏ người dùng sang Academy Admin → Bài tập như cũ.
