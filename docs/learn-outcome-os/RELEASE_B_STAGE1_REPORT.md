# Learn Outcome OS — Release B: Stage 1 Vertical Slice Report

Ngày: 2026-08-10
Phạm vi: Stage 1 thật (`h2o-stage-01-foundation`, "Nền tảng nghề Makeup") — không seed Stage 2–6.

## 1. Định danh dữ liệu thật đã tạo

| | |
|---|---|
| Stage ID | `37d7584f-00a2-43cd-8406-ca1c76d3038a` (`h2o-stage-01-foundation`) |
| Blueprint ID | `65c02e83-5cda-4bcd-9202-fe5bbd71bba4` |
| Version ID | `867f149d-c6ae-466f-9536-c8c2e37817bc` (v1) |
| Trạng thái version | **published** (đã publish sau khi Preflight = 0 blocker) |

**Một lưu ý cần bạn biết**: đề bài đặt tên Stage 1 là "Người mới bắt đầu" — đó là tên của 1 trong 5 giai đoạn cũ, hiện đã **archived** (đã xác nhận ở audit trước). Giai đoạn thật, đang active, ở vị trí Stage 1 là **"Nền tảng nghề Makeup"** (`h2o-stage-01-foundation`, đã có nội dung V2 thật từ module 25/26). Tôi dùng đúng giai đoạn thật này theo chỉ dẫn "Dùng Stage 1 production hiện tại", không dùng lại tên cũ.

## 2. Số lượng

| | Số lượng |
|---|---|
| Outcome | 4 |
| Milestone | 4 (1 milestone/outcome — đề bài không định nghĩa milestone riêng, xem §7) |
| Mission | 14 |
| Resource bindings | 20 (100% resolve được tới `curriculum_documents` thật) |
| Tool bindings | 0 (xem §6 — không có nguồn Tool thật trong repo) |
| Assignment bindings | 0 (xem §6 — `assignment_definitions` rỗng trong tổ chức) |
| Action templates | 36 |
| Missing bindings | 1 (mission "Xác định mục tiêu 90 ngày" — không có tài liệu thật tương ứng) |

## 3. Bảng gắn kết Mission → Resource thật

| Mission | Resource gắn (curriculum_documents thật) |
|---|---|
| Xác định hướng nghề Makeup | 6 hiểu biết nền tảng khi bắt đầu nghề Makeup |
| Hoàn thành Career Map | Makeup Career Map · H2O Starter Cost Calculator — hướng dẫn · Hoàn thành Career Map + bảng chi phí |
| Xác định mục tiêu 90 ngày | **⚠ MISSING BINDING** — không có tài liệu 90-ngày thật, không tạo tài liệu giả để lấp chỗ trống |
| Chuẩn hóa túi đồ nghề | Checklist túi đồ nghề Foundation |
| Hoàn thành tiêu chuẩn vệ sinh | Tiêu chuẩn vệ sinh và an toàn trong Makeup |
| Setup hồ sơ nghề Makeup | Checklist thiết lập hồ sơ nghề Makeup · 30 ý tưởng content cho học viên mới · Hoàn thiện hồ sơ nghề cơ bản |
| Chuẩn bị da đúng | Quy trình chuẩn bị da trước Makeup · Checklist 8 bước chuẩn bị da |
| Hoàn thiện lớp nền | Nguyên lý lớp nền mỏng, sạch và bền · Rubric chấm lớp nền Foundation |
| Màu sắc cơ bản | Màu sắc cơ bản trong Makeup |
| Tóc nền tảng | Dụng cụ tóc và bảo vệ tóc · Thực hành sóng & tạo độ phồng cơ bản |
| Before/After #1, #2, #3 | Nộp 3 bài nền cơ bản có Before/After (3 mission dùng chung 1 tài liệu thật — không có 3 tài liệu riêng biệt trong curriculum) |
| Hoàn thiện hồ sơ Stage 1 | Business & Skill Check-up Giai đoạn 1 |

## 4. Quyết định cần bạn biết (không tự ý giấu)

1. **`assignment_definitions` rỗng trong tổ chức** (xác nhận bằng truy vấn thật trước khi làm). Vì vậy 3 tài liệu loại "assignment" của module 25 (`s1-a1/s1-a2/s1-a3`) là `curriculum_documents`, không phải hàng thật trong `assignment_definitions` — gắn qua **resource binding** (đúng loại dữ liệu thật của chúng), không gắn qua **assignment binding** (sẽ sai vì trỏ nhầm bảng).
2. **Không có nguồn "Tool" thật nào trong repo** để gắn `learning_mission_tool_bindings` — không có bảng `tools` với id thật; catalog công thức của tab CREATE (`lib/student/create-outcome.ts`) chỉ có `slug` string tĩnh, không phải UUID thật. Không tạo bảng giả chỉ để có gì đó gắn vào — bỏ trống, đúng nguyên tắc "không tạo duplicate content".
3. **completion_policy đổi tên** — đề bài dùng `self_complete/evidence_required/teacher_verify/result_required`, nhưng schema (migration 0050, viết từ bản đặc tả gốc trước đề bài Release B này) dùng `self_reported/evidence_required/teacher_verified/metric_based`. Đã map: `self_complete→self_reported`, `teacher_verify→teacher_verified`, `result_required→teacher_verified` (mission tổng kết giai đoạn về bản chất là 1 lượt review, khớp đúng ý nghĩa `teacher_verified`).
4. **3 chế độ xem (Map/Roadmap/Danh sách) đơn giản hóa** — "Danh sách" là accordion đầy đủ; "Roadmap"/"Map" dùng chung 1 bộ dữ liệu, chỉ đổi layout (dải ngang) chứ không phải 3 cách hiển thị hoàn toàn độc lập. Nói rõ ở đây, không âm thầm trình bày như 3 tính năng riêng.
5. **Bug thật sửa trong lúc làm** (trước khi ghi dữ liệu): `preflightVersion` kiểm tra mọi resource binding vào bảng `career_stage_resources`, nhưng binding loại `document` trỏ vào `curriculum_documents` — nếu không sửa, cả 20 binding thật sẽ báo "gãy" sai. Đã sửa kiểm tra đúng theo `resource_type`.
6. **Lỗ hổng bảo mật tự phát hiện và tự sửa trước khi deploy**: `submitEvidence`/`completeSelfReportedMission` ban đầu nhận `completion_policy` từ phía client — một học viên có thể tự khai "evidence_required" cho mission thực chất là "teacher_verified" (vd. Before/After) để tự xác nhận, bỏ qua bước giáo viên duyệt. Đã sửa: tra `completion_policy` thật từ DB, không tin dữ liệu client gửi lên.

## 5. Route / Schema thay đổi

**Route giữ nguyên, đổi nội dung:** `/student/courses` (nay là Journey Map, "Khóa học của tôi" cũ chuyển xuống mục "Khóa học bổ trợ").
**Route mới:** `/api/student/journey`, `/api/student/journey/mission`, `/api/student/journey/action`, `/api/student/journey/evidence`, `/api/student/journey/actions`, `/api/academy-admin/learn-outcome/verify`.
**Migration mới:** `0051_h2obook_learn_outcome_mission_evidence.sql` — 3 cột trên `student_mission_states` (`evidence`, `evidence_submitted_at`, `verified_by`) + 1 policy RLS cho giáo viên xác nhận. **⚠ CẦN BẠN CHẠY** — chưa chạy tại thời điểm viết báo cáo này.

## 6. Kết quả 16 test bắt buộc

| # | Test | Kết quả |
|---|---|---|
| 1 | Student Stage 1 nhìn thấy Journey Map | ✅ Xác nhận qua dữ liệu thật: blueprint đã publish, `getPublishedJourneyForStage` trả về đúng 4 outcome/14 mission. **Chưa xác nhận bằng trình duyệt thật** (xem NOT VERIFIED). |
| 2 | Có đúng 4 Outcome | ✅ Xác nhận bằng truy vấn thật. |
| 3 | Mission prerequisite đúng | ✅ Đã gắn chuỗi tuần tự 14 mission, kiểm tra circular = 0. Test thật trên tài khoản học viên "Max Crypto": Mission 2 hiện `locked` khi Mission 1 chưa `result_achieved`; sau khi đánh dấu Mission 1 `result_achieved`, Mission 2 chuyển `available`. Đã dọn sạch dữ liệu test sau khi xong. |
| 4 | Click Mission mở Drawer | ⚠️ Code đã viết đúng (`components/student/journey-map.tsx`), **chưa xác nhận bằng trình duyệt thật**. |
| 5 | Resource title thật | ✅ Xác nhận: `getJourneyForStudent` resolve title thật từ `curriculum_documents`/`career_stage_resources`, không rơi về UUID. |
| 6 | Start Mission tạo action thật | ✅ Test thật: start Mission 1 tạo đúng 1 action row khớp 1 action template. |
| 7 | Refresh không duplicate action | ✅ Test thật: gọi lại insert lần 2 → lỗi `23505 unique_violation` đúng như thiết kế, không tạo dòng thứ hai. |
| 8 | Tab 4 thấy action vừa tạo | ✅ `JourneyActionsSection` đọc đúng bảng `student_learning_actions` — đã xác nhận qua route `/api/student/journey/actions`. **Chưa xác nhận bằng trình duyệt thật**. |
| 9 | Submit Evidence cập nhật Mission | ⛔ **CHƯA TEST ĐƯỢC** — cần migration 0051 (cột `evidence`) chưa chạy tại thời điểm này. |
| 10 | Teacher verify cập nhật state | ⛔ **CHƯA TEST ĐƯỢC** — cùng lý do #9. |
| 11 | Mission completed cập nhật Journey progress | ✅ Test thật: sau khi Mission 1 → `result_achieved`, `progressPercent` tính đúng theo `achievedMissionIds.size / missions.length`. |
| 12 | Locked Mission không bypass bằng URL | ✅ Đúng theo thiết kế: mọi state-changing action (`startMission`, `submitEvidence`, `completeSelfReportedMission`) đọc `organizationId` từ session server-side, không tin client; `displayStateFor` tính lại từ dữ liệu thật mỗi lần tải, không lưu trạng thái "unlocked" phía client. **Chưa test bằng tấn công URL thật trên trình duyệt**. |
| 13 | Student Stage khác không đọc Stage 1 Journey trái quyền | ✅ Đúng theo thiết kế: RLS + `getUnlockedStageIds` (đã sửa ở lượt trước) chỉ trả về giai đoạn thật đã mở khóa; `/api/student/journey` luôn tự chọn giai đoạn hiện tại của đúng học viên đang đăng nhập. **Chưa test chéo 2 tài khoản thật trên trình duyệt**. |
| 14 | Draft Blueprint không visible | ✅ Đúng theo thiết kế: `getPublishedJourneyForStage` chỉ đọc `current_published_version_id`; version draft không bao giờ được trỏ tới cho tới khi Publish. |
| 15 | Publish Blueprint visible | ✅ Test thật: đã Publish v1, `blueprint.current_published_version_id` trỏ đúng vào v1. |
| 16 | Build/typecheck/lint/tests PASS | ✅ typecheck sạch · lint 51 warning (đúng baseline cũ) · 179/179 test · `test:sql` sạch · build thành công. |

## 7. NOT VERIFIED — nói thật, không giấu

- **Chưa có phiên trình duyệt thật** để xác nhận UI (Drawer, 3 chế độ xem, nút bấm) hoạt động đúng như khi bạn tự click. Mọi xác nhận ở trên là qua truy vấn/ghi dữ liệu trực tiếp mô phỏng đúng logic — không phải qua giao diện.
- **Test #9, #10 (Evidence, Teacher verify)** chặn bởi migration 0051 chưa chạy.
- **Test #12, #13** (bypass URL, cross-org) xác nhận bằng đọc code, không phải bằng tấn công thật trên trình duyệt với 2 tài khoản.
- **Milestone**: đề bài không định nghĩa milestone riêng cho từng outcome — mỗi outcome hiện có đúng 1 milestone trùng tên. Nếu bạn muốn milestone chi tiết hơn, cần nói rõ cấu trúc.
- **"Why this matters"** trong Mission Drawer hiện dùng `mission.description` (rỗng cho toàn bộ 14 mission — đề bài không cung cấp nội dung này) — Drawer sẽ ẩn phần này khi trống, không hiện placeholder giả.

## 8. Việc cần bạn làm

1. Chạy `supabase/_RUN-0051-ONLY.sql`.
2. Báo tôi — tôi sẽ test Evidence + Teacher verify thật, cập nhật report này.
3. Tự vào `/student/courses` bằng 1 tài khoản học viên thật để xác nhận UI (tôi không có trình duyệt để tự làm việc này).
