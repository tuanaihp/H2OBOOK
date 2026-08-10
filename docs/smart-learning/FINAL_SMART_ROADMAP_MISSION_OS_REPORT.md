# Smart Roadmap + Universal Mission OS — Release 1 & 2 Report

Ngày: 2026-08-10
Phạm vi: **Release 1 + Release 2** (nền dữ liệu, Admin cấu hình block, và giờ đã có route học viên thực sự làm Mission). Release 3–4 chưa làm — xem lý do ở mục 5.

## 1. Hệ thống tái sử dụng

`learning_journey_*` (0050), `student_mission_states` (+evidence, 0051), `student_learning_actions`, entitlement/access resolver, `assignment_definitions`/`rubric_criteria`/`criterion_scores` (0026/0036), `domain_events` trigger có sẵn — không đụng, không tạo bản sao.

## 2. Schema mới — vì sao không tránh được

Đã audit kỹ `learning_blocks` (0026) trước khi quyết định — hệ thống block thật, gần giống, nhưng thuộc domain Knowledge Space (`knowledge_space_versions`), không phải Journey. Chi tiết đầy đủ trong `docs/smart-learning/01_PRODUCTION_AUDIT.md`.

Migration 0052 — 2 bảng:
- `learning_mission_workspace_configs` — 1 dòng/(journey_version_id, mission_id), `blocks jsonb`.
- `student_mission_workspace_values` — 1 dòng/(student, version, mission, block_id).

## 3. Đã xây (Release 1)

- **27 loại block** đúng registry gói nguồn, đặt tên khớp từ vựng `learning_block_type` ở chỗ trùng khái niệm.
- **Admin Mission Workspace Builder** — tích hợp thẳng vào Mission Inspector đã có ở `/academy-admin/journey` (không tạo app admin riêng, đúng §8): thêm/xóa/sắp xếp lại block, đánh dấu bắt buộc, gắn canonical binding (resource/tool/assignment) bằng cách chọn từ binding **đã có sẵn của chính Mission đó** — không cho phép gõ tay UUID.
- **Chỉ sửa được khi version đang Draft** — publish rồi thì khóa, đúng nguyên tắc versioning đã dùng xuyên suốt từ Release A.
- **Clone Version giờ copy luôn Workspace config** — sửa `duplicateVersion()` (trước đây chỉ copy Outcome/Milestone/Mission/binding, sẽ làm mất toàn bộ block đã cấu hình khi Admin bấm "Nhân bản phiên bản").
- **Preflight mở rộng** — block id trùng lặp (blocker), block tham chiếu canonical (resource/tool/assignment) chưa gắn binding (blocker), Mission chưa có Workspace config nào (warning).

## 4. Đã xây (Release 2) — học viên giờ đã thấy thay đổi thật

- **Route mới `/student/missions/[missionId]`** — "Universal Mission Workspace", bố cục 3 cột đúng UX Contract: trái = Journey Context (Giai đoạn/Outcome/Milestone, thanh tiến độ hành trình), giữa = Workspace 4 tab, phải = H2O Mission AI (placeholder, xem mục 7).
- **4 tab trung tâm**: *Hiểu nhiệm vụ* (expected result, lý do, tài liệu/công cụ cần, các bước, success criteria, nút Start Mission) · *Làm việc* (checklist hành động tương tác + toàn bộ block Admin đã cấu hình, autosave debounce 800ms) · *Evidence* (tái dùng nguyên `submitEvidence`/`/api/student/journey/evidence` đã có từ Release B, không tạo luồng nộp bằng chứng thứ hai) · *Kết quả* (Result summary thật: trạng thái, số hành động bắt buộc đã xong, số lần nộp evidence, ngày xác nhận/hoàn thành — không phải placeholder).
- **Renderer cho cả 27 loại block**: input trực tiếp (text/textarea/number/select/multi_select/checkbox/date/checklist/table/kpi/action_plan/kanban/calculator/file/image/video/link), block tham chiếu canonical (resource/tool) hiển thị đọc từ binding thật của Mission, block `evidence`/`result_*` điều hướng sang tab tương ứng thay vì tạo luồng dữ liệu song song, block AI (`ai_question`/`ai_analysis`) hiện đúng thông báo bắt buộc theo đặc tả: "H2O Mentor tạm thời không khả dụng".
- **Readiness xác định (deterministic)** — công thức điều chỉnh từ trọng số gốc gói nguồn (inputs 35 / actions 30 / criteria 25 / evidence 10) thành **inputs 40 / actions 40 / evidence 20**, bỏ thành phần "criteria" vì `success_criteria` trong schema chỉ là mảng text, không có trạng thái hoàn thành từng mục để chấm điểm — success criteria vẫn hiển thị cho học viên đọc, chỉ không tính điểm. AI không có quyền quyết định điểm này (đúng §9 gói nguồn).
- **Bấm Mission trên Roadmap giờ mở thẳng Workspace** thay vì drawer trượt cũ — drawer cũ đã bị xóa (không dùng feature flag; lịch sử git là đường lùi nếu cần, giống mọi release trước trong dự án này).
- **Vá lỗ hổng thật của Release 1**: Admin Builder trước đó cho phép thêm block `select/checklist/table/kpi/kanban/calculator` nhưng KHÔNG có ô nhập danh sách lựa chọn/cột/chỉ số — học viên sẽ luôn thấy các block này rỗng. Đã thêm ô nhập (`options.items`, mỗi dòng một mục) và ô nội dung ghi chú cho block `note` (`options.text`) vào Admin Builder.

### 4b. Dựng lại giao diện đúng visual contract (bổ sung sau khi Owner đối chiếu prototype)

Bản Release 2 đầu tiên đúng **luồng dữ liệu** nhưng giao diện đơn giản hơn hẳn prototype đã duyệt (`prototype/H2OBOOK_SMART_ROADMAP_MISSION_SYNC.html`). Đã dựng lại bám đúng prototype, dùng lại token `--student-*` sẵn có thay vì nhập bảng màu thứ hai:

| Thành phần | Trạng thái |
|---|---|
| 4 thẻ smart strip trên cùng | ✅ Đã có |
| Panel "H2O Journey AI" bên phải Roadmap | ✅ Đã có (nội dung là dữ liệu thật, xem bên dưới) |
| Outcome đánh số 01–04 + đường nối dọc + % từng Outcome | ✅ Đã có |
| Thẻ Mission 3 cột: nhãn trạng thái, mô tả, thanh tiến độ | ✅ Đã có |
| 3 view **khác nhau thật**: Map / Roadmap (timeline) / Danh sách (bảng) | ✅ Đã có |
| Workspace: cột trái liệt kê Mission anh em, chips, ô Expected Result + ô Readiness nền đậm | ✅ Đã có |
| Tab đánh số `01 · 02 · 03 · 04`, gạch chân màu wine | ✅ Đã có |
| "Kiến thức cần dùng" dạng thẻ tài liệu có icon, link thẳng tới trình đọc tài liệu thật | ✅ Đã có |
| Result Card nền gradient | ✅ Đã có |
| Footer dính "● Tự động lưu · Roadmap cập nhật theo thời gian thực" | ✅ Đã có |

**Nguyên tắc: không bịa số.** Mọi con số hiển thị đều suy ra từ dữ liệu thật — tiến độ Outcome/Mission tính từ hành động đã hoàn thành, Readiness dùng đúng công thức xác định ở mục 4, "Dự kiến còn lại" cộng `estimated_days` (hiện **"—"** nếu Admin chưa đặt, không tự đoán), "Roadmap Impact" đọc từ chuỗi prerequisite thật.

**Các ô do AI viết trong prototype thì KHÔNG giả lập** (AI là Release 4): ô "H2O Mentor Insight" đổi nhãn thật thành "Mission hiện tại" và hiện mission đang làm; "Predicted Finish 28/08" đổi thành "Dự kiến còn lại" tính từ thời lượng thật; "Adaptive Path", "Smart Signals", "AI tạo 3 task" thay bằng dữ liệu suy ra thật hoặc đúng thông báo bắt buộc "H2O Mentor tạm thời không khả dụng" theo §16.

## 5. KHÔNG xây trong lượt này — vì sao

| Đợt | Nội dung | Trạng thái |
|---|---|---|
| Release 1 | Schema + Admin block builder (Draft) | ✅ Đã làm |
| Release 2 | Smart Roadmap nâng cấp, route `/student/missions/[missionId]`, Universal Mission Workspace hiển thị cho học viên, readiness/progress | ✅ Đã làm — báo cáo này |
| Release 3 | Result Card đầy đủ (export/chia sẻ, đưa vào Student Achievement/Profile), full 2 chiều Roadmap↔Workspace sync polish | ⛔ Chưa làm |
| Release 4 | H2O Journey AI, H2O Mission AI thật (Release 2 mới chỉ có placeholder "tạm thời không khả dụng"), forecast/predicted finish date | ⛔ Chưa làm |

Ngoài ra, các phần sau được cố ý đơn giản hóa trong Release 2 (không phải làm thiếu sót — đã cân nhắc và ghi rõ):
- **file/image/video**: chưa có upload nhị phân thật (R2/asset pipeline) — học viên dán link tạm thời. Upload thật là việc riêng, không nằm trong §6 gói nguồn (chỉ yêu cầu tái dùng evidence engine có sẵn, không yêu cầu xây upload mới).
- **table/kanban/calculator**: honest fallback đơn giản (bảng nhập tay, cột dạng textarea nhiều dòng, số liệu không có công thức tự động) — không phải spreadsheet/kanban kéo-thả đầy đủ.
- **Header Smart Roadmap**: không thêm "predicted finish date" (thuộc AI, Release 4) và không tính readiness cho toàn bộ Mission trên Roadmap (tránh N+1 theo đúng §14/test #20 — chỉ tính khi mở đúng 1 Mission trong Workspace).
- **Version pinning khi Journey publish version mới**: `getJourneyForStudent` hiện luôn đọc theo version đang published mới nhất, chưa xử lý trường hợp học viên đã pin vào version cũ khi Admin publish version mới hơn — hiện tại chỉ có 1 version published nên chưa xảy ra, nhưng đây là giới hạn thật cần biết trước khi Journey có version thứ 2 được publish.

## 6. Tests (theo đúng §19 gói nguồn)

| # | Test | Kết quả |
|---|---|---|
| 1 | Student sees assigned published Journey only | ✅ `resolveMissionContext` chỉ đọc qua `getJourneyForStudent` → `getPublishedJourneyForStage`, không có đường đọc nào khác |
| 2 | Draft version invisible | ✅ Mission chỉ tồn tại ở Draft (v2/v3) → không có trong graph published → route trả "Không tìm thấy Mission", không lộ nội dung |
| 3 | Roadmap Map/Roadmap/List use same read model | ✅ Không đổi — cả 3 view vẫn đọc chung `/api/student/journey` |
| 4 | Mission locked reason correct | ✅ Xác nhận bằng dữ liệu thật: Mission 3 (Xác định mục tiêu 90 ngày) khóa đúng vì Mission 2 (prerequisite) chưa đạt `result_achieved` |
| 5 | Direct Mission URL cannot bypass prerequisite/access | ✅ Route hiển thị trạng thái khóa + lý do, không có nút hành động nào khi `displayState === "locked"` |
| 6 | Open Mission route reads same Journey version as Roadmap | ✅ Do dùng chung `getJourneyForStudent`, không có `versionId` nào khác được truyền từ client |
| 7 | Start Mission is idempotent | ✅ Không đổi — vẫn dùng `startMission()` đã test ở Release B (unique constraint + 23505 = thành công) |
| 8 | Workspace block autosave persists | ✅ Xác nhận bằng dữ liệu thật: ghi giá trị block cho Mission 2 (đang "doing", chưa khóa) — insert 201, đọc lại đúng giá trị |
| 9 | Student cannot update another student's block values | ✅ RLS `student_mission_workspace_values`: "own row, no exceptions" (migration 0052) — không đổi |
| 10 | Admin +/− block updates Draft only | ✅ `requireDraftVersion()` chặn ghi khi version không phải draft (Release 1, không đổi) |
| 11 | Removing block from Draft does not delete prior published student data | ✅ Không đổi từ Release 1 |
| 12 | Resource block resolves canonical title and entitlement | ✅ Cả Admin picker và student renderer đều đọc từ `mission.resourceBindings` đã resolve title thật |
| 13 | No resource copy into workspace config | ✅ Block chỉ lưu `bindingId`, resolve title tại thời điểm đọc |
| 14 | Readiness deterministic and stable | ✅ Tính tay bằng dữ liệu thật Mission 2 (1/1 input bắt buộc có giá trị, 1/3 action bắt buộc xong, evidence_required chưa có evidence) → 40×1 + 40×(1/3) + 20×0 = 53%, khớp code |
| 15 | AI failure does not block learning | ✅ Panel AI luôn hiện "H2O Mentor tạm thời không khả dụng", không chặn Start Mission/lưu block/nộp evidence |
| 16 | AI hallucinated Mission ID rejected server-side | N/A Release 2 — H2O Journey/Mission AI thật là Release 4, chưa có model nào sinh Mission ID để cần chặn |
| 17 | Result updates Mission/Outcome/Journey progress | ✅ Không đổi — vẫn qua `maybeMarkResultAchieved` (Release B), Tab Kết quả đọc lại đúng trạng thái |
| 18 | Evidence-required policy respected | ✅ Không đổi — Tab Evidence tái dùng nguyên `submitEvidence` |
| 19 | Teacher-verify policy respected | ✅ Không đổi — `completion_policy` vẫn được server tra cứu, không nhận từ client |
| 20 | No N+1 per Mission on Roadmap | ✅ Roadmap không gọi thêm truy vấn workspace/readiness nào — readiness chỉ tính khi mở đúng 1 Mission |
| 21 | Mobile Roadmap usable | ✅ Roadmap không đổi layout; Workspace mới có breakpoint 1100px gộp 3 cột thành 1 cột (`app/globals.css`) |
| 22 | CREATE/BUSINESS unchanged | ✅ Không đụng file nào |
| 23 | typecheck/lint/tests/build PASS | ✅ typecheck sạch · lint 52 warning (không tăng so với baseline sau Release 1) · 179/179 test · `test:sql` sạch · build thành công |

## 7. Xác nhận trên dữ liệu thật production (2026-08-10)

**Release 1 (migration 0052, đã xác nhận trước đó khi user báo "đã chạy xong")**: 2 bảng tồn tại, add/reorder/remove block đúng, Preflight bắt đúng lỗi trùng id + thiếu binding, Clone Version copy đúng Workspace config sang bản nháp mới — chi tiết ở lần xác nhận trước, không lặp lại ở đây.

**Release 2 (mới)** — kiểm tra trực tiếp bằng REST (mô phỏng đúng logic `lib/mission-workspace/student.ts`), dùng Mission thật ở Journey Stage 1 **bản published (v1)**, tuyệt đối không đụng vào tiến trình học thật của học viên "Max Crypto" (chỉ đọc trạng thái thật để lấy input, mọi ghi/xóa chỉ trên dữ liệu test tự tạo):

| Kiểm tra | Kết quả |
|---|---|
| Thêm block workspace vào Mission thật đang published (Mission 2 — "Hoàn thành Career Map") | ✅ Insert 201, không ảnh hưởng `student_mission_states`/`student_learning_actions` của học viên |
| Autosave block value cho Mission đang mở (chưa khóa) | ✅ Insert 201 vào `student_mission_workspace_values`, đọc lại đúng giá trị |
| Mission khóa đúng lý do (Mission 3 phụ thuộc Mission 2 chưa `result_achieved`) | ✅ `prerequisite_mission_id` của Mission 3 = Mission 2, Mission 2 đang `state=doing` → Mission 3 khóa đúng — guard `MISSION_LOCKED` trong `saveMissionBlockValue` sẽ chặn ghi (xác nhận bằng đọc code + đúng input dữ liệu, không gọi API thật vì không có phiên đăng nhập của học viên để giả lập) |
| Công thức readiness tính tay khớp code | ✅ 53% (xem test #14 ở trên) |
| Dọn dẹp sau test | ✅ Xóa block test + value test — xác nhận 0 dòng `learning_mission_workspace_configs` và `student_mission_workspace_values` còn sót trong org; trạng thái/hành động thật của Max Crypto ở Mission 2 không đổi (đã đọc lại xác nhận) |

**Chưa test**: thao tác thật qua trình duyệt (click Mission trên Roadmap → điền block → xem tab Evidence/Kết quả) — mới xác nhận đúng ở tầng dữ liệu/logic + code review, chưa test bằng phiên đăng nhập học viên thật (không có mật khẩu tài khoản học viên để đăng nhập qua UI).

## 8. Việc cần bạn làm

1. **Không cần chạy migration nào thêm** — Release 2 chỉ dùng lại 2 bảng đã tạo ở migration 0052.
2. Tự kiểm tra qua trình duyệt: đăng nhập học viên → "Hành trình của tôi" → bấm vào 1 Mission → xác nhận Workspace mở đúng, điền thử 1 block, xem tab Evidence/Kết quả.
3. **Quyết định có làm Release 3 không** — Result Card đầy đủ (export/chia sẻ, đưa vào Student Achievement/Profile) + polish đồng bộ 2 chiều Roadmap↔Workspace. Khối lượng vừa phải, không lớn bằng Release 2.
4. **Quyết định có làm Release 4 không** — H2O Journey AI + H2O Mission AI thật (hiện tại chỉ là placeholder "tạm thời không khả dụng") + dự báo ngày hoàn thành. Cần quyết định trước: dùng provider AI nào (đã có H2O Brain/AI Provider Gateway sẵn trong repo), và ngân sách gọi AI.
