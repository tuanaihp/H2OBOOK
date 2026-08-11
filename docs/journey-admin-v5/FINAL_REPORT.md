# Journey Admin Builder V5 — Final Report

Route: `/academy-admin/journey`. Nguồn: `v5/33-H2OBOOK_JOURNEY_ADMIN_BUILDER_V5/`. Audit đầy đủ ở [01_PRODUCTION_AUDIT.md](./01_PRODUCTION_AUDIT.md).

## Đã triển khai

1. **`root_mission_id`** (migration 0054, đã chạy trên production — xác nhận bằng `curl` trực tiếp Supabase REST, cột tồn tại, 0 dòng null trên toàn bộ `learning_journey_missions`).
2. **`duplicateVersion()`** — mission được clone giờ kế thừa `root_mission_id` từ nguồn (`mission.rootMissionId ?? mission.id`) thay vì mất nhận diện như trước.
3. **`publishVersion()`** — trước khi archive version cũ và đổi `current_published_version_id`, gọi `repointStudentProgress()`: với mỗi dòng `student_mission_states` đang ghim vào version SẮP bị archive, tìm Mission ở version MỚI có cùng `root_mission_id`, nếu có thì repoint `mission_id` + `blueprint_version_id` sang version mới (giữ nguyên `state`/`evidence`/`verified_by`/...). Mission bị bỏ ở version mới thì dòng cũ giữ nguyên làm lịch sử.
4. **`deleteDraftVersion()`** — chỉ xóa được `status='draft'`, chặn nếu là `current_published_version_id` hoặc có `student_mission_states` tham chiếu, xóa theo đúng thứ tự outcome → milestone → mission → workspace configs.
5. **`bulkCloneToStages()`** — nhân bản 1 version nguồn thành bản nháp MỚI trên nhiều Stage đích (get-or-create blueprint từng Stage), không bao giờ ghi đè Published, không copy tiến độ/bằng chứng/kết quả học viên (các bảng đó không hề được đọc trong hàm này), tôn trọng 4 tùy chọn sao chép (Học liệu/Việc cần làm/Không gian làm việc/Điều kiện mở khóa — mặc định bật cả 4).
6. **API routes** (`/api/academy-admin/learn-outcome/version`): thêm `action=delete`, `action=bulk-clone`; `action=publish` nhận `scope` (chỉ chấp nhận `all_active_students` — không có bảng cohort trong production nên không giả lập các scope khác); `action=preflight`/`publish`/`archive`/`delete` phát `journey.version_*` domain events (§17).
7. **Giao diện** viết lại hoàn toàn theo từ điển `TERMS_VI.md`: header 2 hàng nút (`Xem như học viên` / `Kiểm tra` / `Áp dụng cho học viên` + `Nhân bản phiên bản này` / `Nhân bản sang nhiều giai đoạn` / `Xóa bản nháp` / `Lưu trữ phiên bản`), version selector dạng `v3 — Bản nháp`/`v1 — Đang áp dụng`/`v0 — Đã lưu trữ`, Mission Inspector 5 tab (Tổng quan/Học liệu/Việc cần làm/Không gian làm việc/Mở khóa & đánh giá), modal Nhân bản sang nhiều giai đoạn (checkbox Stage thật từ DB, loại Stage nguồn, bảng kết quả Stage|Version mới|Trạng thái|Mở), modal Xóa bản nháp (cảnh báo đúng câu gói nguồn yêu cầu).

## Validate

`typecheck` ✅ · `lint` ✅ (0 error, 0 warning mới) · `test` ✅ (179/179) · `test:sql` ✅ (19 bảng) · `build` ✅ · migration chain ✅ (54 migration liên tục). Merge vào `main`, push, deploy `npx vercel --prod --yes` thành công (`h2obook-app.vercel.app`), health check: `/academy-admin/journey` và API route trả `307` (redirect đăng nhập bình thường, không có lỗi 500).

## Kiểm chứng bằng dữ liệu thật

- Xác nhận migration đã chạy: `learning_journey_missions.root_mission_id` tồn tại, mọi Mission hiện có tự trỏ về chính nó (đúng như thiết kế backfill).
- Xác nhận 2 học viên thật (Max Crypto, Thùy H2O Makeup) đang có tiến độ thật trên version đang publish (`867f149d...`, Stage "Nền tảng nghề Makeup") — 4 dòng `student_mission_states` thật, không phải dữ liệu test.
- Kiểm chứng cơ chế repoint bằng cách tái tạo chính xác thao tác ghi của `cloneGraphIntoVersion()` (clone 1 outcome/milestone/mission thật từ v1 vào 1 version nháp tạm) và xác nhận: (a) FK `root_mission_id` chấp nhận đúng giá trị kế thừa, (b) Mission mới nhận đúng `root_mission_id` trùng với Mission mà 2 học viên thật đang có tiến độ — tức là join key mà `repointStudentProgress()` dùng để match là chính xác. Đã dọn sạch toàn bộ dữ liệu test này ngay sau đó (xác nhận 0 dòng còn lại).
- **Chưa** thực hiện một lượt Publish thật đè lên version đang publish (dù cơ chế đã kiểm chứng đúng) — đây là hành động ảnh hưởng trực tiếp giao diện học viên thật, cần Admin tự bấm qua UI khi đã sẵn sàng, không tự ý làm thay.

## Phát hiện quan trọng cần Admin xử lý

Trong lúc kiểm chứng, phát hiện 3 bản nháp (v2, v3, v4) trên Stage "Nền tảng nghề Makeup" đều **không** mang `root_mission_id` trỏ về Mission gốc ở v1 (được clone bằng `duplicateVersion()` phiên bản CŨ, trước khi có cột này) — nếu publish nguyên trạng bây giờ, cơ chế bảo toàn tiến độ mới xây sẽ KHÔNG nhận ra Mission tương đương, và tiến độ của 2 học viên thật vẫn sẽ biến mất y như lỗi ban đầu.

**Đính chính:** lúc mới phát hiện, tôi báo nhầm với bạn rằng cả 3 bản nháp này "giống hệt v1, 0 chỉnh sửa" — chỉ vì tôi so sánh số lượng Mission và tiêu đề Outcome/Milestone, chưa so `prerequisite_mission_id`/`estimated_days`/`success_criteria`. Kiểm lại kỹ mới thấy **cả 3 đều mang chỉnh sửa thật** — đúng là công việc đã làm ở folder 32 (2026-08-11): mở khóa song song 4 Outcome (nhiều Mission giờ `prerequisite_mission_id = null` thay vì 1 chuỗi tuần tự), toàn bộ 14 Mission đã có `estimated_days` và `success_criteria` (bản v1 đang publish thì chưa có). **Không phải dữ liệu test, không nên xóa.** Cảm ơn bạn đã chọn "tự kiểm tra trước" thay vì đồng ý xóa ngay theo đề xuất sai của tôi.

**Vì vậy khuyến nghị đổi lại:** khi bạn đã chọn được bản muốn publish (nhiều khả năng v4 — bản mới nhất), đừng publish thẳng bản đó. Hãy bấm **"Nhân bản phiên bản này"** trên nó trước — thao tác này tạo ra một bản nháp MỚI bằng cơ chế `duplicateVersion()` đã sửa hôm nay, mang đúng `root_mission_id` trỏ về v1 — rồi publish bản nháp mới đó. Chỉ thêm một bước, nhưng đảm bảo tiến độ của Max Crypto và Thùy H2O Makeup được bảo toàn đúng như thiết kế.

## Việc học viên không được tự cắt sang version mới (§16)

Không có luồng "copy Journey riêng cho từng học viên" — học viên đọc thẳng `current_published_version_id` của blueprint qua `getJourneyForStudent()`, nên lần tải trang tiếp theo sau khi Admin Publish sẽ tự động thấy version mới, không cần thao tác gì thêm.
