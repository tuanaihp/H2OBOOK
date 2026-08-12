# Stage 1 Learning OS V1 — Final Report

Nguồn: `v5/36-H2OBOOK_STAGE1_LEARNING_OS_V1/`. Audit đầy đủ ở [01_PRODUCTION_AUDIT.md](./01_PRODUCTION_AUDIT.md). Tiêu chí thành công thật (chưa áp dụng) ở [SUCCESS_CRITERIA_READY_TO_APPLY.md](./SUCCESS_CRITERIA_READY_TO_APPLY.md).

## Quyết định phạm vi (đã hỏi và được xác nhận)

Blueprint gói nguồn mô tả 1 cấu trúc 4 Outcome/13 Mission (Career Map/Style DNA/Brand/Skill Passport/Career Passport/Chứng nhận là các Mission riêng) khác hẳn nội dung Stage 1 thật đang publish — 4 Outcome/14 Mission thật (Hiểu nghề & chọn hướng / Thiết lập nền tảng nghề / Xây kỹ thuật nền / Tạo bằng chứng nghề), 2 học viên thật (Max Crypto, Thùy H2O Makeup) đang học dở. Đã hỏi qua `AskUserQuestion`, người dùng chọn: **giữ nguyên tên/cấu trúc 14 Mission thật, chỉ thêm năng lực mới gắn vào đúng nội dung thật hiện có** — không dựng bản nháp theo blueprint 13 Mission.

## Đã triển khai

1. **Student Journey Passport** (`lib/stage1-learning-os/passport.ts`'s `getStudentJourneyPassport`, route `GET /api/student/passport`) — 1 read-model tổng hợp Identity (`profiles`), Career (đọc block value 3 Mission Outcome 01 qua `student_mission_workspace_values`, chỉ hiện khi Mission đã DONE, fallback về `expected_result` thật của Mission khi chưa có evidence text), Learning (progress% qua `getJourneyForStudent`), Skill (`getSkillMastery()` có sẵn, lọc theo 4 skill key thật), Creative/Brand (`create_outcome_projects`, tách theo `outcome_type='brand_profile'`), Evidence (đếm `student_mission_states.evidence`), Credential (trạng thái locked/eligible/issued qua `certificate_issues`). Không bảng mới cho Passport — thuần aggregate.
2. **Mission Workspace — "Known Context"** (`lib/stage1-learning-os/known-context.ts`, component `MissionKnownContext`) — với mỗi Mission, đọc các Mission trước đó trong cùng Milestone đã DONE, hiện lại dữ liệu học viên đã nhập (không bắt nhập lại). Đọc trực tiếp `student_mission_workspace_values`, không bảng mới.
3. **Mission Workspace — "Output Reuse"** (`lib/stage1-learning-os/output-reuse.ts`, component `MissionOutputFlow`) — bảng tĩnh `OUTPUT_DESTINATIONS` khoá đúng theo 14 tên Mission thật, cho biết kết quả Mission này sẽ dùng ở đâu (Hồ sơ/Thư viện/Create/Chứng nhận). Trả mảng rỗng cho Mission không có đích thật, không tự bịa.
4. **Daily Practice Journal** (`lib/stage1-learning-os/daily-practice.ts`, route `/api/student/practice`, component `DailyPracticeLogger`, gắn vào Mission "Xác định mục tiêu 90 ngày") — reuse `learner_notes` (đã tổng quát hoá ở migration 0053 để nhận `mission_id`), chỉ thêm 1 cột thật thiếu: `asset_ids uuid[]`. Ghi qua session học viên thật (không admin client) — RLS tự chặn cross-student. UI hiện tại chỉ có ghi chú văn bản + tag; upload ảnh/video và teacher-review **chưa xây, ghi rõ là gap hoãn** (xem "Chưa xây / gap còn lại").
5. **Skill Passport wiring** (`lib/stage1-learning-os/skill-evidence.ts`) — `getSkillMastery()` đã có sẵn và tính mastery% thật từ `learning_skill_evidence`, chỉ thiếu người ghi. Gắn `recordStage1SkillEvidence()` vào đúng 1 chốt chặn dùng chung `maybeMarkResultAchieved()` (`lib/learn-outcome/student.ts`) — nơi cả 3 luồng hoàn thành Mission (tự báo cáo, nộp evidence được duyệt, giáo viên xác nhận) đều đi qua. Map đúng 4 Mission kỹ thuật thật → skill key thật (`skin`/`face`/`waves`) đã có trong catalog `lib/student/experience.ts`, không bịa skill mới. Điểm số theo `completion_policy` thật của Mission (teacher_verified=100, evidence_required=82, self_reported/metric_based=62) — phản ánh đúng mức được kiểm chứng, không phải số áp đặt.
6. **Credential issuance** (`lib/stage1-learning-os/credential.ts`, route `/api/academy-admin/stage1-credential`, "Bước 3" trong `/academy-admin/distribution`) — dùng thẳng bảng thật `certificate_issues` (0025, trước đây có nhưng không ai ghi). `checkStage1Eligibility` yêu cầu đủ 14/14 Mission thật ở trạng thái DONE (server tự tính lại, không tin tham số client). Issuance chỉ do Admin bấm ở trang phân phối — học viên không tự cấp cho mình (đúng RLS gốc của 0025: không có policy self-insert).
7. **`/verify/[certificateNo]` sửa lỗi thật** — trước đây đọc `seedCertificates` giả (`lib/operations/data.ts`); nay đọc `certificate_issues` thật qua `lookupPublicCertificate()` (chỉ trả 6 trường an toàn công khai theo đúng comment RLS của migration 0025).
8. **Feature flags**: `NEXT_PUBLIC_STAGE1_LEARNING_OS_V1`, `..._KNOWN_CONTEXT`, `..._OUTPUT_REUSE`, `..._DAILY_PRACTICE`, `..._SKILL_PASSPORT`, `..._CREDENTIAL_WALLET` (`lib/stage1-learning-os/feature-flags.ts`, mặc định bật, tắt qua env var).

## Không tạo source-of-truth mới

Xác nhận: **1 migration duy nhất** (`0055_h2obook_stage1_learning_os_v1.sql`) — `alter table learner_notes add column if not exists asset_ids uuid[] not null default '{}'`. Không tạo `stage1_outcomes_v2`/`stage1_missions_v2`/`student_progress_v2`/`media_assets`/unlock engine mới/assignment system mới/certificate system mới. Toàn bộ còn lại đọc/ghi qua bảng đã có: `profiles`, `student_mission_workspace_values`, `student_mission_states`, `learning_skill_evidence`, `academy_skill_progress`, `create_outcome_projects`, `certificate_issues`, `learner_notes`, `learning_journey_missions`.

## Ánh xạ Outcome/Mission thật ↔ khái niệm blueprint

| Outcome thật | Mission thật | Khái niệm blueprint tương ứng |
|---|---|---|
| 01 Hiểu nghề & chọn hướng | Xác định hướng nghề Makeup | Career Direction Profile |
| | Hoàn thành Career Map | Career Map |
| | Xác định mục tiêu 90 ngày | 90-Day Plan + Daily Practice |
| 02 Thiết lập nền tảng nghề | Chuẩn hóa túi đồ nghề / Hoàn thành tiêu chuẩn vệ sinh | (không có tương đương blueprint — giữ nguyên) |
| | Setup hồ sơ nghề Makeup | Professional Profile |
| 03 Xây kỹ thuật nền | Chuẩn bị da đúng / Hoàn thiện lớp nền | Skill: `skin` |
| | Màu sắc cơ bản | Skill: `face` |
| | Tóc nền tảng | Skill: `waves` |
| 04 Tạo bằng chứng nghề | Before/After #1/#2/#3 | Portfolio Evidence |
| | Hoàn thiện hồ sơ Stage 1 | Career Passport / eligibility Chứng nhận |

"Style DNA", "Brand Mission riêng", "Skill Passport & Practice Lab riêng", "Đánh giá cuối khóa riêng", "Chứng nhận hoàn thành riêng" trong blueprint không có Mission tương đương thật — xử lý như **năng lực Passport-level** (mục 1-6 ở trên), không tạo Mission giả để khớp blueprint.

## Gap thật tìm thấy khi audit (ngoài phạm vi gói nguồn yêu cầu)

Toàn bộ 14 Mission thật đang publish có `success_criteria = []` — học viên thật đang thấy "Chưa có tiêu chí thành công cho mission này." Đã soạn tiêu chí thật, cụ thể theo từng Mission trong [SUCCESS_CRITERIA_READY_TO_APPLY.md](./SUCCESS_CRITERIA_READY_TO_APPLY.md) — **chưa áp dụng vào Published** (đúng nguyên tắc bất biến version). Admin cần tự áp dụng qua "Nhân bản phiên bản này" (Journey Admin Builder, đã xây ở folder 33/35) rồi Publish khi sẵn sàng. Cân nhắc và loại bỏ phương án tự viết REST clone thủ công để ghi thẳng vào 1 Draft mới — rủi ro cao hơn dùng lại đường publish đã kiểm thử.

## AI boundaries

V1 này không tích hợp AI provider nào — toàn bộ năng lực hoạt động đầy đủ không cần AI (đúng nguyên tắc "AI off core vẫn chạy"). Nếu AI được bật ở phase sau: chỉ tóm tắt/gợi ý, không tự cấp certificate, không thay điểm giáo viên, không mutate canonical result.

## Validate

`typecheck` ✅ · `lint` ✅ (0 error, 0 warning mới) · `test` ✅ (5 test mới cho `generateCertificateNo` + `getMissionOutputDestinations`, tách riêng khỏi file `credential.ts`/`mastery.ts` có `server-only` — không import được trong Vitest, đúng giới hạn đã gặp từ folder 34) · `test:sql` ✅ · `build` ✅. Merge vào `main`, push, deploy `npx vercel --prod --yes`, health check 6 route trả mã kỳ vọng (không lỗi 500).

## Migration production

`supabase/_RUN-0055-ONLY.sql` — người dùng đã tự chạy trên Supabase SQL Editor và xác nhận ("đã chạy 0055 thành công"), được xác minh độc lập lại qua curl (`learner_notes.asset_ids` trả `[]` thay vì lỗi 42703 cột không tồn tại) trước khi merge/deploy code phụ thuộc cột này.

## Rollback

`alter table public.learner_notes drop column if exists asset_ids;` (comment sẵn trong migration 0055). Code phía app: revert commit, không cần thao tác dữ liệu thêm — `certificate_issues`/`learning_skill_evidence`/`create_outcome_projects` đều là bảng đã tồn tại từ trước, không có dữ liệu mới bắt buộc phải dọn khi rollback (dữ liệu ghi thêm là hàng thật hợp lệ, không phải dữ liệu test).

## Kiểm chứng bằng dữ liệu thật

- `student_mission_states` (blueprint version thật `867f149d-...`): cả 2 học viên thật chỉ có 2/14 dòng trạng thái Mission (1 `result_achieved`, 1 `doing`) → `checkStage1Eligibility` đúng ra "chưa đủ điều kiện" (không false-positive cấp chứng nhận sớm).
- Mission "Xác định hướng nghề Makeup" (`career.direction` trong Passport): evidence rỗng cho cả 2 học viên dù đã `result_achieved` → xác nhận Passport fallback đúng về `expected_result` thật của Mission, không hiện giá trị rỗng/giả.
- Đối chiếu 14 tên Mission thật (qua REST, vòng qua lỗi encode tiếng Việt của `curl --data-urlencode` bằng cách lọc lại qua Python cục bộ) — 4 khoá trong `STAGE1_MISSION_SKILL_MAP` khớp chính xác tên thật; xác nhận `completion_policy` thật của "Hoàn thiện lớp nền" là `teacher_verified`.
- Ghi thử — xoá ngay — xác nhận 0 dòng còn lại cho cả 2 cơ chế ghi mới, dùng ID học viên/Mission thật:
  - `learning_skill_evidence` (skill Passport): insert 1 dòng đúng khuôn `upsert` của `recordStage1SkillEvidence`, xác nhận ghi thành công, xoá, SELECT lại trả `[]`.
  - `learner_notes` (Daily Practice): insert 1 dòng đúng khuôn `saveDailyPracticeEntry` (kèm `mission_id`/`resource_type`/`asset_ids`), xác nhận ghi thành công đúng schema, xoá, SELECT lại trả `[]`.
- **Chưa test qua giao diện với 1 tài khoản học viên thật đăng nhập trực tiếp** (không có phiên đăng nhập thật để mô phỏng qua curl, giống mọi folder trước trong phiên này) — verification dựa trên đối chiếu logic + dữ liệu thật production, không phải click-through UI thật.

## Chưa xây / gap còn lại (ghi rõ, không giấu)

- Daily Practice: chưa có UI upload ảnh/video (`asset_ids` đã có cột nhưng chưa có form upload), chưa có cột/luồng "teacher review" (spec ghi rõ đây là tuỳ chọn "nếu có", không bắt buộc).
- Tiêu chí thành công thật cho 14 Mission đã soạn nhưng chưa được Admin áp dụng vào bản Published.
- Không claim production hoàn chỉnh trước khi có 1 lượt kiểm thử thật bằng tài khoản học viên Stage 1 (Max Crypto hoặc Thùy H2O Makeup) đăng nhập trực tiếp, xác nhận cả 5 năng lực (Passport ở `/student/profile`, Known Context + Output Reuse trong Mission Workspace, Daily Practice logger, Skill Passport hiện đúng mastery%) hiển thị đúng trên giao diện thật.
