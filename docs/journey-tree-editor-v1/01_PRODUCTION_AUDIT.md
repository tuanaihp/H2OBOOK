# Journey Tree Editor V1 — Production Audit

Đọc đủ 13/13 file gói nguồn trước khi audit.

## Entity | Table/Service | ID | Parent | Title | Description | Position | Version | Readers | Writers

| Entity | Table | ID col | Parent | Title | Description | Position | Version | Readers (hiện có) | Writers (hiện có) |
|---|---|---|---|---|---|---|---|---|---|
| Outcome (Kết quả) | `learning_journey_outcomes` | `id` | `version_id` | `title` | `description` | `position` | qua `version_id` | `loadVersionGraph` (`lib/learn-outcome/service.ts`) | `createOutcome` (`lib/learn-outcome/admin.ts`) — **chưa có update/delete** |
| Milestone (Chặng) | `learning_journey_milestones` | `id` | `outcome_id` | `title` | `description` | `position` | gián tiếp qua Outcome | `loadVersionGraph` | `createMilestone` — **chưa có update/delete, chưa check draft server-side** |
| Mission (Nhiệm vụ) | `learning_journey_missions` | `id` | `milestone_id` | `title` | `description`/`expected_result` | `position` | gián tiếp qua Milestone | `loadVersionGraph` | `createMission`, `updateMission` (đủ, đang dùng cho Mission Editor 5 tab) — **cũng chưa check draft server-side, chưa có reorder/delete** |

Không có field nào cần "invent" — `title`/`description`/`position` đã có sẵn trên cả 3 bảng, đúng yêu cầu §4/§5 "chỉ hiển thị field nếu schema hiện có hỗ trợ".

## Journey resolver / progress / evidence / prerequisite / bindings (đã biết từ folder 33/34, xác nhận lại)

- **Version resolver**: `getPublishedJourneyForStage`, `loadBlueprintForStage` — Published = `learning_journey_blueprints.current_published_version_id`.
- **Clone Published → Draft**: `duplicateVersion()` đã có (folder 33), tạo version mới + copy toàn bộ outcome/milestone/mission/binding/action-template/workspace-config, giữ `root_mission_id` để bảo toàn tiến độ khi publish sau này. Đây chính là service sẽ dùng cho CTA "Tạo bản nháp để chỉnh sửa" — không viết logic clone mới.
- **Progress/evidence/result**: `student_mission_states` (1 dòng/học viên/mission/version, cascade xóa theo `mission_id`), evidence là cột jsonb trên chính bảng đó (không phải bảng riêng).
- **Workspace values thật của học viên**: `student_mission_workspace_values` (cascade theo `mission_id`).
- **Learning actions**: `student_learning_actions.mission_id` — `on delete set null` (không cascade, nhưng xóa Mission sẽ âm thầm gỡ liên kết action thật của học viên khỏi Mission đó).
- **Prerequisite**: `learning_journey_missions.prerequisite_mission_id` — `on delete set null`. Từ folder 30, cross-outcome prerequisite được cho phép — nghĩa là 1 Mission ngoài subtree đang bị xóa CÓ THỂ đang trỏ prerequisite vào 1 Mission bên trong subtree đó.
- **Bindings**: `learning_mission_resource_bindings`/`_tool_bindings`/`_assignment_bindings`/`_action_templates`/`learning_mission_workspace_configs` — tất cả `on delete cascade` theo `mission_id`.

## Rủi ro thật đã xác nhận: mọi FK con của Outcome/Milestone/Mission đều `on delete cascade` xuống tới `student_mission_states` và `student_mission_workspace_values`

Test trực tiếp trên schema: `learning_journey_outcomes → learning_journey_milestones → learning_journey_missions → student_mission_states/student_mission_workspace_values` toàn bộ là `on delete cascade`. Một lệnh `DELETE` thô trên Outcome sẽ **âm thầm xóa sạch tiến độ/bằng chứng/kết quả thật của học viên** trong toàn bộ subtree, không có cảnh báo nào từ Postgres.

`deleteDraftVersion()` (folder 33) đã tự giải quyết đúng vấn đề này ở cấp Version (check `student_mission_states` trước khi xóa) — Tree Editor cần **lặp lại đúng nguyên tắc đó ở cấp Outcome/Milestone**, cộng thêm 2 điều `deleteDraftVersion` không cần lo (vì nó xóa cả cây):
1. `student_learning_actions` đang trỏ `mission_id` vào bất kỳ Mission nào trong subtree (set-null âm thầm, không cascade nhưng vẫn là mất liên kết dữ liệu thật).
2. `prerequisite_mission_id` từ Mission **ngoài** subtree trỏ **vào** Mission **trong** subtree (cross-outcome prerequisite, folder 30) — xóa sẽ âm thầm null hóa điều kiện mở khóa của Mission khác, thay đổi hành vi unlock ngoài ý định admin.

**Quyết định:** `deleteOutcome`/`deleteMilestone` phải kiểm tra đủ 4 điều trước khi xóa: (a) `student_mission_states` trong subtree, (b) `student_mission_workspace_values` trong subtree, (c) `student_learning_actions.mission_id` trong subtree, (d) `prerequisite_mission_id` trỏ vào subtree từ Mission ngoài subtree. Có 1 trong 4 → BLOCK, trả lý do chính xác (đúng §8 "BLOCK và hiển thị exact reason"). Không có → cascade delete an toàn (để Postgres tự cascade phần bindings/action-templates/workspace-configs, vốn không phải dữ liệu học viên).

## Gap bảo mật nhỏ đã phát hiện: createMilestone/createMission/updateMission không check draft ở server

`createOutcome()` có gọi `requireDraftVersion()` trước khi ghi — đúng. Nhưng `createMilestone()`, `createMission()`, `updateMission()` **không** gọi `requireDraftVersion()` — chỉ được chặn ở UI (`isDraft` disable nút). Cùng đúng bài học bảo mật đã tìm thấy ở folder 30 (nút Start Mission bị ẩn nhưng API không chặn): về nguyên tắc, một request trực tiếp gọi các API này trên version đã Published vẫn có thể ghi được. §9 "Published immutable" của gói nguồn 35 yêu cầu rõ tree phải read-only cho Published — nhân dịp sửa, thêm `requireDraftVersion()` server-side cho cả 3 hàm này (giữ nguyên hành vi khi gọi đúng, chỉ chặn thêm trường hợp gọi sai).

## domain_events

Đã có (folder 33): `journey.version_cloned`, `journey.version_bulk_cloned`, `journey.version_deleted`, `journey.version_archived`, `journey.version_preflighted`, `journey.version_published`, `journey.version_scope_applied` — tất cả qua `emitDomainEvent()` insert trực tiếp (không cần allowlist riêng biệt).

Gói nguồn 35 yêu cầu thêm: `journey.outcome.created/updated/deleted`, `journey.milestone.created/updated/deleted`, `journey.mission.created`, `journey.tree.reordered`, `journey.version.cloned_for_edit`. Emit thêm bằng đúng `emitDomainEvent()`, không tạo bảng event mới. `journey.version.cloned_for_edit` sẽ emit thêm (không thay) khi CTA "Tạo bản nháp để chỉnh sửa" gọi `duplicateVersion()` — phân biệt với hành động "Nhân bản phiên bản này" chung (vẫn chỉ emit `journey.version_cloned`).

## Security

`resolveAcademyAdminAccess()` (owner/admin only, tổ chức từ session) đã bọc mọi route `/api/academy-admin/learn-outcome/*` — tái dùng nguyên, không viết lại.

## Academy Data Link V1 (folder 34) — đã tích hợp

Outcome/Milestone chưa có resource binding trực tiếp (chỉ Mission có `learning_mission_resource_bindings`) — mục "Liên kết dữ liệu" cho Outcome/Milestone sẽ hiện tổng hợp thật (số Mission có/thiếu học liệu trong phạm vi đó) tính từ dữ liệu cây đã tải sẵn ở client (không thêm query, không N+1), kèm link sang `/academy-admin/data-link?stageId=`. Mission tiếp tục dùng đúng Resource Data Link Inspector đã có.

## Không tạo source-of-truth mới

Xác nhận: không migration nào cho folder này. Không `outcome_v2`/`milestone_v2`/`mission_v2`/`journey_tree_nodes`. Reorder dùng đúng field `position` sẵn có trên cả 3 bảng — không thêm `sort_order`.
