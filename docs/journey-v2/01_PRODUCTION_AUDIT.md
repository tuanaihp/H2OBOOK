# Journey Map V2 — Production Audit (trước khi nâng cấp)

Ngày: 2026-08-10
Theo yêu cầu §3 gói nguồn — audit trước, không tạo migration mới nếu không cần.

## Kết luận chính: không cần migration mới

Toàn bộ schema Journey (migration 0050 + 0051, tự tôi xây ở Release A/B) đã đủ cho V2 — chỉ thêm 1 cột logic mới (`findings` có cấu trúc trong kiểu trả về `PreflightResult`, không phải cột DB) để phục vụ UI nhóm lỗi. Không có `alter table`/`create table` nào trong lượt nâng cấp này.

## Bảng thật đang có (đã audit lại)

| Bảng | Vai trò |
|---|---|
| `learning_journey_blueprints` | 1 blueprint/stage |
| `learning_journey_versions` | draft/published/archived, unique published/blueprint |
| `learning_journey_outcomes` / `_milestones` / `_missions` | Outcome graph |
| `learning_mission_resource_bindings` / `_tool_bindings` / `_assignment_bindings` | tham chiếu canonical, không copy |
| `learning_mission_action_templates` | action mẫu |
| `student_mission_states` (+ `evidence`, `evidence_submitted_at`, `verified_by` từ 0051) | trạng thái từng học viên |
| `student_learning_actions` | action thật của từng học viên |

## Trạng thái Stage 1 trước khi nâng cấp

```
Blueprint: 65c02e83-5cda-4bcd-9202-fe5bbd71bba4 ("Nền tảng nghề Makeup")
Version 1: 867f149d-c6ae-466f-9536-c8c2e37817bc — published
current_published_version_id = 867f149d... (trỏ đúng v1)
```

**1 dòng `student_mission_states` thật đang tồn tại** — học viên "Max Crypto" (`117de651-...`), mission "Xác định hướng nghề Makeup", state=`result_achieved`, thời điểm tạo **sau** lần tôi dọn dữ liệu test cuối cùng ở Release B. Nhiều khả năng đây là dữ liệu thật (bạn hoặc ai đó đã tự bấm Start Mission qua trình duyệt). **Không đụng vào dòng này** trong suốt quá trình nâng cấp V2.

## Resolver canonical hiện có (dùng lại, không xây mới)

- **Resource**: `curriculum_documents` (nội dung thật) + `career_stage_resources` (vị trí gắn trong giáo trình, có `title_override`).
- **Assignment**: `assignment_definitions` — **rỗng trong tổ chức này** (đã xác nhận lại, giống Release B). Assignment Picker vì vậy không có gì để search — đã báo rõ trong report, không giả lập dữ liệu.
- **Tool**: **không có bảng `tools` thật với id** — công thức CREATE (`lib/student/create-outcome.ts`) chỉ có `slug` tĩnh, không phải nguồn canonical có id thật. Tool Picker không xây được cho tới khi có bảng tool thật — báo rõ, không tạo giả.
- **Entitlement/access resolver**: `lib/content-access/facts.ts`, `lib/student/stage-access.ts` (đã sửa ở lượt trước) — không đổi, Journey V2 không ghi đè.

## UI hiện tại trước khi sửa (đúng như gói nguồn mô tả)

- Admin `/academy-admin/journey`: Mission Inspector hiện `{resourceType} · {resourceId}` — **đúng là UUID**, xác nhận từ code tôi viết ở Release A.
- Preflight cũ: `blockers`/`warnings` là mảng string phẳng, không nhóm — đúng như gói nguồn mô tả "debug screen".
- Student `/student/courses`: Map/Roadmap là card-grid đơn giản, chưa hiện lý do khóa (`lockedReason` chưa tồn tại).

Tất cả khớp với mô tả vấn đề trong README của gói nguồn — không có gì bị thổi phồng hay bịa thêm so với thực tế.
