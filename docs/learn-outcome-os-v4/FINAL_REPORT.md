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

## 7. Growth Recommendations + Admin Learning Control Center — hoàn thành (bổ sung 2026-08-11)

Đã audit đầy đủ hệ thống thương mại thật (`products`, `academy_courses`, `memberships`, `entitlements`, `orders`, `career_stage_resources`) trước khi code, và audit các trang admin thật cho 7 module Learning Control Center. Kết quả:

### 7a. Growth Recommendations (§8)

**Phát hiện thật (không phải giả định):**
- **0 dòng `entitlements` và 0 dòng `memberships` tồn tại trong toàn bộ tổ chức** — 0 đơn hàng nào có `payment_status='paid'` (5 đơn hàng thật đều `pending`). Nghĩa là hiện tại **không học viên nào** có "included/đã sở hữu" thật.
- **0 tài nguyên nào dùng `access='entitlement_only'`** trong `career_stage_resources` — không có "tài liệu cao cấp bán riêng" thật nào tồn tại. Mục "PREMIUM RESOURCE" (loại B) không hiện gì cả thay vì bịa — truy vấn thật vẫn có sẵn, sẽ tự hoạt động ngay khi Admin đánh dấu 1 tài nguyên là entitlement_only.
- **9 sản phẩm thật** (6 khóa học giá 3.6-19.8 triệu, 3 gói membership giá 299k-1.49 triệu/tháng) — dùng trực tiếp giá/mô tả thật, không copy catalog tĩnh.

`lib/growth/recommendations.ts` tái dùng đúng công thức entitlement/membership mà `lib/academy/student-course.ts` đã dùng cho "Khóa học bổ trợ" (privileged || membership || entitlement riêng khóa học), không viết lại logic truy cập mới. Đã **xóa "Khóa học bổ trợ"** khỏi `/student/courses`, thay bằng `<GrowthRecommendations>`. Membership không bao giờ chào bán lại nếu học viên đã có (test #16). Không con số/mô tả nào bịa (test #17) — mọi thứ trace về đúng 1 dòng dữ liệu thật.

**Xác nhận bằng dữ liệu thật** (mô phỏng đúng logic cho học viên thật "Max Crypto" — role student, 0 entitlement): 0 mục "included", 3 khóa học gợi ý (giới hạn từ 6), 3 gói membership, 0 tài liệu cao cấp — khớp đúng dự đoán.

### 7b. Admin Learning Control Center (§9)

> **Sửa lỗi phạm vi (2026-08-11, sau khi Owner chỉ ra):** phần bên dưới ban đầu tôi làm **nhầm chỗ**. §9 nói "Admin LEARN" — tôi hiểu thành Academy Control Center (`/academy-admin`), nhưng thực ra là **nhóm "Learn" trong sidebar workspace chính** (`/learn`, `/study`, `/knowledge`, `/library`, `/classes`, `/assignments`, `/quizzes`) — chính là màn hình hiển thị Workspace Owner như một học viên cá nhân ("55% Mastery", "Ôn ngay 3 thẻ", "Ngày duy trì nhịp học"). Đã sửa lại đúng chỗ, xem mục 7c.

Tìm trang admin thật cho từng module trước khi quyết định xây gì:

| Module | Trạng thái thật | Xử lý |
|---|---|---|
| Tổng quan đào tạo | Có sẵn, thật | Giữ nguyên `/academy-admin` |
| Journey & Outcomes | Có sẵn, thật | Giữ nguyên `/academy-admin/journey` |
| Knowledge & Library | Có sẵn, thật | Giữ nguyên `/academy-admin/content` |
| Classes & Cohorts | **Có sẵn nhưng chưa nối** — `/instructor/classes` đã cho phép owner/admin truy cập (`lib/operations/permissions.ts`), chỉ chưa có link từ Academy Control Center | Nối link vào sidebar, không xây mới |
| Assignment & Review | **Có sẵn nhưng chưa nối** — `/instructor/assessments` ("Feedback Studio") cũng đã cho owner/admin | Nối link vào sidebar, không xây mới |
| Smart Review | **Không tồn tại** — grep toàn repo không thấy trang quản trị flashcard/spaced-repetition nào | Hiện thẻ "Chưa có trang quản trị" trung thực, không link giả |
| Quiz & Assessment | **Không tồn tại** — không có question bank/quiz management nào cho admin | Hiện thẻ "Chưa có trang quản trị" trung thực, không link giả |

### 7c. Sửa lại đúng chỗ — `/learn` trở thành Learning Control Center thật

**Audit 7 trang trong nhóm "Learn" của sidebar chính** (`components/layout/sidebar.tsx`) — đây mới là "Admin LEARN" mà §9 nói tới:

| Trang | Nguồn dữ liệu thật | Số dòng thật trong DB |
|---|---|---|
| `/learn` Hành trình học | Zustand demo store | `learning_goals` = **0** |
| `/study` Ôn tập thông minh | Zustand demo store | `flashcards` = **0** |
| `/knowledge` Không gian tri thức | Zustand demo store | `knowledge_spaces` = **0** |
| `/library` Thư viện học | Zustand demo store | — |
| `/classes` Lớp học | Zustand demo store | `classes` = **0** |
| `/assignments` Bài tập | Zustand demo store | `assignments` = **0** |
| `/quizzes` Quiz | Zustand demo store | `quizzes` = **0** |

Trong khi dữ liệu đào tạo **thật** của tổ chức nằm ở chỗ khác và rất lớn: **102 tài liệu**, **13 giai đoạn**, **28 Mission**, **4 dòng tiến độ học viên thật**. Nghĩa là tab LEARN của Owner đang hiển thị **tiến độ cá nhân bịa trên các bảng rỗng**.

**Đã sửa:**
- `/learn` viết lại thành **Learning Control Center**: số liệu toàn tổ chức từ read model thật mới (`lib/learning-control/summary.ts` — mọi con số là COUNT thật, một số **thật sự bằng 0** và hiện đúng là 0), cộng 7 thẻ module trỏ tới nơi chúng thực sự được quản trị.
- Nhóm sidebar đổi từ ngữ nghĩa học viên sang quản trị: "Tổng quan đào tạo", "Journey & Outcomes" → `/academy-admin/journey`, "Knowledge & Library" → `/academy-admin/content`, "Classes & Cohorts" → `/instructor/classes` (thật), "Assignment & Review" → `/instructor/assessments` (thật), còn "Smart Review" và "Quiz & Assessment" giữ route cũ và **ghi rõ chưa có trang quản trị**.
- **Không xóa route demo nào** — đúng tinh thần §9 "preserve routes if necessary; change labels/navigation first".
- Gỡ khối 7-module đã thêm nhầm ở `/academy-admin` để tránh hai "control center" cạnh tranh nhau.
- Nhãn nhóm sidebar giữ nguyên "Learn" (ngắn gọn, hợp thanh sidebar hẹp) theo yêu cầu — ngữ nghĩa quản trị nằm ở tên từng mục con và nội dung trang, không cần đổi tên nhóm.

**Xác nhận bằng dữ liệu thật (2026-08-11)** — mô phỏng đúng truy vấn của `getLearningControlSummary()` trên production:

| Số liệu | Giá trị thật |
|---|---|
| Giai đoạn | 6/13 đang publish |
| Tài liệu | 102 |
| Mission đã cấu hình | 42 (tính cả bản nháp lẫn đã publish, đúng ý nghĩa "nội dung đã xây") |
| Học viên đang hoạt động | 4 |
| Học viên đã có tiến độ | 2/4 |
| flashcards / knowledge_spaces / classes / assignments / quizzes | 0 / 0 / 0 / 0 / 0 (đúng thật, không bịa) |

Đã xác minh 2 học viên có tiến độ là dữ liệu thật hợp lệ (Max Crypto và tài khoản chính chủ workspace "Thùy H2O Makeup"), không phải dữ liệu test còn sót — không cần dọn dẹp gì thêm vì bước này chỉ đọc, không ghi.

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
2. Tự vào `/student/courses` (cuộn xuống dưới Journey) để xem Growth Recommendations thật, và `/academy-admin` để xem khối Learning Control Center 7 module.
3. **Quyết định về Smart Review và Quiz & Assessment** — 2 module này chưa có trang quản trị nào trong toàn bộ app (đã xác nhận bằng tìm kiếm, không phải chưa tìm kỹ) — cần bạn quyết định có xây mới không, và nếu có thì phạm vi ra sao (đây là 2 tính năng lớn, mỗi cái tương đương 1 module riêng).
4. **Growth Recommendations sẽ tự động có nội dung "Đã sở hữu"** ngay khi có đơn hàng thật được đánh dấu `paid` hoặc Admin cấp entitlement thủ công — không cần sửa code thêm.
