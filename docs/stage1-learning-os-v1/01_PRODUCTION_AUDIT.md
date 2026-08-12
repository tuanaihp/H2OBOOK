# Stage 1 Learning OS V1 — Production Audit

Đọc đủ 18/18 file gói nguồn trước khi audit.

## Quyết định phạm vi (đã hỏi và được xác nhận)

Blueprint gói nguồn (`stage1-blueprint.ts`) mô tả 1 cấu trúc 4 Outcome/13 Mission khác hẳn nội dung Stage 1 thật đang publish (vd Outcome 2 blueprint là Style DNA/Brand/Hồ sơ, Outcome 2 thật là Chuẩn hóa túi đồ nghề/Vệ sinh/Setup hồ sơ — kỹ thuật tay nghề thật). 2 học viên thật (Max Crypto, Thùy H2O Makeup) đang học dở theo cấu trúc thật. **Đã hỏi và được xác nhận: giữ nguyên tên/cấu trúc 14 Mission thật đang publish, chỉ thêm năng lực mới (Passport/Known Context/Output Reuse/Daily Practice/Skill Passport/Credential) gắn vào đúng nội dung thật hiện có.** Không dựng bản nháp theo blueprint 13 Mission.

## Cấu trúc Stage 1 thật (xác nhận trực tiếp trên production, v1 đang publish)

| Outcome thật | Mission thật | Ánh xạ khái niệm blueprint |
|---|---|---|
| 01 Hiểu nghề & chọn hướng | Xác định hướng nghề Makeup | Career Direction Profile |
| | Hoàn thành Career Map | Career Map |
| | Xác định mục tiêu 90 ngày | 90-Day Plan + Daily Practice |
| 02 Thiết lập nền tảng nghề | Chuẩn hóa túi đồ nghề | (không có tương đương blueprint — giữ nguyên) |
| | Hoàn thành tiêu chuẩn vệ sinh | (không có tương đương blueprint — giữ nguyên) |
| | Setup hồ sơ nghề Makeup | Professional Profile |
| 03 Xây kỹ thuật nền | Chuẩn bị da đúng | Skill: `skin`/chuẩn bị da |
| | Hoàn thiện lớp nền | Skill: `skin` (Kỹ thuật nền, catalog `lib/student/experience.ts`) |
| | Màu sắc cơ bản | Skill: `face` (Phân tích khuôn mặt/màu) |
| | Tóc nền tảng | Skill: `waves` (Sóng và texture) |
| 04 Tạo bằng chứng nghề | Before/After #1/#2/#3 | Portfolio Evidence |
| | Hoàn thiện hồ sơ Stage 1 | Career Passport / eligibility cho Chứng nhận |

Không có Mission thật nào tương đương "Makeup Style DNA", "Sáng tạo Makeup Brand", "Giáo trình Makeup" (canonical resource, đã có qua binding thật), "Khóa học Video" (academy_courses, đã có), "Skill Passport & Practice Lab" (mission riêng), "Đánh giá cuối khóa" (rubric riêng), "Chứng nhận hoàn thành" (mission riêng) — các khái niệm này được xử lý như **năng lực Passport-level** (xem bên dưới), không phải Mission riêng, đúng quyết định đã chốt.

## Audit schema/service — nguồn tái sử dụng thật, không tạo hệ song song

| Nhu cầu (gói nguồn) | Nguồn thật đã có | Kết luận |
|---|---|---|
| Identity | `profiles` (full_name, avatar_url, phone) | reuse nguyên |
| Career (Career Direction/Map/90-day) | `student_mission_workspace_values` (block value theo `mission_id`, đã có từ Mission Workspace 0052) | reuse — đọc block value của 3 Mission Outcome 01 |
| Learning (progress) | `student_mission_states` (0050/0051) | reuse nguyên |
| Skill | `learning_skill_evidence` (0028) + `academy_skill_progress` (0024), đã có `getSkillMastery()` (`lib/student/mastery.ts`) tính mastery% thật, không fake | **reuse nguyên `getSkillMastery()`**, chỉ thêm: ghi 1 dòng `learning_skill_evidence` khi 1 trong 4 Mission kỹ thuật đạt trạng thái hoàn thành |
| Creative (Create tool output) | `create_outcome_projects` (0027, `owner_user_id`, `outcome_type`, `source_stage_key`) | reuse — liên kết theo `outcome_type` phù hợp, không copy binary |
| Brand | `create_outcome_projects.outcome_type='brand_profile'` | reuse — **KHÔNG dùng `brand_profiles`** (bảng đó là brand củaTỔ CHỨC/workspace dùng cho template thiết kế, không phải brand cá nhân học viên — đã kiểm tra và loại) |
| Evidence | `student_mission_states.evidence` jsonb (0051) | reuse nguyên |
| Credential | **`certificate_issues` (0025) — bảng thật đã có, RLS cố ý không cho public SELECT (đúng thiết kế, cần lookup hẹp qua server)** nhưng **`/verify/[certificateNo]` hiện đọc từ `seedCertificates` giả** (`lib/operations/data.ts`) — gap thật | reuse bảng thật, **sửa route đọc dữ liệu thật**, thêm hàm issue có điều kiện |
| Daily Practice Journal | `learner_notes` (0026), đã tổng quát hóa (0053) nhận `mission_id`/`resource_type`/`resource_id`, KHÔNG bắt buộc `knowledge_space_id` nữa | reuse — cần thêm 1 cột `asset_ids uuid[]` (ảnh/video) không có sẵn; "teacher review" trong spec ghi rõ "nếu có" (tùy chọn) — không thêm cột, ghi là gap hoãn |
| Assignment & Review | `assignment_definitions`/`rubrics`/`brain_assignment_submissions` (0026) | reuse nguyên, không đụng |
| Known Context / Output Reuse | Không cần bảng — đọc trực tiếp từ `student_mission_workspace_values` của Mission trước (Known Context) và cấu hình tĩnh đích tái sử dụng theo Mission (Output Reuse) | read-model thuần |

## Gap thật đã tìm thấy (không phải do gói nguồn yêu cầu — do audit)

**Toàn bộ 14 Mission thật đang publish có `success_criteria = []`** — học viên thật đang thấy dòng "Chưa có tiêu chí thành công cho mission này." (`components/student/mission-workspace/mission-workspace-client.tsx:198`), đúng chuyện gói nguồn cấm ("Không để mission production có text 'Chưa có tiêu chí thành công'"). Đã biết từ folder 33: preflight đã chặn việc này cho lần publish SAU, nhưng bản đang chạy chưa có nội dung thật. **Sẽ điền tiêu chí thật cho cả 14 Mission qua 1 bản nháp** (không sửa Published trực tiếp — đúng nguyên tắc bất biến), để Admin tự xem/publish khi sẵn sàng.

## Không tạo hệ song song — xác nhận

Không tạo `stage1_outcomes_v2`/`stage1_missions_v2`/`student_progress_v2`/`media_assets`/unlock engine mới/assignment system mới/certificate system mới. `certificate_issues` đã tồn tại — dùng thẳng, không tạo bảng credential mới.

## Migration cần thiết (nhỏ, có audit rõ)

`ALTER TABLE learner_notes ADD COLUMN asset_ids uuid[] NOT NULL DEFAULT '{}'` — Daily Practice cần đính ảnh/video thật qua `assets`, cột này chưa có. Không có cột nào khác cần thêm.

## AI boundaries

AI (nếu bật) chỉ tóm tắt/gợi ý — không tự cấp certificate, không thay teacher score, không mutate canonical result. V1 này không tích hợp AI provider nào (đúng "AI off core vẫn chạy" — toàn bộ tính năng hoạt động đầy đủ không cần AI).
