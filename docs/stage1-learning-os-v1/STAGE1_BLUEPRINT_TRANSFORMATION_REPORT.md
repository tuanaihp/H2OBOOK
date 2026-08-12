# Stage 1 Blueprint Transformation — Báo cáo (v2 Draft only)

Phạm vi: chuyển cấu trúc Outcome/Mission của **`v2 — Bản nháp`** (versionId `5f63920f-23de-4e1d-b3eb-4de5e766c237`) sang cấu trúc 4-Outcome mới theo yêu cầu. **`v1 — Đang áp dụng`** (versionId `867f149d-c6ae-466f-9536-c8c2e37817bc`, sống cho 2 học viên thật) **không bị đụng tới ở bất kỳ bước nào** — đã xác nhận lại bằng spot-check sau transform (xem "Kiểm chứng" bên dưới). `v2` vẫn ở trạng thái `draft`, chưa Publish.

## Audit trước khi transform

Đọc toàn bộ 14 Mission thật trong `v2` (đã được nhân bản từ `v1` + điền Tiêu chí đạt ở bước trước), cùng 20 resource binding thật của chúng, trước khi đổi bất kỳ gì. Phát hiện quan trọng:

- **"Chuẩn hóa túi đồ nghề"** đang gắn tài liệu **"Checklist túi đồ nghề Foundation"**, **"Hoàn thành tiêu chuẩn vệ sinh"** đang gắn **"Tiêu chuẩn vệ sinh và an toàn trong Makeup"** — cả 2 tài liệu này **không liên quan gì tới Style DNA/Brand**. Gợi ý mapping ban đầu (túi đồ nghề→Style DNA, vệ sinh→Brand) đã bị loại bỏ để tránh gắn sai tài liệu, đúng yêu cầu.
- **"Setup hồ sơ nghề Makeup"** đang gắn 3 tài liệu đúng chủ đề hồ sơ nghề (checklist thiết lập hồ sơ, content ideas, portfolio assignment) — khớp tốt với "Hồ sơ nghề Makeup" trong Outcome 02 mới, rename an toàn.
- **"Hoàn thiện hồ sơ Stage 1"** đang gắn tài liệu **"Business & Skill Check-up Giai đoạn 1"** (đánh giá kỹ thuật/tác phong/hồ sơ trước khi lên Stage 2) — khớp rất tốt với khái niệm "Đánh giá cuối khóa" trong Outcome 04 mới, rename an toàn.
- **4 Mission kỹ thuật** (Chuẩn bị da đúng/Hoàn thiện lớp nền/Màu sắc cơ bản/Tóc nền tảng) và **3 Mission Before/After** không có tương đương 1:1 nào trong 3 "chỗ trống" mới (Giáo trình Makeup/Skill Passport & Practice Lab/Portfolio Evidence) — 7 Mission thật, chỉ 3 chỗ mới.

## Quyết định đã hỏi và được xác nhận (2026-08-12)

Đã hỏi trực tiếp: gộp cứng 7 Mission thật vào 3 chỗ mới (chọn 1 Mission làm gốc, 6 Mission còn lại mất vai trò Mission riêng) hay giữ nguyên toàn bộ 7 Mission (và tương tự 2 Mission túi đồ nghề/vệ sinh) là Mission riêng biệt, chấp nhận tổng Mission vượt quá 13. **Người dùng chọn: giữ tất cả Mission thật riêng biệt, không gộp mất identity/tiến độ, báo cáo đúng số thật thay vì ép về 13.** Đây là quyết định chủ đạo cho toàn bộ mapping bên dưới.

## Bảng mapping đầy đủ — Mission cũ nào REUSE / RENAME / MOVE, Mission nào MỚI

| # | Mission trong v2 sau transform | Nguồn | Hành động | root_mission_id | Ghi chú |
|---|---|---|---|---|---|
| 1 | Xác định hướng nghề Makeup | Mission cũ cùng tên | **KEEP** (không đổi gì) | giữ gốc `e6956113` | |
| 2 | Hoàn thành Makeup Career Map | "Hoàn thành Career Map" | **RENAME** | giữ gốc `cbfbcc11` | |
| 3 | Lộ trình Makeup 90 ngày của tôi | "Xác định mục tiêu 90 ngày" | **RENAME** | giữ gốc `6c1bcff8` | |
| 4 | Makeup Style DNA | — | **MỚI** | tự nó | Chưa có Tiêu chí đạt thật — cần Admin soạn trước khi Publish |
| 5 | Sáng tạo Makeup Brand | — | **MỚI** | tự nó | Nên nối với `create_outcome_projects.outcome_type='brand_profile'` đã có sẵn (folder 36) khi xây UI thật |
| 6 | Hồ sơ nghề Makeup | "Setup hồ sơ nghề Makeup" | **RENAME** | giữ gốc `2a2d50d8` | Giữ nguyên 3 tài liệu hồ sơ nghề đã gắn |
| 7 | Giáo trình Makeup | — | **MỚI** | tự nó | Mission tổng quan, chưa gắn tài liệu — xem "Việc Admin cần làm" |
| 8 | Chuẩn hóa túi đồ nghề | Mission cũ cùng tên | **MOVE** (đổi Milestone, giữ tên) | giữ gốc `bdb0b5b5` | **Không đổi thành Style DNA** — tài liệu túi đồ nghề vẫn đúng ngữ cảnh kỹ thuật |
| 9 | Hoàn thành tiêu chuẩn vệ sinh | Mission cũ cùng tên | **MOVE** (đổi Milestone, giữ tên) | giữ gốc `38e89ca7` | **Không đổi thành Brand** — tài liệu vệ sinh vẫn đúng ngữ cảnh kỹ thuật |
| 10 | Chuẩn bị da đúng | Mission cũ cùng tên | **KEEP** (đổi vị trí trong cùng Outcome) | giữ gốc `586a5f5f` | |
| 11 | Hoàn thiện lớp nền | Mission cũ cùng tên | **KEEP** (đổi vị trí) | giữ gốc `2093b7a6` | |
| 12 | Màu sắc cơ bản | Mission cũ cùng tên | **KEEP** (đổi vị trí) | giữ gốc `7e9b353c` | |
| 13 | Tóc nền tảng | Mission cũ cùng tên | **KEEP** (đổi vị trí) | giữ gốc `b31064ca` | |
| 14 | Khóa học Video | — | **MỚI** | tự nó | Chưa có khóa học video thật cho Stage 1 (đã kiểm `academy_courses` — chỉ có khóa trả phí không liên quan) — Mission rỗng nội dung, cần Admin bổ sung |
| 15 | Skill Passport & Practice Lab | — | **MỚI** | tự nó | Nên trỏ về `/student/profile` (Skill Passport đã xây ở folder 36) khi có UI thật |
| 16 | Before/After #1 | Mission cũ cùng tên | **KEEP** | giữ gốc `bca82ea7` | |
| 17 | Before/After #2 | Mission cũ cùng tên | **KEEP** | giữ gốc `cb0751f4` | |
| 18 | Before/After #3 | Mission cũ cùng tên | **KEEP** | giữ gốc `1868b235` | |
| 19 | Portfolio Evidence | — | **MỚI** | tự nó | Ý định: tổng hợp 3 bộ Before/After — chưa có UI tự động tổng hợp |
| 20 | Đánh giá cuối khóa | "Hoàn thiện hồ sơ Stage 1" | **RENAME** | giữ gốc `16ee3dcf` | Tài liệu "Business & Skill Check-up" khớp rất tốt với tên mới |
| 21 | Career Passport | — | **MỚI** | tự nó | Nên trỏ về `/student/profile` (Career Passport đã xây ở folder 36) |
| 22 | Chứng nhận hoàn thành | — | **MỚI** | tự nó | `completion_policy=teacher_verified` — khớp thiết kế cấp chứng nhận chỉ do Admin/giáo viên (folder 36) |

**Tổng: 14 Mission cũ được REUSE (5 rename + 9 giữ tên, toàn bộ giữ `root_mission_id`/binding/success_criteria) + 8 Mission thật sự mới = 22 Mission.** Không Mission cũ nào bị xóa. Không tài liệu nào bị xóa hay gắn sai chủ đề.

## Cách thực hiện (không phải REST tay tùy tiện)

`scripts/transform-stage1-v2-blueprint.mjs` — chỉ `UPDATE` tại chỗ (`title`/`milestone_id`/`position`/`prerequisite_mission_id`) cho 14 Mission cũ (id không đổi → toàn bộ 20 resource binding, 36 action template tự động vẫn đúng, không cần rewiring tay), và `INSERT` cho 8 Mission mới (`root_mission_id` = chính id mới, đúng ngữ nghĩa migration 0054 "Mission mới là gốc của chính nó"). Có dry-run in kế hoạch trước, chỉ ghi thật khi chạy `--apply`; script tự kiểm tra `v1` vẫn `published` và `v2` vẫn `draft` trước khi làm bất kỳ gì.

## Kết quả Validation (`scripts/validate-stage1-v2-transform.mjs`)

- **Outcome: 4/4** — Định hướng nghề & Career Map / Xây hệ thống nghề cá nhân / Học & làm chủ kỹ thuật / Tốt nghiệp & Chứng nhận năng lực.
- **Mission: 22** (yêu cầu gốc ghi "13" — thực tế giữ 22 theo đúng quyết định đã hỏi, không ép về 13 để tránh mất identity).
- **Resource bindings: 20/20** — khớp đúng số gốc của `v1`, không binding nào gãy (0 thiếu `resource_id`).
- **Success Criteria: 14/22 có nội dung** (toàn bộ 14 Mission cũ, kể cả sau rename/move) — **8 Mission mới rỗng, đúng như dự kiến** (chưa có nội dung thật để soạn, không bịa).
- **Prerequisites: 22/22 hợp lệ** — chuỗi liên tục 1 hướng từ "Xác định hướng nghề Makeup" tới "Chứng nhận hoàn thành", 0 broken, 0 cycle.
- **Orphan Mission: 0/14** — toàn bộ 14 Mission cũ còn đủ trong `v2`, không cái nào bị rơi ra ngoài Milestone/Outcome.
- **Broken binding: 0.**
- **v1 spot-check:** mission gốc "Xác định hướng nghề Makeup" trên `v1` vẫn `success_criteria: []` — xác nhận `v1` hoàn toàn không bị ảnh hưởng.

## ⚠️ Việc cần làm TRƯỚC KHI Publish (không phải bây giờ — chỉ ghi lại để không bị bất ngờ)

4 file code hiện khoá **theo đúng tên Mission** (không phải theo id), sẽ **âm thầm ngừng hoạt động cho đúng Mission đó** (không crash, chỉ mất tính năng) nếu `v2` được Publish mà không cập nhật song song:

- `lib/stage1-learning-os/passport.ts` (`CAREER_MISSION_TITLES`) — Career Passport trên `/student/profile` sẽ không còn nhận ra "Hoàn thành Makeup Career Map"/"Lộ trình Makeup 90 ngày của tôi" (tên cũ đã đổi).
- `lib/stage1-learning-os/output-reuse.ts` (`OUTPUT_DESTINATIONS`) — "Kết quả này dùng ở đâu?" sẽ trống cho các Mission đã đổi tên (Career Map, 90 ngày, Setup hồ sơ, Hoàn thiện hồ sơ Stage 1).
- `components/student/mission-workspace/mission-workspace-client.tsx` (`DAILY_PRACTICE_MISSION_TITLE`) — Nhật ký luyện tập sẽ không còn hiện ở Mission "Lộ trình Makeup 90 ngày của tôi" (tên cũ đã đổi).
- `lib/stage1-learning-os/skill-evidence.ts` (`STAGE1_MISSION_SKILL_MAP`) — **không bị ảnh hưởng**, vì 4 Mission kỹ thuật chỉ MOVE (đổi Milestone), không đổi tên.

**Không sửa các file này trong đợt này** (nằm ngoài yêu cầu transform lần này, và sửa sớm khi `v2` chưa được duyệt là làm trước nhu cầu thật). Ghi lại rõ để bạn biết: khi quyết định Publish `v2`, cần 1 đợt cập nhật code song song cho 3 file đầu.

## Không xóa tài liệu, không copy asset, không tạo progress system mới — xác nhận

- 0 dòng `curriculum_documents` bị xóa hay sửa nội dung.
- 0 asset được copy — toàn bộ 20 resource binding vẫn trỏ đúng `resource_id` gốc, không tạo bản sao.
- Không bảng mới, không migration mới cho bước này — chỉ thao tác trên `learning_journey_outcomes`/`learning_journey_milestones`/`learning_journey_missions` đã có sẵn.

## Trạng thái hiện tại

`v2` vẫn ở `draft`, **chưa Publish**. Bạn tự vào `/academy-admin/journey` → Stage "Nền tảng nghề Makeup" → `v2 — Bản nháp` để Preview ("Xem như học viên") và duyệt. 8 Mission mới đang thiếu Tiêu chí đạt thật và một số thiếu nội dung/tài liệu gắn kèm (Giáo trình Makeup, Khóa học Video, Style DNA, Brand, Portfolio Evidence, Career Passport, Chứng nhận) — cần Admin bổ sung trước khi cân nhắc Publish.
