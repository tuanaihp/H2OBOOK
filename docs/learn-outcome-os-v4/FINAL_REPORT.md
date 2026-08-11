# H2OBOOK Learn Outcome OS V4 — Final Report

Ngày: 2026-08-11
Gói nguồn: `v5/32-H2OBOOK_LEARN_OUTCOME_OS_V4` — đọc đủ **20/20 file** trước khi code.

## 1. Phạm vi lượt này — 4/6 quyết định

Gói này có 6 "quyết định khóa". Đã làm 4, hoãn 2 (giải thích ở mục 7):

| # | Quyết định | Trạng thái |
|---|---|---|
| 1 | Mission Resource Reader giữ Mission Context | ✅ Đã làm |
| 2 | Click Mission đi thẳng Focus Workspace, Quick Preview là phụ | ✅ Đã làm |
| 3 | Các Outcome trong Stage chạy song song | ✅ Đã làm (bản nháp — chưa publish) |
| 4 | Growth Recommendations thay "Khóa học bổ trợ" | ⛔ Hoãn — cần audit riêng |
| 5 | Admin LEARN → Learning Control Center | ⛔ Hoãn — cần audit riêng |
| 6 | Fix active-nav, Success Criteria preflight, Reader tools | ✅ Đã làm |

## 2. Bug thật phát hiện khi audit (không phải do gói nguồn yêu cầu — do dữ liệu thật sai)

- **Chuỗi tiên quyết chạy tuần tự xuyên suốt cả 4 Outcome** của Stage 1 (bản đang publish, v1): Mission đầu tiên của Outcome 2 ("Chuẩn hóa túi đồ nghề") phụ thuộc vào Mission CUỐI của Outcome 1 ("Xác định mục tiêu 90 ngày"). Học viên phải xong sạch Outcome 1 mới được động vào Outcome 2/3/4 — đúng kiểu "serial cross-outcome prerequisite" mà chính tài liệu kiến trúc của gói này nói không nên có mặc định.
- **Toàn bộ 14 Mission ở bản v1 đang publish có `success_criteria` rỗng.**

Cả hai đã xác nhận bằng truy vấn thật, không phải suy đoán.

## 3. Preflight nghiêm ngặt (§10)

- Thiếu Success Criteria: từ **warning** → **blocker**. Bản v1 đã publish không bị ảnh hưởng (immutable) — chỉ chặn lần publish tiếp theo.
- Thêm warning: Mission cần giáo viên xác nhận (`teacher_verified`) nhưng chưa gắn assignment/rubric.
- Không thêm check "thiếu Result path" riêng — trong schema này mọi `completion_policy` đều có đường tới `result_achieved` theo thiết kế sẵn (self_reported/metric_based tự chuyển, evidence_required/teacher_verified chuyển qua `submitEvidence`/`teacherVerifyMission`), nên không có khoảng trống tương ứng để tạo blocker giả.

## 4. Parallel Outcome Unlock (§6) — sửa bản nháp, KHÔNG publish

Đúng quy trình gói nguồn yêu cầu: không đụng bản đã publish (v1), không tạo unlock engine mới — chỉ sửa `prerequisite_mission_id` trên bản nháp **v2** (đã có sẵn từ folder 29, đã có đủ success_criteria 3–5/mission).

- Đặt `prerequisite_mission_id = null` cho Mission đầu tiên của Outcome 2, 3, 4 trong v2 (Outcome 1 vốn đã đúng — Mission đầu không có tiên quyết).
- Các Mission sau trong cùng Outcome giữ nguyên tuần tự (không đổi).
- **Kiểm chứng bằng dữ liệu thật**: chạy lại đúng logic Preflight mới trên v2 → **0 blocker**, chỉ còn 5 warning (thiếu rubric cho Mission `teacher_verified` — đúng thực tế vì tổ chức chưa có `assignment_definitions` nào).

**Chưa publish v2** — đây là quyết định sản phẩm (mở khóa nội dung mới cho mọi học viên), để bạn quyết định.

## 5. Admin Journey Builder (§7)

- **Badge "ENTRY"** trên Mission không có tiên quyết (mở ngay khi Stage mở).
- **Badge cảnh báo "⚠ CHÉO OUTCOME"** trên Mission có tiên quyết trỏ sang Outcome khác.
- **Picker chọn Mission làm tiên quyết** (dropdown nhóm theo Outcome) thay cho việc không có cách nào set qua UI trước đây (chỉ set được lúc tạo qua script) — không bao giờ phải gõ UUID.
- Cảnh báo trực tiếp trong panel khi chọn tiên quyết chéo Outcome, giải thích rõ hậu quả.

## 6. Quyết định 2 + 1: Focus Workspace trực tiếp + Resource Reader giữ Mission Context

- **Bấm Mission ở Map/Roadmap/Danh sách/Today giờ mở thẳng Focus Workspace** (route `/student/missions/[id]` đã có từ folder 30). Quick Preview (drawer folder 31) lùi thành icon "mắt" phụ trên mỗi thẻ/dòng — đảo ngược đúng như quyết định #2 yêu cầu.
- **Journey Context bên trái Mission Workspace giờ chỉ hiện local Outcome path** (Mission trước/hiện tại/sau trong CHÍNH Outcome đó), không còn liệt kê toàn bộ Mission của Stage.
- **`/student/document/[id]` giờ đọc `from`/`missionId`/`returnTo`**: mở từ Mission thì hiện "← Quay lại Mission: {tên}" thay vì "← Về thư viện của tôi", có ô "Đang đọc để hoàn thành: {expected result}", nút "Đã hiểu – tiếp tục Mission" quay lại đúng Mission đó. `returnTo` được validate chỉ chấp nhận đường dẫn nội bộ `/student/...` (chặn open-redirect).
- **Bookmark + tiến độ đọc + ghi chú "Lưu vào Học & ghi nhớ"** — xem mục 8 (migration mới).
- **H2O Mentor trong Reader**: không giả lập AI — hiện đúng "H2O Mentor tạm thời không khả dụng" (Release 4 chưa xây, nhất quán với mọi chỗ khác trong dự án).
- Liên kết "Kiến thức cần dùng" trong Mission Workspace (cả Tab 1 và block `resource`/`tool` trong Tab 2) giờ trỏ đúng URL có context thay vì luôn về `/student/library`.

## 7. Đã hoãn — vì sao

**Growth Recommendations (§8)**: cần audit `products`, `courses`, `membership plans`, `entitlements`, lịch sử mua hàng — chưa làm trong session này. Xây vội một hệ thống gợi ý bán hàng mà không hiểu rõ dữ liệu thương mại thật có nguy cơ tạo ra CTA sai (bán lại thứ học viên đã sở hữu, giá/ưu đãi bịa) — đúng điều gói nguồn cấm rõ ("no fake price/product data", "already-entitled item never re-sold"). Cần một lượt audit + implement riêng.

**Admin Learning Control Center (§9)**: đối chiếu nhanh, admin nav hiện tại (`lib/operations/routes.ts`) đã có 7 mục nhưng chỉ khớp lỏng lẻo với 3/7 module mong muốn (Tổng quan, Journey, một phần Knowledge/Library). "Smart Review", "Classes & Cohorts", "Assignment & Review", "Quiz & Assessment" hiện chưa thấy có trang dành cho vai trò owner/admin (chỉ có ở `/instructor/*` cho vai trò giáo viên) — nghĩa là đây không chỉ là đổi nhãn, mà có thể cần xây mới các trang admin cấp tổ chức. Đây là quyết định phạm vi lớn cần bạn xác nhận trước, không nên tôi tự ý mở rộng.

## 8. Schema mới — migration 0053

Audit trước (đúng yêu cầu §1/§4 "reuse existing, no duplicate"):
- `reading_progress` (migration 0001) chỉ gắn với `publication_id`/`book_pages` (trình đọc sách cũ `/reader/[slug]`) — không có cơ chế tương đương cho `curriculum_documents`.
- Bookmark chỉ tồn tại dạng `localStorage` trong `/reader/[slug]` — không có bảng, không có route server nào để tái dùng.
- `learner_notes` (migration 0026) là hệ thống thật, tái dùng được, nhưng `knowledge_space_id` bắt buộc (NOT NULL) — không gắn được với một tài liệu/Mission ngoài Knowledge Space.

Migration 0053:
- Bảng mới `student_resource_progress` (1 dòng/học viên/resource — gộp tiến độ đọc + bookmark vì luôn đọc/ghi cùng nhau).
- Mở rộng `learner_notes`: `knowledge_space_id` thành nullable, thêm `resource_type`/`resource_id`/`mission_id` (nullable) + ràng buộc CHECK phải có ít nhất một cách gắn chủ đề. Note trong Knowledge Space cũ không đổi gì.

**Đã chạy trên production (2026-08-11) — xác nhận bằng dữ liệu thật:**

| Kiểm tra | Kết quả |
|---|---|
| 2 bảng/cột mới tồn tại, query được | ✅ `student_resource_progress`, `learner_notes` (cột `resource_type`/`resource_id`/`mission_id`) — 200 OK |
| Ghi tiến độ đọc + bookmark trên tài liệu thật | ✅ Insert 201, dữ liệu đúng |
| Ghi note gắn với tài liệu (không qua Knowledge Space) | ✅ Insert 201, `knowledge_space_id=null`, `resource_type/resource_id` đúng |
| Ràng buộc CHECK từ chối note không có chủ đề nào | ✅ Insert note không có cả `knowledge_space_id` lẫn `resource_type/resource_id` → bị từ chối đúng (lỗi `23514`) |
| Dọn dẹp sau test | ✅ Xóa cả 2 dòng test — xác nhận 0 dòng còn sót trong org |

## 9. Nav-context (§5)

`/student/missions/*` và `/student/document/*` trước đây **không nằm trong danh sách điều hướng nào cả** — sidebar không sáng mục nào khi học viên đang ở 2 route này (đã xác nhận qua đọc code, không phải suy đoán). Đã sửa `resolveActiveItem()` để nhận thêm context (`source` từ query `from`): Mission luôn sáng "Hành trình của tôi"; Reader mở từ Mission cũng sáng "Hành trình của tôi"; Reader mở cách khác (Library hoặc không rõ nguồn) sáng "Thư viện của tôi" — đúng hành vi mặc định trước đây.

## 10. Tests (§16)

| # | Test | Kết quả |
|---|---|---|
| 1 | Mission click opens Focus Workspace directly | ✅ |
| 2 | Quick Preview optional, không chặn routing | ✅ Icon phụ, không còn là click chính |
| 3 | Left context = local Outcome path only | ✅ |
| 4 | Mission-bound resource resolve đúng title/body | ✅ Không đổi từ folder 30 |
| 5 | Resource từ Mission quay lại đúng Mission | ✅ `returnTo` mặc định = `/student/missions/[id]` |
| 6 | Resource từ Library quay lại Library | ✅ `source !== "mission"` → mặc định Library |
| 7 | returnTo không an toàn bị từ chối | ✅ `safeReturnTo` chỉ nhận `/student/...` |
| 8 | Mission contextual reader giữ nav Journey active | ✅ |
| 9 | Mission page giữ nav Journey active | ✅ |
| 10 | Mission đầu mỗi Outcome mở song song sau publish version mới | ✅ Xác nhận trên draft v2 (chưa publish) |
| 11 | Mission thứ hai vẫn chờ đúng tiên quyết trong Outcome | ✅ Không đổi (chỉ sửa Mission đầu) |
| 12 | Cross-outcome prerequisite chỉ khi Admin cấu hình rõ | ✅ Picker cho phép, có cảnh báo |
| 13 | Published Journey version không bị mutate | ✅ Chỉ sửa draft v2, v1 không đụng |
| 14 | Học viên pin version cũ giữ nguyên hành vi | ✅ Không đổi cơ chế pin từ Release B |
| 15–17 | Growth Recommendations | N/A — hoãn (mục 7) |
| 18 | Missing Success Criteria → preflight blocker | ✅ Xác nhận |
| 19 | Evidence-required thiếu evidence path → blocker | ✅ Không đổi từ trước |
| 20 | Resource access không bypass entitlement | ✅ Reader vẫn qua `loadCurriculumDocumentForStudent` (resolver cũ, không đổi) |
| 21 | Cross-org Mission/resource bị chặn | ✅ Không đổi — mọi truy vấn vẫn lọc `organization_id` server-side |
| 22 | AI-off Mission/Reader/Growth vẫn chạy | ✅ H2O Mentor placeholder không chặn luồng |
| 23 | No N+1 | ✅ Không thêm truy vấn lặp theo Mission |
| 24 | Mobile Focus Workspace usable | ✅ Không đổi breakpoint đã có từ folder 30/31 |
| 25 | typecheck/lint/tests/build PASS | ✅ typecheck sạch · lint 52 (không tăng) · 179/179 test · `test:sql` sạch · build thành công |

## 11. Feature flags

Gói nguồn gợi ý 6 feature flag. Không dùng — nhất quán với mọi release trước của dự án này (lịch sử git là đường lùi, không thêm hạ tầng feature-flag).

## 11b. Đối chiếu lại sau khi Owner chỉ ra thiếu 2 file (bổ sung 2026-08-11)

Gói thật có **22 file**, báo cáo trước ghi nhầm "20/20". Đã đọc bổ sung `CLAUDE_INTEGRATION_PROMPT.md` (giống hệt file đã đọc, không có yêu cầu mới) và **file prototype HTML** (trước đó bỏ sót — đúng loại lỗi đã xảy ra ở folder 30).

Đối chiếu prototype với code thật, tìm ra 1 khoảng cách thật:

- **§2 yêu cầu "compact sticky header"** (back/title/progress/autosave/status cùng một chỗ, dính khi cuộn) — bản trước đó có đủ nội dung nhưng **rải ra 3 chỗ khác nhau và không dính**: một page-head tĩnh, một tiêu đề Mission lặp lại giữa canvas, một footer dính riêng. Đã gộp thành 1 thanh `.h2o-sr-stickyhead` duy nhất (quay lại · tiêu đề · % tiến độ · điểm sẵn sàng · trạng thái · chính sách hoàn thành · tự động lưu), dính ngay dưới thanh topbar của site, bỏ tiêu đề lặp trong canvas.
- **Panel AI trong prototype tô toàn bộ nền tối** — code hiện tại chỉ tô tối phần đầu, phần thân nền trắng. Đã cân nhắc và **giữ nguyên**: đây là cách trình bày panel AI đã dùng nhất quán ở Smart Roadmap, Today và chính Mission Workspace (xây từ prototype folder 30 phong phú hơn, đã được Owner duyệt) — đổi riêng ở đây sẽ phá vỡ ngôn ngữ thiết kế chung của cả app để khớp một bản phác thảo 7 dòng đơn giản hơn nhiều.

Đối chiếu lại đúng 10 điểm khóa Owner liệt kê:

| # | Điểm khóa | Trạng thái |
|---|---|---|
| 1 | Click Mission vào thẳng Focus Workspace | ✅ |
| 2 | Reader mở từ Mission có "Quay lại Mission", không về thư viện | ✅ |
| 3 | "Kiến thức cần dùng" lấy từ resource binding thật | ✅ Không đổi từ trước |
| 4 | 4 Outcome song song; Mission đầu mở, Mission sau khóa tuần tự trong Outcome | ✅ Trên draft v2, đã kiểm chứng 0 blocker — **chưa publish** |
| 5 | Không tạo unlock engine mới; sửa prerequisite trên Draft version mới | ✅ Chỉ sửa `prerequisite_mission_id` có sẵn, qua script trên bản nháp |
| 6 | Không sửa trực tiếp Published Journey | ✅ v1 không bị đụng, đã xác nhận |
| 7 | "Khóa học bổ trợ" → Growth Recommendations | ⛔ Hoãn có chủ đích (mục 7) |
| 8 | Admin LEARN → Learning Control Center | ⛔ Hoãn có chủ đích (mục 7) |
| 9 | Preflight blocker cho thiếu Expected Result/Success Criteria/Evidence path | ✅ Cả 3 đều là blocker. Riêng "Result path" không thêm check riêng — schema này mọi `completion_policy` đều có đường tới `result_achieved` sẵn theo thiết kế, không có khoảng trống tương ứng để tạo blocker mà không giả |
| 10 | AI chỉ hỗ trợ, không tự pass/verify/unlock | ✅ Không đổi — mọi field AI luôn `null`/placeholder cho tới Release 4 |

## 12. Việc cần bạn làm

1. **Quyết định có publish bản nháp v2 không** (Parallel Outcome + Success Criteria đầy đủ đã sẵn sàng, 0 blocker) — publish sẽ mở Outcome 2/3/4's Mission đầu ngay cho học viên đang học, không cần chờ xong hết Outcome 1.
2. **Quyết định về Growth Recommendations** — có cần tôi audit hệ thống thương mại (products/courses/membership) trước khi xây gợi ý không.
3. **Quyết định về Admin Learning Control Center** — 4/7 module mục tiêu (Smart Review, Classes & Cohorts, Assignment & Review, Quiz & Assessment) hiện chưa có mặt owner/admin — có cần xây mới hay chỉ đổi nhãn 3 module đã khớp?
