# Audit hiện trạng LEARN — trước khi tích hợp Learn Outcome OS V1 (folder 28)

Ngày: 2026-08-10
Theo đúng yêu cầu của gói nguồn (`## 1. AUDIT REPO TRƯỚC` trong `CLAUDE_INTEGRATION_PROMPT.md`) — audit trước, không viết migration trước khi audit xong.

## Phát hiện quan trọng nhất: 4 tab LEARN mà gói nguồn "đề xuất" — đã tồn tại gần như nguyên vẹn

So sánh trực tiếp `lib/student/compact-navigation.ts` (điều hướng thật đang chạy) với README của gói nguồn:

| Gói nguồn đề xuất | Nhãn thật trong sidebar hiện tại | Route thật |
|---|---|---|
| "Hành trình của tôi" | **"Hành trình của tôi"** (khớp 100%) | `/student/courses` |
| "Học & ghi nhớ" | **"Học & ghi nhớ"** (khớp 100%) | `/student/learn` |
| "Thư viện của tôi" | **"Thư viện của tôi"** (khớp 100%) | `/student/library` |
| "Hành động & Kết quả" | "Thực hành & kết quả" (gần khớp) | `/student/assignments` |

Đây không phải trùng hợp ngẫu nhiên — 4 tab với đúng tên gói nguồn "đề xuất nâng cấp" **đã là cấu trúc sidebar thật đang chạy production**. Câu hỏi thật không phải "có nên tạo 4 tab này không" (đã có), mà là "có nên thay mô hình dữ liệu bên dưới (course/lesson/assignment) bằng một graph mới (Outcome→Milestone→Mission→Action→Evidence→Result) không".

## Bảng audit chính

| Component | Nguồn hiện tại | Thật hay demo | Keep/Reuse/Extend/Deprecate | Ghi chú |
|---|---|---|---|---|
| **Tab 1 — Hành trình của tôi** (`/student/courses`) | `getStudentCourseSummaries` (`lib/academy/student-course.ts`) | ✅ Thật | **KEEP** | Progress bar thật, completed/total lessons thật. |
| **Tab 1 phụ — Roadmap** (`/student/roadmap`) | `studentCareerStages` hardcode trong `lib/student/experience.ts` | ⚠️ **NỬA THẬT NỬA GIẢ** | ❌ **Cần sửa ngay, không cần chờ quyết định về Outcome Graph** | 5 giai đoạn tiếng Anh hardcode (`foundation/practice/first-client/professional/leader`) với title/description/requirements giả — **không khớp 6 giai đoạn thật** đã seed ở module 25/26 (`career_stages`, đã có nội dung V2 thật). Chỉ có `status` (khóa/mở) là dùng dữ liệu thật (`getUnlockedStageIds`). Trang này được link nổi bật từ Smart Home ("Xem lộ trình của tôi") và Skill Map — học viên bấm vào sẽ thấy giai đoạn KHÔNG TỒN TẠI trong hệ thống thật. |
| **Tab 2 — Học & ghi nhớ** (`/student/learn`) | `flashcards`, `learner_notes`, `knowledge_space_progress` (migration 0026) | ✅ Thật | **KEEP** | Comment gốc trong code: "no new table, no demo data". Đã đúng tinh thần "Personal Learning Workspace" gói nguồn muốn. |
| **Tab 3 — Thư viện của tôi** (`/student/library`) | `/api/student/library`, 3 chế độ: production/unconfigured/demo | ⚠️ Có demo nhưng **ghi rõ nhãn** | **KEEP** | Gói nguồn cáo buộc "demo giả im lặng" — kiểm tra thật thấy demo **có nhãn rõ ràng** ("CHẾ ĐỘ DEMO... chưa phải thư viện thật"), chỉ hiện khi chưa cấu hình. Đúng nguyên tắc `CLAUDE.md` "No silent fake fallback" — cáo buộc của gói nguồn không hoàn toàn đúng. |
| **Tab 4 — Thực hành & kết quả** (`/student/assignments`) | `brain_assignment_submissions` (migration 0026) + `portfolio_ready` (migration 0036) | ✅ Thật | **KEEP** | State machine đầy đủ: `not_started→draft→submitted→in_review→revision_requested→graded`. Rubric, criterion scores, instructor feedback, resubmission — tất cả thật. |
| **Evidence / Result** | `app/api/student/portfolio/route.ts` | ✅ Thật | **KEEP — đây chính là "Evidence/Result" gói nguồn muốn xây mới** | Comment gốc: "Portfolio is derived, never entered by hand: an item exists because an instructor marked a graded submission `portfolio_ready`." Đây gần như y hệt khái niệm "Result... teacher_verified" ở mục 7 gói nguồn — **đã có, không cần xây engine thứ hai**. |
| **Smart Home** (`/student`) | `app/student/page.tsx` | ✅ Thật | **KEEP** | Đã có: Continue Learning, "Nhiệm vụ hôm nay" (next-best-action), Skill Map, `SmartHomeRoadmapWidget` (stage-gate progress dùng `unlockedStageIds` thật), Upcoming Assignments. Đây chính là điều mục 14 gói nguồn ("Smart Home Connection") yêu cầu — **đã kết nối sẵn**, không cần xây read model mới. |
| **H2O Mentor** (`/student/mentor`) | `lib/student/experience.ts` (`getLocalMentorAnswer`) | ✅ Thật, rule-based | **KEEP** | "LOCAL-FIRST" tường minh — dùng progress/skill/assignment thật làm ngữ cảnh, câu trả lời rule-based chứ không phải LLM. Đúng nguyên tắc `CLAUDE.md` "No-AI-first". |
| **Pin công cụ / template** ("Công cụ của tôi") | `lib/student/compact-navigation.ts` — `href: "/student/mentor"` | ❌ **Giả — link chết** | ❌ **Gap thật, cần xây hoặc sửa nhãn** | Mục sidebar "Công cụ của tôi" trỏ thẳng vào trang Mentor — không có tính năng pin/unpin tool nào tồn tại. Đây là khoảng trống thật duy nhất khớp với mục 5 gói nguồn ("Tool pin"). |
| **Progress engine** | `lib/student/stage-access.ts` (unlock) + `lib/academy/student-course.ts` (lesson %) + `lib/student/mastery.ts` (skill) | ✅ Thật, nhiều lớp | **Reuse, có thể mở rộng** | Progress hiện = hoàn thành bài học + membership/grant + skill mastery. **Chưa** cộng thêm kết quả assignment/portfolio vào tiến độ giai đoạn — đây là khoảng trống thật thứ hai module 28 chỉ đúng (mục 8: "Stage progress không dựa đơn thuần đã mở tài liệu"). |
| **Entitlements** | 2 cơ chế song song: bảng `entitlements` (migration 0034, `lib/content-access/*`) **và** `memberships`/`business_feature_grants` (`lib/student/stage-access.ts`) | ✅ Thật, nhưng **trùng lặp kiến trúc có sẵn** | ⚠️ Nợ kỹ thuật cũ, không do module 28 gây ra | Phát hiện phụ trong lúc audit — hai cơ chế chặn quyền truy cập khác nhau đang tồn tại song song. Không thuộc phạm vi module 28, ghi nhận để bạn biết, không tự sửa trong lượt này. |
| **Cron / scheduled job** | Không có gì | ❌ Chưa tồn tại | — | Không có `vercel.json` crons, không pg_cron, không script rollup/snapshot/daily. Có quy ước route `CRON_SECRET`-gated (vd. `app/api/academy/email/reminders`) nhưng **không có gì kích hoạt theo giờ** — cần bộ lập lịch thật (Vercel Cron hoặc tương đương) nếu làm "Daily/Weekly Rollup". |
| **Outcome/Milestone/Mission/Action graph** (10 bảng gói nguồn đề xuất) | Không tồn tại | — | ❌ **Không xây trong lượt này** | Xem phần khuyến nghị bên dưới. |

## Đối chiếu với nguyên tắc "one orchestrator" tương tự audit module 27

Gói nguồn tự nhận: "Không thay thế curriculum hiện có... bổ sung execution/outcome graph độc lập". Về lý thuyết đây không phải trùng lặp curriculum — nhưng audit thật cho thấy **phần lớn giá trị "execution/outcome" mà graph mới muốn mang lại đã được hệ thống hiện tại cung cấp bằng cơ chế thực dụng hơn**:

- "Mission" ≈ khóa học/bài học hiện tại + assignment.
- "Evidence/Result + teacher-verified" ≈ `portfolio_ready` đã có, đã hoạt động.
- "Journey Map hiển thị giai đoạn/tiến độ" ≈ Smart Home + Roadmap + Skill Map đã có (dù Roadmap đang có bug hardcode).
- "Admin cấu hình nội dung theo giai đoạn" ≈ Academy Control Center + Content V2 đã xây ở module 25/26.

Xây thêm 10 bảng mới + Admin Journey Builder có versioning (Draft→Preflight→Publish→Archive) + cron rollup là khối lượng công việc **nhiều tuần**, tạo ra một mô hình sư phạm song song (mission/milestone) cạnh mô hình đang chạy (course/lesson/assignment) — đúng dạng rủi ro "hai hệ thống làm cùng một việc" mà cả `CLAUDE.md` lẫn chính gói nguồn (mục 0.8: "Không tạo duplicate assignment/note/tool/event system nếu repo đã có") đều cảnh báo.

## Khuyến nghị phạm vi

**Không xây Outcome Graph / Journey Blueprint / Admin Map Builder / cron rollup trong lượt này.** Not vì không khả thi kỹ thuật — mà vì audit cho thấy phần lớn giá trị nó nhắm tới đã tồn tại, và phần chưa tồn tại (versioned mission graph, cron) là quyết định sản phẩm lớn cần bạn xác nhận trước, giống hệt quyết định Docling ở module 27.

**Đề xuất làm ngay trong lượt này — 2 việc thật, nhỏ, rủi ro thấp:**

1. **Sửa `/student/roadmap` dùng dữ liệu thật** — thay `studentCareerStages` hardcode bằng 6 giai đoạn thật từ `career_stages` (đã có nội dung V2 thật từ module 25/26). Đây là bug thật đang hiển thị sai cho học viên ngay bây giờ, độc lập với quyết định về Outcome Graph.
2. **Sửa "Công cụ của tôi"** — hoặc gỡ link giả (trỏ đúng vào đâu đó có thật, ví dụ thư viện mẫu thiết kế `/student/design-library` đã có sẵn) hoặc báo rõ "sắp ra mắt" thay vì trỏ nhầm sang Mentor.

**Cần bạn quyết định — không tự làm nếu bạn không chọn:** có build Outcome/Mission graph + Admin Journey Builder thật hay không, vì đây là khối lượng công việc lớn, đổi mô hình sư phạm, và cần hạ tầng cron chưa từng có trong repo.
