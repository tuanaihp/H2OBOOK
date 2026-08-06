# HƯỚNG DẪN LƯU TRỮ HỆ THỐNG H2OBOOK

> Tài liệu này giải thích: mỗi loại dữ liệu (nội dung sách, ảnh, video, CRM, khóa học, tài liệu chỉnh sửa) đang lưu ở đâu, cần tài khoản/dịch vụ gì để đưa vào vận hành thật, và cách kết nối. Viết cho người không rành kỹ thuật — chỉ cần đọc bảng và làm theo từng bước.
>
> Cập nhật lần cuối: 2026-07-31. Nếu code thay đổi nhiều, nhờ Claude Code đọc lại repo và cập nhật file này.

---

**2026-08-06 — 🧩 Đã merge + deploy: nhóm tài liệu theo chương trình/module (phần được duyệt của module 20) — ⚠️ CẦN CHẠY MIGRATION 0040.**

**Việc bạn cần làm:** Supabase → SQL Editor → dán `supabase/_RUN-0040-ONLY.sql` → Run.

- **Bối cảnh**: bạn nhờ đánh giá và tích hợp `v5/20-h2obook-student-experience-builder-final-v2`. Module đề xuất **12 bảng** dựng thành một hệ CMS quản lý sidebar học viên hoàn chỉnh (versioning, draft/publish/rollback, luật hiển thị theo role/membership, override từng học viên) — audit đầy đủ ở `docs/module-20-student-experience-builder-audit.md`.
- **Từ chối 11/12 bảng vì trùng lặp trực tiếp** với 3 hệ đã deploy trong chính phiên này: `career_stages`/`career_stage_resources` (0033/0036), bộ giải quyết quyền `lib/content-access/resolver.ts` (0034), và **sidebar học viên thật đang chạy production** `lib/student/compact-navigation.ts`. Rủi ro cao nhất trong đề xuất gốc là thay thế toàn bộ sidebar đang sống bằng cấu hình database — việc này **không đụng tới**.
- **Lỗi bảo mật cùng khuôn mẫu đã gặp ở module 18 và 19**: hàm xác thực riêng của module `h2obook_can_manage_student_experience()` cho phép vai trò `'academic_ops'` — vai trò **không tồn tại** trong `public.member_role` (chỉ có `owner/admin/designer/partner/teacher/student`) — và tự dò bảng `workspace_members` không có thật, thay vì dùng `has_org_role()` đã có.
- **Vì đây là quyết định phạm vi sản phẩm (không phải sửa lỗi), tôi dừng lại hỏi bạn** thay vì tự quyết — bạn chọn phương án hẹp nhất trong 4 phương án: **chỉ nhóm tài liệu trong 1 giai đoạn thành chương trình/module**, không đụng sidebar, không dựng hệ versioning.
- **Đã xây đúng phần đó, cộng thêm vào hệ có sẵn**: bảng mới `career_stage_programs` (tên, mô tả, thuộc `career_stages` qua khóa ngoại thật — không phải `stage_key` tự do như module gốc đề xuất), tối đa **1 cấp lồng** (chương trình chứa module, module không chứa gì thêm — chặn bằng trigger, không phải bằng cách dò đệ quy vì đó đúng là độ sâu cần dùng). `career_stage_resources` có thêm cột `program_id` — có thể để trống, tài liệu tạo trước migration này đọc như chưa hề có cột.
- **Màn hình Academy Admin → Giai đoạn & tài liệu** có thêm: mục "Chương trình & module" để thêm/lưu trữ chương trình và module con, cột "Chương trình" trong bảng tài liệu để gắn/gỡ từng tài liệu vào một chương trình hoặc module, và ô chọn chương trình ngay khi gắn tài liệu mới.
- **Sửa kèm 1 lỗi tôi tự viết trước khi commit**: migration 0040 bản nháp đầu thiếu `drop policy if exists`/`drop trigger if exists` trước các lệnh `create policy`/`create trigger` — đúng lỗi đã gặp và sửa ở module 0037. Đã thêm guard trước khi chạy, nên chạy lại file này bao nhiêu lần cũng không báo lỗi trùng.
- Kiểm chứng: typecheck sạch · lint 0 lỗi (51 cảnh báo nền, không phát sinh mới) · **143/143 test** · test:sql qua · build thành công.

⚠️ **Chưa kiểm chứng trên production**: tôi chưa chạy migration 0040 trên database thật — bạn cần tự chạy `_RUN-0040-ONLY.sql` rồi xác nhận, tôi không thể tự kiểm tra thay bạn. ⚠️ **Chưa làm**: không có giao diện kéo-thả sắp xếp chương trình/module (dùng số `position` mặc định theo thứ tự tạo), không có test tự động riêng cho trigger chặn lồng quá 1 cấp (đây là ràng buộc ở database, bộ test dự án chạy không có database thật — giống caveat đã nêu ở module 0038).

---

**2026-08-06 — 🔙 Đã merge + deploy: hoàn thiện 5 việc còn dang dở của module 0038 + nút quay lại cho mọi trang quản trị — ⚠️ CẦN CHẠY MIGRATION 0039 để dùng tính năng gắn tài sản vào lộ trình.**

- **1. Gắn tài sản vào lộ trình** — mở rộng `career_stage_resources.resource_type` để nhận thêm `'asset'`, thay vì dựng bảng liên kết thứ ba. Màn hình Academy Admin → Giai đoạn & tài liệu đã dùng được ngay, không cần giao diện mới. **⚠️ Cần chạy `_RUN-0039-ONLY.sql`, nếu không thao tác này sẽ báo lỗi ràng buộc dữ liệu.**
- **2. Thùng rác** — cột `deleted_at` đã có sẵn từ trước (migration 0011), chỉ là chưa ai đọc nó. Thêm mục "Thùng rác" trong thanh bên, nút xóa mềm và khôi phục. Không đụng tới file gốc, khôi phục là ra đúng file cũ.
- **3. Chế độ xem dạng lưới** — nút chuyển đổi danh sách/lưới hoạt động thật (trước đây lưu được cài đặt nhưng không có gì đọc nó).
- **4. Chọn cột hiển thị** — 3 trường có thể ẩn/hiện: phân loại con, đường dẫn lưu trữ, ngày tải lên.
- **5. Sắp xếp thư mục** — dùng mũi tên lên/xuống thay vì kéo-thả: đơn giản hơn, không cần xử lý cảm ứng, và tận dụng cột `position` đã có sẵn.
  - **Sửa kèm 1 lỗi HTML thật** phát hiện khi dựng tính năng này: bản nháp đầu tiên lồng `<li>` trong `<div>` trong `<li>` khác — sai chuẩn HTML và không đáng tin với trình đọc màn hình. Đã viết lại để `<li>` luôn là con trực tiếp của `<ul>`.
- **Nút quay lại cho mọi trang quản trị** (yêu cầu riêng của bạn): mỗi khu quản trị con (Academy Admin, Instructor, Platform Admin, System, Operations) tự đặt "trang chủ" là gốc của chính nó — **không phải Dashboard chính**. Nên trước đây vào sâu trong Academy Control Center thì không có đường quay lại Dashboard. Nay có **2 nút**: "Quay lại" (lùi 1 bước, giống nút back trình duyệt) và "Dashboard" (về thẳng trang chủ, dùng được ngay cả khi vừa vào từ link ngoài, không có lịch sử để lùi).
- Kiểm chứng: typecheck sạch · lint 0 lỗi (51 cảnh báo nền, không phát sinh mới) · **143/143 test** · test:sql qua · build thành công · production health 200.

---

**2026-08-06 — 📁 Đã merge + deploy module 0038 (Asset Organization UI) — ✅ MIGRATION 0037 VÀ 0038 ĐỀU ĐÃ CHẠY XONG.**

- **Giao diện mới ở `/assets`**: thanh bên có 6 chế độ xem sẵn (Tất cả · Hộp thư đầu vào · Chưa xếp thư mục · Cần duyệt · Lưu trữ · Ngừng dùng), **cây thư mục cha/con** kèm số tài sản, **khu vực thẻ có ô tìm kiếm**, và nút **"Lưu chế độ xem"**.
- **Chọn nhiều tài sản** → chuyển thư mục hàng loạt, gắn thẻ hàng loạt.
- **Phân trang, sắp xếp, lọc theo thẻ** đều chạy trên máy chủ. Số hiển thị là **số tài sản khớp bộ lọc**, không phải tổng kho — bộ lọc khớp 12 trong 4.000 file thì phải nói 12.
- **🔴 Sửa một lỗi thật trong module 0037 của tôi**: ràng buộc chống trùng tên thư mục `unique(organization_id, parent_id, name)` **không có tác dụng ở cấp gốc**, vì PostgreSQL coi hai `NULL` là khác nhau — mà thư mục gốc có `parent_id = NULL`. Nghĩa là **tạo hai thư mục gốc trùng tên vẫn thành công**, đúng cấp người dùng tạo nhiều nhất. Đã thay bằng 2 chỉ mục kiểu khác không dính vấn đề này.
- **🔴 Sửa lỗi thứ hai trong 0037**: file **chỉ chạy được đúng một lần**, lần hai đổ ở policy đầu tiên (PostgreSQL không có `create policy if not exists`). Đây là hình dạng tệ nhất cho migration mà người ta chạy lại **chính vì không chắc nó đã vào chưa**. Nay 8 policy + 2 trigger đều `drop … if exists` trước → chạy lại bao nhiêu lần cũng được. Thêm file `supabase/_CHECK-0037-APPLIED.sql` để trả lời câu hỏi "đã vào chưa" **bằng số**, không phải suy đoán từ thông báo lỗi.
- **Lưu trữ thay vì xóa**: thư mục **còn tài sản thì bị từ chối xóa** (kèm số lượng) — xóa thì hoặc bỏ rơi tài sản, hoặc kéo theo mất tài sản, không cái nào là ý nghĩa của "dọn lại danh sách thư mục". Lưu trữ thẻ **vẫn giữ nguyên liên kết** — một tấm ảnh không ngừng là ảnh before/after chỉ vì ai đó dọn danh sách thẻ.
- **Chống vòng lặp thư mục** (A → B → A khiến cây không bao giờ vẽ được) chặn trước khi ghi, vì database không diễn đạt được ràng buộc kiểu này.
- **Phân quyền kiểm ở mọi lệnh ghi, không dựa vào ẩn nút.** Chủ sở hữu/quản trị/nhà thiết kế quản trị cấu trúc chung; **giảng viên thì không** — đổi tên một thẻ dùng chung ảnh hưởng mọi màn hình. Riêng bộ lọc cá nhân: **chủ sở hữu cũng không sửa được view riêng của người khác**.
- **Nhãn tiếng Việt dài thì xuống dòng, không cắt** — "Ảnh cô dâu mùa c…" là thư mục không ai phân biệt được với thư mục bên cạnh. Thanh bên gộp thành 1 cột dưới 1024px.
- Kiểm chứng: typecheck sạch · lint 0 lỗi (51 cảnh báo nền, **không phát sinh mới**) · **143/143 test** (18 mới) · test:sql qua · build thành công · 5 API mới đều đã lên production và được bảo vệ đúng.
- 4 tài liệu: `docs/module-0038-asset-organization-{audit,changelog,test-report,rollback}.md`.

⚠️ **2/8 yêu cầu kiểm thử KHÔNG được phủ bằng test tự động, và tôi nói rõ thay vì che**: **cách ly giữa 2 organization** và **phạm vi chuyển thư mục hàng loạt** là hành vi của database (RLS), trong khi bộ test của dự án chạy **không có database**. Test dùng mock sẽ chỉ chứng minh mock trả về đúng thứ tôi lập trình cho nó — **xanh kể cả khi RLS bị tắt hoàn toàn**, tệ hơn là không có test. Báo cáo kiểm thử ghi 4 bước kiểm chứng thủ công cần 2 workspace thật.

⚠️ **Chưa làm**: kéo-thả sắp xếp thư mục · chế độ hiển thị dạng lưới · chọn cột hiển thị · mục "Theo lộ trình" (cần quyết định có thêm `'asset'` vào `career_stage_resources` hay không — quyết định về cấu trúc dữ liệu, tôi không tự quyết) · màn hình Thùng rác.

---

**2026-08-06 — 🗂️ Đã merge + deploy module 19 (Asset Governance V1) — ⚠️ CẦN CHẠY MIGRATION 0037.**

**Việc bạn cần làm:** Supabase → SQL Editor → dán `supabase/_RUN-0037-ONLY.sql` → Run.

- **🔴 Phát hiện chặn đường**: migration của module mở đầu bằng `create table if not exists public.media_assets`. **Trong hệ thống không có bảng nào tên `media_assets`** — bảng tài sản thật là **`public.assets`**, và có **22 khóa ngoại từ 10 migration** trỏ tới nó (thương hiệu, trang sách, nguồn dữ liệu, nhập liệu, marketplace…).
  → Câu lệnh đó **sẽ không báo lỗi**. Nó sẽ lặng lẽ tạo **bảng tài sản thứ hai, rỗng**, trong khi toàn bộ dữ liệu thật và 22 khóa ngoại vẫn ở bảng cũ — và màn hình quản trị mới sẽ nhìn vào cái rỗng. Chính README của module cấm đúng điều này ("không tạo bảng song song nếu đã tồn tại") — nó có tồn tại, chỉ là dưới tên khác.
- **Từ chối 7/11 bảng** vì trùng: nhật ký tài sản → `domain_events` (module 17 đã chốt) · lô tải file → `input_sessions`/`ingestion_runs`/`document_jobs` đã có · **liên kết giai đoạn + liên kết tài nguyên → `career_stage_resources` (0033) đã làm đúng việc đó** và bộ giải quyết quyền (0034) đang đọc nó — thêm bảng nữa sẽ phá vỡ đúng thứ vừa gom lại.
- **Nhận 4 bảng mới**: thư mục · thẻ · gắn thẻ · bộ lọc đã lưu. Bộ lọc đã lưu **lưu điều kiện lọc chứ không lưu kết quả**, nên không bao giờ cũ đi khi thêm tài sản mới.
- **Thêm 15 cột vào bảng `assets` thật**: tên hiển thị, mô tả, phân loại con, thư mục, người phụ trách, trạng thái phân loại/duyệt/vòng đời, quyền sử dụng… Tất cả đều có giá trị mặc định giữ nguyên hành vi cũ.
- **Lọc chuyển sang chạy trên máy chủ.** Lọc trong trình duyệt trên danh sách giới hạn 200 dòng chỉ lọc được đúng trang bạn nhận — vô dụng khi kho lên hàng nghìn file, mà đó chính là tình huống module sinh ra để giải.
- Tìm kiếm quét **cả tên hiển thị lẫn tên file gốc** — nửa kho đã có tên tử tế, nửa còn lại vẫn là `IMG_4821.jpg`, và người tìm thường chỉ nhớ một trong hai.
- Đặt loại cho tài sản thì **trạng thái phân loại tự chuyển theo**, không bắt nhớ tích thêm ô.
- Báo cáo audit đầy đủ: `docs/asset-governance-integration-audit.md`.

⚠️ **Chưa làm**: chưa có màn hình tạo thư mục/thẻ/bộ lọc đã lưu (bảng và quyền đã có, giao diện chưa). Thao tác hàng loạt, trình hướng dẫn tải theo lô, phát hiện trùng và 10 mục điều hướng cấp hai là các bản sau. `asset_versions` **hoãn chứ không phải trùng** — `asset_variants` là bản kết xuất, không phải phiên bản.

---

**2026-08-05 — 📝 Đã merge + deploy: luồng nộp bài → chấm → phản hồi → nộp lại (phía học viên) — ⚠️ CẦN CHẠY MIGRATION 0036.**

**Việc bạn cần làm:** Supabase → SQL Editor → dán `supabase/_RUN-0036-ONLY.sql` → Run.

- **Audit trước đã thay đổi hẳn khối lượng công việc**: hệ thống này **đã dựng gần xong từ trước** — bảng `assignment_definitions` (đề bài, tiêu chí chấm, cho phép nộp lại), `brain_assignment_submissions` (đủ 5 trạng thái: nháp → đã nộp → đang chấm → cần sửa → đã chấm), `rubrics` + `rubric_criteria`. **Không có ràng buộc chống trùng** nên nhiều lần nộp vốn đã được phép — tức **lịch sử nộp bài chỉ là một câu truy vấn, không cần đổi cấu trúc**. Phía giảng viên (chấm theo tiêu chí, yêu cầu sửa) cũng đã chạy từ lâu.
  → Nên tôi **không tạo bảng mới nào**. Chỉ thêm **1 cột** và viết phần còn thiếu: phía học viên.
- **Cột thêm vào**: khi giảng viên chấm, hệ thống tính điểm theo từng tiêu chí rồi **vứt đi**, chỉ lưu điểm tổng và một đoạn nhận xét. Nói "72%" thì học viên không học được gì; nói "tiêu chí độ phủ nền được 4/10" thì lần sau biết sửa chỗ nào. Nay điểm từng tiêu chí được lưu lại và học viên xem được.
- **Học viên giờ làm được**: xem bài được giao kèm trạng thái thật · nộp bài · đọc nhận xét theo từng tiêu chí · xem điểm · **xem lịch sử các lần nộp** · **nộp lại** khi giảng viên yêu cầu sửa.
- **Nộp bài luôn tạo bản ghi mới, không ghi đè** — lần nộp trước và nhận xét kèm theo chính là bằng chứng cho biết đã sửa những gì; ghi đè sẽ xóa mất lý do phải làm lại.
- **Portfolio trong hồ sơ nay sinh ra từ bài đã được giảng viên duyệt** — đóng luôn khoảng trống của lần trước. Một mục xuất hiện vì **có người duyệt nó**, đó là điều biến nó thành bằng chứng chứ không phải lời tự nhận. Cũng vì vậy mà **không có nút "thêm tác phẩm"**.
- Đã thêm **8 test** khoá lại luật chống nộp trùng khi giảng viên đang chấm.

⚠️ **Chưa làm, nói rõ**: **tải ảnh bài làm chưa dựng** — form hiện nhận mô tả bằng chữ và có ghi chú rõ; cột lưu ảnh đã có sẵn nên đây là chỗ trống chờ, không phải thiếu sót cấu trúc. Chưa có thông báo khi giảng viên phản hồi. Bài tập bắt buộc phải thuộc một Knowledge Space — nếu bạn muốn gắn thẳng vào bài học của khóa thì đó là quyết định về cấu trúc dữ liệu, tôi chưa tự quyết. **Chưa kiểm chứng xuyên suốt trên production** — cần một tài khoản giảng viên và một tài khoản học viên đi hết vòng nộp → chấm → sửa → nộp lại.

---

**2026-08-05 — 🧹 Đã merge + deploy: quét sạch số liệu bịa khỏi khu vực học viên (P0 báo cáo Codex) — KHÔNG CẦN CHẠY MIGRATION GÌ.**

Nguyên tắc áp dụng: **tài khoản thật chỉ được thấy số liệu thật, hoặc trạng thái rỗng nói đúng sự thật.** Dữ liệu mẫu chỉ còn dành cho chế độ demo và được dán nhãn rõ.

- **Smart Home**: 4 ô đầu trang trước đây là số cứng — chuỗi 7 ngày, 42 giờ thực hành, 6/9 kỹ năng, 4 thành tựu. "Chuỗi ngày học" và "giờ thực hành" **không có nguồn dữ liệu nào trong hệ thống**, nên tôi bỏ hẳn thay vì để dấu gạch — hai ô đó nay hiện **số bài đã hoàn thành** và **số khóa đang học** (có thật). Danh sách bài tập trước đây lấy từ dữ liệu demo và nhãn "Còn 2 ngày" suy ra từ **thứ tự trong mảng** chứ không phải hạn nộp thật. Khối thành tựu cũng là danh sách cố định.
- **Hồ sơ** — nặng nhất: 68% tiến độ, 42 giờ, 7 sách, điểm 82, "Lớp K26", tên thành phố, "tham gia 18 ngày", 1 chứng nhận đã cấp và 6 tác phẩm portfolio có tên — **tất cả đều là số cứng**, và học viên ngày đầu tiên đọc chúng như hồ sơ của chính mình. Nay hiện số thật nếu có nguồn, còn lại là trạng thái rỗng **kèm giải thích cái gì sẽ lấp đầy nó**.
- **Bài tập**: các con số 3/8/6/82 là số cứng, trạng thái thẻ suy từ **vị trí trong mảng**, và **mọi nút đều không có hành vi** — trang trông như bản ghi thực hành có thật của một việc chưa từng xảy ra. Nay tài khoản thật thấy trạng thái rỗng và **nói thẳng rằng luồng nộp bài đang được xây dựng**.
- **H2O Mentor**: đã đóng ở bản deploy trước.

⚠️ **Chưa làm, không giấu**: luồng **nộp bài → giảng viên duyệt → phản hồi → nộp lại** (kèm tải ảnh, tiêu chí chấm riêng từng bài, lịch sử, thông báo) là **một tính năng cần dựng riêng**, không phải vá. Thẻ "Academy Pro · 18 ngày · 68%" ở thanh bên vẫn là số cứng. Chứng nhận và portfolio **chưa có bảng dữ liệu**, nên hiện tại chỉ có thể để trống.

---

**2026-08-05 — 👤 Đã merge + deploy: khu vực học viên giờ chỉ còn MỘT nguồn danh tính & tiến độ — KHÔNG CẦN CHẠY MIGRATION GÌ.**

**Lỗi nghiêm trọng nhất đã sửa.** Một tài khoản đăng nhập thật nhìn thấy **4 câu trả lời khác nhau** cho cùng câu hỏi "tôi là ai, học tới đâu": thanh bên ghi `Nguyen Van Tuan 78%`, dashboard ghi `Tuan 0%`, tải lại thành `Anh 78%`, hồ sơ lại ghi `Nguyễn Minh Anh`.

- **Nguyên nhân**: mỗi màn hình tự trả lời riêng, và phương án dự phòng khác nhau. Thanh bên đọc phiên đăng nhập thật nhưng **lấy % tiến độ từ dữ liệu demo** (học viên mẫu 78%). Dashboard cũng rơi về dữ liệu demo cho tới khi tải xong — đó là hiện tượng nhảy số khi tải lại. Trang hồ sơ thì **chưa bao giờ rời khỏi dữ liệu demo**.
- **Dữ liệu demo là dữ liệu mẫu cho người chưa đăng nhập.** Trộn nó vào phiên thật chính là thứ khiến phần mềm trông như không biết ai đang dùng.
- Nay có **một nguồn duy nhất**: danh tính lấy từ phiên đăng nhập phía máy chủ nên **đúng ngay từ khung hình đầu tiên, không nhảy số**; tiến độ tải một lần rồi dùng chung cho mọi màn hình.
- Khi chưa biết tiến độ, hệ thống hiện **"Đang tải…"** chứ không hiện một con số nghe hợp lý — thà không nói còn hơn nói sai.
- **H2O Mentor**: khung "Dữ liệu đang dùng" trước đây liệt kê 4 con số **bịa hoàn toàn** (32/48 bài, 6 kỹ năng, 3 bài tập, giai đoạn thực hành). Đặt dưới tiêu đề "dữ liệu đang dùng" thì con số cố định lại càng giống bằng chứng thật — đây là kiểu sai tệ nhất. Nay hiện số thật hoặc dấu gạch ngang. Lời chào cũng thôi gọi mọi người là "Minh Anh".
- **Video bài học**: player vốn không có lỗi — đã hỗ trợ sẵn Cloudflare Stream, video trực tiếp và nhúng. Hai vấn đề thật: (1) chỗ trống hiện **hướng dẫn dành cho lập trình viên** ("thêm playback ID vào bảng…") cho **học viên** đọc — người ít có khả năng làm nhất; (2) **màn hình quản trị chỉ báo "Có video / Chưa có video" mà không có ô nhập**, dù backend đã nhận `videoUrl` từ lâu — nên mọi bài học đều trống trừ khi viết SQL tay. **Nay đã có ô nhập** trong Academy Admin → Chương trình đào tạo.
- **Về 8 route 404**: đó là URL đoán từ bên ngoài, **không phải link sản phẩm đưa ra**. Tôi đã rà **25 link nội bộ** trong toàn bộ khu vực học viên/reader/academy — **không có link nào hỏng**. Nút "Xem toàn bộ" vốn đã trỏ đúng `/student/roadmap`. Không tạo/xoá gì cho mục này.

⚠️ **Chưa sửa, cùng loại lỗi**: thẻ "Academy Pro · 18 ngày trong hành trình · 68%" ở thanh bên **vẫn là số cứng** — cần nguồn dữ liệu gói thành viên thật, không phải đổi sang một hằng số khác. Bài tập chưa có tiêu chí chấm chi tiết, nộp lại, phản hồi giảng viên. Portfolio/chứng nhận vẫn nằm trong trang hồ sơ.

📌 Thư mục `audit-output/` và `test-results/` đã được thêm vào danh sách bỏ qua của git — đó là ảnh chụp và kết quả kiểm thử, không phải mã nguồn.

---

**2026-08-05 — ♿ Đã merge + deploy: sửa 3 lỗi đợt rà soát thứ 3 — KHÔNG CẦN CHẠY MIGRATION GÌ.**

1. **`book_skin` vẫn sai nội dung (lần 2 — lần trước tôi sửa chưa tới).** Lần trước tôi thay tên sách bằng cách tìm-và-thay chuỗi, nhưng **không khớp được gì cả**: bìa sách viết `"GIÁO TRÌNH\nMAKEUP CHUYÊN NGHIỆP"` — chữ hoa, xuống dòng — nên không chứa tên sách gốc; phần thân bài thì không nhắc tên sách lần nào. Nay **mỗi sách mẫu có nội dung viết riêng thật**: bìa, tên chương, thân bài, trích dẫn, checklist — cuốn về kỹ thuật nền và cuốn về tóc cô dâu.
   - **Lý do thứ hai khiến bạn vẫn thấy nội dung cũ**: dữ liệu sách được **lưu trong trình duyệt**, nên máy nào đã từng vào web sẽ giữ bản cũ mãi. Đã nâng phiên bản lưu trữ kèm bước chuyển đổi **chỉ thay đúng 2 cuốn mẫu, và chỉ khi chúng vẫn đang là bản sao lỗi** — cuốn nào bạn đã sửa thì giữ nguyên. Không đụng vào bất kỳ dữ liệu nào khác.
   - ⚠️ Máy đã vào web trước đây cần **tải lại trang một lần** để bước chuyển đổi chạy.
2. **Reader thiếu nhãn cho nút biểu tượng** — **18 nút** giờ đều có nhãn đọc được bằng trình đọc màn hình, và biểu tượng được đánh dấu ẩn để không bị đọc lặp. Các nút bật/tắt giữ **nhãn cố định** kèm trạng thái riêng, thay vì đổi tên mỗi lần bấm (đổi tên sẽ khiến trình đọc thông báo như một nút khác).
3. **PWA mở vào `/dashboard`** — cài app xong mở ra là bị đá về login. Nay mở vào trang chủ `/`. Đã kiểm chứng: `"start_url": "/"`.
4. **Form — xin đính chính báo cáo**: không form công khai nào dùng `method=get`; cả 6 form đều chặn hành vi mặc định nên không có chuyện dữ liệu lộ lên URL. Phần đúng là **tự động điền**: 18 ô nhập ở form đăng nhập/đăng ký/membership/đăng ký khóa học thiếu thuộc tính `name` nên trình quản lý mật khẩu và tự động điền của trình duyệt không nhận ra. Đã bổ sung.

✅ Đã kiểm chứng sau deploy: health 200 · `start_url` = `/` · nội dung riêng của `book_skin` đã có trong bản build.

⚠️ Còn lại: ~134 ô nhập thiếu `name` nằm trong trình soạn thảo và trang quản trị — đều là ô do React quản lý, không gửi form kiểu cũ, nên tôi không sửa hàng loạt để tránh rủi ro.

---

**2026-08-05 — 🧰 Đã merge + deploy: sửa 5 lỗi còn lại của đợt rà soát — ⚠️ CẦN CHẠY MIGRATION 0035.**

**Việc bạn cần làm:** Supabase → SQL Editor → dán `supabase/_RUN-0035-ONLY.sql` → Run. **Chưa chạy thì analytics vẫn lỗi.**

1. **Analytics lỗi 400 trên mọi trang.** Nguyên nhân: migration 0015 tạo ràng buộc chống trùng dưới dạng **index "một phần"** (chỉ áp dụng khi `event_id` khác rỗng). PostgreSQL **không cho phép dùng index một phần** để chống ghi trùng trừ khi câu lệnh lặp lại đúng điều kiện đó — thư viện thì không gửi. Kết quả: ràng buộc có thật, hoạt động đúng, nhưng **vô hình** với lệnh ghi. Mà điều kiện đó cũng thừa: `event_id` luôn được gửi. Đã bỏ điều kiện → không thay đổi gì về dữ liệu được phép, chỉ là lệnh ghi chạy được.
2. **Quên mật khẩu — đính chính báo cáo**: 2 trang này **không bị chặn, mà chưa hề tồn tại**. Middleware đá mọi đường dẫn lạ về login nên nhìn từ ngoài giống hệt nhau. Nay đã dựng đủ luồng: `/forgot-password` gửi mail → `/reset-password` đặt mật khẩu mới → trang đăng nhập đã có link "Quên mật khẩu?".
   - Form báo thành công **giống nhau dù email có tồn tại hay không** — báo khác nhau sẽ biến nó thành công cụ dò xem email nào đã đăng ký.
3. **Reader tràn ngang trên điện thoại (lần 2).** Lần trước tôi sửa phần trang mà **bỏ sót thủ phạm chính là thanh công cụ**: 3 nhóm nút không xuống dòng, cộng tiêu đề giới hạn 330px → riêng thanh đó đã vượt màn 390px. Nay thanh tự xuống dòng, tiêu đề bỏ giới hạn, chữ cạnh icon tự ẩn.
4. **`book_skin` dùng chung nội dung với giáo trình makeup.** Nguyên nhân: 3 sách demo được tạo bằng cách sao chép nông (`spread`) từ một cuốn — nên **dùng chung y nguyên một bộ trang, trùng cả mã của từng phần tử**. Nay mỗi sách có bộ trang riêng, mã riêng, và bìa mang đúng tên của nó.
   - Sửa kèm: API campaign trả 404 cho sách không có trong database → nay trả 200 với "không có campaign". Câu hỏi là "sách này bị khóa bởi cái gì", và "không có gì" là câu trả lời hợp lệ; trả 404 khiến trình duyệt coi là lỗi và **thử lại liên tục**.
5. **Thiếu robots.txt / sitemap.xml** — đã có cả hai. Sitemap chỉ liệt kê trang mà người chưa đăng nhập mở được, và **tự lấy các giai đoạn từ database** nên bạn thêm giai đoạn mới trong admin là nó tự xuất hiện. Đã kiểm chứng sau deploy: **31 URL**.
6. **Tìm kiếm không có kết quả**: thông báo vốn đã có sẵn, nhưng **lưới rỗng vẫn được vẽ phía trên nó** — tạo ra đúng khoảng trống bạn thấy. Nay bỏ lưới khi không có kết quả.

✅ Đã kiểm chứng sau deploy: `/robots.txt` 200 · `/sitemap.xml` 200 (31 URL) · `/forgot-password` 200 · `/reset-password` 200 · campaign `book_skin` 200 (hết 404).

---

**2026-08-05 — 🩹 Đã merge + deploy: sửa 4 lỗi chặn chuyển đổi từ đợt rà soát production — KHÔNG CẦN CHẠY MIGRATION GÌ.**

1. **API công khai của Reader bị chặn đăng nhập.** 3 API (`/api/reader/campaign`, `/api/reader/leads`, `/api/analytics/events`) vốn thiết kế cho người chưa đăng nhập, nhưng bị middleware đá về `/login`. Hậu quả: người đọc chưa đăng nhập **không tải được campaign, không thu được lead, và không ghi nhận được analytics nào cả** — mọi lệnh gọi đều thất bại âm thầm. Đã mở đúng 3 đường dẫn này; `/api/analytics/report` (báo cáo nội bộ) vẫn được bảo vệ. Đã kiểm chứng sau deploy: 3 API trả 404/200/400 (tức chạy tới logic thật), `report` vẫn trả 307.
2. **Đăng ký membership luôn lỗi 503.** Nguyên nhân: code đọc biến `PUBLIC_ACADEMY_ORGANIZATION_ID` — **một biến thứ hai chưa từng được đặt ở đâu cả** — trong khi `ACADEMY_ORGANIZATION_ID` nằm ngay dòng dưới trong cùng file thì đã có giá trị. Hai cái tên cho một sự thật, và cái rỗng thắng. Đã kiểm chứng trên Vercel: biến rỗng đó **không tồn tại**, biến đúng thì **có**. Nay dùng chung bộ giải quyết mà cả app đang dùng.
3. **Thanh toán membership luôn lỗi 400.** Màn hình gửi `productId` mà chỉ có giá trị khi sản phẩm đã tồn tại sẵn trong database. Luồng khóa học không dính lỗi này vì nó hỏi qua catalog trước — và catalog **tự tạo sản phẩm nếu chưa có**. Cơ chế đó đã hỗ trợ membership sẵn, chỉ là màn hình membership không gọi. Nay đã gọi.
4. **Reader hiện chữ thô `{{brand.name}}` và tràn ngang trên điện thoại.** Placeholder nay được phân giải theo thương hiệu đang chọn lúc hiển thị — sửa cho mọi sách cùng lúc, không phải sửa từng nội dung, và không đụng vào dữ liệu đã lưu. Về tràn ngang: trang sách là khổ A4 cố định thu nhỏ bằng `transform`, mà `transform` **không làm thay đổi chỗ nó chiếm trong bố cục** — nên dù thu nhỏ bao nhiêu, chiều rộng 794px vẫn đẩy trang lệch. Nay cỡ hiển thị tự khớp màn hình và mục lục tự đóng dưới 900px.

⚠️ **Chưa sửa** (cũng từ đợt rà soát đó): `/forgot-password` và `/recovery` bị đá về login · nút thanh toán gửi hồ sơ đăng ký lần 2 · `/reader/book_skin` dùng chung nội dung với giáo trình makeup (đây là dữ liệu mẫu, không phải lỗi code) · chưa có thông báo khi tìm kiếm không ra kết quả · vài lỗi ngữ nghĩa form.

---

**2026-08-05 — 🎛️ Đã merge + deploy: 6 luật mở khóa giờ chỉnh được trực tiếp trên admin panel — KHÔNG CẦN CHẠY MIGRATION GÌ.**
- ✅ **Xác nhận migration 0033 và 0034 đều đã vào production**: 0034 sửa bảng `career_stage_resources`, nếu bảng chưa có thì lệnh đã báo lỗi — chạy được là bằng chứng cả hai đã thành công.
- Vào **Academy Admin → Giai đoạn & tài liệu → Quản lý tài liệu**, mỗi tài liệu giờ chỉnh được:
  - **Mức độ**: Bắt buộc · Tùy chọn · Mở rộng
  - **Quyền xem**: Miễn phí · Khóa theo giai đoạn · Chỉ khi được cấp riêng
  - **Luật mở khóa**: Mở ngay · Khi đang ở giai đoạn · **Sau khi học xong tài liệu khác** · **Khi đạt % tiến độ** · **Từ mốc thời gian** · Chỉ mở tay
  - **Hiển thị ở**: Thư viện · Hành trình · Smart Home (tick chọn nhiều nơi)
- **Ô nhập chỉ hiện khi luật cần đến nó** — ô "% tiến độ" đặt cạnh "mở ngay" chỉ khiến người dùng điền một con số không bao giờ được đọc.
- Ô chọn tài liệu tiên quyết **liệt kê đúng các tài liệu trong cùng giai đoạn**, không phải gõ tay; giai đoạn chưa có tài liệu nào khác thì nói rõ thay vì đưa danh sách rỗng.
- Chọn tài liệu **Miễn phí** thì luật mở khóa bị khóa lại kèm ghi chú — tài liệu miễn phí vốn luôn mở, cho cấu hình một luật không bao giờ áp dụng còn tệ hơn là không cho.
- **Đã thêm chặn vòng lặp**: nếu tài liệu A cần B, B cần A thì cả hai khóa vĩnh viễn. Database không diễn đạt được ràng buộc này nên hệ thống tự kiểm tra chuỗi điều kiện trước khi lưu, chặn cả tự trỏ vào chính nó lẫn vòng dài hơn.

---

**2026-08-05 — 🧠 Đã merge + deploy module 18 (Content Access Engine V1) — ⚠️ CẦN CHẠY MIGRATION 0034.**

**Việc bạn cần làm:** Supabase → SQL Editor → New query → dán file `supabase/_RUN-0034-ONLY.sql` → Run.

- **Module gốc đề xuất 12 bảng mới. Tôi TỪ CHỐI cả 12** — vì trùng với bảng đã có: 3 bảng trùng đúng phần tôi làm hôm nay (0033), số còn lại trùng `entitlements`, `memberships`, `products`, `domain_events`, và các bảng nội dung thật. Chính README của module cũng yêu cầu audit trước.
- **⚠️ Phát hiện lỗ hổng nghiêm trọng trong module gốc**: hàm xét quyền admin của nó đọc vai trò từ **metadata mà người dùng tự sửa được**. Nếu chạy nguyên bản, **bất kỳ ai tự đặt `role: "admin"` cho mình sẽ có toàn quyền ghi lên 12 bảng đó**. Nó còn coi token thiếu thông tin tổ chức là hợp lệ cho MỌI tổ chức. Đây là lý do đủ để từ chối, độc lập với chuyện trùng lặp.
- **Phần đã nhận — giá trị thật**: repo đang có **4 nơi tự quyết định quyền truy cập**, mỗi nơi một luật riêng (đó là cách một màn hình hiện ra thứ mà cổng chặn phía sau lại không cho vào). Nay có **một bộ quyết định duy nhất** với thứ tự ưu tiên rõ ràng:
  - **Lệnh chặn thắng mọi thứ** — kể cả người đã mua. Thu hồi quyền vì lý do bảo mật không bị gói thành viên vô hiệu hóa.
  - **Phân biệt "hết hạn" với "chưa mở khóa"** — hai thông điệp hoàn toàn khác nhau với người học.
- **Luật mở khóa nâng cao** thành **6 cột bổ sung** (không thêm bảng): mở ngay · khi đang ở giai đoạn · sau khi học xong tài liệu khác · khi đạt % tiến độ · theo mốc thời gian · chỉ mở tay. Kèm phân loại bắt buộc/tùy chọn/mở rộng và chọn nơi hiển thị.
- Giá trị mặc định của 6 cột **giữ nguyên hành vi cũ**, nên dữ liệu hiện có không đổi nghĩa.
- **Một quyết định kinh doanh cần bạn biết**: tôi coi "thu hồi quyền" là **chặn hẳn tài liệu đó**, chứ không chỉ hủy bản cấp quyền. Nếu bạn muốn ngược lại (thu hồi xong mà có gói thành viên thì vẫn xem được), báo tôi đổi — 1 dòng.
- Chưa xong: 2 chế độ mở khóa theo tiến độ **đã code và có test đầy đủ** nhưng **chưa có nguồn dữ liệu tiến độ đọc sách**, nên với sách sẽ luôn ra "chưa đủ điều kiện". 6 cột mới chưa có ô nhập trên giao diện admin. 3 nơi quyết định quyền còn lại chưa gộp về bộ mới.
- Chi tiết đầy đủ: `docs/H2OBOOK-CONTENT-ACCESS-ENGINE-V1-INTEGRATION-REPORT.md`.

---

**2026-08-05 — 🔗 Đã merge + deploy: nút "Xem nội dung phù hợp" giờ có đích đến thật + trang riêng cho từng giai đoạn — KHÔNG CẦN CHẠY MIGRATION GÌ THÊM (dùng bảng của 0033).**
- **Lỗi đã sửa**: nút này trước đây trỏ về `/academy/learning-paths?stage=<id>` — **chính là trang đang đứng**, và không dòng code nào đọc tham số đó. Đã đối chiếu HTML thật trên production: giống nhau từng ký tự. Bấm vào chỉ đổi thanh địa chỉ, trang không đổi gì.
- Nay mỗi giai đoạn có **trang riêng** `/academy/learning-paths/<giai-đoạn>`:
  - Mở đầu bằng **tài liệu học thử miễn phí** — xem được ngay, **không cần tài khoản**.
  - Tài liệu còn lại **chỉ đếm số lượng, không lộ tên** — đó là lý do để đăng ký.
  - **Thanh CTA dính ở đáy trang** kêu gọi tạo tài khoản.
- Thanh CTA đặt **phía trên footer, không ghim đè lên màn hình** — ghim đè sẽ che chính phần nội dung miễn phí đang dùng để thuyết phục, và trên điện thoại thì càng chật.
- Danh sách giai đoạn công khai giờ **đọc từ bảng `career_stages`** khi bạn đã thiết lập; chưa thiết lập thì vẫn hiện 5 giai đoạn cũ nên trang không bao giờ trống.
- Đã kiểm tra sau deploy: 5 trang giai đoạn đều mở được (200), slug sai trả 404 đúng, nút CTA trỏ đúng địa chỉ mới.
- ⚠️ **Còn tồn tại**: nút **"Bắt đầu đánh giá"** (`?diagnostic=1`) vẫn là link chết y hệt — chưa xử lý. Lộ trình học viên vẫn đọc danh sách viết cứng.

---

**2026-08-05 — 🔐 Đã merge + deploy: vá lỗ hổng `/academy-admin` bị coi là trang công khai — KHÔNG CẦN CHẠY MIGRATION GÌ.**
- Toàn bộ khu `/academy-admin/*` trước đây **không bị chặn đăng nhập**, vì hệ thống so khớp đường dẫn theo kiểu "bắt đầu bằng" — mà `/academy-admin` thì bắt đầu bằng `/academy` (vốn là khu công khai).
- **Dữ liệu KHÔNG bị lộ**: mọi API quản trị đều tự kiểm tra quyền riêng và trả 403. Nhưng người lạ vẫn nhìn thấy khung giao diện quản trị, và tài khoản học viên cũng không bị đá ra.
- Nay so khớp theo **ranh giới đoạn đường dẫn**, và `/academy-admin` được đưa vào danh sách chỉ-admin.
- Đã rà toàn bộ route: chỉ đúng 2 chỗ ăn theo kiểu khớp lỏng — `/academy-admin` (sai, đã vá) và `/verify-outcome` (đúng là trang tra cứu chứng chỉ công khai, đã khai báo riêng để không bị chặn nhầm).
- Đã kiểm tra sau deploy: `/academy-admin/*` đá về login; `/academy/books`, `/verify-outcome`, `/dev/typography` vẫn công khai bình thường.

---

**2026-08-05 — 🗂️ Đã merge + deploy: Bản đồ GIAI ĐOẠN & TÀI LIỆU — ⚠️ CẦN CHẠY MIGRATION 0033.**

**Việc bạn cần làm:** mở Supabase → SQL Editor → New query → dán toàn bộ nội dung file `supabase/_RUN-0033-ONLY.sql` → Run. Chưa chạy thì phần này chưa hoạt động.

- **Vấn đề đã giải quyết**: 6 giai đoạn (hiện có 5, thêm được không giới hạn) trước đây bị **viết cứng trong code ở 2 nơi**, muốn sửa phải deploy lại. Và **không có bất kỳ mối nối nào giữa giai đoạn và tài liệu** — đó chính là lý do tab "Thư viện của tôi" phải hiện sách mẫu.
- **Nay có màn hình quản trị đầy đủ**: Academy Admin → **Giai đoạn & tài liệu** (`/academy-admin/stages`).
  - Thêm / sửa / ẩn / lưu trữ giai đoạn — **thêm giai đoạn thứ 6, thứ 10 chỉ là điền form, không cần lập trình**.
  - Gắn / gỡ / đổi tên / đổi quyền xem cho từng tài liệu trong mỗi giai đoạn.
  - Hỗ trợ 7 loại tài liệu: sách/giáo trình, khóa học, ấn phẩm, mẫu thiết kế, Knowledge Space, lộ trình, liên kết ngoài.
  - **3 mức quyền xem mỗi tài liệu**: *Miễn phí (ai cũng xem)* · *Khóa theo giai đoạn* · *Chỉ khi được cấp riêng*.
  - Nút "Nạp 5 giai đoạn mặc định" cho lần đầu — và nó **từ chối chạy nếu đã có giai đoạn**, nên không bao giờ ghi đè dữ liệu bạn đã sửa.
- **Xóa giai đoạn = lưu trữ, không xóa thật** — tránh làm hỏng tiến độ học viên và link công khai đã phát ra.
- **Tab "Thư viện của tôi" đã nối vào dữ liệu thật** để chứng minh chạy thông suốt: hiện tài liệu theo từng giai đoạn, tài liệu chưa mở khóa chỉ **đếm số lượng chứ không lộ tên**. Thanh phần trăm bịa (`34 + số thứ tự × 18`, chính là chỗ hiện "106%") đã bị xóa.
- Thư viện giờ báo rõ 3 trạng thái: *dữ liệu thật* · *học viện chưa cấu hình* · *chế độ demo* — không còn im lặng hiện sách mẫu như thật.
- ⚠️ **Chưa xong (nói rõ để bạn không hiểu nhầm)**: trang công khai `/academy/learning-paths` và lộ trình học viên **vẫn đọc danh sách viết cứng cũ**, mới chỉ có Thư viện đọc bảng mới. Và giai đoạn bạn tự thêm sẽ ở trạng thái khóa cho tới khi được nối vào quy tắc mở khóa hoặc cấp quyền riêng.
- Chi tiết kỹ thuật: `supabase/migrations/0033_h2obook_career_stage_curriculum.sql`.

---

**2026-08-04 — 🔮 Đã merge + deploy: thống nhất quả cầu "H2O Brain core" ở TẤT CẢ các vị trí — KHÔNG CẦN CHẠY MIGRATION GÌ.**
- Trước đây chỉ **trang chủ (Knowledge Universe hero)** có thiết kế quả cầu đúng (3 vòng quay, hình bộ não, hiệu ứng xoáy, nhịp đập). **4 chỗ khác mỗi chỗ tự vẽ một quả cầu riêng** đã lệch hẳn: khác màu, khác số vòng, không có hình bộ não.
- Nay cả 5 chỗ dùng **chung một thiết kế duy nhất** (`components/brand/h2o-brain-core`): trang chủ mục cuối, khối FutureOrb, dashboard học viên, dashboard chủ workspace, và bản xem trước Academic Ops.
- Kích thước tự co giãn theo đường kính — muốn to/nhỏ chỉ cần đổi 1 giá trị, hình bộ não/vòng quay/ánh sáng tự theo.
- **Không đổi màu sắc, gradient hay tốc độ hiệu ứng nào** — các tỉ lệ trong file mới chính là số đo gốc của hero chia cho đường kính 178px.
- Sửa kèm 2 lỗi phát hiện khi tách: (1) một lớp hiệu ứng của quả cầu bị khai báo trùng nên **chưa bao giờ hiển thị**; (2) chế độ "giảm chuyển động" trước đây **vẫn để vòng quay và nhịp đập chạy** — giờ dừng hết.
- Đã xác minh trên production: trang chủ hiện đúng 2 quả cầu chuẩn (hero + mục cuối).
- ⚠️ Chưa xem được ảnh thật — nhờ bạn kiểm tra 5 vị trí, nhất là dashboard chủ workspace (trước là hình bầu dục, nay thành hình tròn).

---

**2026-08-04 — ✒️ Đã merge + deploy bộ font chính thức Literata + Be Vietnam Pro cho TOÀN BỘ webapp — KHÔNG CẦN CHẠY MIGRATION GÌ.**
- **Literata** (font sách, tri thức) dùng cho: tiêu đề trang chủ, tiêu đề mục lớn, tên sách/khóa học trong catalog & thư viện & cửa hàng, trích dẫn chuyên gia.
- **Be Vietnam Pro** (tối ưu dấu tiếng Việt) dùng cho: menu, nút bấm, biểu mẫu, bảng dữ liệu, dashboard, admin, vận hành.
- **Phát hiện quan trọng khi rà soát**: chữ giao diện trước đây khai báo là "Inter" nhưng **font này chưa bao giờ được tải về** — nghĩa là máy ai nấy hiện một kiểu theo font mặc định của hệ điều hành. Giờ mới thật sự có font thống nhất cho mọi máy.
- Font được **tải sẵn khi build và phục vụ từ chính máy chủ H2OBOOK** (25 file), **không gọi ra Google Fonts** lúc người dùng vào web → nhanh hơn và không phụ thuộc bên ngoài.
- Đã xác minh trên production: 27 khối font, có đủ dải ký tự tiếng Việt, file font tải về được (200 OK).
- **KHÔNG đụng vào font trong nội dung sách/template do học viên tạo** (vùng soạn thảo, bản xem trước bìa, chế độ hỗ trợ đọc khó) — giữ nguyên hoàn toàn, đúng nguyên tắc không phá tài sản của học viên.
- Không đổi màu sắc, khoảng cách, kích thước thẻ, viền hay hiệu ứng — chỉ đổi kiểu chữ.
- Trang tự kiểm tra dấu tiếng Việt: `https://h2obook-app.vercel.app/dev/typography` (không hiện trên Google, không có link trỏ tới).
- Deploy production thành công (health check OK).
- ⚠️ **Tôi chưa so sánh được ảnh trước/sau** (không có công cụ chụp màn hình). Nhờ bạn xem lại: trang chủ (máy tính + điện thoại), `/login`, 1 trang Learn, 1 trang Create, 1 trang Admin — chú ý tiêu đề có bị xuống dòng xấu, bảng có bị lệch, điện thoại có bị tràn không.
- Chi tiết đầy đủ: `docs/H2OBOOK_TYPOGRAPHY_LITERATA_BE_VIETNAM_PRO_REPORT.md`.

---

**2026-08-04 — 🔠 Đã merge + deploy: phóng to và đồng bộ toàn bộ cỡ chữ khu vực học viên — KHÔNG CẦN CHẠY MIGRATION GÌ.**
- **Không phải chỉ vài màn hình bị nhỏ**: trong 92 chỗ quy định cỡ chữ của giao diện học viên thì **68 chỗ nằm ở mức 6–9px** (nhãn 7px, nội dung 9px, menu trái 10px, có chỗ 6px) — nhỏ hơn nhiều so với mức ~12px đọc thoải mái, và lệch hẳn so với phần còn lại của phần mềm.
- Nay dùng chung **5 bậc cỡ chữ** khai báo một chỗ duy nhất: 11px (nhãn nhỏ/huy hiệu) · 12px (nhãn mục, chú thích) · 13px (nội dung, ô nhập) · 14px (menu trái, chữ nhấn) · 15px (tiêu đề thẻ).
- 76 chỗ đã chuyển sang dùng các bậc này thay vì tự ghi số riêng → sau này muốn chỉnh to/nhỏ toàn hệ thống chỉ cần sửa 1 chỗ, và màn hình mới sẽ tự theo đúng chuẩn.
- Các tiêu đề lớn (trên 15px) giữ nguyên — vốn đã đọc tốt, phóng thêm chỉ gây xuống dòng.
- Áp dụng cả cho màn hình Knowledge Space để khớp với khung bao quanh nó.
- Deploy production thành công (health check OK).
- ⚠️ Tôi mới kiểm tra bằng tính toán chiều rộng chứ **chưa nhìn được ảnh thật sau khi đổi** — nhờ bạn xem lại và báo nếu có chỗ nào bị xuống dòng/tràn.

---

**2026-08-04 — 🎨 Đã merge + deploy: menu bên trái của học viên giờ sổ xuống được (LEARN / CREATE / BUSINESS) — KHÔNG CẦN CHẠY MIGRATION GÌ.**
- Bấm vào tên nhóm để mở/đóng danh sách bên trong. Nhóm HOME chỉ có 1 mục nên giữ nguyên dạng nhãn, không thành nút bấm (bấm cũng không có gì để mở).
- Mặc định: nhóm chứa trang bạn đang xem sẽ mở sẵn, các nhóm còn lại thu gọn — lấy lại chỗ trống cho giai đoạn sau khi có nhiều mục hơn.
- Nhóm đang thu gọn có hiện **số mục bên trong**, và **đổi màu** nếu nó đang chứa trang bạn đang mở — để không bị lạc.
- Ghi nhớ lựa chọn đóng/mở của bạn (lưu trên máy bạn), nhưng khi bạn đi vào một trang thuộc nhóm đang đóng thì nhóm đó vẫn tự mở ra.
- **Sửa kèm 1 lỗi cũ**: trước đây mục "Smart Home" luôn bị tô sáng cùng lúc với mục bạn đang xem (2 mục sáng một lúc). Giờ chỉ đúng 1 mục sáng.
- Máy tính bảng/điện thoại (dưới 900px) không đổi gì — màn hình nhỏ vốn ẩn menu trái và dùng thanh dưới cùng.
- Đã thêm bộ test riêng cho phần điều hướng (9 test mới).
- Deploy production thành công (health check OK).

---

**2026-08-04 — 🐞 Đã merge + deploy: sửa lỗi tab "Studio" (`/student/create`) báo "H2OBOOK gặp lỗi khi tải màn hình" — KHÔNG CẦN CHẠY MIGRATION GÌ.**
- Thẻ công thức bị khoá trước đây vẫn được vẽ như một đường dẫn bấm được rồi chặn lại bằng đoạn mã xử lý sự kiện. Cách này không hợp lệ với kiểu trang chạy trên máy chủ, nên **chỉ cần có 1 thẻ bị khoá là toàn bộ trang sập** (không phải chỉ hỏng riêng thẻ đó).
- Vì sao đến giờ mới lộ: trước đây chỉ test bằng tài khoản chủ (owner) — mở khoá hết nên không bao giờ chạm vào nhánh lỗi. Tài khoản học viên thật đầu tiên (tạo bởi luồng đăng ký mới hôm nay) thì có thẻ bị khoá nên gặp lỗi ngay lần đầu vào.
- Nay thẻ bị khoá được vẽ như một ô thường, không phải đường dẫn — đúng bản chất hơn (thẻ không bấm được thì không nên là link).
- Đã rà toàn bộ thư mục `app/`: đây là chỗ duy nhất mắc lỗi kiểu này.
- Deploy production thành công (health check OK).

---

**2026-08-04 — ⚡ Đã merge + deploy: sửa lỗi chuyển tab học viên chậm 3–4 giây — KHÔNG CẦN CHẠY MIGRATION GÌ.**
- **Nguyên nhân chính là địa lý, không phải code chậm**: Supabase đặt ở Singapore, nhưng Vercel chưa được khai báo vùng nên chạy mặc định ở Washington (Mỹ). Mỗi lần bấm 1 tab, dữ liệu phải đi vòng Việt Nam → Mỹ → Singapore → Mỹ → Việt Nam. Đã ghim Vercel về Singapore (`sin1`) — cùng chỗ với database.
- Đã xác minh sau deploy: header phản hồi trả về `hkg1::sin1::…` (trước đây là `iad1` bên Mỹ) — máy chủ đã thực sự chạy ở Singapore.
- Bỏ 3 lượt gọi database thừa mỗi lần bấm tab: middleware trước đây luôn tra vai trò tài khoản kể cả khi không dùng đến, và thông tin người dùng bị lấy lặp lại 2 lần trong cùng 1 lần tải trang.
- Không đổi bất kỳ quy tắc phân quyền nào — 3 quy tắc bảo vệ route trong middleware giữ nguyên điều kiện gốc.
- Deploy production thành công (health check OK).
- ⚠️ Chưa đo được con số cải thiện thực tế tính bằng giây — cần bạn bấm thử lại và xác nhận cảm nhận.
- Chi tiết đầy đủ: `docs/H2OBOOK_STUDENT_NAVIGATION_LATENCY_REPORT.md`.

---

**2026-08-04 — ✅ Đã merge + deploy: tự động đăng nhập sau khi xác nhận email, nút Đăng nhập bằng Google, và vá tận gốc lỗi tạo nhầm workspace Owner — KHÔNG CẦN CHẠY MIGRATION GÌ THÊM (đã chạy `_RUN-0032-ONLY.sql`).**
- **Vá tận gốc**: cơ chế tự động tạo workspace mới trước đây sẽ kích hoạt bất cứ khi nào tài khoản đăng ký KHÔNG chỉ rõ vai trò — kể cả đăng nhập bằng Google. Giờ chỉ khi nào rõ ràng yêu cầu "owner" mới tạo workspace mới; mọi cách đăng ký khác (email, Google, mời qua admin...) đều an toàn.
- Học viên bấm link xác nhận email (hoặc đăng nhập Google) → tự động vào thẳng `/student`, đã gia nhập đúng academy, không cần đăng nhập lại thủ công.
- Thêm nút "Đăng nhập/Đăng ký bằng Google" ở `/login` và `/signup` — cần bạn đã bật Google Provider trong Supabase Dashboard (bạn đã xác nhận hoàn thành việc này).
- Sửa thêm 1 lỗi nhỏ: bấm Google từ `/login` (không phải `/signup`) mà chưa xác định vai trò thì trước đây mặc định đưa về `/dashboard` — giờ luôn kiểm tra đúng vai trò trước khi quyết định đưa vào `/student` hay `/dashboard`.
- ⚠️ Lưu ý khi tự test: nếu trình duyệt đang có sẵn phiên đăng nhập Owner cũ, bấm "Đăng nhập Google" sẽ chỉ tiếp tục phiên cũ đó (không phải bug) — cần đăng xuất hẳn hoặc dùng tab ẩn danh để test đúng luồng học viên mới.
- Deploy production thành công (health check OK).
- Chi tiết đầy đủ: `docs/H2OBOOK_AUTO_LOGIN_GOOGLE_SIGNIN_REPORT.md`.

---

**2026-08-04 — 🚨 ĐÃ SỬA LỖI NGHIÊM TRỌNG: đăng ký tài khoản mới trước đây vô tình tạo workspace Owner mới thay vì vào học viên — đã merge + deploy — KHÔNG CẦN CHẠY MIGRATION GÌ.**
- **Nguyên nhân đã xác nhận**: nút "Chưa có tài khoản?" ở trang đăng nhập dẫn tới `/signup` — trang này trước đây gán cứng `role:"owner"` khi tạo tài khoản. Theo đúng cơ chế tự động của hệ thống (đã có từ trước, không phải lỗi mới), bất kỳ ai đăng ký với role "owner" sẽ được **tự động tạo một workspace mới hoàn toàn và trở thành Owner toàn quyền của workspace đó** — không qua duyệt, không qua cấp độ, không vào academy thật của Thủy H2O.
- **Đã sửa**: `/signup` giờ tạo tài khoản với vai trò Học viên thật, tự động gia nhập đúng academy của Thủy H2O (không tạo workspace mới), sau đó vào thẳng `/student` — không gian học viên trống, đúng vai trò.
- **Đã xây thêm hệ thống khóa/mở giai đoạn thật theo từng học viên** (trước đây mọi học viên đều thấy y hệt nhau — "Học viên nền tảng" luôn hiện "đã hoàn thành" giả cho tất cả mọi người): giờ chỉ giai đoạn đầu (kiến thức miễn phí) mở sẵn cho học viên mới; các giai đoạn sau bị khóa thật, có nút "Đăng ký nâng cấp" dẫn tới trang Membership; mở ra thật khi học viên có membership đang hoạt động hoặc được admin cấp thủ công.
- ⚠️ **Việc bạn cần tự kiểm tra thủ công**: các tài khoản đã lỡ đăng ký qua `/signup` TRƯỚC bản sửa này (nếu có) đã bị tạo thành Owner của 1 workspace rỗng riêng — bản sửa này KHÔNG tự động sửa lại các tài khoản cũ đó. Nếu bạn nghi có tài khoản như vậy, hãy kiểm tra trong Supabase bảng `organizations` xem có workspace lạ nào không phải của Thủy H2O không.
- Deploy production thành công (health check OK). Không cần chạy gì trên Supabase cho phần sửa lỗi này.
- Chi tiết đầy đủ: `docs/H2OBOOK_STUDENT_SELF_SIGNUP_STAGE_LOCK_REPORT.md`.

---

**2026-08-04 — ✅ Đã merge + deploy Phase 1 (Auth & Routing) từ Production Gap Audit — KHÔNG CẦN CHẠY MIGRATION GÌ.**
- Sửa đúng các gap đã xác nhận trong `docs/H2OBOOK_PRODUCTION_GAP_AUDIT.md`:
  - **[P0]** Trước đây các trang quản trị hệ thống (`/admin`, `/platform-admin`, `/security`, `/enterprise`, `/integrations`, `/cloud-sync`, `/settings`...) **không có kiểm tra quyền** — bất kỳ tài khoản đã đăng nhập nào (kể cả không phải admin) đều mở được. Giờ chỉ Admin/Owner mới vào được, các vai trò khác sẽ thấy trang "Không đủ quyền" (`/unauthorized`) mới thay vì mở thẳng trang.
  - Đã tạo trang `/unauthorized` (Không đủ quyền / Cần quyền truy cập / Membership hết hạn).
  - Sửa lỗi: link đăng nhập qua email hết hạn trước đây bị "đăng nhập âm thầm thất bại" không báo gì — giờ báo rõ "Đường dẫn đã hết hạn, vui lòng đăng nhập lại."
  - Sửa màn hình đăng nhập trên điện thoại: trước đây phải cuộn qua phần giới thiệu cao gần nửa màn hình mới thấy được ô nhập email/mật khẩu — giờ form hiện ngay đầu tiên.
  - Trang chi tiết sách/khóa học/chiến lược giờ có tiêu đề riêng khi chia sẻ (trước đây tất cả đều hiện chung "H2OBOOK 4.14").
- **Không đổi database, không cần chạy gì trên Supabase.** Deploy production thành công (health check OK, đã kiểm tra `/unauthorized` hoạt động).
- Chi tiết đầy đủ, gồm những route CỐ Ý CHƯA khóa quyền (vì có vai trò khác vẫn cần dùng, ví dụ `/books`, `/operations/*`) và lý do: `docs/H2OBOOK_PHASE1_AUTH_ROUTING_REPORT.md`.

**2026-08-04 — ✅ Đã merge + deploy: thống nhất ghi log về `domain_events`, bỏ đường ghi log trùng lặp — KHÔNG CẦN CHẠY MIGRATION GÌ.**
- Thực hiện đúng đề xuất trong `docs/DATA_DICTIONARY_MAIN_AUDIT.md` §5.2: phát hiện `lib/domain/audit.ts` là nơi DUY NHẤT trong toàn bộ code còn ghi vào bảng `audit_logs`, và cả 2 chỗ gọi nó đều nằm trong 1 API chung (`/api/domain/[resource]`) mà mọi bảng nó thao tác **đã có sẵn trigger tự động ghi vào `domain_events`** từ migration 0007 (ghi đầy đủ hơn — có cả dữ liệu trước/sau, không chỉ tên hành động).
- Đã xóa `lib/domain/audit.ts` và bỏ 2 lần gọi ghi log trùng lặp. **Không ảnh hưởng gì tới hành vi thật** — mọi thao tác vẫn được ghi log đầy đủ như trước qua `domain_events`, chỉ bớt đi bản ghi trùng kém chi tiết hơn ở `audit_logs`. Bảng `audit_logs` và dữ liệu cũ không bị đụng tới.
- Deploy production thành công (health check OK). Không cần chạy gì trên Supabase.

**2026-08-04 — 📄 Đã merge tài liệu Data Dictionary (module 17) — CHỈ LÀ TÀI LIỆU, KHÔNG ĐỔI CODE/SCHEMA/DEPLOY.**
- Module 17 đề xuất xây "Resource Registry" tổng thể (14 bảng mới) để hợp nhất dữ liệu — nhưng sau khi audit, xác nhận H2OBOOK **không** có tình trạng phân mảnh schema mà giải pháp đó nhắm tới (mỗi domain đã có đúng 1 bảng nguồn sự thật). Theo quyết định của bạn, chỉ viết tài liệu tham khảo, không xây registry.
- Tài liệu mới: `docs/DATA_DICTIONARY_MAIN_AUDIT.md` — bản đồ đầy đủ: bảng nguồn sự thật theo từng domain (Create/Learn/Teach/Business/Operations/System), luồng Input→Process→Output, ai tạo dữ liệu gì (Admin/Giáo viên/Học viên/Hệ thống), dữ liệu nào lưu Postgres/R2/IndexedDB, và các rủi ro trùng lặp thật sự đã phát hiện (ví dụ: `audit_logs` và `domain_events` là 2 cơ chế ghi log song song).
- Không có gì cần bạn chạy trên Supabase, không cần deploy lại.

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
