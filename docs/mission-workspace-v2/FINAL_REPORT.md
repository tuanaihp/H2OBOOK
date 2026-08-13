# Mission Workspace V2 — Final Report

Route: `/student/missions/[missionId]`. Nguồn: `v5/37-H2OBOOK_MISSION_WORKSPACE_V2/`. Audit đầy đủ ở [01_PRODUCTION_AUDIT.md](./01_PRODUCTION_AUDIT.md).

## Phát hiện chính khi audit

Route thật **đã là 4 tab từ trước** (folder 30/32/36): Hiểu nhiệm vụ / Làm việc / Evidence / Kết quả — cùng khái niệm gói nguồn yêu cầu. Known Context (§8), Result Reuse (§9, cùng cơ chế Known Context — Mission sau đọc `student_mission_workspace_values` của Mission trước), returnTo khi mở tài liệu (§4), Result Card thật không phải chỉ số liệu (§7) — **tất cả đã có sẵn từ các folder trước, không xây lại**. Chi tiết đối chiếu từng mục ở audit.

**§3 Readiness != Completion — đã audit sâu, kết luận không có lỗi thật:** `calculateMissionReadiness()` chỉ trả `{score, missingRequiredBlockIds}`, không có field hoàn thành. "Hoàn thành" trên UI đọc từ `mission.displayState` (`student_mission_states.state`), ghi bởi 3 hàm có gate theo `completion_policy` (`lib/learn-outcome/student.ts`) — không có chỗ nào lấy `readiness.score === 100` để suy ra hoàn thành. Cái thật sự thiếu: **danh sách yêu cầu tường minh** (`requirements[]`) để tab Kết quả hiện đúng "còn thiếu gì" thay vì 1 câu tổng hợp — đây là phần đã xây thêm.

## Đã xây thêm (đúng phạm vi gap thật, không xây lại cái đã có)

1. **`lib/mission-workspace/completion.ts`** (mới) — `getMissionCompletionChecklist()`, hàm thuần, chỉ hiển thị (không quyết định hoàn thành thật — `displayState` vẫn là nguồn thật duy nhất). Tính từ dữ liệu Mission Workspace đã tải sẵn (blocks/values/actions/evidence/completionPolicy/displayState), trả về từng mục: nhãn, bắt buộc hay không, đã đạt hay chưa, nguồn (`workspace`/`action`/`evidence`/`teacher_review`/`metric`). `metric_based` chưa có engine kiểm tra ngưỡng tự động trong schema — báo trung thực là "chưa đạt" thay vì tự chế 1 phép kiểm tra giả.
2. **Tab 4 "Kết quả"** — khi Mission chưa hoàn thành, giờ hiện đúng "Chưa tạo kết quả" + danh sách "Còn thiếu X mục" (từ checklist trên) + 2 nút quay lại "Thực hiện"/"Minh chứng" — đúng §7.
3. **Đổi nhãn tab học viên**: "02 · Làm việc" → "02 · Thực hiện", "03 · Evidence" → "03 · Minh chứng" (§5/§6).
4. **`components/student/mission-workspace/adaptive-evidence-form.tsx`** (mới) — Tab Minh chứng giờ đổi hình dạng theo `evidence_policy.type` thật của Mission (jsonb đã có sẵn, không phải trường mới):
   - `before_after_photo` → 2 ô tải ảnh/video Before + After riêng, mỗi ô nộp 1 evidence entry.
   - `photo_upload` / `screenshot_upload` → 1 ô tải ảnh/video + ghi chú.
   - `checklist_confirmation` / `checkup_review` → không ép tải file, chỉ 1 ô tick "Tôi xác nhận đã hoàn thành" + ghi chú — đúng §6 "orientation không ép upload file", áp dụng cho mọi policy không đòi file, không riêng "orientation".
   - Còn lại (không có `type`, `document_upload`, `rubric_submission`...) → giữ nguyên form chữ + link cũ.
   - Dùng thẳng `uploadAsset` (đã dùng thật ở Nhật ký luyện tập folder 36) — không copy binary, `MissionEvidenceEntry.assetId` và route `/api/student/journey/evidence` **đã nhận sẵn** `assetId` từ trước, không sửa server.
5. **Admin Journey Builder — helper text 5 tab** (§10) — thêm đúng câu giải thích gói nguồn đưa ra, gắn vào tab tương ứng đã có (`TAB_HELP`). "Minh chứng" (chưa có tab riêng) ghép vào giải thích của tab "Mở khóa & đánh giá" (đọc theo Cách xác nhận hoàn thành); "Kết quả"/result destinations **chưa có UI cấu hình** (vẫn là bảng tĩnh `output-reuse.ts` từ folder 36) — ghi rõ là gap, không tự chế control giả.
6. **Feature flags mới** (`lib/mission-workspace/feature-flags.ts`): `MISSION_WORKSPACE_V2`, `MISSION_READINESS_COMPLETION_SPLIT_V1`, `MISSION_EVIDENCE_ADAPTIVE_UI_V1` — áp dụng **toàn app** (mọi Stage), khác `stage1LearningOsFeatures` vốn chỉ bật cho Stage 1. Mặc định bật, tắt qua env var.

## Không tạo hệ song song — xác nhận

**Không migration nào cho folder này.** Không tạo `mission_progress_v2`/`mission_evidence_v2`/`mission_result_v2`/`student_passport_v2`/`unlock_v2`/`workspace_block_v2`/`media_assets`. Toàn bộ đọc/ghi qua bảng đã có: `student_mission_states`, `learning_mission_workspace_configs`, `student_mission_workspace_values`, `assets`, `domain_events`.

## Mission modes (§11)

Không thêm cột `mission_mode`. Adaptive Evidence derive trực tiếp từ `evidence_policy.type` — tín hiệu ổn định hơn tên Mission (bài học thật từ lỗi title-keyed đã gặp và sửa trong chính phiên làm việc này).

## AI boundary

Không tích hợp AI provider nào ở đợt này. "Gợi ý thông minh" vẫn hiện "H2O Mentor tạm thời không khả dụng" — đúng nguyên tắc AI off core vẫn chạy.

## Validate

`typecheck` ✅ · `lint` ✅ (0 error, 53 warning cũ không liên quan) · `test` ✅ (207/207, 8 test mới cho `getMissionCompletionChecklist` — bao phủ đúng 6/21 test bắt buộc của gói nguồn khả thi kiểm bằng Vitest thuần, phần còn lại cần session học viên thật) · `test:sql` ✅ (19 bảng, không migration) · `build` ✅.

## Chưa kiểm chứng bằng dữ liệu thật / gap còn lại (ghi rõ, không giấu)

- **Chưa test qua giao diện thật** với 1 tài khoản học viên đăng nhập trực tiếp (không có phiên đăng nhập để mô phỏng, giống mọi folder trước trong phiên này) — đặc biệt: chưa tự bấm thử luồng upload ảnh Before/After thật, chưa xác nhận Tab Kết quả hiện đúng "Còn thiếu X mục" với dữ liệu Mission thật.
- Result destinations (§7 "Kết quả này sẽ dùng ở đâu?") vẫn không có UI cấu hình cho Admin — vẫn là bảng tĩnh theo `root_mission_id` trong code, đúng như đã ghi từ folder 36.
- `metric_based` completion policy chưa có engine kiểm tra ngưỡng tự động — checklist báo trung thực "chưa đạt", nhưng chưa có Mission thật nào dùng policy này để kiểm chứng hành vi thật.
- Test #12/13 (cross-org blocked, học viên không đọc result người khác) — không test mới, dựa trên cơ chế `resolveMissionContext`/RLS đã kiểm chứng từ các folder trước, không đổi gì ở tầng đó lần này.
- Test #15 (published Journey immutable) — không đổi gì ở tầng version/publish lần này, vẫn đúng theo cơ chế đã kiểm ở folder 33/35.

Không claim production hoàn chỉnh trước khi test bằng tài khoản học viên Stage 1 thật.
