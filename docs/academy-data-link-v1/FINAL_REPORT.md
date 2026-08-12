# Academy Data Link V1 — Final Report

Route: `/academy-admin/data-link`. Nguồn: `v5/34-H2OBOOK_ACADEMY_DATA_LINK_V1/`. Audit đầy đủ ở [01_PRODUCTION_AUDIT.md](./01_PRODUCTION_AUDIT.md).

## Đã triển khai

1. **Data Link Overview** (`lib/academy-data-link/service.ts`'s `getStageLinkHealth`) — Program/Module/Group count, Curriculum resource count, Journey version count, published Journey, Mission count, Mission có học liệu, Mission thiếu Tiêu chí đạt, broken resource binding (batched theo bảng, không N+1), student surface error, Data Link Health score (trung bình 6 chỉ số: cấu trúc/journey/binding coverage/integrity/success criteria/context integrity). Tất cả tính lúc đọc, không lưu điểm riêng — cùng triết lý với `lib/academy-control/health.ts` (Stage Health cũ, khác phạm vi: chỉ Curriculum, không nối sang Journey/Student).
2. **Setup Guide 10 bước** (`getSetupGuideState`) — mỗi bước tính từ dữ liệu thật (Stage/nodes/resources/blueprint/outcomes/missions/preflight/domain_events/published version/Stage Context check), có CTA thật (deep-link `?stageId=`/`?missionId=` vào đúng Stage/Mission ở `/academy-admin/stages` và `/academy-admin/journey`), không dùng checkbox tay.
3. **Resource Data Link Inspector + Mission Resource Origin** (`getResourceDataLink`) — Curriculum placement (Stage → Program → Module → Group), Mission usages (Nhiệm vụ nào dùng, role, Draft/Published), student surfaces (đọc thẳng `career_stage_resources.display_locations`/`access`, không tự suy diễn lại). Chọn học liệu từ dropdown thật của Stage, không nhập UUID tay.
4. **Stage Context Validator** (`listStudentStageContextChecks` + `logStageContextMismatches`) — đối chiếu Stage được gán (unlock resolver, batched cho toàn bộ học viên — không N+1) với Stage của Mission học viên chạm gần nhất (`student_mission_states.updated_at`). Đọc và ghi domain_event tách riêng (đọc dùng cho Health/Guide, ghi chỉ khi Admin bấm "Kiểm tra"/"Ghi nhận cảnh báo" ở trang Data Link).
5. **Fix P1 Stage badge** — xem mục riêng bên dưới, bao gồm 1 lần sửa sai và tự sửa lại sau khi kiểm tra dữ liệu thật.
6. **Reframe "Giao diện học viên"** (`ExperienceTab`, `app/academy-admin/stages/[stageId]/page.tsx`) — bỏ hẳn ô nhập `key` tự do và nút "+Thêm mục" (trước đó dựng sidebar tùy ý, chưa từng nối vào sidebar học viên thật). Giờ chỉ cấu hình đúng 3 khu vực thật: Thư viện/Hành trình/Smart Home — mỗi khu vực có Hiện, Cho xem thử, Khóa quyền truy cập, Nổi bật. Vẫn ghi vào đúng bảng `academy_stage_ui_config` cũ (không tạo bảng mới), chỉ đổi khuôn dữ liệu.
7. **Inline Guide** — `CurriculumInlineGuide` trong tab Cấu trúc & nội dung của Stage Workspace, `JourneyInlineGuide` trong Journey Admin Builder.
8. **Feature flags**: `NEXT_PUBLIC_ACADEMY_DATA_LINK_V1`, `NEXT_PUBLIC_ACADEMY_SETUP_GUIDE_V1`, `NEXT_PUBLIC_ACADEMY_RESOURCE_USAGE_V1`, `NEXT_PUBLIC_STUDENT_STAGE_CONTEXT_VALIDATOR_V1` (mặc định bật, tắt qua env var).

## Không tạo source-of-truth mới

Xác nhận: không có bảng mới nào được tạo (không migration nào cho folder này). Toàn bộ đọc/ghi đều qua các bảng/service đã có: `career_stages`, `academy_stage_nodes`, `career_stage_resources`, `content_items`, `curriculum_documents`, `learning_journey_*`, `learning_mission_resource_bindings`, `student_mission_states`, `domain_events`, `academy_stage_ui_config`.

## Lỗi P1: Student Stage badge — sửa sai lần 1, tự phát hiện và sửa đúng lần 2

**Phát hiện gốc (đúng):** Roadmap (`/student/courses`) badge Stage bằng `career_stages.position`; Mission Workspace (`/student/missions/[missionId]`) lại badge bằng `career_stages.index_label` — một trường text admin gõ tay, có thể lệch khỏi `position` (chính UI admin đã có sẵn cảnh báo lệch này). Cùng một học viên có thể thấy 2 số Giai đoạn khác nhau ở 2 màn.

**Sửa lần 1 (sai):** đổi Mission Workspace + `/student/library` sang dùng thẳng `career_stages.position + 1`, nghĩ vậy là khớp với Roadmap. Đã merge, deploy, health check bình thường (không lỗi 500) — nhưng **chưa kiểm tra bằng dữ liệu thật trước khi báo hoàn thành.**

**Tự phát hiện sai (sau khi deploy):** khi chạy bước "kiểm chứng dữ liệu thật" theo đúng quy trình bắt buộc của phiên làm việc, truy vấn trực tiếp `career_stages` production mới thấy: 6 Stage thật đang publish nằm ở `position = 5..10`, KHÔNG phải `0..5` — vì 6 Stage nháp/test cũ hơn (đã lưu trữ) chiếm `position 0..4` trước đó. `.position` là bộ đếm thô toàn cục, không reset khi Stage bị lưu trữ. Nếu giữ nguyên cách sửa lần 1, Stage đầu tiên học viên thật đang học sẽ hiện "Giai đoạn 06" thay vì "01" đúng ý admin — vẫn sai, chỉ đổi kiểu sai. Roadmap cũng mắc lỗi tương tự (dù báo cáo audit ban đầu ghi nhầm là "không có lỗi").

**Sửa lần 2 (đúng, đã xác nhận bằng dữ liệu thật):** thêm `stageDisplayRank()` (`lib/career-stages/types.ts`, có unit test) — số 1-based tính theo **thứ hạng của Stage trong danh sách Stage đang active** (không phải giá trị `.position` thô). Áp dụng thống nhất ở Roadmap, Mission Workspace, `/student/library`, và toàn bộ "Giai đoạn X" hiển thị trong trang Data Link mới. Xác nhận trực tiếp trên production: `stageDisplayRank` cho ra đúng 01→06, khớp 100% với `index_label` admin đã đặt cho cả 6 Stage thật.

## Validate

`typecheck` ✅ · `lint` ✅ (0 error, 0 warning mới) · `test` ✅ (185/185, bao gồm test mới cho `stageDisplayRank` và `assertStageContextConsistency`) · `test:sql` ✅ (19 bảng, không migration nào) · `build` ✅. Merge vào `main`, push, deploy `npx vercel --prod --yes`, health check: mọi route cũ/mới trả `307` (redirect đăng nhập bình thường), không có lỗi 500.

## Kiểm chứng bằng dữ liệu thật

- Xác nhận trực tiếp qua Supabase REST (service role) rằng `stageDisplayRank` tính đúng cho cả 6 Stage thật đang publish, khớp `index_label`.
- Chưa test qua giao diện với 1 tài khoản học viên thật đăng nhập trực tiếp (không có phiên đăng nhập thật để mô phỏng qua curl) — verification dựa trên đối chiếu logic + dữ liệu thật, cùng cách đã dùng xuyên suốt phiên làm việc này khi không có session thật. Khuyến nghị: đăng nhập bằng 1 tài khoản học viên thật (ví dụ Max Crypto hoặc Thùy H2O Makeup) và xác nhận Roadmap + Mission Workspace + Thư viện đều hiện cùng một số Giai đoạn.
