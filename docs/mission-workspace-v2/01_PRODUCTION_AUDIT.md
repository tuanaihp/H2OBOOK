# Mission Workspace V2 — Production Audit

Đọc đủ 18/18 file gói nguồn trước khi audit. Route thật: `/student/missions/[missionId]`
(`app/student/missions/[missionId]/page.tsx` → `lib/mission-workspace/student.ts`'s
`getMissionWorkspaceView` → `components/student/mission-workspace/mission-workspace-client.tsx`).

## Phát hiện lớn nhất: 4-tab + phần lớn §4/§8/§9 đã có sẵn, không phải xây từ đầu

Route thật **đã là 4 tab** từ folder 30/32/36 (`TABS` trong `mission-workspace-client.tsx`):
`01 · Hiểu nhiệm vụ` / `02 · Làm việc` / `03 · Evidence` / `04 · Kết quả` — đúng khái niệm gói nguồn
yêu cầu, chỉ khác 2 chữ hiển thị (`Làm việc`→`Thực hiện`, `Evidence`→`Minh chứng`, §5/§6).

| Yêu cầu gói nguồn | Trạng thái thật | Nguồn |
|---|---|---|
| §4 Tab 1 (Kết quả cần đạt, Known Context, tài liệu/công cụ, các bước, success criteria) | **Đã có đủ** | `mission-workspace-client.tsx` tab `brief` |
| §4 returnTo/missionId/tab khi mở resource | **Đã có** | `components/student/reader/context-url.ts`'s `buildMissionResourceHref` (folder 32), Reader đã có nút "Quay lại Mission: ..." |
| §5 Tab 2 render Workspace Blocks theo cấu hình Admin | **Đã có** | `MissionBlockField` + `getWorkspaceConfig`/`saveBlock`, autosave đã debounce qua `saveBlock` |
| §7 Tab 4 Result Card + result destinations | **Đã có phần lớn** | Result Card thật (không phải chỉ số liệu) + `MissionOutputFlow` ("Kết quả này dùng ở đâu?", folder 36) |
| §8 Known Context | **Đã có** | `MissionKnownContext` + `getMissionContextSnapshot` (folder 36) |
| §9 Result Reuse (Mission sau đọc Mission trước) | **Đã có, cùng cơ chế Known Context** | `getMissionContextSnapshot` đọc `student_mission_workspace_values` của Mission trước cùng Chặng — chính là "Mission sau đọc result Mission trước" gói nguồn mô tả, không phải 2 hệ khác nhau |
| §3 Readiness tách khỏi Completion | **Đã tách đúng ở tầng dữ liệu** — xem mục riêng bên dưới | |

**Không tạo lại** `MissionWorkspaceRepository`/`mission-workspace-service.ts`/`completion-evaluator.ts` của gói nguồn — đó là 1 kiến trúc port/adapter mẫu cho dự án chưa có sẵn Repository nào; H2OBOOK đã có `lib/mission-workspace/student.ts` + `lib/learn-outcome/student.ts` làm đúng vai trò đó, code thật, đã chạy production. Refactor/extend 2 file này, không dựng song song.

## §3 Readiness != Completion — audit sâu, kết luận: đã đúng, nhưng thiếu 1 phần hiển thị

Kiểm tra trực tiếp `lib/mission-workspace/student.ts`:

- `calculateMissionReadiness()` → `MissionReadiness { score, missingRequiredBlockIds }` — **chỉ đánh giá khả năng bắt đầu/tiếp tục** (input/action/evidence-presence), không có field `isComplete` nào ở đây.
- "Hoàn thành" hiển thị trên UI (`STATE_LABEL`, badge `● Hoàn thành`) đọc từ `mission.displayState` (`DONE_STATES = ["verified", "result_achieved"]`), suy ra từ `student_mission_states.state` — cột tiến độ thật, được ghi bởi đúng 3 hàm hoàn thành có gate theo `completion_policy` (`completeSelfReportedMission`/`submitEvidence`'s verified branch/`teacherVerifyMission`, `lib/learn-outcome/student.ts`).
- **Xác nhận: không có chỗ nào trong code thật lấy `readiness.score === 100` để suy ra hoàn thành.** Nút "Đánh dấu hoàn thành" gọi thẳng `completeSelf` — server tự đánh giá lại theo `completion_policy`, không tin readiness từ client.

**Kết luận: không phải sửa lỗi (không có lỗi thật ở đây)** — nhưng gói nguồn còn muốn 1 thứ chưa có: **danh sách yêu cầu tường minh dạng `requirements[]`** (mỗi mục: nhãn, bắt buộc hay không, đã đạt hay chưa, nguồn) để tab 4 hiện đúng "còn thiếu gì" thay vì 1 câu tổng hợp ("Việc cần làm tiếp" ở sidebar hiện chỉ có 1 dòng suy luận, không phải danh sách). Đây là phần thật sự cần xây mới — **thuần hiển thị, tính từ dữ liệu đã có, không tạo nguồn hoàn thành thứ hai** (không đổi cách `displayState` được ghi).

## §6 Adaptive Evidence — gap thật cần xây

Tab Evidence hiện tại: **1 form chung** (ô mô tả + ô dán link) cho MỌI Mission cần evidence, bất kể loại. Gói nguồn muốn UI thích nghi theo "mission mode" (orientation/practice/brand/portfolio).

Audit dữ liệu thật: chưa có cột `mission_mode` (đúng như §11 gói nguồn dự đoán — "derive ở application layer trước khi thêm DB field"). Nhưng **đã có tín hiệu ổn định, không phải suy từ tên**: `evidence_policy.type` (jsonb, đã điền thật cho 14 Mission Stage 1 — `before_after_photo`, `document_upload`, `photo_upload`, `screenshot_upload`, `checklist_confirmation`, `checkup_review`, `rubric_submission`). Đây là khóa đúng để derive UI thích nghi — **ổn định hơn tên Mission** (bài học từ lỗi thật đã gặp ở folder 36: khóa theo tên đã gãy khi đổi tên; `evidence_policy.type` không đổi khi rename).

`assets`/`uploadAsset` pipeline đã có sẵn, đã dùng thật ở Nhật ký luyện tập (folder 36) — evidence đã có sẵn field `assetId` (`MissionEvidenceEntry.assetId`, `submitEvidence()` đã nhận, route `/api/student/journey/evidence` đã nhận) — **chỉ thiếu UI gọi `uploadAsset` rồi truyền `assetId`**, không cần sửa gì ở server.

## §10 Admin Journey Builder helper text

5 tab hiện tại (`app/academy-admin/journey/page.tsx`'s `TAB_LABEL`) chỉ có tên ngắn ("2. Học liệu"...), chưa có câu giải thích ý nghĩa như gói nguồn liệt kê. Sẽ thêm đúng 6 câu giải thích gói nguồn đưa ra, không tự viết lại.

## Không tạo hệ song song — xác nhận

Không tạo `mission_progress_v2`/`mission_evidence_v2`/`mission_result_v2`/`student_passport_v2`/`unlock_v2`/`workspace_block_v2`/`media_assets`. **Không migration nào cho folder này** — toàn bộ đọc/ghi qua bảng đã có (`student_mission_states`, `learning_mission_workspace_configs`, `student_mission_workspace_values`, `assets`, `domain_events`).

## AI boundary

Xác nhận: "H2O Mentor tạm thời không khả dụng" (chưa tích hợp AI provider nào ở đây) — đúng nguyên tắc "AI off core vẫn chạy" đã áp dụng xuyên suốt các folder trước.

## Phạm vi triển khai đợt này

1. Đổi nhãn tab học viên: "Làm việc"→"Thực hiện", "Evidence"→"Minh chứng".
2. `lib/mission-workspace/completion.ts` mới — `getMissionCompletionChecklist()` thuần hiển thị, tính từ dữ liệu đã có (blocks/values/actions/evidence/completionPolicy/displayState), không đổi cách ghi hoàn thành thật.
3. Tab 4 + sidebar "Việc cần làm tiếp" hiện đúng danh sách `requirements[]` thay vì 1 câu.
4. Tab Evidence thích nghi theo `evidence_policy.type` — upload ảnh/video thật qua `uploadAsset`, giữ nguyên form chữ+link cho các policy không có type cụ thể.
5. Helper text 5 tab trong Admin Journey Builder.
6. Feature flags mới (`lib/mission-workspace/feature-flags.ts`): `MISSION_WORKSPACE_V2`, `MISSION_READINESS_COMPLETION_SPLIT_V1`, `MISSION_EVIDENCE_ADAPTIVE_UI_V1` — áp dụng toàn app (không giới hạn Stage 1, vì Mission Workspace dùng chung mọi Stage), mặc định bật.
