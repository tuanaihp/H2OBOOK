# Journey Admin Builder V5 — Production Audit

Đọc đủ 12/12 file gói nguồn trước khi audit.

| Hệ thống | Nguồn hiện tại | Reuse | Extend | New | Rủi ro |
|---|---|---|---|---|---|
| Journey Blueprint/Version/Outcome/Milestone/Mission | `learning_journey_*` (0050) | ✅ | | | |
| Clone version | `duplicateVersion()` (`lib/learn-outcome/admin.ts`) | ✅ | Thêm `root_mission_id` để clone giữ nhận diện | | |
| Publish/current version resolver | `publishVersion()`, `learning_journey_blueprints.current_published_version_id` | ✅ | Thêm bước bảo toàn tiến độ trước khi chuyển pointer | | |
| Student version pinning | `student_mission_states.blueprint_version_id`, lọc theo `getPublishedJourneyForStage` | ✅ | | | **Đã xác nhận rủi ro thật (xem dưới)** |
| Prerequisite/unlock | `prerequisite_mission_id`, `displayStateFor()` | ✅ | | | |
| Resource bindings | `learning_mission_resource_bindings` + Resource Picker (đã có từ folder 29) | ✅ | | | |
| Workspace blocks | `learning_mission_workspace_configs` (0052) | ✅ | | | |
| Progress/evidence/results | `student_mission_states` (+evidence 0051) | ✅ | | | |
| Xóa bản nháp | Không có | | | Thêm `deleteDraftVersion()` | Phải chặn nếu có state row tham chiếu |
| Nhân bản nhiều Stage | Không có | | Dựng từ logic `duplicateVersion()` | Thêm `bulkCloneToStages()` | |
| domain_events | Trigger `capture_domain_event` (generic insert/update/delete) đã tự bắt version create/status-change | ✅ | Thêm `emitDomainEvent()` tên cụ thể (`journey.version_*`) cho phân tích UI | | |
| RLS owner/admin | Đã có, không đổi | ✅ | | | |
| Cohort | Không tồn tại (grep xác nhận) | | | Không xây — chỉ có "Tất cả học viên đang dùng giai đoạn này" | |

## Rủi ro thật đã xác nhận: Publish đè version sẽ làm "mất" tiến độ học viên đang hoạt động

`getJourneyForStudent()` (`lib/learn-outcome/student.ts`) luôn đọc `student_mission_states` lọc theo `.eq("blueprint_version_id", published.version.id)` — tức là CHỈ so với version **đang publish hiện tại**. `duplicateVersion()` tạo Mission mới với **UUID hoàn toàn mới** cho mỗi lần clone (không có cơ chế map ổn định nào được lưu lại — map cũ chỉ tồn tại tạm trong bộ nhớ lúc clone).

Kết quả: nếu Admin publish version mới (v2) đè lên version đang publish (v1) mà **học viên thật đã có tiến độ trên v1** — tiến độ đó lập tức "biến mất" khỏi giao diện học viên (mọi Mission hiện lại "chưa mở"/"available" từ đầu), dù dòng dữ liệu cũ **không bị xóa**, chỉ không còn khớp `blueprint_version_id` của version mới.

**Xác nhận bằng dữ liệu thật:** 2 học viên thật (Max Crypto, Thùy H2O Makeup) đang có tiến độ trên bản v1 đang publish hiện tại — nếu publish v2 (bản nháp đã có sẵn từ trước) ngay bây giờ mà không sửa gì, tiến độ của cả 2 người sẽ biến mất khỏi giao diện của họ.

**Giải pháp đã chọn** (đúng "Safe behavior" ở §13 — không STOP mà không làm gì, mà xây đúng cơ chế "stable-key" gói nguồn yêu cầu):

- Thêm cột `root_mission_id` (tự trỏ về chính nó nếu là Mission gốc, hoặc kế thừa từ Mission nguồn khi bị clone) — đây là "nhận diện ngữ nghĩa" xuyên suốt các version.
- Khi Publish, trước khi đổi pointer: với mỗi dòng `student_mission_states` đang tham chiếu version SẮP bị thay thế, tìm Mission ở version MỚI có cùng `root_mission_id` — nếu có, **repoint** dòng đó sang Mission + version mới (giữ nguyên state/evidence/verified_at/...). Nếu Mission bị bỏ ở version mới, dòng cũ giữ nguyên (lịch sử vẫn còn, chỉ không hiện trong giao diện hiện tại). Mission hoàn toàn mới thì học viên thấy như Mission mới — đúng 3 gạch đầu dòng "Safe behavior" trong gói nguồn.
