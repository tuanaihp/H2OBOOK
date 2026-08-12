# Journey Tree Editor V1 — Final Report

Route: `/academy-admin/journey` (nâng cấp tại chỗ, không route mới). Nguồn: `v5/35-H2OBOOK_JOURNEY_TREE_EDITOR_V1/`. Audit đầy đủ ở [01_PRODUCTION_AUDIT.md](./01_PRODUCTION_AUDIT.md).

## Đã triển khai

1. **Chỉnh sửa Kết quả / Chặng** (`components/academy-admin/outcome-editor.tsx`, `milestone-editor.tsx`): click vào hàng Kết quả/Chặng trong cây mở đúng panel — tên, mô tả, thứ tự (chỉ đọc), quy mô (số Chặng/Nhiệm vụ), mục "Liên kết dữ liệu" (tổng hợp thật từ cây đã tải, không thêm query), nút Lưu/+Thêm/Xóa. Nhiệm vụ tiếp tục dùng nguyên Mission Inspector 5 tab đã có.
2. **Thêm node**: `+ Kết quả`/`+ Chặng`/`+ Nhiệm vụ` tạo ở cuối danh sách anh em theo đúng field `position` hiện có, tự động chọn node vừa tạo qua panel tương ứng.
3. **Xóa an toàn** (`checkMissionsSafeToDelete` trong `lib/learn-outcome/admin.ts`): trước khi xóa Kết quả/Chặng, kiểm tra đủ 4 điều — `student_mission_states`, `student_mission_workspace_values`, `student_learning_actions.mission_id`, và `prerequisite_mission_id` trỏ vào từ Nhiệm vụ **ngoài** phạm vi đang xóa. Có 1 trong 4 → chặn, hiện đúng lý do. Logic thuần (`findOutsidePrerequisiteReferences`) có unit test riêng.
4. **Reorder ↑↓** cho cả 3 cấp (`reorderTreeNode` + `computeSiblingSwap`, có unit test): cùng cấp cha, dùng đúng field `position` có sẵn, không thêm `sort_order`.
5. **Published bất biến — siết ở server, không chỉ UI**: audit phát hiện `createMilestone`/`createMission`/`updateMission` trước đây **không** kiểm tra draft ở server (chỉ ẩn nút ở UI) — cùng loại lỗ hổng đã tìm thấy ở folder 30. Đã thêm `requireDraftVersion()` cho cả 3 hàm, cộng với toàn bộ hàm mới (`updateOutcome`/`deleteOutcome`/`updateMilestone`/`deleteMilestone`/`reorderTreeNode`). Khi xem version Published: banner "Phiên bản đang áp dụng không thể sửa trực tiếp." + nút "Tạo bản nháp để chỉnh sửa" (gọi đúng `duplicateVersion()` đã có, qua wrapper `cloneVersionForEditing()` phát thêm `journey.version.cloned_for_edit`).
6. **Deep link**: `?node=<id>&type=outcome|milestone|mission` — vẫn giữ `?missionId=` cũ (folder 34 đã link) hoạt động song song.
7. **domain_events mới**: `journey.outcome.created/updated/deleted`, `journey.milestone.created/updated/deleted`, `journey.mission.created`, `journey.tree.reordered`, `journey.version.cloned_for_edit` — qua `emitDomainEvent()` có sẵn, không bảng mới.

## Không tạo source-of-truth mới

Xác nhận: không migration nào. Toàn bộ đọc/ghi qua đúng `learning_journey_outcomes/milestones/missions` đã có từ migration 0050.

## Delete strategy

Theo đúng thứ tự `deleteDraftVersion()` (folder 33) đã dùng: xóa workspace configs theo `mission_id` → xóa missions → xóa milestones/outcome — không dựa hoàn toàn vào FK cascade (dù schema đã khai `on delete cascade`), giữ nhất quán cách kiểm soát thứ tự xóa đã có.

## Reorder strategy

Swap `position` với hàng xóm liền kề (cùng cha), y hệt cách `app/academy-admin/stages/page.tsx`'s `moveStage` đã làm cho Stage — không kéo-thả, không đổi cấp cha trong V1 (đúng §10, tránh vấn đề remap prerequisite chưa audit).

## Published immutability

Xác nhận bằng dữ liệu thật: version `867f149d...` (Stage "Nền tảng nghề Makeup") đang `status=published` — mọi hàm ghi mới đều gọi `requireDraftVersion()` trước khi ghi, cùng helper đã dùng ổn định từ folder 33.

## Data preservation

Không đụng `student_mission_states`/`student_mission_workspace_values`/evidence — chỉ đọc để CHẶN xóa, không bao giờ ghi/xóa các bảng này.

## Validate

`typecheck` ✅ · `lint` ✅ (0 error, 0 warning mới) · `test` ✅ (194/194, gồm 9 test mới cho `computeSiblingSwap`/`findOutsidePrerequisiteReferences`) · `test:sql` ✅ (19 bảng) · `build` ✅. Merge `main`, push, deploy, health check: mọi route trả `307` (redirect đăng nhập bình thường), không lỗi 500.

## Kiểm chứng bằng dữ liệu thật (mirror qua Supabase REST — không có phiên đăng nhập thật để click UI trực tiếp)

Trên đúng blueprint thật (Stage "Nền tảng nghề Makeup", v1 đang publish):
- Tạo 1 version nháp tạm (v99), 2 Outcome test — xác nhận **reorder swap đúng** (B lên trước A, vị trí hoán đổi chính xác).
- **updateOutcome đúng** — đổi tên/mô tả, xác nhận lưu.
- Tạo 1 Chặng + 1 Nhiệm vụ test, xác nhận **cả 3 kiểm tra an toàn đều = 0** (không tiến độ/workspace value/action thật, không ai lấy làm điều kiện mở khóa) → **xóa Chặng thành công**, xác nhận Nhiệm vụ con cũng biến mất theo đúng thứ tự xóa thủ công.
- Đối chiếu với Nhiệm vụ **thật** (`e6956113...`, 2 học viên thật Max Crypto/Thùy H2O Makeup đang có tiến độ) — xác nhận count tiến độ = 2 > 0, tức là logic BLOCK sẽ đúng chặn nếu ai thử xóa Nhiệm vụ/Chặng/Kết quả chứa nó.
- Dọn sạch toàn bộ dữ liệu test (version + outcome), xác nhận 0 dòng còn lại.

## NOT VERIFIED

- **Chưa test qua giao diện thật** (§17 acceptance test) — không có phiên đăng nhập Admin thật để click qua UI (chọn v1 Published → xác nhận read-only trên trình duyệt → bấm "Tạo bản nháp để chỉnh sửa" → đổi tên Kết quả 01 qua form → thêm Chặng/Mission qua nút → kéo thứ tự → xóa 1 Chặng test → Xem như học viên → Preflight). Logic phía server đã kiểm chứng đúng bằng dữ liệu thật (trên); phần UI (panel hiện đúng, nút disable đúng khi Published, banner đúng chỗ) chưa được xác nhận bằng mắt qua trình duyệt thật.
- Chưa publish bản nháp nào trong khi test — đúng yêu cầu "chưa publish cho tới khi test đủ".

Khuyến nghị: bạn tự đăng nhập, mở `/academy-admin/journey`, chọn Stage "Nền tảng nghề Makeup" → v1 (Đang áp dụng) → xác nhận thấy banner + nút "Tạo bản nháp để chỉnh sửa" → thử luồng đầy đủ ở §17 trên bản nháp mới tạo (không phải v1 thật).
