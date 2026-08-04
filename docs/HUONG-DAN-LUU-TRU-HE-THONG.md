# HƯỚNG DẪN LƯU TRỮ HỆ THỐNG H2OBOOK

> Tài liệu này giải thích: mỗi loại dữ liệu (nội dung sách, ảnh, video, CRM, khóa học, tài liệu chỉnh sửa) đang lưu ở đâu, cần tài khoản/dịch vụ gì để đưa vào vận hành thật, và cách kết nối. Viết cho người không rành kỹ thuật — chỉ cần đọc bảng và làm theo từng bước.
>
> Cập nhật lần cuối: 2026-07-31. Nếu code thay đổi nhiều, nhờ Claude Code đọc lại repo và cập nhật file này.

---

**2026-08-04 — ✅ Đã merge + deploy module H2O Image Book & Teaching Upgrade V1 — KHÔNG CẦN CHẠY MIGRATION GÌ.**
- Đã merge `feature/image-book-teaching-upgrade-v1` vào `main`, deploy production thành công (health check OK).
- Tại trang `/input` (Unified Input Gateway — nút "Mở Unified Input Gateway" trong Studio, hoặc nút mới "Tạo từ ảnh / ZIP / PDF / Word" ở `/books`) giờ có thêm lựa chọn **"Nhiều ảnh / ZIP trang sách"**: chọn nhiều ảnh PNG/JPEG hoặc 1 file ZIP chứa ảnh từng trang → tự động tạo sách mới, mỗi ảnh thành 1 trang, sắp xếp đúng thứ tự tên file (kể cả file đặt tên "trang 2, trang 10" không bị lộn thứ tự).
- Trước khi làm đã kiểm tra kỹ theo đúng quy trình riêng của phần Input Engine (đọc `CLAUDE.md`, `input-roadmap.yaml`, chạy `pnpm audit:input`) — xác nhận toàn bộ nền tảng nhập liệu (DOCX/PDF/Ảnh/HTML) đã hoàn thiện từ trước, module này chỉ thêm đúng 1 khả năng còn thiếu thật sự (tạo sách từ nhiều ảnh/ZIP), không viết lại engine cũ.
- Phát hiện thêm: Reader đã có sẵn "Trình chiếu" (Presentation Mode) khá đầy đủ rồi (không cần xây lại); còn phần quản lý hàng loạt trang (kéo thả sắp xếp, khóa/ẩn trang, lịch sử phiên bản) và gắn sách vào lộ trình/cấp độ thì **chưa làm** — chi tiết trong báo cáo.
- Chi tiết đầy đủ: `docs/H2OBOOK-IMAGE-BOOK-TEACHING-UPGRADE-V1-INTEGRATION-REPORT.md`.

**2026-08-03 — ⚠️ Đã merge + deploy module H2O Academy Control Center V1, CẦN CHẠY MIGRATION 0031.**
- Đã merge `feature/academy-control-center-v1` vào `main`, deploy production thành công (health check OK).
- Trang mới `/academy-admin` (Tổng quan đào tạo, chỉ Admin/Owner) — lần đầu tiên có giao diện thật để **tạo và sửa khóa học/module/bài học** (`/academy-admin/programs`), trước đây các khóa học chỉ được tạo tự động từ danh mục mẫu có sẵn, không có chỗ nào để thêm/sửa thủ công.
- Trang `/academy-admin/distribution` — tìm học viên theo email và **cấp quyền truy cập khóa học thủ công** (có ghi lý do, ngày hết hạn, và tự động lưu lịch sử/audit).
- **Việc bắt buộc:** mở file `supabase/_RUN-0031-ONLY.sql` (mới) → copy toàn bộ → dán vào Supabase SQL Editor (New query) → Run. Đã kiểm tra không trùng tên với 30 migration trước. Migration này chỉ thêm 2 cột mới vào bảng `entitlements` có sẵn (không tạo bảng mới).
- Cho tới khi chạy: trang `/academy-admin/distribution` (cấp quyền thủ công) sẽ báo lỗi khi lưu. `/academy-admin` và `/academy-admin/programs` vẫn dùng được bình thường vì không cần cột mới.
- Chi tiết đầy đủ, bao gồm các phần cố ý chưa làm (Media Center upload video, Roadmap Builder, trình soạn bài học 12-block, Role Preview...): `docs/H2OBOOK-ACADEMY-CONTROL-CENTER-V1-INTEGRATION-REPORT.md`.

**2026-08-03 — ✅ Đã merge + deploy module H2O System Control Plane V2 — KHÔNG CẦN CHẠY MIGRATION GÌ (dùng hết dữ liệu thật đã có sẵn).**
- Đã merge `feature/system-control-plane-operations-intelligence-v2` vào `main`, deploy production thành công (health check OK).
- Trang mới `/system` (System Command Center, chỉ Admin/Owner xem được) — thay thế kiểu "mọi dịch vụ đều Sẵn sàng/active" giả trên `/operations/system-health` và `/platform-admin/system-health` (2 trang đó vẫn còn demo, chưa đụng tới) bằng trạng thái dịch vụ **thật**: đã cấu hình hay chưa, có kiểm tra kết nối thật (Supabase) hay chưa từng kiểm tra thật.
- Đã kiểm tra: toàn bộ 9 trang `/operations/*` và 4 trang `/platform-admin/*` **vẫn đang demo** (chưa nối Supabase) — đây là khoảng trống lớn hơn nhiều so với 1 module này có thể xử lý xong, đã ghi rõ trong báo cáo để làm ở đợt sau.
- Không có "Dangerous Actions" (khôi phục backup, xoay secret, xóa workspace...) nào được xây trong đợt này vì hệ thống chưa có xác thực 2 lớp (MFA) — xây nút bấm mà không có bảo vệ thật sẽ nguy hiểm hơn là không xây.
- Chi tiết đầy đủ: `docs/H2OBOOK-SYSTEM-CONTROL-PLANE-OPERATIONS-INTELLIGENCE-V2-INTEGRATION-REPORT.md`.

**2026-08-03 — ⚠️ Đã merge + deploy module H2O Business Growth & Commerce Engine V1, CẦN CHẠY MIGRATION 0030.**
- Đã merge `feature/business-growth-commerce-v1` vào `main`, deploy production thành công (health check OK, `mode: production`).
- Trước khi tích hợp đã kiểm tra: `/store`, `/orders`, `/membership`, `/analytics`, `/marketplace-studio`, `/licensing`, `/white-label`, `/growth-reader` (8 trang Admin hiện có) đều vẫn đang dùng dữ liệu demo cũ (chưa nối Supabase) — theo đúng yêu cầu của module này, **không đụng vào 8 trang đó**, chỉ xây thêm khu vực mới cho học viên.
- Trang mới cho học viên: `/student/business` (Trung tâm kinh doanh — mục tiêu, nhiệm vụ, chỉ số lead/booking/doanh thu thật, thành quả Create sẵn dùng), `/student/business/customers` (Pipeline khách hàng cá nhân — thêm/sửa lead thật), `/student/business/growth` (thành quả Create dùng để tăng trưởng), `/student/business/operations` (đơn hàng, membership, quyền lợi thật của riêng học viên đó).
- **Việc bắt buộc:** mở file `supabase/_RUN-0030-ONLY.sql` (mới) → copy toàn bộ → dán vào Supabase SQL Editor (New query) → Run. Đã kiểm tra không trùng tên với 29 migration trước.
- Cho tới khi chạy: 4 trang `/student/business/*` sẽ báo lỗi hoặc hiện rỗng. Các phần khác không bị ảnh hưởng.
- Chi tiết đầy đủ, bao gồm các phần cố ý chưa làm (Roadmap Builder cấu hình giai đoạn, Offer/Pricing Builder riêng — dùng lại recipe có sẵn của Create Outcome Studio thay vì làm công cụ mới, Growth Campaign, CRM nâng cao...): `docs/H2OBOOK-BUSINESS-GROWTH-COMMERCE-ENGINE-V1-INTEGRATION-REPORT.md`.

**2026-08-03 — ⚠️ Đã merge + deploy module H2O Teaching Intelligence Center V1, CẦN CHẠY MIGRATION 0029.**
- Đã merge `feature/teaching-intelligence-center-v1` vào `main`, deploy production thành công (health check OK, `mode: production`).
- Trước khi tích hợp đã kiểm tra tính nhất quán toàn bộ webapp theo yêu cầu: phát hiện hệ thống vai trò trong module nguồn (mentor/instructor/reviewer/training_manager/admin/owner) không khớp với vai trò thật trong database (chỉ có `teacher/admin/owner` cho người dạy) — đã thu hẹp lại đúng theo dữ liệu thật, không tạo hệ vai trò song song. Cũng phát hiện 4 trang `/instructor`, `/instructor/classes`, `/instructor/students`, `/instructor/assessments` trước đây **đều hiển thị cùng 1 component demo giả lập** (không đọc dữ liệu thật) — đã thay bằng dữ liệu Supabase thật cho cả 4 trang.
- **Việc bắt buộc:** mở file `supabase/_RUN-0029-ONLY.sql` (mới) → copy toàn bộ → dán vào Supabase SQL Editor (New query) → Run. Đã kiểm tra không trùng tên với 28 migration trước.
- Cho tới khi chạy: 4 trang trên (`/instructor` và các trang con) sẽ báo lỗi hoặc hiện rỗng. Các phần khác của webapp không bị ảnh hưởng.
- Nội dung chính: Trung tâm chỉ huy giảng dạy (Command Center) xếp việc cần làm theo mức khẩn cấp thật; Trung tâm học viên với Risk Radar (cảnh báo học viên cần hỗ trợ dựa trên dữ liệu thật: không hoạt động, tiến độ thấp, quá hạn, chờ phản hồi, năng lực thấp) + ghi chú can thiệp riêng tư; Danh sách lớp với tiến độ trung bình thật; Feedback Studio chấm bài hợp nhất (bài tập lớp học cũ + bài tập Brain Studio) với xác nhận rõ ràng trước khi đánh dấu "sẵn sàng làm portfolio", và duyệt/yêu cầu sửa thành quả Create Outcome.
- Chi tiết đầy đủ, bao gồm các phần cố ý chưa làm (vai trò mentor/reviewer chưa có trong DB, Content & Approval dùng lại trang `/reviews` có sẵn, chưa có bảng lịch buổi học...): `docs/H2OBOOK-TEACHING-INTELLIGENCE-CENTER-V1-INTEGRATION-REPORT.md`.

**2026-08-03 — ⚠️ Đã merge + deploy module H2O Learn Mastery Engine V1, CẦN CHẠY MIGRATION 0028.**
- Đã merge `feat/learn-mastery-engine-v1` vào `main`, deploy production thành công.
- Trước khi tích hợp, đã kiểm tra tính nhất quán toàn bộ webapp theo yêu cầu: phát hiện và sửa 1 lỗi báo cáo trước đó (module 10 nói sai "6 recipes", thực tế là 5), và 1 chỗ lệch tên (recipe slug của module 10 chưa khớp với module 11) — đã đối chiếu và sửa cả hai, xác nhận không còn lệch dữ liệu giữa các module.
- **Việc bắt buộc:** chạy `supabase/_RUN-0028-ONLY.sql` trên Supabase SQL Editor (New query → Run). Đã kiểm tra không trùng tên với 27 migration trước.
- Cho tới khi chạy: trang `/student/learn` (Học & ghi nhớ) và mục "Nhiệm vụ hôm nay/Skill Map" thật trên Smart Home sẽ không có dữ liệu (rơi về trạng thái rỗng an toàn, không lỗi trang).
- Chi tiết: `docs/H2OBOOK-LEARN-MASTERY-ENGINE-V1-INTEGRATION-REPORT.md`.
- **✅ Đã xác nhận migration 0028 chạy thành công** (kiểm tra qua API: bảng `learning_skill_evidence` tồn tại, cột `skill_keys` đã có trong `create_outcome_projects`). `/student/learn` và dữ liệu thật trên Smart Home đã hoạt động đầy đủ.

**2026-08-03 — ⚠️ Đã merge + deploy 2 module lớn (H2O Brain Learning Intelligence V3 + Compact Navigation V2), CẦN CHẠY MIGRATION MỚI NGAY.**
- Đã merge `feat/h2obook-learning-intelligence-v3` + `feat/compact-learner-navigation-v2` vào `main`, deploy production thành công (`h2obook-app.vercel.app`, health check OK).
- **Việc bắt buộc phải làm ngay:** migration `0026_h2obook_learning_intelligence_v3.sql` (26 bảng mới cho Knowledge Space/Brain Learning) **chưa được chạy trên Supabase thật**. Trước khi chạy, mở file `supabase/_RUN-ONCE-COMBINED-MIGRATIONS.sql` bản mới nhất, tìm đoạn `-- FILE: 0026_h2obook_learning_intelligence_v3.sql` (ở cuối file) và chỉ copy phần đó (không chạy lại từ đầu vì 0001-0025 đã có rồi) → dán vào Supabase SQL Editor → Run 1 lần.
- **Cho tới khi chạy migration này:** trang `/instructor/brain-studio` và `/student/spaces/[slug]` cùng toàn bộ API `/api/learning/*` sẽ báo lỗi (bảng chưa tồn tại). Các trang khác không bị ảnh hưởng.
- Chi tiết đầy đủ 2 module này: `docs/H2OBOOK-LEARNING-INTELLIGENCE-V3-INTEGRATION-REPORT.md` và `docs/H2OBOOK-COMPACT-NAVIGATION-V2-INTEGRATION-REPORT.md`.

**2026-08-03 — Sự cố khi chạy migration 0026 (đã sửa):**
- Bạn chạy `_RUN-0026-ONLY.sql`, gặp lỗi: `relation "assignment_submissions" already exists`.
- **Nguyên nhân (lỗi thật của tôi khi viết migration):** migration `0002` (đã chạy từ trước) đã có sẵn 1 bảng tên `assignment_submissions` (hệ bài tập cũ, đơn giản). Migration `0026` mới vô tình đặt trùng tên cho 1 bảng khác hẳn (hệ chấm bài cho Knowledge Space). Vì `0026` chạy trong 1 transaction duy nhất, lỗi trùng tên khiến **toàn bộ 21 bảng mới đều không được tạo** (tự động rollback sạch — đã xác minh qua API, không có bảng nào trong số 21 bảng mới tồn tại, kể cả bảng bị trùng tên).
- **Đã sửa:** đổi tên bảng mới thành `brain_assignment_submissions` để không trùng. Đã kiểm tra lại toàn bộ 21 bảng mới + kiểu dữ liệu + hàm trong `0026`, xác nhận không còn trùng tên với bất kỳ thứ gì trong 25 migration trước.
- **Việc bạn cần làm:** vì lần chạy trước đã tự rollback sạch (không để lại gì), **không cần dọn dẹp gì thêm** — chỉ cần mở lại file `supabase/_RUN-0026-ONLY.sql` (đã cập nhật bản sửa), copy toàn bộ, dán vào Supabase SQL Editor (mở **New query** mới) → Run lại từ đầu.

**2026-08-03 — ⚠️ Đã merge + deploy thêm module H2O Create Outcome Studio V1, CẦN CHẠY MIGRATION 0027.**
- Đã merge `feature/create-outcome-studio-v1` vào `main`, deploy production thành công (health check OK).
- **Việc bắt buộc:** mở file `supabase/_RUN-0027-ONLY.sql` (mới) → copy toàn bộ → dán vào Supabase SQL Editor (New query) → Run. Đã kiểm tra không trùng tên với 26 migration trước.
- Cho tới khi chạy: `/student/create` (Studio tạo thành quả học tập) và trang chia sẻ công khai `/verify-outcome/[slug]` sẽ báo lỗi. Các phần khác không ảnh hưởng.
- Chi tiết: `docs/H2OBOOK-CREATE-OUTCOME-STUDIO-V1-INTEGRATION-REPORT.md`.

**2026-08-03 — ✅ Migration 0026 chạy thành công.** Đã kiểm tra qua API: đầy đủ cả 21 bảng mới (knowledge_spaces, knowledge_space_versions, learning_sections, learning_blocks, brain_templates, experience_cases, rubrics, assignment_definitions, brain_assignment_submissions, block_progress, knowledge_space_progress, learner_notes, learner_experiences, learning_results, share_card_templates, shared_results, journal_entries, knowledge_chunks, knowledge_nodes, knowledge_edges, completion_conditions) đều đã tồn tại thật trên Supabase production. Từ giờ `/instructor/brain-studio` và `/student/spaces/[slug]` đã có thể dùng được với dữ liệu thật (đăng nhập bằng tài khoản owner/teacher để tạo Knowledge Space đầu tiên, gắn vào 1 bài học đã có).

---

## 0.A NHẬT KÝ KẾT NỐI THỰC TẾ (cập nhật liên tục — đọc mục này trước tiên)

> Mục này ghi lại chính xác đã làm tới đâu với tài khoản Supabase/Cloudflare thật của bạn, để lần sau mở file là biết ngay đang đứng ở bước nào.

**2026-07-31 — Bắt đầu Phase 4 (kết nối hạ tầng thật):**

- Đã xác nhận project Supabase thật của bạn: `thuyh2omakeup@gmail.com's H2OBOOK Project`, mã project `oamczuibcgjqmjxqntsn`, vùng Southeast Asia (ap-southeast-1), trạng thái Healthy, **chưa có migration/backup nào** (database đang trống).
  - URL: `https://oamczuibcgjqmjxqntsn.supabase.co`
- Đã xác nhận tài khoản Cloudflare của bạn đã đăng nhập được, nhưng **chưa có R2 bucket nào**.
- Đã chuẩn bị sẵn 1 file SQL gộp toàn bộ 25 migration theo đúng thứ tự tại:
  `supabase/_RUN-ONCE-COMBINED-MIGRATIONS.sql`
  → Đây là cách chạy migration **không cần cài đặt Supabase CLI hay psql** — chỉ cần mở file này, copy toàn bộ nội dung, dán vào **Supabase Dashboard → SQL Editor → New query → Run**, chạy 1 lần duy nhất cho project trống nói trên.
  → File này cố ý đặt tên có dấu `_` ở đầu để không bị các script kiểm tra migration trong repo tưởng nhầm là 1 migration mới — đã kiểm tra lại, không ảnh hưởng gì đến hệ thống migration hiện có.
- **Đã tạo file `.env.local`** (không commit lên Git — đã kiểm tra `.gitignore` chặn đúng) với các giá trị đã biết điền sẵn: `NEXT_PUBLIC_APP_MODE=production`, `NEXT_PUBLIC_SUPABASE_URL=https://oamczuibcgjqmjxqntsn.supabase.co`, toàn bộ feature flag V4.14/V5 giữ nguyên trạng thái đã kiểm chứng khi deploy production gần nhất. Các ô khóa bí mật (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, R2...) đang để trống, chờ bạn cung cấp.
  - Lưu ý: app **tự động vẫn chạy Demo Mode an toàn** cho tới khi 2 khóa Supabase được điền — không sợ bật nhầm production khi chưa sẵn sàng (cơ chế: `lib/runtime-config.ts` → `getAppMode()`).
- **Việc tiếp theo (đang chờ bạn):**
  1. Chạy file `_RUN-ONCE-COMBINED-MIGRATIONS.sql` trong Supabase SQL Editor (xem hướng dẫn chi tiết bên dưới mục "Việc cần làm").
  2. Lấy 2 khóa API từ Supabase (Project Settings → API): `anon public key` và `service_role key` — gửi lại để điền vào `.env.local`.
  3. Quyết định tạo R2 bucket trên Cloudflare ngay bây giờ hay sau khi Supabase chạy ổn.
- **Trạng thái Cloudflare Stream (video):** chưa xử lý — sẽ làm sau khi Supabase + R2 xong, theo đúng thứ tự ưu tiên ở mục 5.

**2026-07-31 — Sự cố khi chạy migration lần 1 (đã sửa):**

- Bạn chạy file `_RUN-ONCE-COMBINED-MIGRATIONS.sql` lần đầu, gặp lỗi: `function public.is_platform_admin() does not exist`.
- **Nguyên nhân:** lỗi có sẵn trong chính mã nguồn migration gốc (`0017_h2obook_v411_marketplace_enterprise.sql`) — file này dùng hàm `is_platform_admin()` để phân quyền cho 2 bảng ít quan trọng (`marketplace_moderation_cases`, `sla_incidents`) nhưng không có file nào định nghĩa hàm đó trước. Không phải do bạn thao tác sai.
- **Đã sửa:** thêm định nghĩa hàm `is_platform_admin()` vào đầu file `0017...sql`, mặc định luôn trả về `false` (an toàn — vì vai trò "platform admin" chưa thực sự tồn tại trong hệ thống tài khoản, khớp với việc `NEXT_PUBLIC_PLATFORM_ADMIN_V1=false` trong toàn bộ hệ thống). Đã tạo lại file `_RUN-ONCE-COMBINED-MIGRATIONS.sql` (bản v2) với bản vá này.
- **Việc bạn cần làm:** vì Postgres tự động hủy (rollback) toàn bộ phần chưa `commit` khi gặp lỗi giữa chừng, project của bạn hiện đang ở trạng thái dở dang (file 0001-0006 đã commit thành công trước khi lỗi xảy ra ở file 0017, nên chạy lại từ đầu mà không dọn trước sẽ báo "type member_role already exists"). Cách xử lý:
  1. Chạy file `supabase/_RESET-BEFORE-RERUN.sql` (mới tạo) trong 1 **New query** riêng trước — xóa sạch schema `public` (an toàn, project chưa có dữ liệu thật, không đụng auth/storage nội bộ Supabase).
  2. Sau đó mở **New query** khác, dán lại toàn bộ `supabase/_RUN-ONCE-COMBINED-MIGRATIONS.sql` (đã có bản vá `is_platform_admin`), chạy lại từ đầu.
  3. Nếu vẫn còn báo lỗi ở bất kỳ dòng nào khác, gửi lại nguyên văn lỗi để tôi kiểm tra tiếp — đây là lần đầu chạy thật trên hạ tầng thật nên có thể còn sai sót cần dò từng lỗi một.

**2026-07-31 — Sự cố lần 2 (đã có script dọn sạch):**
- Bạn chạy lại toàn bộ file combined từ đầu nhưng chưa dọn trước → lỗi `type "member_role" already exists` (vì 0001-0006 đã commit từ lần chạy trước). Đã tạo `supabase/_RESET-BEFORE-RERUN.sql` để dọn sạch an toàn — xem hướng dẫn 2 bước ở trên.

**2026-07-31 — ✅ Migration chạy thành công.** Toàn bộ 25 file migration đã áp dụng xong vào project Supabase thật (`oamczuibcgjqmjxqntsn`). Database đã có đầy đủ bảng (sách, CRM, khóa học, đơn hàng, v.v.), RLS, trigger tạo workspace tự động khi có người đăng ký.
- **Đã điền vào `.env.local`:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (dạng khóa mới `sb_publishable_...`), `SUPABASE_SERVICE_ROLE_KEY` (dạng khóa mới `sb_secret_...`) — lấy từ Project Settings → API. File này không lên Git.
- **Việc tiếp theo:** (1) đăng nhập lần đầu bằng tài khoản chủ (owner) để hệ thống tự tạo `organization` đầu tiên, sau đó lấy `ACADEMY_ORGANIZATION_ID` điền vào env; (2) tạo bucket R2 trên Cloudflare cho ảnh/file.

**2026-07-31 — ✅ Đã đưa Vercel production sang Supabase thật.** Thêm 6 biến vào Vercel (Project Settings → Environment Variables → Production): `NEXT_PUBLIC_APP_MODE=production`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ACADEMY_ORGANIZATION_SLUG=thuyh2o-academy`. Deploy lại (`vercel --prod`), đã alias vào `h2obook-app.vercel.app`.
- **Đã xác minh qua `/api/health` và `/api/readiness`:** `"mode":"production"`, `"database":{"configured":true}`. Trang web thật giờ đọc/ghi Supabase thật, không còn Demo Mode.
- **Còn thiếu (theo `missingRequired`):** `storage` (R2), `queue` (Redis), `scanner` (file scan), `payment`, `email` — đúng như kế hoạch, sẽ làm tiếp theo thứ tự ưu tiên ở mục 5.
- **Lưu ý quan trọng:** vì database Supabase còn trống (chưa có khóa học/sách thật), trang công khai (`/academy/...`) hiện sẽ hiển thị danh mục trống thay vì nội dung mẫu — đây là điều đã báo trước và người dùng đồng ý đánh đổi để bắt đầu nhập dữ liệu thật.

**2026-07-31 — ✅ Tài khoản chủ (owner) đầu tiên đã tạo, đã cấu hình `ACADEMY_ORGANIZATION_ID`.**
- Tài khoản chủ: `maxsamuelbldhp@gmail.com` (Nguyen Van Tuan), đăng ký lúc 2026-07-31 15:28 UTC.
- Hệ thống tự động tạo workspace/organization đầu tiên (trigger `handle_new_user`): `organization_id = 4cdbbcbf-d6e1-4d06-bb87-4f63c9cac01f`, slug `nguyen-van-tuan-cc2e5221`.
- Đã điền `ACADEMY_ORGANIZATION_ID` + `ACADEMY_ORGANIZATION_SLUG` vào `.env.local` và Vercel production, deploy lại thành công.
- **Việc tiếp theo:** tạo bucket R2 trên Cloudflare cho ảnh/file, rồi đồng bộ catalog khóa học lần đầu (mục 5, bước 2 và 4).

---

## 0. Tình trạng hiện tại: hệ thống đang chạy ở "chế độ Demo"

Toàn bộ dữ liệu bạn thấy trên `h2obook-app.vercel.app` hiện nay (sách mẫu, khóa học mẫu, học viên mẫu...) là **dữ liệu giả lập nạp sẵn trong code**, không lưu vào đâu cả — mỗi lần tải lại trang là quay về dữ liệu gốc. Đây gọi là **Demo Mode**.

Lý do: chưa có tài khoản Supabase (database) thật được kết nối. Chỉ cần bật Supabase, hệ thống tự động chuyển sang **Production Mode** — dữ liệu thật, lưu vĩnh viễn.

```
Production Mode = NEXT_PUBLIC_APP_MODE=production  +  đã điền NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
```
(nguồn: `lib/runtime-config.ts`, hàm `getAppMode()`)

Các mảnh khác (kho ảnh R2, video Cloudflare Stream, thanh toán, email) **độc lập với nhau** — bật Supabase trước, rồi bật từng mảnh khác khi cần, không phải bật hết cùng lúc.

---

## 1. Bản đồ tổng quan — mỗi loại dữ liệu đi đâu

| Loại dữ liệu | Lưu ở đâu | Dịch vụ cần | Bắt buộc? |
|---|---|---|---|
| Nội dung sách (trang, khối văn bản, thiết kế) | **Database** (Supabase Postgres), dạng bảng có cấu trúc — **không phải file** | Supabase | Bắt buộc |
| Ảnh, PDF, file tải lên | **Kho file** (Cloudflare R2) — Database chỉ lưu tên/đường dẫn file | Supabase + R2 | Bắt buộc để có ảnh thật |
| Video bài giảng | **Cloudflare Stream** (dịch vụ phát video riêng) — không lưu trong R2, không lưu trong Database | Cloudflare Stream | Cần nếu có video |
| CRM / hồ sơ đăng ký / lead | **Database** (Supabase Postgres) | Supabase | Bắt buộc |
| Khóa học, bài học, tiến độ học | **Database** (Supabase Postgres) | Supabase | Bắt buộc |
| Chứng nhận / xác minh bằng | **Database** (Supabase Postgres), chỉ đọc công khai qua đường dẫn riêng | Supabase | Tùy chọn |
| Thanh toán | Không lưu số thẻ — chỉ lưu trạng thái đơn hàng trong Database, xử lý qua cổng thanh toán ngoài | Supabase + 1 cổng thanh toán (VNPay/Momo/Stripe...) | Cần nếu bán hàng online |
| Email xác nhận/mời | Không lưu — gửi qua dịch vụ email ngoài | Resend (khuyến nghị) | Cần nếu có đăng ký/mời tài khoản |
| Xử lý DOCX/PDF nặng (nhập tài liệu) | Hàng đợi xử lý nền (Redis) + máy xử lý riêng | Redis + Document Worker | Chỉ cần nếu dùng tính năng nhập DOCX/PDF phức tạp |

**Điểm quan trọng nhất cần nhớ:** *Nội dung sách và khóa học không phải là "file" — chúng là dữ liệu có cấu trúc trong database.* Chỉ có ảnh/PDF/video mới là "file" thật sự, và file thì đi vào R2 (ảnh/PDF) hoặc Cloudflare Stream (video), không đi vào Supabase.

---

## 2. Chi tiết từng loại dữ liệu

### 2.1 Nội dung sách (sách tự thiết kế, sách chỉnh sửa)

- Mỗi cuốn sách = 1 dòng trong bảng `books`, mỗi trang = 1 dòng trong `book_pages`, mỗi khối chữ/hình = 1 dòng trong `page_elements`.
- Có thêm một mô hình nội dung mới hơn (`book_documents` + `content_nodes`) dùng cho sách dạng "cây nội dung" (chương/mục/đoạn văn), có lưu **lịch sử phiên bản** (`content_node_versions`) — mỗi lần sửa đều giữ lại bản cũ.
- Ảnh trong sách chỉ lưu **tham chiếu** (assetId) trỏ tới R2, không lưu file ảnh trực tiếp trong Database — vì vậy Database luôn nhẹ, không phình to dù học viên upload nhiều ảnh.
- Phân quyền: mỗi sách thuộc về 1 tổ chức (`organization_id`), chỉ chủ sở hữu/quản trị/designer trong tổ chức đó xem/sửa được — không ai lẫn dữ liệu qua tổ chức khác.

### 2.2 Ảnh, PDF, file tải lên (Design Library, Brand Kit, sách remix của học viên)

- Luồng upload: xin URL upload có chữ ký từ hệ thống → tải file thẳng lên R2 → hệ thống xác nhận, quét virus, kiểm tra đúng loại file → ghi 1 dòng vào bảng `assets`.
- **Quota lưu trữ theo học viên: 300 MB/học viên** (mặc định), chỉ áp dụng cho vai trò "student" — chủ/quản trị/giáo viên không bị giới hạn. Có thể chỉnh riêng từng học viên nếu cần.
- **Giới hạn 1 file: tối đa 250 MB**.
- **Nén ảnh tự động**: chỉ áp dụng cho ảnh Brand Kit và ảnh học viên tự tải lên khi "remix" sách (nén về WebP, giảm kích thước, chất lượng 82%). Ảnh nhập vào qua công cụ nhập tài liệu chính (Word/PDF/HTML) **không bị nén** — giữ nguyên gốc để không hỏng chất lượng/EXIF khi phục dựng tài liệu. Đây là quyết định có chủ đích, không phải thiếu sót.

### 2.3 Video bài giảng

- **Không lưu video trong hệ thống này.** Video phải upload lên **Cloudflare Stream** (ngoài H2OBOOK, qua trang quản trị hoặc API riêng của Cloudflare).
- Sau khi upload, Cloudflare trả về 1 mã (playback ID) — chỉ cần dán mã đó vào cột `video_playback_id` của bài học trong Database, video sẽ tự phát trên trang học viên.
- Nếu chưa dán mã, trang học viên sẽ hiện dòng nhắc: *"Thêm Cloudflare Stream playback ID trong bảng academy_course_lessons để phát video riêng tư tại đây."*
- Video công khai (không cần bảo mật cao) phát được ngay không cần thêm gì. Muốn video riêng tư/bảo mật hơn thì cần điền thêm `NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE`.

### 2.4 CRM / hồ sơ đăng ký / lead khách hàng

Hiện có **2 hệ thống CRM riêng biệt, chưa nối với nhau** (do làm ở 2 giai đoạn khác nhau):

1. **`academy_applications`** — form "Đăng ký học" công khai trên trang chủ/trang khóa học. Luồng: khách điền form → `new` → admin duyệt `approved` → hệ thống mời tạo tài khoản `invited` → khách đặt mật khẩu, thành học viên thật `converted`.
2. **`admission_leads` + `customer_applications` + `support_tickets` + `approval_requests`** — bộ CRM nội bộ đầy đủ hơn (Operations Center: `/operations`), có pipeline bán hàng (mới → liên hệ → tư vấn → đủ điều kiện → đặt cọc → đã thanh toán → đã ghi danh), có ticket hỗ trợ, có hàng chờ duyệt nội dung.

**Đã nối một chiều (2026-07-31):** mỗi khi có người nộp form đăng ký công khai, hệ thống tự động tạo (hoặc cập nhật nếu trùng email) 1 dòng trong `admission_leads` để đội sale/CRM thấy ngay trong `/operations/admissions`. Cầu nối này chỉ *thêm dữ liệu*, không đụng vào luồng duyệt/cấp tài khoản gốc của `academy_applications` — nếu cầu nối lỗi vì lý do gì, việc duyệt hồ sơ và cấp quyền học vẫn chạy bình thường (lỗi bị nuốt âm thầm, có chủ đích).

Ánh xạ trạng thái: nộp form → lead `new`; admin duyệt (cấp tài khoản học viên) → lead `enrolled`; admin từ chối → lead `lost`. Cầu nối tìm lead cũ theo `(organization_id, email, source='academy_public')` để không tạo trùng khi có nhiều lượt cập nhật trên cùng 1 người.

Code: `lib/operations/lead-bridge.ts` (hàm `syncAdmissionLeadFromApplication`), gọi từ `app/api/academy/applications/route.ts` (khi nộp form), `lib/academy/service.ts` hàm `approveAcademyApplication` (khi duyệt), và `app/api/academy/applications/[id]/route.ts` (khi từ chối).

**Lưu ý:** chưa test được với dữ liệu Supabase thật (hệ thống vẫn ở Demo Mode tại thời điểm viết) — cần test lại luồng thật sau khi kết nối Supabase (xem mục 5, bước 7).

**Về phân quyền:** CRM nội bộ có sẵn các vai trò `admissions/support/finance/content_manager` trong thiết kế, nhưng **các vai trò này chưa thực sự tồn tại trong hệ thống tài khoản** — hiện tại chỉ có `owner/admin/teacher/student`. Nghĩa là: hôm nay, chỉ tài khoản `owner`/`admin` truy cập được `/operations`. Muốn có nhân viên CRM/sale/support riêng (không phải admin toàn quyền) thì cần làm thêm 1 bước nâng cấp (thêm vai trò mới vào database).

### 2.5 Khóa học và tiến độ học

- `academy_courses` (khóa học) → `academy_course_modules` (chương) → `academy_course_lessons` (bài học, có video).
- Mỗi bài học có ô `content` nhỏ để lưu tóm tắt bài học + checklist thực hành đi kèm video — **không phải chỗ để nhét tài liệu dài**, chỉ để hỗ trợ video.
- `academy_lesson_progress` ghi mỗi học viên học đến đâu, xem bao lâu, hoàn thành chưa.
- `academy_skill_progress` tự động tính % kỹ năng dựa trên các bài học đã hoàn thành có gắn "skill_keys" giống nhau — cập nhật tự động, không cần nhập tay.

### 2.6 Chứng nhận (bằng/chứng chỉ)

- Bảng `certificate_issues`, tra cứu công khai tại `/verify/<mã-chứng-nhận>` — chỉ hiển thị tên học viên/khóa học/ngày cấp/trạng thái, **không hiển thị mã xác minh bí mật hay tên tổ chức** (đã khóa ở tầng database, không ai đọc trực tiếp được bảng này qua API công khai).

---

## 3. Bảng biến môi trường cần điền (file `.env.local`, không phải `.env.example`)

> Không bao giờ đưa các giá trị thật này vào `.env.example` hay commit lên GitHub — chỉ điền vào `.env.local` (file này không được đưa lên Git) hoặc mục Environment Variables trên Vercel.

### 3.1 Nhóm BẮT BUỘC để rời khỏi Demo Mode

| Biến | Lấy ở đâu | Ghi chú |
|---|---|---|
| `NEXT_PUBLIC_APP_MODE` | Tự đặt | Đặt thành `production` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API | Khóa công khai, an toàn để lộ ra client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API | **Tuyệt mật** — chỉ dùng server-side, không bao giờ để lộ ra trình duyệt |
| `ACADEMY_ORGANIZATION_ID` | Truy vấn bảng `organizations` sau khi tài khoản chủ đầu tiên đăng nhập | Ưu tiên hơn slug |

### 3.2 Nhóm BẮT BUỘC để có ảnh/file thật (Cloudflare R2)

| Biến | Lấy ở đâu |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare Dashboard → R2 → Overview |
| `R2_ACCESS_KEY_ID` | Cloudflare Dashboard → R2 → Manage API Tokens → tạo token mới |
| `R2_SECRET_ACCESS_KEY` | Cùng bước trên, chỉ hiện 1 lần khi tạo — lưu lại ngay |
| `R2_BUCKET` | Tên bucket bạn tạo (gợi ý: `h2obook`) |
| `R2_PUBLIC_OR_CDN_URL` | Bật "Public Access" cho bucket hoặc gắn domain riêng, lấy URL đó |

### 3.3 Nhóm CẦN NẾU có video bài giảng

| Biến | Lấy ở đâu |
|---|---|
| `NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE` | Cloudflare Dashboard → Stream → Overview (mã "customer code" hiện trong URL embed mẫu) |

*(Không cần biến môi trường nào khác cho video — chỉ cần upload video lên Cloudflare Stream rồi dán playback ID thẳng vào Database qua Supabase Table Editor hoặc qua trang quản trị nội bộ khi có.)*

### 3.4 Nhóm CẦN NẾU bán khóa học/membership online

| Biến | Lấy ở đâu |
|---|---|
| `PAYMENT_PROVIDER` | Tên cổng thanh toán bạn chọn (không được để `manual` nếu muốn tự động) |
| `PAYMENT_API_KEY` | Từ cổng thanh toán đó |
| `PAYMENT_CHECKOUT_URL` | Từ cổng thanh toán đó |
| `PAYMENT_WEBHOOK_SECRET` | Từ cổng thanh toán đó — dùng để xác minh webhook báo "đã thanh toán" là thật |
| `EMAIL_PROVIDER` | Khuyến nghị `resend` |
| `EMAIL_API_KEY` | Từ Resend Dashboard |
| `EMAIL_FROM` | Ví dụ: `H2OBOOK Academy <academy@thuyh2o.vn>` (cần domain email riêng) |

### 3.5 Nhóm TÙY CHỌN (có thể để trống lâu dài, hệ thống vẫn chạy tốt)

| Nhóm | Biến | Khi nào cần |
|---|---|---|
| Xử lý DOCX/PDF nặng | `REDIS_URL`, `DOCUMENT_WORKER_URL`, `DOCUMENT_WORKER_SECRET` | Chỉ cần nếu dùng tính năng nhập file Word/PDF phức tạp thường xuyên. Không có thì tính năng nhập vẫn chạy ở "chế độ giả lập" trong Demo Mode, nhưng ở Production Mode mà thiếu Redis thì tính năng này báo lỗi (các phần khác vẫn chạy bình thường) |
| Quét virus file upload | `FILE_SCAN_URL`, `FILE_SCAN_TOKEN` | Nên có trước khi mở public upload rộng rãi |
| AI hỗ trợ | `AI_GATEWAY_URL`, `AI_GATEWAY_TOKEN` | Không cần — hệ thống có "Smart Core Local" chạy đầy đủ không cần AI |
| Theo dõi lỗi | `SENTRY_DSN` | Nên có khi đã có học viên thật dùng hàng ngày |

---

## 4. Ước tính chi phí lưu trữ cho ~500 học viên (tăng chậm)

> Đây là ước tính tham khảo dựa trên cấu trúc hệ thống thực tế, không phải báo giá chính thức — giá dịch vụ có thể thay đổi, kiểm tra lại trang giá của từng bên trước khi quyết định.

| Dịch vụ | Vai trò | Gói đề xuất ban đầu | Ước tính chi phí/tháng |
|---|---|---|---|
| Supabase | Database (sách, CRM, khóa học, tiến độ) | Pro (8GB DB, 100GB file đi kèm, 100k user hoạt động) | ~$25 |
| Cloudflare R2 | Ảnh/PDF/file | Trả theo dung lượng, không phí tải xuống (egress free) | Vài USD (300MB × 500 học viên là mức trần lý thuyết, thực tế thấp hơn nhiều vì ít ai dùng hết quota) |
| Cloudflare Stream | Video bài giảng | Trả theo phút lưu trữ + phút phát | Tùy tổng số phút video, cần ước tính riêng theo số bài giảng thực tế |
| Resend (email) | Gửi mail mời/xác nhận/biên nhận | Free tier ~3,000 email/tháng thường đủ cho 500 học viên | $0 lúc đầu |
| Redis (nếu cần) | Hàng đợi xử lý DOCX/PDF | Gói nhỏ (Upstash free/trả theo dùng) | $0–10 |

**Điểm mấu chốt về tăng trưởng dung lượng (đã phân tích trước đây, nay xác nhận lại đúng với code hiện tại):**
- Nội dung sách/CRM/khóa học nằm trong Database dạng bảng — **không nhân bản theo dung lượng lớn** dù có 500 hay 5000 học viên, vì mỗi dòng dữ liệu rất nhẹ (vài KB).
- Phần **thực sự phình theo số học viên** là ảnh/file cá nhân (thiệp, bằng, ảnh remix sách riêng) — đây là lý do quota 300MB/học viên đã được làm để chặn tăng trưởng không kiểm soát.
- Video là chi phí *cố định theo số bài giảng*, không nhân theo số học viên xem (Cloudflare Stream tính theo lượt phát, không phải theo dung lượng nhân bản).

---

## 5. Việc cần làm để đưa vào vận hành (theo thứ tự ưu tiên)

1. **Tạo project Supabase thật** (✅ đã có — xem mục 0.A) → mở Supabase Dashboard → SQL Editor → New query → dán toàn bộ nội dung file `supabase/_RUN-ONCE-COMBINED-MIGRATIONS.sql` (gộp sẵn 25 migration đúng thứ tự) → Run 1 lần → điền mục 3.1 → chuyển `NEXT_PUBLIC_APP_MODE=production`.
2. **Tạo bucket R2** → điền mục 3.2 → bật "Public Access"/domain riêng cho ảnh hiển thị được.
3. **Đăng nhập lần đầu bằng tài khoản chủ (owner)** → hệ thống tự tạo `organization` đầu tiên → lấy `ACADEMY_ORGANIZATION_ID` điền vào env.
4. **Đồng bộ catalog khóa học lần đầu** (gọi 1 API đồng bộ 1 lần sau khi có Supabase — đã có sẵn trong `docs/ACADEMY-PRODUCTION-RUNBOOK.md`).
5. Nếu có video: **tạo tài khoản Cloudflare Stream**, upload video, dán playback ID vào từng bài học.
6. Nếu bán hàng online: **đăng ký cổng thanh toán** + **Resend email** → điền mục 3.4.
7. **Test toàn bộ luồng thật** với 1 email test: đăng ký → admin duyệt → nhận mail mời → đặt mật khẩu → vào học → xem tiến độ lưu đúng không.

*(Chi tiết kỹ thuật đầy đủ hơn cho bước 1 và 4 xem thêm `docs/ACADEMY-PRODUCTION-RUNBOOK.md` đã có sẵn trong repo.)*

---

## 6. Những điều CHƯA làm — biết trước để không bất ngờ

- 2 hệ thống CRM (mục 2.4) đã nối một chiều (form công khai → CRM nội bộ), nhưng **chưa test với dữ liệu Supabase thật**.
- Vai trò nhân sự riêng (sale/support/kế toán/content manager) chưa có tài khoản thật — hiện chỉ có owner/admin/teacher/student.
- Chưa test với dữ liệu/tài khoản Supabase thật trong phiên làm việc này — toàn bộ vẫn đang ở Demo Mode tại thời điểm viết tài liệu này.
- Redis/Document Worker chưa được cấu hình — nếu bật Production Mode mà không cấu hình Redis, riêng tính năng nhập DOCX/PDF phức tạp sẽ báo lỗi (các phần khác không ảnh hưởng).
##7. CÁC MÃ ĐĂNG KÝ CLOUDFLARE 
Token value: cfat_aCopOBrNqjFkLF0VSzaItpKjh35hFI9b48cPeeaKfddc2293
Access Key ID: 
2a1fbefff4edef8805115a1db6c18b6e
Secret Access Key:
6e681d64212f0c24460266317e0896566b18bd399830a752454ef29fc5a38a32
Use jurisdiction-specific endpoints for S3 clients:
https://2b7da61131f811f331a40966c402c82f.r2.cloudflarestorage.com
Account ID:
https://dash.cloudflare.com/2b7da61131f811f331a40966c402c82f/r2/api-tokens/success
