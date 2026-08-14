# HƯỚNG DẪN LƯU TRỮ HỆ THỐNG H2OBOOK

> Tài liệu này giải thích: mỗi loại dữ liệu (nội dung sách, ảnh, video, CRM, khóa học, tài liệu chỉnh sửa) đang lưu ở đâu, cần tài khoản/dịch vụ gì để đưa vào vận hành thật, và cách kết nối. Viết cho người không rành kỹ thuật — chỉ cần đọc bảng và làm theo từng bước.
>
> Cập nhật lần cuối: 2026-07-31. Nếu code thay đổi nhiều, nhờ Claude Code đọc lại repo và cập nhật file này.

---

**2026-08-15 — 🧠 Đã merge + deploy: Sửa tận gốc pipeline Mission Coach / H2O Brain Memory (không phải vá prompt), KHÔNG cần migration.**

Bạn báo đúng bug thật với bằng chứng cụ thể: học viên trả lời "cô dâu" / "tôi muốn theo cô dâu phong cách Hàn Quốc" nhưng H2O Coach hỏi lại y hệt câu cũ, trong khi H2O Brain Memory bên phải vẫn "Chưa xác định" và Mission Progress lại báo 100%.

**Root cause thật (đã audit + query production trước khi sửa, không đoán):**
- Chế độ Offline (đang dùng cho Giai đoạn 1 vì `GEMINI_API_KEY` chưa cấu hình) **chưa từng có khả năng đọc hiểu văn bản tự do** — code gốc chỉ kiểm tra field nào đã "confirmed", không bao giờ trích xuất giá trị từ tin nhắn. Học viên gõ gì cũng bị bỏ qua → field không bao giờ được set → câu hỏi không bao giờ đổi.
- Thanh Progress trong Coach Workspace đang lấy nhầm từ công thức **cũ** của Mission Workspace 4-tab (block/action bắt buộc) — không liên quan gì tới H2O Brain Memory. Mission này có 0 block bắt buộc trong hệ thống cũ nên công thức mặc định trả về 100%, dù Coach memory rỗng hoàn toàn. Đây là 2 nguồn trạng thái không đồng bộ, không phải 1 bug.

**Đã sửa tận gốc pipeline (không chỉ sửa câu prompt):**
- Thêm cơ chế trích xuất dữ liệu **Offline thật** — so khớp từ khoá xác định (admin cấu hình được qua Coach Builder), không đoán mò, không cần AI. Một tin nhắn có thể điền nhiều field cùng lúc.
- Progress giờ tính đúng theo số field bắt buộc đã xác nhận thật / tổng số yêu cầu (bao gồm cả bước xác nhận cuối) — không còn dùng công thức cũ không liên quan.
- Thêm bước **xác nhận tổng kết**: khi đủ field, H2O tóm tắt lại và hỏi "Đây có đúng không?" — chỉ khi học viên xác nhận mới tính Mission hoàn thành thật (gọi đúng cơ chế hoàn thành sẵn có của hệ thống, không tạo luồng hoàn thành song song).
- Chống xử lý trùng khi bấm gửi 2 lần / mất mạng thử lại.
- Dùng lại đúng hàm kiểm tra quyền truy cập Mission có sẵn — vá luôn 1 lỗ hổng là Coach trước đây chưa kiểm tra Mission có bị khoá hay không.

**Đã xác minh:** 24 test mới (khớp đúng các tình huống bạn liệt kê: trả lời 1 field, trả lời nhiều field 1 lúc, không lặp câu hỏi, xác nhận tổng kết, tính đúng %) + 245/245 test toàn hệ thống, typecheck/lint/build sạch. Đã cập nhật lại cấu hình Coach thật của Giai đoạn 1 (bản v2) với quy tắc nhận diện thật cho 3 field, xác minh trực tiếp trên production. Không cần migration — mọi thay đổi đều nằm trong cấu trúc dữ liệu JSON có sẵn.

Merge, push, deploy, health check ✅.

---

**2026-08-15 — 🐛 Đã merge + deploy: Sửa 2 lỗi thật của H2O Coach Builder (hiện nhầm Giai đoạn cũ/test + crash khi mở tab Kiến thức của bản nháp mới), KHÔNG cần migration.**

Ngay sau khi bạn bật cờ và vào thử `/academy-admin/coach-builder`, phát hiện 2 lỗi thật:

1. **Danh sách Giai đoạn hiện nhầm dữ liệu cũ/test đã lưu trữ** — "Giai ddoanj test cho makeup", "Người mới bắt đầu", "Giai đoạn", "Có khách đầu tiên"... (đều `status: archived` trong database, không phải 6 Giai đoạn thật đang hoạt động). Nguyên nhân: hàm lấy danh sách Giai đoạn cho Coach Builder quên lọc theo trạng thái — đã sửa để dùng đúng hàm `loadCareerStages()` (chỉ lấy Giai đoạn `active`) giống mọi màn Admin khác trong hệ thống đang dùng.
2. **Bấm vào 1 Giai đoạn chưa từng cấu hình → mở tab "2. Kiến thức sử dụng" → sập trang** với lỗi "Cannot read properties of undefined (reading 'join')". Nguyên nhân: khi tự tạo bản nháp đầu tiên cho 1 Giai đoạn, cột lưu "phạm vi kiến thức" trong database mặc định là rỗng hoàn toàn (`{}`), thiếu hẳn các trường con mà giao diện cần đọc — code chỉ kiểm tra "có tồn tại không" chứ chưa kiểm tra "có đủ trường con không". Đã sửa tận gốc: từ nay bản nháp mới luôn được tạo với đầy đủ cấu trúc, đồng thời mọi nơi đọc dữ liệu cũ đều tự vá lại nếu thiếu trường.

Đã xác minh: `pnpm typecheck`/`lint`/`test` (230/230)/`build` sạch. Merge, push, deploy lại — bản deploy mới này cũng là bản đầu tiên thực sự có cờ `NEXT_PUBLIC_H2O_COACH_WORKSPACE_V1=true` bạn vừa thêm trên Vercel (lần deploy trước đó không có bản build mới nào gộp cả 2 thay đổi cùng lúc).

**Về việc giao diện học viên chưa đổi:** đã kiểm tra trực tiếp bằng dữ liệu thật — Mission "Xác định hướng nghề Makeup" bạn đang xem đúng là đã được gắn Coach Profile Giai đoạn 1 đã áp dụng thật, chuỗi tra cứu Stage→Mission hoạt động đúng. Nếu sau lần deploy này vẫn chưa thấy đổi, nhiều khả năng là cache trình duyệt — thử Ctrl+Shift+R (tải lại bỏ cache) hoặc mở cửa sổ ẩn danh.

---

**2026-08-14 — 🤖 Đã merge + deploy: H2O Coach OS V1 (Coach Workspace hội thoại + Coach Builder cho Admin + rule engine offline thật + bộ nhớ học viên có cấu trúc), CÓ migration (0057, bạn đã tự chạy trong Supabase SQL Editor). Mặc định TẮT — chưa hiện gì cho học viên cho tới khi Admin bật và cấu hình.**

Tích hợp từ folder 39 (`v5/39-H2OBOOK_H2O_COACH_OS_V1`) — nâng Mission Workspace từ giao diện điền form 4 tab thành "Coach Workspace": học viên nói chuyện tự nhiên, H2O đọc dữ liệu đã có từ Mission trước, hỏi phần còn thiếu, học viên xác nhận trước khi ghi vào hồ sơ chính thức. 4 bước cũ (Hiểu/Thực hiện/Minh chứng/Kết quả) vẫn là luồng backend, không mất gì — Coach chỉ là lớp giao diện mới nằm trên cùng dữ liệu thật.

**Đã làm:**
- Migration 0057 (additive-only, 5 bảng mới): cấu hình Coach theo từng Giai đoạn có versioning y hệt cách "Bản đồ kết quả học viên" đang làm (Nhân bản → chỉnh Draft → Áp dụng → có thể rollback), cấu hình coaching theo từng Mission (câu hỏi, field cần thu, công cụ), bộ nhớ học viên có cấu trúc theo namespace (career.*, style.*...) kèm trạng thái đề xuất/đã xác nhận/từ chối, lịch sử hội thoại theo từng Mission.
- **Rule engine Offline chạy thật 100%, không cần AI** — H2O vẫn hỏi đúng câu hỏi còn thiếu dựa trên cấu hình Admin đặt, dù chưa bật AI nào.
- **Chế độ AI/Hybrid đã viết sẵn** (dùng lại đúng cách gọi Gemini mà H2O Brain đang dùng) nhưng **`GEMINI_API_KEY` chưa được cấu hình** ở cả local lẫn Vercel production — đã kiểm tra kỹ trước khi code theo đúng yêu cầu "chỉ tích hợp AI provider nếu đã cấu hình". Khi nào bạn thêm key, chế độ Hybrid/AI sẽ tự chạy được, không cần sửa code.
- **H2O Coach Builder** (Admin, chỉ owner/admin) tại `/academy-admin/coach-builder` — cấu hình Vai trò Coach, Kiến thức sử dụng, Mission Coaching (bao gồm Công cụ & Quy tắc), Dữ liệu cần ghi nhớ, Chế độ AI, và quản lý phiên bản.
- **H2O Coach Workspace** (Học viên) — giao diện 3 cột (Hành trình / Hội thoại với Coach / Hồ sơ đang hình thành), chỉ hiện thay cho 4 tab cũ khi Giai đoạn đó ĐÃ được Admin cấu hình và áp dụng thật — nếu chưa cấu hình, học viên vẫn thấy giao diện 4 tab như trước, không có gì thay đổi.

**Mặc định TẮT:** cờ `NEXT_PUBLIC_H2O_COACH_WORKSPACE_V1` chưa bật — đây là tính năng thí điểm theo đúng kế hoạch của gói tích hợp ("Phase 1: chỉ Admin dùng Builder, mở 100% Giai đoạn 1 sau khi QA"), không tự động thay đổi trải nghiệm học viên hiện tại.

**Đã xác minh bằng dữ liệu thật:** tạo thử 1 hồ sơ Coach cho Giai đoạn → tạo bản nháp v1 → gắn cấu hình cho 1 Mission thật → áp dụng v1 → nhân bản sang v2 → áp dụng v2 (v1 tự lưu trữ) → **rollback** bằng cách áp dụng lại v1 (đúng luồng "Nhân bản → Draft → Áp dụng → rollback" gói yêu cầu) → thử ghi 1 dữ liệu bộ nhớ đề xuất rồi xác nhận → thử ghi cấu hình Mission với id giả (đúng luật phải bị từ chối) → xóa sạch dữ liệu thử, xác nhận 0 dòng còn sót. Kiểm tra lại Giai đoạn 01 và tổng số Mission không đổi — xác nhận migration không đụng gì tới Journey/Mission/Progress/Hoàn thành hiện có.

Merge, push, deploy, health check ✅. Chi tiết đầy đủ: `docs/h2o-coach-v1/01_PRODUCTION_AUDIT.md`, `docs/h2o-coach-v1/FINAL_REPORT.md`.

---

**2026-08-14 — 🐛 Đã merge + deploy: Sửa lỗi tài khoản được cấp Giai đoạn 2/3 trước hạn bị kẹt, không vào được Giai đoạn 1, KHÔNG cần migration.**

Bạn báo: tài khoản "Max Crypto" được cấp cả Giai đoạn 2 và 3, nhưng vào "Hành trình của tôi" lại hiện "Giai đoạn này đang được xây dựng hành trình" — không vào được chi tiết Giai đoạn 1 dù Giai đoạn 1 đã xây xong từ lâu.

**Nguyên nhân thật:** "Giai đoạn hiện tại" của học viên luôn được tính là **Giai đoạn có vị trí cao nhất mà học viên đã mở khóa** — không quan tâm Giai đoạn đó đã có nội dung thật hay chưa. Tài khoản này mở khóa được Giai đoạn 1 (miễn phí) + Giai đoạn 2 + Giai đoạn 3 (được cấp thủ công để test tính năng cấp quyền vừa xây xong) → hệ thống chọn Giai đoạn 3 làm "hiện tại" vì vị trí cao nhất — nhưng Giai đoạn 3 **chưa có hành trình nào được publish** (chưa xây), Giai đoạn 2 cũng vậy (mới có bản nháp). Kết quả: học viên bị kẹt ở 1 Giai đoạn trống, không còn cách nào vào lại Giai đoạn 1 đã xây xong và đang mở.

**Đã sửa:** "Giai đoạn hiện tại" giờ ưu tiên tìm từ vị trí cao nhất xuống thấp, chọn **Giai đoạn đã mở khóa ĐẦU TIÊN có hành trình thật (đã publish)** — chỉ khi không Giai đoạn nào có hành trình thật mới quay lại chọn Giai đoạn vị trí cao nhất như cũ (đúng bản chất "chưa có gì để xem" thật sự). Gom 3 nơi từng lặp lại cùng 1 đoạn logic (trang Hành trình, trang Lộ trình, API `/api/student/journey`) về chung 1 hàm `resolveCurrentStageId()`.

Đã xác minh: chạy thử đúng dữ liệu thật của tài khoản Max Crypto (mở khóa Giai đoạn 1+2+3, chỉ Giai đoạn 1 có hành trình publish) — kết quả chọn đúng Giai đoạn 1.

Không migration — chỉ sửa logic đọc dữ liệu, không đổi bảng nào.

Merge, push, deploy, health check ✅.

---

**2026-08-14 — 🧠 Đã merge + deploy: Learning Journey Intelligence V1 (Nhật ký thực hành 90 ngày + H2OBrain Student Context + Capability Snapshot), CÓ migration (0056, bạn đã tự chạy trong Supabase SQL Editor).**

Tích hợp từ folder 38 (`v5/38-h2obook_learning_intelligence_v1`) — thêm một lớp "Learning Memory" ghi lại 90 ngày thực hành thật (hôm nay luyện gì, ảnh/video, kỹ năng đang luyện, tự chấm điểm, điểm giáo viên, thời gian luyện, lỗi lặp lại, nhận xét, việc cần làm tiếp) để nuôi H2OBrain đánh giá năng lực — xây **thêm lên trên** Journey hiện có, không đụng vào Stage/Mission/Checkpoint/Progress/Unlock.

**Audit trước khi code phát hiện:** bảng `learner_experiences` (có sẵn từ rất sớm, chưa từng được dùng ở bất kỳ tính năng nào trong suốt phiên làm việc này) đã có gần đúng hình dạng cần cho Nhật ký thực hành — sát hơn hẳn so với `learner_notes` mà tính năng "Nhật ký thực hành" ở folder 36 đang dùng. Đã kiểm tra: cả hai bảng đều **0 dòng dữ liệu thật** — nên chuyển đổi an toàn, không cần dời dữ liệu cũ.

**Đã làm:**
- Migration 0056 (additive-only): mở rộng `learner_experiences` để gắn được vào Mission (`mission_id`) thay vì bắt buộc phải thuộc Khoảng không gian kiến thức, thêm cột `journey_day` (Ngày 1-90), `best_result`, `suspected_reason`, `self_score`, `instructor_score`, `practice_minutes`. Thêm bảng mới `learning_capability_snapshots` cho báo cáo năng lực Weekly/Day30/Day60/Day90.
- **Chuyển "Nhật ký thực hành" (folder 36) từ `learner_notes` sang `learner_experiences`** — giữ nguyên API cũ (`/api/student/practice`) để không phá bất kỳ ai đang gọi, chỉ đổi bảng lưu bên trong. Giao diện Nhật ký thực hành nâng cấp: chọn kỹ năng đang luyện (dùng đúng 9 kỹ năng đã có sẵn ở Hộ chiếu kỹ năng, không tạo danh sách kỹ năng mới song song), tự chấm điểm, điều làm tốt nhất, điều chưa tốt, nguyên nhân, việc cần làm tiếp theo, số phút luyện tập — cùng với upload ảnh/video như cũ.
- API mới: `/api/student/learning-journey/log` (Nhật ký đầy đủ), `/api/h2obrain/student-context` (dữ liệu tổng hợp thật cho AI diễn giải — không để AI tự bịa điểm số), `/api/student/learning-journey/snapshot` (tạo báo cáo năng lực theo yêu cầu).
- Quy tắc trung thực: nếu chưa đủ ít nhất 3 lần thực hành thật trong kỳ, báo cáo năng lực hiện "Chưa đủ Evidence để đánh giá", không tự tạo điểm giả.

**Đã xác minh bằng dữ liệu thật:** ghi thử 1 dòng đầy đủ các cột mới, ghi kỹ năng luyện tập 2 lần (kiểm tra đường ghi-đè hoạt động đúng), tạo thử 1 báo cáo năng lực, thử ghi 1 dòng thiếu cả 2 loại gắn kết (phải bị từ chối đúng luật ràng buộc), sau đó xóa sạch toàn bộ dữ liệu thử — xác nhận 0 dòng còn sót. Kiểm tra lại Giai đoạn 01 vẫn "active" và số lượng Mission không đổi (58) — xác nhận migration không đụng gì tới Journey Core.

Merge, push, deploy, health check ✅. Chi tiết đầy đủ: `docs/H2O_LEARNING_JOURNEY_AUDIT.md`, `docs/learning-journey-intelligence-v1/FINAL_REPORT.md`.

---

**2026-08-14 — 🔔 Đã merge + deploy: Thông báo thật cho học viên + hiện Giai đoạn hiện tại trong danh sách + hiệu ứng xác nhận rõ ràng, KHÔNG cần migration.**

Bạn báo 3 việc sau khi dùng tính năng cấp Giai đoạn/Membership mới: (1) danh sách học viên không hiện đang ở Giai đoạn nào, (2) cấp quyền xong không có hiệu ứng thông báo rõ ràng, (3) học viên không nhận được thông báo gì khi tài khoản được nâng cấp.

**Phát hiện lớn khi audit việc 3:** chuông thông báo 🔔 trên giao diện học viên **từ trước tới giờ chỉ hiện số "2" viết cứng trong code**, không đọc dữ liệu thật nào cả. Trong khi đó bảng `notifications` (đã có từ rất sớm, có RLS đúng chuẩn — mỗi học viên chỉ đọc được thông báo của mình) **chưa từng có màn hình nào ghi vào hoặc đọc từ đó** — tồn tại sẵn, đúng cấu trúc, nhưng bị bỏ quên hoàn toàn.

**Đã làm:**
- **Chuông thông báo giờ là thật** — đọc đúng bảng `notifications`, hiện đúng số chưa đọc, bấm vào xem danh sách, bấm 1 thông báo để đánh dấu đã đọc và đi thẳng tới đúng trang liên quan.
- Mỗi lần Admin cấp **Khóa học / Giai đoạn / Membership** ở `/academy-admin/distribution`, học viên tương ứng **tự động nhận 1 thông báo thật** nói rõ vừa được cấp gì.
- **Hiệu ứng xác nhận rõ ràng cho Admin** — mọi lượt cấp/thu hồi quyền giờ hiện 1 khối thông báo nổi bật góc phải màn hình (xanh = thành công, đỏ = lỗi), tự ẩn sau vài giây, nói rõ đã cấp gì cho ai.
- **Danh sách học viên ở Bước 1** giờ hiện thêm nhãn Giai đoạn hiện tại cho từng người — tính đúng theo luật mở khóa thật (Giai đoạn đầu miễn phí / có Membership thì mở hết / được cấp riêng), cùng công thức trang tổng quan học viên đang dùng nên không bao giờ lệch nhau. Tự cập nhật ngay sau khi cấp Giai đoạn/Membership, không cần tải lại trang.

Không migration — cả 3 bảng liên quan (`notifications`, `business_feature_grants`, `memberships`) đều đã có sẵn từ trước, chỉ thiếu người đọc/ghi.

Merge, deploy, health check ✅.

---

**2026-08-14 — 🔓 Đã merge + deploy: Cấp Giai đoạn & Membership thủ công cho học viên — vá đúng lỗ hổng bạn báo, KHÔNG cần migration.**

Bạn báo: màn "Thêm học viên" chỉ cấp được Khóa học, không có lựa chọn Giai đoạn, và học viên đã cấp trước đó chưa từng được nâng cấp Giai đoạn/Membership.

**Audit ra đúng nguyên nhân:** hệ thống mở khóa Giai đoạn cho học viên đã có sẵn 3 luật (Giai đoạn đầu miễn phí / có Membership thì mở hết / cấp riêng từng Giai đoạn) — nhưng luật thứ 3 (cấp riêng từng Giai đoạn) **có sẵn bảng dữ liệu, có sẵn chỗ đọc, nhưng chưa từng có màn hình nào ghi vào đó** — y hệt kiểu lỗ hổng "nút chưa nối" đã gặp nhiều lần trong dự án này. Vì "Thêm học viên" chỉ cấp Khóa học, không đụng tới Membership, nên học viên đã cấp trước đó đúng là chưa từng được mở thêm Giai đoạn nào ngoài Giai đoạn 1 miễn phí.

**Đã vá:** trang `/academy-admin/distribution` giờ có thêm 2 bước mới bên cạnh cấp Khóa học:
- **Cấp Giai đoạn** — chọn đúng 1 Giai đoạn thật, có lý do bắt buộc, có thể đặt ngày hết hạn. **Cấp Giai đoạn mới không bao giờ làm mất Giai đoạn đã cấp trước đó** — cơ chế chỉ cộng dồn, không tự xóa.
- **Cấp Membership** — chọn đúng gói thật (Knowledge Library / Academy Pro / Beauty Business), có hiệu lực **ngay lập tức** (không phải bản dùng thử 7 ngày như luồng mời tự động) — vì Admin đã chủ động quyết định cấp thì phải có tác dụng thật ngay, không lo "1 tuần sau tự mất mà không ai để ý".

Có thêm danh sách "Lịch sử cấp Giai đoạn thủ công" kèm nút Thu hồi, cùng kiểu với lịch sử cấp Khóa học đã có.

**Phát hiện thêm khi audit — đã hỏi và sửa luôn:** Giai đoạn 01 "Nền tảng nghề Makeup" — nơi 2 học viên thật đang học — đang có trạng thái **"hidden"** trong hệ thống, không phải "active". Điều này khiến 1 số màn tổng quan (tóm tắt "Giai đoạn hiện tại" trên Hành trình/Trang chủ, đọc qua `getUnlockedStageIds`) tính nhầm sang Giai đoạn 02 làm Giai đoạn hiện tại của học viên — dù Mission Workspace (nơi học viên thật sự làm bài, đọc trực tiếp không qua luật này) vẫn đúng. Đã hỏi bạn — xác nhận là sai sót — đã sửa lại `status: "active"` (đúng theo logic hàm `publishStage()` có sẵn: chỉ set `published_at` lần đầu, không đụng gì khác). Đã xác nhận lại bằng dữ liệu thật: Giai đoạn 01 giờ đứng đúng vị trí đầu tiên trong danh sách 6 Giai đoạn active. Đây là sửa dữ liệu, không phải code — có tác dụng ngay, không cần deploy.

Merge, deploy, health check ✅. Không migration — dùng lại đúng bảng `business_feature_grants` đã có sẵn từ trước (module 13), chỉ thêm màn hình ghi vào đó.

---

**2026-08-13 — 🧭 Đã merge + deploy: Mission Workspace V2 (folder 37) — "còn thiếu gì" rõ ràng ở tab Kết quả, Minh chứng đổi hình theo từng loại Mission, KHÔNG cần migration.**

Đọc đủ 18/18 file gói nguồn trước khi làm. Gói nguồn yêu cầu nâng `/student/missions/[missionId]` thành luồng 4 bước rõ ràng, và sửa cho đúng nguyên tắc "Sẵn sàng (Readiness) khác Hoàn thành (Completion)".

**Audit trước — phát hiện: phần lớn đã có sẵn, không phải xây từ đầu.** Route thật đã là 4 tab (Hiểu nhiệm vụ / Làm việc / Evidence / Kết quả) từ các đợt nâng cấp trước, đã có "H2O đã biết gì về bạn" (Known Context), đã có Result Card thật, đã có "Kết quả này dùng ở đâu". **Kiểm tra sâu nguyên tắc Sẵn sàng ≠ Hoàn thành: xác nhận KHÔNG có lỗi thật** — hệ thống chưa từng lấy điểm Sẵn sàng để tự suy ra Hoàn thành, "Hoàn thành" luôn đọc đúng từ tiến độ thật đã ghi theo đúng quy tắc Cách xác nhận hoàn thành. Cái thật sự thiếu: 1 danh sách rõ ràng "còn thiếu đúng những gì" thay vì 1 câu chung chung.

**Đã làm thêm:**
- **Tab "Kết quả"** — khi Mission chưa xong, giờ hiện đúng "Chưa tạo kết quả" kèm danh sách cụ thể còn thiếu bao nhiêu mục, và 2 nút quay lại "Thực hiện"/"Minh chứng" ngay tại chỗ.
- **Đổi tên tab cho đúng tiếng Việt tự nhiên**: "Làm việc" → "Thực hiện", "Evidence" → "Minh chứng".
- **Tab Minh chứng giờ đổi hình theo từng loại Mission thật** — Mission cần ảnh Before/After thì hiện 2 ô tải ảnh riêng biệt; Mission chỉ cần 1 ảnh thì hiện 1 ô tải; Mission chỉ cần học viên tự xác nhận (không cần ảnh) thì chỉ hiện 1 ô tick xác nhận, không ép tải file. Dùng đúng đường tải ảnh/video học viên đã có sẵn (cùng cơ chế Nhật ký luyện tập đã xây trước đó).
- **Màn Admin quản lý Nhiệm vụ** — thêm câu giải thích ngắn dưới mỗi trong 5 tab, để Admin hiểu rõ từng tab dùng để làm gì mà không cần đoán.

**Không tạo bảng dữ liệu mới nào** — toàn bộ đọc/ghi qua đúng những gì đã có.

**Chưa test qua giao diện thật** với 1 tài khoản học viên đăng nhập trực tiếp (không có phiên đăng nhập để mô phỏng, giống mọi đợt trước) — đặc biệt chưa tự bấm thử luồng tải ảnh Before/After thật. Báo cáo đầy đủ: `docs/mission-workspace-v2/FINAL_REPORT.md`.

---

**2026-08-12 — 📸 Đã merge + deploy: đóng 2 việc còn hoãn của Stage 1 Learning OS V1 — upload ảnh/video cho Nhật ký luyện tập + áp dụng Tiêu chí đạt thật vào 1 bản nháp mới, KHÔNG cần migration.**

Tiếp tục 2 việc đã ghi rõ là "chưa xây" trong báo cáo folder 36.

**Nhật ký luyện tập giờ đính được ảnh/video thật** — dùng đúng đường upload học viên đã có sẵn (cùng cơ chế Reader và Brand Kit đang dùng: link tải lên có chữ ký, tự kiểm dung lượng, tự quét an toàn), không dựng lại từ đầu. Chỉ là nối thêm giao diện — phần ghi dữ liệu (`asset_ids`) máy chủ đã âm thầm nhận sẵn từ trước, chỉ chưa ai gửi lên.

**Tiêu chí đạt thật cho 14 Mission — đã áp dụng vào 1 bản nháp mới, chưa Publish:** thay vì để bạn tự dán tay qua giao diện, tôi đã hỏi và **được bạn cho phép** chạy 1 script ghi thật vào production (hệ thống quyền tự động đã tự chặn lại trước, đúng như thiết kế, và tôi đã dừng hỏi bạn thay vì tìm cách lách). Script mô phỏng chính xác logic nút "Nhân bản phiên bản này" thật đang dùng trong Admin — nhân bản đầy đủ `v1` đang publish thành `v2 — Bản nháp` (đủ 14 Mission, học liệu, Việc cần làm đi kèm), rồi điền Tiêu chí đạt thật vào cả 14 Mission trong bản nháp đó. **`v1` đang publish cho 2 học viên thật hoàn toàn không bị đụng tới** — đã kiểm tra lại sau khi chạy, xác nhận đúng. Bạn vào `/academy-admin/journey`, chọn Stage "Nền tảng nghề Makeup" → `v2 — Bản nháp`, soát lại rồi tự quyết định khi nào Publish.

**Chưa test qua giao diện thật** cho phần upload ảnh/video (không có phiên đăng nhập học viên để mô phỏng qua curl) — đã xác nhận đúng bằng cách đọc lại code, chưa bằng click thật. Báo cáo đầy đủ: `docs/stage1-learning-os-v1/FINAL_REPORT.md`.

---

**2026-08-12 — 🎓 Đã merge + deploy: Stage 1 Learning OS V1 (folder 36) — Passport học viên, Known Context, Output Reuse, Daily Practice, Skill Passport, Chứng nhận Stage 1 — ⚠️ ĐÃ CHẠY MIGRATION 0055.**

Đọc đủ 18/18 file gói nguồn trước khi làm. Gói nguồn mô tả Stage 1 nên trở thành "Learning Outcome OS" — kiến thức → dữ liệu cá nhân → hành động → bằng chứng → kết quả → tái sử dụng dữ liệu → mission tiếp theo — kèm 1 bản blueprint 4 Outcome/13 Mission mới.

**Đã hỏi trước khi động vào nội dung thật:** blueprint khác hẳn 4 Outcome/14 Mission thật đang publish, mà 2 học viên thật (Max Crypto, Thùy H2O Makeup) đang học dở. Đã hỏi qua câu hỏi lựa chọn, bạn chọn: **giữ nguyên tên/cấu trúc 14 Mission thật, chỉ thêm năng lực mới gắn vào đúng nội dung thật hiện có** — không dựng lại curriculum theo blueprint.

**Audit trước, gần như không cần bảng mới:** rà 8 nhu cầu của gói nguồn thì 7/8 đã có sẵn hạ tầng thật nhưng chưa được nối: `certificate_issues` (bảng Chứng nhận có thật từ trước, chưa ai ghi), `learning_skill_evidence` + hàm tính mastery% thật (đã có, chỉ thiếu người ghi), `learner_notes` (đã tổng quát hóa từ đợt trước, đủ dùng cho Nhật ký luyện tập), `create_outcome_projects` (đủ dùng cho Brand Kit cá nhân — đã loại `brand_profiles` vì đó là brand của tổ chức, không phải của học viên). Chỉ thiếu đúng 1 cột: `learner_notes.asset_ids` (đính ảnh/video cho Nhật ký luyện tập).

**Đã làm:**
- **Passport học viên** (`/student/profile`, mục mới "CAREER PASSPORT" + phần Chứng nhận viết lại từ dữ liệu thật) — tổng hợp Định hướng nghề, Career Map, mục tiêu 90 ngày, tiến độ, Skill mastery%, sản phẩm Create, trạng thái Chứng nhận (khóa/đủ điều kiện/đã cấp) — tất cả đọc thật, không ô nào bịa.
- **"Known Context" trong Mission Workspace** — mở 1 Mission giờ tự hiện lại dữ liệu học viên đã nhập ở các Mission trước cùng Chặng, không bắt nhập lại.
- **"Kết quả này sẽ dùng ở đâu?"** — mỗi Mission cho biết rõ kết quả sẽ chảy tới đâu (Hồ sơ/Thư viện/Create/Chứng nhận), Mission chưa có đích thì không hiện gì, không tự bịa.
- **Nhật ký luyện tập hằng ngày** — gắn vào Mission "Xác định mục tiêu 90 ngày", ghi chú + tag (upload ảnh/video và giáo viên duyệt **chưa xây**, ghi rõ là việc còn hoãn).
- **Skill Passport có người ghi** — hoàn thành 1 trong 4 Mission kỹ thuật nền (Chuẩn bị da đúng/Hoàn thiện lớp nền/Màu sắc cơ bản/Tóc nền tảng) giờ tự ghi 1 dòng bằng chứng kỹ năng, điểm số theo đúng mức được kiểm chứng thật (giáo viên xác nhận > có nộp bằng chứng > tự báo cáo).
- **Cấp Chứng nhận Stage 1** — mục mới ở trang phân phối Admin, chỉ Admin bấm cấp (học viên không tự cấp cho mình), tự kiểm tra lại đủ 14/14 Mission mới cho cấp, không tin theo dữ liệu gửi lên.
- **Sửa lỗi thật:** trang `/verify/[mã]` (tra cứu công khai Chứng nhận) trước đây đọc dữ liệu giả — giờ đọc đúng bảng Chứng nhận thật.

**Gap thật tìm thấy khi audit (ngoài yêu cầu gói nguồn):** toàn bộ 14 Mission thật đang publish chưa có Tiêu chí thành công — học viên đang thấy dòng "Chưa có tiêu chí thành công". Đã soạn sẵn tiêu chí thật, cụ thể cho từng Mission (`docs/stage1-learning-os-v1/SUCCESS_CRITERIA_READY_TO_APPLY.md`) — **chưa áp dụng vào bản đang publish**, cần bạn tự áp dụng qua "Nhân bản phiên bản này" ở Journey Admin Builder rồi Publish khi sẵn sàng.

**⚠️ Migration 0055 đã chạy và xác nhận:** bạn đã tự chạy `supabase/_RUN-0055-ONLY.sql` trên Supabase SQL Editor và xác nhận thành công — đã kiểm tra độc lập lại bằng dữ liệu thật trước khi deploy code phụ thuộc cột này.

**Đã kiểm chứng bằng dữ liệu thật:** cả 2 học viên thật chỉ mới xong 1/14 Mission → hệ thống Chứng nhận đúng ra "chưa đủ điều kiện" (không cấp nhầm sớm); thử ghi rồi xóa ngay 1 dòng bằng chứng kỹ năng và 1 dòng Nhật ký luyện tập bằng ID học viên thật — đúng khuôn dữ liệu, xóa sạch, không còn dấu vết.

**Chưa test qua giao diện thật** với 1 tài khoản học viên đăng nhập trực tiếp (không có phiên đăng nhập để mô phỏng, giống mọi folder trước) — verification dựa trên đối chiếu logic + dữ liệu thật production. Báo cáo đầy đủ: `docs/stage1-learning-os-v1/FINAL_REPORT.md`.

---

**2026-08-12 — 🌳 Đã merge + deploy: Journey Tree Editor V1 (folder 35) — Admin sửa được đủ Kết quả → Chặng → Nhiệm vụ trong 1 màn, vá thêm 1 lỗ hổng bảo mật thật, KHÔNG cần migration.**

Trước đây màn "Bản đồ kết quả học viên" chỉ cho sửa Nhiệm vụ đầy đủ (5 tab) — Kết quả và Chặng chỉ có nút "+ Thêm", không đổi tên/mô tả, không xóa, không sắp xếp lại được. Giờ bấm vào bất kỳ hàng Kết quả hay Chặng nào cũng mở đúng màn chỉnh sửa (tên, mô tả, thứ tự, quy mô, liên kết dữ liệu thật), có nút Lưu/Thêm/Xóa, có nút ↑ ↓ sắp xếp lại cho cả 3 cấp.

**Xóa an toàn:** trước khi xóa 1 Kết quả hay Chặng, hệ thống tự kiểm tra 4 điều — tiến độ học viên thật, dữ liệu Không gian làm việc thật, Việc cần làm thật, và có Nhiệm vụ nào khác đang lấy Nhiệm vụ bên trong làm điều kiện mở khóa hay không. Có 1 trong 4 → từ chối xóa, báo đúng lý do. Đã kiểm chứng bằng dữ liệu thật: thử xóa đúng Nhiệm vụ có tiến độ thật của Max Crypto/Thùy H2O Makeup — hệ thống nhận đúng là không an toàn.

**Vá thêm 1 lỗ hổng bảo mật thật khi audit (không phải do gói nguồn yêu cầu — do rà lại kỹ):** 3 hàm ghi dữ liệu (thêm Chặng, thêm Nhiệm vụ, sửa Nhiệm vụ) trước đây chỉ bị khóa ở giao diện khi xem bản đang áp dụng cho học viên — máy chủ không thực sự chặn, ai gọi thẳng API vẫn ghi được vào version đã publish. Cùng loại lỗ hổng đã vá ở folder 30 (nút "Bắt đầu Mission"). Đã thêm chặn ở máy chủ cho cả 3 hàm này và toàn bộ hàm mới. Đã kiểm tra: chưa từng có ai lợi dụng.

**Đã làm thêm:** version đang áp dụng giờ hiện rõ banner "Phiên bản đang áp dụng không thể sửa trực tiếp" kèm nút "Tạo bản nháp để chỉnh sửa" (1 bấm ra ngay bản nháp mới); liên kết sâu `?node=...&type=...` để mở đúng Kết quả/Chặng/Nhiệm vụ khi tải lại trang.

**Chưa test qua giao diện thật** (không có phiên đăng nhập để click) — logic phía máy chủ đã kiểm chứng đúng bằng dữ liệu thật (dọn sạch sau khi test), nhưng phần giao diện (panel hiện đúng chỗ, nút ẩn/hiện đúng lúc) cần bạn tự xác nhận qua trình duyệt. Báo cáo đầy đủ: `docs/journey-tree-editor-v1/FINAL_REPORT.md`.

---

**2026-08-12 — 🔗 Đã merge + deploy: Academy Data Link V1 (folder 34) — liên kết Curriculum ↔ Journey ↔ Học viên, sửa lỗi thật Student Stage badge, KHÔNG cần migration.**

Đọc đủ 16/16 file gói nguồn trước khi làm. Trang mới `/academy-admin/data-link` ("Liên kết dữ liệu" trong sidebar) — chỉ là **read-model + inspector**, không tạo bảng dữ liệu mới:

- **Data Link Health**: điểm số + số liệu thật cho 1 Giai đoạn (Program/Module/Group, học liệu Curriculum, Journey Version, Nhiệm vụ, Mission có học liệu, học liệu gãy, lỗi Stage Context).
- **Hướng dẫn cài đặt Academy 10 bước**: từng bước tự tính từ dữ liệu thật, có nút bấm thẳng tới đúng chỗ.
- **Resource Data Link Inspector**: chọn 1 học liệu thật (không gõ UUID) → thấy nó nằm ở đâu trong Curriculum, Mission nào đang dùng, hiện ở đâu cho học viên.
- **Stage Context Validator**: đối chiếu Stage học viên thật đang được gán với Stage mà Mission gần nhất của họ thuộc về — lệch thì báo P1.

**Lỗi thật tìm ra khi audit:** trang Roadmap của học viên hiện số Giai đoạn lấy từ `career_stages.position` (đúng), nhưng màn Mission Workspace lại lấy từ `index_label` — một ô chữ admin gõ tay, có thể lệch khỏi `position` thật (chính màn quản trị Giai đoạn đã có sẵn cảnh báo việc này từng xảy ra). Cùng 1 học viên, cùng 1 Giai đoạn, có thể thấy 2 số khác nhau ở 2 màn.

**Sửa 2 lần mới đúng — xin nói thật:** lần đầu tôi đổi Mission Workspace sang dùng thẳng `position`, tưởng đã khớp Roadmap — merge, deploy, health check bình thường. Nhưng khi làm đúng bước bắt buộc "kiểm chứng dữ liệu thật" (tra thẳng dữ liệu Giai đoạn thật trên production) mới phát hiện: 6 Giai đoạn thật đang chạy nằm ở `position = 5..10`, không phải `0..5`, vì 6 Giai đoạn nháp/test cũ đã chiếm số 0-4 trước khi bị lưu trữ — `position` là bộ đếm thô không reset lại. Nếu giữ cách sửa lần 1, Giai đoạn đầu tiên học viên đang học sẽ hiện "06" thay vì "01" đúng ý bạn đặt — vẫn sai, chỉ khác kiểu sai. **Đã tự phát hiện và sửa lại trước khi báo hoàn thành**, không để lỗi lọt ra ngoài: thêm cách tính "thứ hạng trong nhóm Giai đoạn đang hoạt động" thay vì dùng số thô, áp dụng thống nhất ở cả Roadmap/Mission Workspace/Thư viện — đã kiểm tra lại bằng dữ liệu thật, khớp đúng 01→06 với số bạn đã đặt cho cả 6 Giai đoạn.

**Đã làm thêm:** tab "Giao diện học viên" trong Stage Workspace từng cho gõ `key` tự do để dựng menu (chưa từng nối vào menu học viên thật) — đổi thành "Hiển thị & Trải nghiệm", chỉ bật/tắt Hiện/Cho xem thử/Khóa/Nổi bật cho đúng 3 khu vực thật (Thư viện/Hành trình/Smart Home).

Báo cáo đầy đủ: `docs/academy-data-link-v1/FINAL_REPORT.md`.

---

**2026-08-11 — 🧩 Đã merge + deploy: Journey Admin Builder V5 (folder 33) — sửa lỗi mất tiến độ khi publish đè version, thêm Xóa bản nháp + Nhân bản nhiều giai đoạn — ⚠️ ĐÃ CHẠY MIGRATION 0054.**

Đọc đủ 12/12 file gói nguồn trước khi làm. Audit ra 1 rủi ro thật đang tồn tại: `duplicateVersion()` tạo Mission mới với UUID hoàn toàn khác mỗi lần nhân bản — nếu Admin publish version mới đè lên version đang publish, tiến độ học viên thật (xác nhận 2 người: Max Crypto, Thùy H2O Makeup, đang có tiến độ thật trên v1) sẽ "biến mất" khỏi giao diện của họ (dữ liệu không mất, chỉ không còn khớp version mới).

**Đã sửa bằng "nhận diện xuyên suốt version" (`root_mission_id`, migration 0054):** Mission được tạo mới thì tự trỏ về chính nó; Mission được nhân bản thì kế thừa đúng gốc từ Mission nguồn. Khi Publish, hệ thống giờ tự dò Mission tương đương ở version mới theo nhận diện này và chuyển tiến độ học viên sang đúng chỗ trước khi đổi phiên bản đang áp dụng — Mission bị bỏ ở version mới thì tiến độ cũ giữ nguyên làm lịch sử, không bị xóa.

**Đã làm thêm:** "Nhân bản sang nhiều giai đoạn" (1 version tạo bản nháp mới cho nhiều giai đoạn cùng lúc, không đụng bản đang publish, không copy tiến độ/bằng chứng học viên), "Xóa bản nháp" (chỉ xóa được bản nháp, chặn nếu đang có học viên tham chiếu), dịch lại toàn bộ giao diện đúng từ điển tiếng Việt, tách Mission Inspector thành 5 tab (Tổng quan/Học liệu/Việc cần làm/Không gian làm việc/Mở khóa & đánh giá), thêm "Xem như học viên".

**⚠️ Phát hiện quan trọng — đã báo cáo sai lúc đầu, xin đính chính:** lúc kiểm chứng, thấy 3 bản nháp cũ (v2/v3/v4) trên Stage "Nền tảng nghề Makeup" chưa publish. Tôi báo nhầm với bạn là "3 bản giống hệt v1, không có gì" — **sai**, vì tôi chỉ so số lượng Mission chứ chưa so nội dung. Kiểm lại đúng thì cả 3 đều mang chỉnh sửa thật từ folder 32 (mở khóa song song 4 Outcome, đã điền đủ Thời lượng dự kiến + Tiêu chí đạt). Bạn đã chọn đúng khi bấm "tự kiểm tra trước" thay vì đồng ý xóa theo đề xuất sai của tôi — không có gì bị mất. Vì 3 bản này được nhân bản TRƯỚC khi có `root_mission_id`, khi bạn sẵn sàng publy chọn 1 trong 3 bản, hãy bấm "Nhân bản phiên bản này" trên nó trước để tạo bản nháp mới mang đúng nhận diện, rồi publish bản mới đó — đảm bảo tiến độ 2 học viên thật không bị ảnh hưởng.

Báo cáo đầy đủ: `docs/journey-admin-v5/FINAL_REPORT.md`.

---

**2026-08-11 — 🔧 Đã merge + deploy: SỬA LỖI PHẠM VI — Learning Control Center đặt đúng chỗ (tab LEARN), KHÔNG cần migration.**

Bạn chỉ ra tab LEARN chưa đổi thiết kế — **bạn đúng, và tôi đã làm nhầm chỗ.** Yêu cầu gốc nói "Admin LEARN không được đóng vai học viên"; tôi hiểu nhầm thành khu Academy Control Center, trong khi thực tế là **tab "Learn" trong sidebar chính** — chính màn hình bạn chụp, hiển thị bạn (Chủ workspace) như một học viên với "55% Mastery", "Ôn ngay 3 thẻ", "Ngày duy trì nhịp học".

**Kiểm tra kỹ 7 trang trong tab đó, phát hiện:** tất cả đều là **dữ liệu demo giả**, và **cả 7 bảng dữ liệu thật của chúng đều rỗng** (flashcard 0, lớp học 0, bài tập 0, quiz 0...). Trong khi dữ liệu đào tạo THẬT của bạn rất lớn và nằm chỗ khác: **102 tài liệu, 13 giai đoạn, 28 Mission, 4 học viên có tiến độ thật**.

**Đã sửa:** tab LEARN giờ là **Learning Control Center** — hiện số liệu đào tạo thật của tổ chức (không còn tiến độ cá nhân bịa), và 7 module trỏ đúng nơi quản trị thật. Hai module chưa tồn tại (Smart Review, Quiz & Assessment) ghi rõ "chưa có trang quản trị" thay vì trỏ bừa. Không xóa trang cũ nào — chỉ đổi cách vào. Nhãn nhóm sidebar giữ "Learn" ngắn gọn theo yêu cầu của bạn cho đẹp giao diện.

**Đã kiểm chứng số liệu bằng dữ liệu thật:** 6/13 giai đoạn đang publish, 102 tài liệu, 42 Mission đã cấu hình, 4 học viên hoạt động (2 người đã có tiến độ thật — đã xác minh không phải dữ liệu test còn sót).

---

**2026-08-11 — 🛒 Đã merge + deploy: Growth Recommendations + Learning Control Center — nốt 2 việc còn hoãn của folder 32, KHÔNG cần migration.**

**Growth Recommendations** (thay "Khóa học bổ trợ"): đã audit hệ thống bán hàng thật trước khi xây. Phát hiện: **chưa có học viên nào từng mua hàng thành công** trong hệ thống (5 đơn hàng thật đều đang "chờ thanh toán") — nên mục "Đã sở hữu" hiện chưa có gì, đúng thực tế, không bịa. Có 9 sản phẩm thật (6 khóa học, 3 gói membership) với giá thật — dùng trực tiếp, không dùng giá giả. Ngay khi có đơn hàng đầu tiên được đánh dấu đã thanh toán, mục "Đã sở hữu" sẽ tự có nội dung — không cần sửa code.

**Learning Control Center** (Admin LEARN): tìm ra 2 trang quản trị **đã tồn tại thật** (Classes & Cohorts, Assignment & Review — nằm dưới `/instructor/*`) nhưng chưa có link vào từ Academy Control Center — đã nối vào sidebar, không xây trùng. 2 module còn lại (Smart Review, Quiz & Assessment) xác nhận **chưa có trang quản trị nào trong toàn bộ app** — hiện thẻ "Chưa có trang quản trị" trung thực trên Tổng quan đào tạo thay vì trỏ vào chỗ không liên quan.

---

**2026-08-11 — ✅ Migration 0053 đã chạy — đã kiểm chứng Contextual Resource Reader bằng dữ liệu thật.**

Đã test trực tiếp: lưu bookmark + tiến độ đọc + ghi chú trên 1 tài liệu thật, và cố tình thử ghi 1 ghi chú "không gắn với gì cả" để xác nhận hệ thống từ chối đúng (không cho note mồ côi). Cả 2 đều đúng như thiết kế. Đã dọn sạch dữ liệu test — không còn dấu vết nào trong production.

---

**2026-08-11 — 🎯 Đã merge + deploy: Learn Outcome OS V4 (folder 32) — sửa xong 4/6 quyết định, 2 quyết định còn lại cần bạn quyết trước — ⚠️ CẦN CHẠY MIGRATION 0053.**

Đọc đủ 20/20 file gói nguồn trước khi làm (rút kinh nghiệm từ folder 30).

**Phát hiện 2 lỗi thật khi audit (không phải do gói nguồn yêu cầu — do dữ liệu thật sai):**
1. **Chuỗi mở khóa chạy tuần tự xuyên suốt cả 4 Outcome** của Stage 1 đang chạy thật — Outcome 2 bị khóa cho tới khi học viên xong sạch Outcome 1. Đã sửa trên bản nháp v2 (Mission đầu mỗi Outcome giờ mở song song đúng thiết kế), **chưa publish** — quyết định của bạn.
2. **Toàn bộ 14 Mission đang publish thiếu Success Criteria.** Preflight giờ chặn (blocker) việc này cho lần publish tiếp theo — bản đang chạy không bị ảnh hưởng.

**Đã làm thêm:**
- Bấm Mission ở bất kỳ đâu giờ mở thẳng màn làm bài (trước đó phải qua khung xem nhanh trước).
- Khung "bối cảnh hành trình" bên trái màn làm bài giờ chỉ hiện 3 Mission gần nhất trong CHÍNH Outcome đó, không còn liệt kê hết cả giai đoạn.
- Đọc tài liệu từ trong Mission ra giờ **nhớ đường về** — nút "Quay lại Mission: [tên]" thay vì luôn về Thư viện, có thêm lưu bookmark/ghi chú/tiến độ đọc.
- Sidebar bên trái giờ sáng đúng mục khi bạn đang ở màn Mission hoặc đang đọc tài liệu từ Mission ra (trước đây không mục nào sáng cả).
- Màn Admin Journey Builder có thêm nút chọn "Mission nào phải học trước" (không cần biết mã kỹ thuật), kèm nhãn cảnh báo khi chọn phụ thuộc chéo sang Outcome khác.

**⚠️ Việc cần bạn làm:** chạy `supabase/_RUN-0053-ONLY.sql` (bảng lưu bookmark/tiến độ đọc, mở rộng bảng ghi chú có sẵn — an toàn, không đụng dữ liệu cũ).

**Quyết định cần bạn:**
1. Có publish bản nháp v2 không (mở khóa song song 4 Outcome ngay cho học viên đang học).
2. Growth Recommendations (thay "Khóa học bổ trợ") — cần audit hệ thống bán hàng trước, chưa làm.
3. Admin Learning Control Center — 4/7 mục tiêu chưa có trang cho vai trò Admin (chỉ có cho Giáo viên), cần quyết định xây mới hay chỉ đổi tên.

Báo cáo đầy đủ: `docs/learn-outcome-os-v4/FINAL_REPORT.md`.

---

**2026-08-11 — 🗺️ Đã merge + deploy: Smart Journey Shell V3 (folder 31) — hợp nhất Map/Roadmap/Danh sách/Today thành 1 shell, KHÔNG cần migration.**

Lần này đọc đủ **22/22 file** ngay từ đầu (rút kinh nghiệm từ folder 30). Nâng cấp "Hành trình của tôi":

- Header, thanh 4 chỉ số (Insight/Tiến độ/Sẵn sàng/Dự kiến hoàn thành), nút chuyển "Journey ⇄ Today" và "Map ⇄ Roadmap ⇄ Danh sách", panel AI bên phải — tất cả **giữ nguyên khi đổi tab**, không load lại từ đầu, vì cả 4 chế độ giờ đọc chung đúng 1 bộ dữ liệu.
- Bấm vào 1 Mission ở bất kỳ đâu đều mở **1 khung xem nhanh** (Quick Preview) giống hệt nhau, có nút "Mở Mission Workspace".
- Tab **Today** mới — 1-5 việc thật nên làm hôm nay (không phải AI đoán): bắt đầu mission đang mở, các bước bắt buộc chưa xong, nhắc nộp bằng chứng nếu cần.
- Tab **Danh sách** nâng cấp thành "Mission Control": 6 ô tổng quan + tìm kiếm + lọc trạng thái + lọc theo Outcome + 2 chế độ xem (Theo Outcome / Hàng đợi việc cần làm).
- Tab **Roadmap** giờ nhóm thật theo "Hôm nay → Tiếp theo → Tuần này → Sau đó" thay vì liệt kê phẳng.

**Cam kết không bịa số** (giữ nguyên nguyên tắc từ folder 30): ô "Dự kiến hoàn thành" hiện "—" cho tới khi có AI thật (chưa xây); điểm "Sẵn sàng" toàn hành trình lấy đúng số của Mission đang làm, không phải một con số tự chế riêng.

**Đã kiểm tra dữ liệu thật:** số Mission thật (14), trạng thái thật của học viên, công thức tính điểm sẵn sàng — khớp đúng. Lần này chỉ đọc để đối chiếu, không ghi gì nên không cần dọn dẹp.

---

**2026-08-10 — 🔒 Đã merge + deploy: đối chiếu lại TOÀN BỘ gói nguồn folder 30 — tìm ra và vá 1 lỗ hổng bảo mật thật.**

Bạn hỏi tôi đã kiểm tra đúng với toàn bộ prompt và bộ code chưa. **Thú thật là chưa** — hai đợt trước tôi mới đọc 5/22 file. Đã đọc hết 22 file và đối chiếu lại. Kết quả: kiến trúc không sai chỗ nào, nhưng có **5 lỗi/thiếu sót thật**, đã sửa hết:

1. **🔴 Lỗ hổng bảo mật:** nút "Bắt đầu Mission" bị ẩn với Mission đang khóa, nhưng **API thì không chặn** — người biết kỹ thuật có thể gọi thẳng API để bắt đầu một Mission chưa mở, và tự chọn phiên bản hành trình để ghim vào. Đã bịt: mọi thao tác ghi của học viên giờ đều phải qua một cửa kiểm tra ở máy chủ, tự tra phiên bản đúng và từ chối Mission đang khóa. **Đã kiểm tra dữ liệu thật: chưa từng có ai lợi dụng, không có dữ liệu hỏng cần dọn.**
2. **Admin không đặt được cờ "bắt buộc" cho ô nhập** → khiến điểm "Sẵn sàng" của học viên luôn tính đủ điểm phần nhập liệu, tức là con số gây hiểu nhầm. Đã thêm ô tick "Bắt buộc".
3. **Thiếu nút "Xem như học viên"** trong màn Admin — đã thêm (xem trước bản nháp đúng như học viên sẽ thấy, chế độ chỉ đọc).
4. **Bản đồ bỏ mất tầng "Chặng" (Milestone)** — đã hiện lại đúng cấu trúc Outcome → Chặng → Mission.
5. **Preflight thiếu 4 kiểm tra** trước khi publish — đã bổ sung.

---

**2026-08-10 — 🎨 Đã merge + deploy: dựng lại giao diện Smart Roadmap + Mission Workspace đúng bản thiết kế.**

Bản Release 2 đầu tiên đúng luồng dữ liệu nhưng **giao diện đơn giản hơn hẳn bản thiết kế** bạn đã duyệt. Bạn đối chiếu và chỉ ra — tôi đã dựng lại bám đúng file prototype:

- **Roadmap**: 4 thẻ tổng quan trên cùng · Outcome đánh số 01–04 có đường nối dọc và % tiến độ riêng · thẻ Mission 3 cột có mô tả + thanh tiến độ · panel "H2O Journey AI" bên phải · và **3 view giờ khác nhau thật**: Map (bản đồ), Roadmap (dòng thời gian), Danh sách (bảng có cột Readiness/Thời lượng).
- **Mission Workspace**: cột trái liệt kê toàn bộ Mission anh em (bấm chuyển qua lại được) · ô "Expected Result" cạnh ô Readiness nền đậm · tab đánh số 01–04 · "Kiến thức cần dùng" dạng thẻ tài liệu bấm vào mở thẳng tài liệu thật · Result Card nền gradient · footer dính "Tự động lưu".

**Cam kết không bịa số:** mọi con số đều từ dữ liệu thật. Chỗ nào chưa có dữ liệu thì hiện **"—"** chứ không tự đoán (ví dụ "Dự kiến còn lại" sẽ là "—" cho tới khi Admin đặt thời lượng ước tính cho Mission — hiện bản v1 đang publish chưa có, bản nháp v2 thì đã có).

**Các ô do AI viết trong bản thiết kế thì không giả lập** (AI là Release 4 chưa xây): ô "H2O Mentor Insight" đổi nhãn thật thành "Mission hiện tại", "Predicted Finish" đổi thành "Dự kiến còn lại" tính từ thời lượng thật, "Adaptive Path"/"Smart Signals"/"AI tạo 3 task" hiện đúng thông báo "H2O Mentor tạm thời không khả dụng".

---

**2026-08-10 — 🚀 Đã merge + deploy: Smart Roadmap + Universal Mission OS — Release 2 (folder 30) — học viên đã thấy thay đổi thật, KHÔNG cần migration mới.**

**Release 1 (bên dưới) chỉ là nền dữ liệu + màn Admin. Release 2 là phần học viên nhìn thấy được:**

- Bấm vào 1 Mission trên "Hành trình của tôi" giờ mở ra màn hình mới **Mission Workspace** (`/student/missions/[id]`) — 3 cột: bối cảnh hành trình bên trái, 4 tab ở giữa ("Hiểu nhiệm vụ / Làm việc / Evidence / Kết quả"), khung H2O Mission AI bên phải.
- Tab "Làm việc" hiển thị đúng các block Admin đã cấu hình ở Release 1 — học viên điền, hệ thống tự lưu (autosave) sau 800ms ngừng gõ.
- Tab "Evidence" và luồng nộp bằng chứng **dùng lại nguyên** cơ chế đã có từ trước (không tạo hệ thống nộp bài thứ hai).
- Tab "Kết quả" hiện tóm tắt thật: trạng thái, số việc bắt buộc đã xong, số lần nộp bằng chứng, ngày xác nhận/hoàn thành.
- Thêm chỉ số **"Sẵn sàng" (readiness) tính tự động**, không phải AI đoán — dựa trên: đã điền đủ input bắt buộc chưa (40%), đã làm đủ hành động bắt buộc chưa (40%), đã nộp evidence nếu Mission cần chưa (20%).
- Khung "H2O Mission AI" bên phải hiện đúng "H2O Mentor tạm thời không khả dụng" — AI thật là Release 4, chưa xây, nhưng học viên vẫn học/làm bài bình thường không bị chặn.

**Đã sửa 1 lỗ hổng thật của Release 1 phát hiện khi làm:** màn Admin trước đó cho thêm block kiểu "Chọn 1 / Checklist / Bảng / KPI / Kanban / Máy tính" nhưng **không có chỗ nhập danh sách lựa chọn** — học viên sẽ luôn thấy block đó trống rỗng. Đã thêm ô nhập vào màn Admin.

**Kiểm tra trên dữ liệu thật:** đã test thêm block + lưu giá trị trên 1 Mission thật đang published (Mission "Hoàn thành Career Map"), tuyệt đối không đụng tiến độ thật của học viên — chỉ đọc trạng thái thật để lấy input test, mọi ghi/xóa đều trên dữ liệu tự tạo và đã dọn sạch. Xác nhận công thức "Sẵn sàng" tính đúng bằng tay khớp với số liệu thật.

**Chưa test qua trình duyệt bằng tài khoản học viên thật** (không có mật khẩu để đăng nhập) — mới xác nhận đúng ở tầng dữ liệu + code. Bạn tự đăng nhập thử là chắc chắn nhất.

**Quyết định cần bạn:** Release 3 (Result Card đầy đủ, có thể chia sẻ/export) và Release 4 (H2O Journey AI + Mission AI thật, dự báo ngày hoàn thành) — chưa làm. Báo cáo đầy đủ: `docs/smart-learning/FINAL_SMART_ROADMAP_MISSION_OS_REPORT.md`.

---

**2026-08-10 — 🧩 Đã merge + deploy: Smart Roadmap + Universal Mission OS — Release 1 (folder 30) — ⚠️ CẦN CHẠY MIGRATION 0052.**

**Đây là gói lớn nhất từ trước tới giờ** — chính gói nguồn tự chia làm 4 đợt. Lượt này **chỉ làm Release 1**: nền dữ liệu + màn hình Admin cấu hình nội dung Mission. **Học viên chưa thấy gì thay đổi** — đây là quyết định phạm vi có chủ đích, không phải làm dở dang.

**Đã có thật:** vào `/academy-admin/journey`, chọn 1 Mission (ở version Draft) → phần "Mission Workspace" mới trong Inspector — thêm/xóa/sắp xếp lại 27 loại "block" nội dung (văn bản, checklist, KPI, tài liệu, công cụ, bài tập, bằng chứng...) cho phần "Làm việc" của Mission đó. Gắn tài liệu/công cụ/bài tập bằng cách **chọn từ danh sách đã có sẵn của Mission**, không gõ tay mã số.

**Đã sửa 1 lỗi thật phát hiện khi làm:** trước đây bấm "Nhân bản phiên bản" (Clone Version) sẽ copy Outcome/Mission nhưng **làm mất sạch mọi block Admin vừa cấu hình** — đã sửa để clone luôn cả phần này.

**Đã audit kỹ trước khi tạo bảng mới:** repo đã có 1 hệ thống block gần giống (`learning_blocks`, dùng cho Khóa học/Knowledge Space) — kiểm tra kỹ thấy nó thuộc về một hệ thống version hoàn toàn khác (không phải Journey), nên không dùng lại được mà không làm rối cả 2 hệ thống. Giải thích đầy đủ trong `docs/smart-learning/01_PRODUCTION_AUDIT.md`.

**⚠️ Việc cần bạn làm:** chạy `supabase/_RUN-0052-ONLY.sql` (chỉ thêm 2 bảng mới, an toàn).

**Quyết định lớn cần bạn:** có làm tiếp **Release 2** không — đây là màn hình học viên hoàn toàn mới (mở Mission ra làm bài trực tiếp), khối lượng tương đương 1 đợt riêng. Báo cáo đầy đủ: `docs/smart-learning/FINAL_SMART_ROADMAP_MISSION_OS_REPORT.md`.

---

**2026-08-10 — ✨ Đã merge + deploy: Journey Map V2 (folder 29) — nâng UX Admin/Student, KHÔNG cần migration.**

**Không đổi cấu trúc dữ liệu** — chỉ nâng cách hiển thị, vì bảng đã đủ từ Release A/B.

**Admin `/academy-admin/journey` (nhãn mới: "Bản đồ kết quả học viên"):**
- **Hết hiện UUID** — tài liệu gắn vào Mission giờ hiện đúng tên thật ("Business & Skill Check-up Giai đoạn 1" thay vì 1 chuỗi mã).
- **Tìm tài liệu thật** thay vì dán UUID — gõ tên, hệ thống tự tìm trong kho tài liệu đã có.
- **Preflight gọn hơn** — thay vì liệt kê hàng chục dòng lỗi, giờ gộp theo nhóm (Thiếu KPI, Thiếu thời lượng, Tham chiếu gãy...), bấm vào nhóm để lọc đúng mission bị lỗi.

**Đã tạo sẵn phiên bản nháp v2 cho Stage 1** — nhân bản từ v1 đang publish (v1 không hề bị đụng, đã xác nhận), thêm "thời lượng ước tính" + "tiêu chí thành công" thật cho toàn bộ 14 mission (khớp 14/14, không thiếu, không trùng tên). **Chưa publish** — bạn tự vào xem, đồng ý thì bấm Publish.

**Học viên:** mission bị khóa giờ hiện rõ lý do ("Cần hoàn thành: {tên mission trước đó}") thay vì chỉ icon khóa im lặng.

**Không xây được, báo thật:** Tool Picker và Assignment Picker — không có nguồn dữ liệu thật (bảng "tools" không tồn tại, `assignment_definitions` rỗng). Không tạo giả để cho đẹp.

**Phát hiện phụ trong lúc audit:** có 1 dòng tiến độ thật của học viên "Max Crypto" (mission "Xác định hướng nghề Makeup" đã hoàn thành) — có vẻ là bạn hoặc ai đó đã tự bấm thử qua trình duyệt sau lần tôi dọn dữ liệu test. **Không đụng vào** — giữ nguyên.

Báo cáo đầy đủ: `docs/journey-v2/FINAL_JOURNEY_MAP_V2_REPORT.md`.

---

**2026-08-10 — 🚀 Đã merge + deploy: Learn Outcome OS — Release B — vertical slice thật cho Stage 1 ("Nền tảng nghề Makeup") — ⚠️ CẦN CHẠY MIGRATION 0051.**

**Đã có Journey Map thật cho Stage 1** — không phải demo. Vào `/academy-admin/journey`, chọn "Nền tảng nghề Makeup" sẽ thấy: 4 Outcome, 4 Milestone, 14 Mission — tất cả gắn vào tài liệu thật đã có (20/20 gắn kết resolve đúng, không cái nào gãy), đã Publish (Preflight 0 blocker).

**`/student/courses` ("Hành trình của tôi") đã đổi** — không còn là danh sách khóa học, giờ là Journey Map thật: học viên bấm vào Mission → mở Drawer thấy mục tiêu, tài liệu cần học, kế hoạch hành động, nút Start Mission. Khóa học video cũ vẫn còn, chuyển xuống "Khóa học bổ trợ".

**Đã tự kiểm thử trực tiếp trên 1 tài khoản học viên thật** (không qua trình duyệt — mô phỏng đúng logic ghi/đọc, đã dọn sạch dữ liệu test sau khi xong):
- Start Mission tạo action thật ✓, bấm lại không tạo trùng ✓ (nhờ đúng ràng buộc unique của database).
- Mission có điều kiện tiên quyết: khóa đúng, mở đúng khi hoàn thành mission trước ✓.
- % tiến độ Journey tính đúng theo mission đã hoàn thành ✓.

**Phát hiện + tự sửa 1 lỗ hổng bảo mật trước khi deploy:** ban đầu học viên có thể tự khai "loại hoàn thành" khi nộp evidence để tự xác nhận bài Before/After thay vì chờ giáo viên duyệt. Đã sửa: hệ thống tự tra loại hoàn thành thật từ database, không tin dữ liệu học viên gửi lên.

**✅ Cập nhật 2026-08-10 (sau khi bạn chạy migration 0051):** đã test xong nốt 2 phần còn thiếu — Nộp evidence (mission tự xác nhận đúng) và Giáo viên duyệt bài (mission Before/After: nộp evidence → chờ duyệt → giáo viên duyệt → hoàn thành, đúng từng bước, không tự động bỏ qua bước duyệt). Toàn bộ 16 test bắt buộc đã PASS bằng dữ liệu thật, đã dọn sạch mọi dữ liệu test khỏi tài khoản học viên thật dùng để kiểm tra.

**Báo cáo đầy đủ (số liệu thật, quyết định, 16 test):** `docs/learn-outcome-os/RELEASE_B_STAGE1_REPORT.md`.

**Chưa làm, nói thật:** chưa tự vào trình duyệt bấm thử được (tôi không có trình duyệt) — mọi xác nhận ở trên là qua dữ liệu thật, không phải qua giao diện. Bạn nên tự vào `/student/courses` bằng 1 tài khoản học viên để xem trực tiếp.

---

**2026-08-10 — ✨ Đã merge + deploy: Learn Outcome OS V1 — Release A (folder 28, phần bạn chọn "xây đầy đủ") — ⚠️ CẦN CHẠY MIGRATION 0050.**

Bạn chọn xây đầy đủ Outcome Graph. Vì khối lượng quá lớn (10 bảng mới + Admin Builder có versioning + 4 tab học viên viết lại + cron), tôi làm theo đúng lộ trình chia đợt mà chính gói nguồn đề xuất (Release A→E), bắt đầu từ Release A — **chưa cho học viên thấy gì cả, chỉ xây nền + màn hình Admin**.

**Đã xây trong Release A:**
- 10 bảng mới: Journey Blueprint (1 cái/giai đoạn) → Version (nháp/đã publish/lưu trữ) → Outcome → Milestone → Mission → Action, cùng các bảng gắn kết (mission gắn vào tài liệu/công cụ/bài tập **có sẵn**, không copy nội dung).
- Trang Admin mới: **`/academy-admin/journey`** — chọn giai đoạn, tạo Journey Map, thêm Outcome/Milestone/Mission, gắn tài liệu/bài tập vào Mission, chạy "Kiểm tra trước khi publish" (báo đủ loại lỗi: thiếu expected result, mission tham chiếu vòng lặp, gắn nhầm tài liệu không tồn tại...), rồi Publish.
- Nhân bản phiên bản (Duplicate Version) để sửa mà không đụng vào bản đang publish.

**Cố tình CHƯA làm trong đợt này:**
- Học viên **chưa thấy gì thay đổi** — tab "Hành trình của tôi" vẫn y như cũ. Đây là đúng theo kế hoạch (Release B mới đến lượt học viên).
- Chưa có tạo Mission tự động cho học viên, chưa có luồng "Bắt đầu Mission".
- Chưa có tổng kết ngày/tuần (cron) — hệ thống hiện chưa có cơ chế lập lịch nào, cần hạ tầng mới, sẽ bàn riêng khi tới Release D.

**⚠️ Việc cần bạn làm:** chạy `supabase/_RUN-0050-ONLY.sql`. An toàn chạy lại nhiều lần, chỉ thêm bảng mới, không đụng dữ liệu cũ.

Muốn tiếp tục Release B (cho học viên thấy Journey Map thật) thì báo tôi.

---

**2026-08-10 — 🛠 Đã merge + deploy: sửa bug thật nghiêm trọng — bộ giải mã quyền truy cập giai đoạn đang so khớp với ID giả, không khớp được với 6 giai đoạn thật.**

**Bạn yêu cầu sửa bug tab CREATE (mọi học viên thấy đúng 1 trạng thái mở khóa công thức giống hệt nhau) — khi sửa, phát hiện gốc rễ nghiêm trọng hơn nhiều.**

`lib/student/stage-access.ts` (hàm quyết định giai đoạn nào học viên đã mở khóa) từ trước đến giờ so khớp với 5 ID giả tiếng Anh (`foundation/practice/first-client/professional/leader`) — không phải 6 giai đoạn thật (`h2o-stage-01-foundation`...) đã cấu hình. Kết quả: **`stageUnlocked` luôn = false cho MỌI học viên, ở MỌI giai đoạn thật**, bất kể có gói thành viên hay không.

**Chưa gây hại tới giờ chỉ vì mọi tài liệu đang cố ý để `free_preview`** (mở tự do, tách biệt khỏi cơ chế khóa-theo-giai-đoạn) — **nhưng ngay khi bạn khóa nội dung lại (bước tiếp theo bạn đã nói sẽ làm), toàn bộ học viên sẽ bị chặn khỏi nội dung khóa-theo-giai-đoạn, kể cả người có gói thành viên.**

**Đã sửa tận gốc — không chỉ tab CREATE:**
- Bộ giải mã quyền giai đoạn (`stage-access.ts`) giờ đọc đúng 6 giai đoạn thật, giai đoạn thấp nhất luôn miễn phí, gói thành viên mở tất cả.
- Tab CREATE (bug bạn báo) — giờ dùng tín hiệu gói thành viên thật của từng học viên thay vì trạng thái cố định giống nhau cho mọi người.
- `/student/roadmap` và widget "Lộ trình nghề nghiệp" trên Smart Home — giờ hiện đúng tên 6 giai đoạn thật thay vì danh sách giả.

**Đã kiểm chứng trên dữ liệu thật:** giai đoạn miễn phí đúng là "Nền tảng nghề Makeup" (18 tài liệu active) — sẽ đúng được coi là đã mở khóa cho mọi học viên từ giờ.

---

**2026-08-10 — 🔍 Đã merge + deploy: audit folder 28 (Learn Outcome OS) — sửa 2 lỗi thật tìm được, CHƯA xây graph mới — phát hiện thêm 1 bug thật ở tab CREATE, chưa sửa.**

**Phát hiện bất ngờ nhất:** 4 tab LEARN mà gói nguồn "đề xuất nâng cấp" — "Hành trình của tôi" / "Học & ghi nhớ" / "Thư viện của tôi" — **đã đúng y hệt tên trong sidebar đang chạy thật**, không phải trùng hợp. Phần lớn giá trị gói nguồn muốn (bằng chứng năng lực có giáo viên xác nhận, Smart Home có nhiệm vụ hôm nay + lộ trình, H2O Mentor) **đã có sẵn** dưới hình thức thực dụng hơn (`portfolio_ready`, Smart Home hiện tại, Mentor rule-based).

**Đã sửa 2 lỗi thật tìm được khi audit:**
1. **`/student/roadmap` hiện sai giai đoạn** — trang này bấy lâu hiện 5 giai đoạn **giả, hardcode bằng tiếng Anh** (foundation/practice/...), hoàn toàn không khớp 6 giai đoạn thật bạn đã cấu hình (và tôi đã làm giàu nội dung ở module 25/26). Chỉ có trạng thái khóa/mở là thật, còn tên/mô tả/điều kiện đều là giả. Học viên bấm "Xem lộ trình của tôi" từ Smart Home sẽ thấy giai đoạn không tồn tại trong hệ thống. Đã sửa đọc đúng 6 giai đoạn thật.
2. **"Công cụ của tôi" trong sidebar là link chết** — trỏ nhầm sang trang Mentor thay vì công cụ nào. Đã trỏ đúng sang Thư viện thiết kế (vốn đã có thật — học viên tự tạo cover/profile/thiệp/bằng — nhưng trước đó không nằm trong menu, chỉ vào được nếu gõ đúng URL).

**Phát hiện thêm nhưng CHƯA sửa — cần bạn biết:** hệ thống mở khóa "công thức" ở tab CREATE (`lib/student/outcome-access.ts`) hiện đang dùng **cùng mảng giả nói trên** để quyết định ai được dùng công thức nào — nghĩa là **mọi học viên đều thấy đúng một trạng thái mở khóa giống hệt nhau**, không tính theo tiến độ/gói thành viên thật của từng người. Đây là lỗi thật, riêng biệt, nhưng đụng vào logic mở khóa của tab CREATE (không phải LEARN) — gói nguồn module 28 tự dặn rõ chưa đụng CREATE ở giai đoạn này, nên tôi không tự sửa. Báo bạn biết, nếu muốn sửa hãy nói tôi làm riêng.

**Chưa làm — cần bạn quyết định:** phần lớn của gói nguồn — 10 bảng mới (Outcome/Milestone/Mission/Action/Evidence/Result) + màn hình Admin xây "Hành trình" có versioning (Draft→Preflight→Publish) + cron chạy tổng kết ngày/tuần (hệ thống hiện **chưa có cơ chế lập lịch nào cả**, cần hạ tầng mới). Đây là công việc nhiều tuần, đổi mô hình sư phạm — không tự làm nếu bạn không chọn.

Báo cáo đầy đủ: `docs/learn-outcome-os/01_CURRENT_LEARN_AUDIT.md`.

---

**2026-08-09 — 🔍 Đã merge + deploy: audit folder 27 (Ingestion Fabric V3) — chỉ làm phần audit + 1 gap thật tìm được, CHƯA xây kernel lớn — ⚠️ CẦN CHẠY MIGRATION 0049 (chỉ thêm index + đánh dấu, không đổi dữ liệu).**

**Bạn đã dặn:** audit trước, tích hợp sau. Đã làm đúng vậy.

**Kết quả audit** (`docs/ingestion-v3/01-current-ingestion-audit.md`): gói nguồn đề xuất xây 4 bảng mới để "hợp nhất 5 cơ chế nạp nội dung". Kiểm tra thật trên repo + dữ liệu production thì thấy 2 trong 5 cơ chế đó **đã là cùng một hệ thống** (Input Gateway hiện tại), 1 cơ chế ("Universal Ingestion" từ bản 4.5) **đã chết từ lâu — 0 dòng dữ liệu, không route nào gọi tới**. Nếu xây 4 bảng mới như đề xuất sẽ tạo ra một Content Store song song thứ hai — đúng điều `CLAUDE.md` cấm.

**Khoảng trống thật duy nhất tìm được:** hệ thống **chưa từng tính hash nội dung thật** để phát hiện file trùng lặp khi upload — cột `checksum` có sẵn nhưng chỉ là giá trị client gửi lên, không được server xác minh hay dùng để làm gì. Đã xây đúng phần này: server tự tính SHA-256 thật từ file trong kho lưu trữ (không tin dữ liệu client gửi), tra cứu trùng lặp trong cùng tổ chức trước khi tạo asset mới.

**Một việc tôi định làm rồi tự rút lại:** ban đầu định "gắn thêm nhật ký" cho trang Nhập nội dung — sau khi đọc kỹ thấy trang đó tạo sách hoàn toàn ở máy người dùng (cố ý hoạt động offline), gắn thêm việc gọi server chỉ để ghi log sẽ làm hỏng tính chất offline-first của nó. Không làm, đã ghi rõ lý do trong audit thay vì âm thầm bỏ qua.

**⚠️ Việc cần bạn làm:** chạy `supabase/_RUN-0049-ONLY.sql` (chỉ thêm 1 index + đánh dấu "deprecated" trên 4 bảng chết bằng comment, không xóa gì, không đổi dữ liệu nào).

**Phần lớn còn lại (Docling worker đọc PDF/DOCX chuyên sâu + gộp toàn bộ màn hình quản trị nạp nội dung thành 1 trung tâm) — CHƯA làm, cần bạn quyết định trước** vì đây là thêm hạ tầng mới (1 service Docker riêng, có chi phí vận hành) và đụng vào cả luồng tạo sách lẫn luồng giáo trình cùng lúc — không phải chi tiết kỹ thuật tôi nên tự quyết.

---

**2026-08-09 — 🛡 Đã merge + deploy: audit toàn hệ thống theo chuẩn H2O V2 + sửa toàn bộ lỗi tìm được — ⚠️ CẦN CHẠY 1 FILE SQL: `supabase/_RUN-0047-0048-AUDIT-FIXES.sql`.**

**Kết quả audit:** không có lỗi chặn release. RLS đã được kiểm chứng thật bằng anon key trên production — dữ liệu nhạy cảm (hồ sơ, đơn hàng, quyền truy cập, tài sản, nhật ký) đều **không** đọc được từ bên ngoài. Không có secret nào lộ ra client.

**Đã sửa xong và deploy (không cần bạn làm gì):**
1. **Lỗ hổng nghiêm trọng nhất — thư viện đọc PDF.** `pdfjs-dist` bản cũ có lỗi cho phép **chạy mã JavaScript tùy ý khi mở một file PDF độc hại**. Vì H2OBOOK chủ động nhận PDF người dùng tải lên, đây là rủi ro thật. Đã nâng lên đúng bản vá 6.2.108, chạy lại bộ test bảo vệ import PDF → PASS.
2. **11 lỗ hổng phụ thuộc (9 mức cao) → còn 0.** Nâng Next.js + ghim các thư viện con về bản đã vá.
3. **Bật Dependabot + CodeQL.** Trước đây không có gì theo dõi lỗ hổng nên chúng cứ tích tụ; giờ tự động cảnh báo và quét bảo mật mỗi lần thay đổi code.
4. **Bớt 1 truy vấn thừa** trên trang public, thư viện học viên và trang đọc tài liệu (đang đọc một bảng đã ngừng dùng, luôn trả về rỗng).
5. **Sửa 1 lỗi CI đã hỏng từ trước** — một bước kiểm tra viết sai điều kiện nên **không bao giờ có thể pass**, khiến CI luôn đỏ ở đó.
6. **Sửa 1 lỗi tính dung lượng:** cách tính cũ không trừ file đã xóa, nên học viên xóa file rồi vẫn bị trừ hạn mức lưu trữ.

**⚠️ Việc duy nhất bạn cần làm:** Supabase → SQL Editor → dán toàn bộ file `supabase/_RUN-0047-0048-AUDIT-FIXES.sql` → Run. (Đây là lệnh đổi cấu trúc/quyền, Supabase không cho chạy qua API nên tôi không chạy hộ được.) An toàn chạy lại nhiều lần, không xóa/sửa dữ liệu nào.

File này làm 2 việc:
- **Bịt lỗ đọc giáo trình trả phí:** hiện tại ai cũng có thể đọc tiêu đề + tóm tắt của toàn bộ 102 tài liệu qua API mà không cần đăng nhập. Đang **chưa gây hại** vì bạn đang cố ý để mở hết cho việc rà soát — **nhưng hãy chạy file này TRƯỚC khi bạn khóa nội dung lại**, nếu không thì khóa trên giao diện mà bên ngoài vẫn đọc được.
- **Tăng tốc & tính đúng dung lượng lưu trữ** khi số lượng file lớn dần.

Trong lúc chưa chạy, hệ thống vẫn chạy bình thường và hạn mức lưu trữ vẫn được kiểm soát (code tự dùng cách tính cũ khi chưa thấy hàm mới).

Báo cáo audit đầy đủ: `docs/h2o-audit/H2O_ENGINEERING_AUDIT_V2.md`.

---

**2026-08-09 — ✨ Đã merge + deploy: Curriculum Content V2 (folder 26) — ⚠️ CẦN CHẠY MIGRATION 0046 trước khi bấm "Nâng cấp nội dung".**

**V2 giải quyết gì:** 80 tài liệu module 25 nạp vào chỉ là khung mẫu giống hệt nhau sau mục "Mục tiêu" — tôi đã báo điều này khi nạp giáo trình 6 giai đoạn. V2 thay bằng nội dung thật cho từng tài liệu: mục tiêu, kiến thức cốt lõi, quy trình thực chiến, case ngành Makeup, bài thực hành, bằng chứng cần nộp, KPI, lỗi thường gặp, câu hỏi coaching, ghi chú giảng viên. Mỗi giai đoạn còn có thêm "playbook" (nhịp thực hành hàng tuần, trọng tâm kinh doanh/coach, KPI giai đoạn).

**Việc bạn cần làm:**
1. Vào Supabase → SQL Editor → chạy file `supabase/_RUN-0046-ONLY.sql` (chỉ thêm cột, không đụng dữ liệu cũ).
2. Báo tôi "đã chạy xong 0046" — tôi sẽ tự áp dụng nâng cấp nội dung lên production luôn, không cần bạn bấm nút.
3. Muốn tự bấm cũng được: vào `/academy-admin/stages` → mục "Nâng cấp nội dung V2" → "Chạy thử" để xem trước, rồi "Nâng cấp nội dung". Chạy lại nhiều lần an toàn — tài liệu đã nâng cấp sẽ không bị ghi đè lần nữa (kể cả khi bạn đã sửa tay).

**Đã tiện thể sửa 1 lỗi thật phát hiện trong lúc làm:** tài liệu loại "document" trong giai đoạn trước đây không có tiêu đề riêng trên thẻ tài liệu (hiện UUID thay vì tên) vì bước gắn tài liệu không copy tiêu đề sang. Đã sửa cả nơi tạo mới lẫn 102 tài liệu cũ (tự backfill khi chạy nâng cấp nội dung).

**Chưa làm trong đợt này (báo thật, không giấu):** trang đọc bài học thật cho học viên (student-facing document reader) — hiện chưa có route nào trong app đọc `curriculum_documents` để hiển thị cho học viên, nên dù nội dung đã lưu đúng vào database, học viên bấm vào tài liệu này hôm nay vẫn chưa thấy nội dung hiển thị đúng. Đây là việc cần làm tiếp theo nếu bạn muốn học viên đọc được ngay. Cũng bỏ qua phần "reconcile 5 giai đoạn cũ" trong gói nguồn — vì 5 giai đoạn cũ đã archived từ trước, không còn gì để gộp.

---

**2026-08-09 — 🛠 Đã merge + deploy: fix nút "Nạp vào workspace" không hồi sinh giai đoạn đã xóa — ⚠️ KHÔNG CẦN MIGRATION, chỉ sửa code + đã tự khôi phục dữ liệu thật của bạn.**

**Bạn gặp lỗi gì:** bạn xóa (lưu trữ) hết 6 giai đoạn giáo trình makeup, rồi bấm "Nạp vào workspace" lại — trang báo 0 Giai đoạn, không thêm lại được gì.

**Nguyên nhân thật (đã kiểm tra trực tiếp trên dữ liệu production):** nút "Lưu trữ giai đoạn" không xóa hẳn dữ liệu, chỉ ẩn đi (status chuyển sang `archived`). Bộ nạp giáo trình chỉ kiểm tra "mã giáo trình này đã tồn tại chưa" để tránh tạo trùng — nó thấy 6 giai đoạn đã tồn tại (dù đang bị ẩn) nên coi là xong việc, không có cơ chế "làm hiện lại". Kết quả: dữ liệu vẫn còn nguyên trong hệ thống nhưng vĩnh viễn không hiện ra vì không ai đảo trạng thái nó về active.

**Đã sửa:** bộ nạp giờ kiểm tra thêm trạng thái — nếu thấy mã giáo trình đã có nhưng đang bị lưu trữ, nó tự chuyển lại thành active (hồi sinh) thay vì bỏ qua. Cả nút "Chạy thử" và "Nạp vào workspace" đều hiện rõ số mục được hồi sinh, tách biệt với số mục tạo mới.

**Đã tự khôi phục dữ liệu thật của bạn:** không cần bạn bấm lại nút — tôi đã áp dụng đúng logic hồi sinh này trực tiếp lên production, xác nhận cả 6 giai đoạn và 102 tài liệu đính kèm đã quay lại trạng thái active. Bạn vào lại `/academy-admin/stages` sẽ thấy đủ 6 giai đoạn như trước khi xóa.

---

**2026-08-07 — ✨ Đã merge + deploy: nối AI Gemini vào H2O Brain — ⚠️ KHÔNG CẦN MIGRATION, chỉ cần thêm 1 biến môi trường.**

**Việc bạn cần làm để bật AI:**
1. Lấy khóa tại **https://aistudio.google.com/apikey**
2. Vercel → project `h2obook-app` → **Settings → Environment Variables** → thêm `GEMINI_API_KEY` = khóa của bạn (chọn Production). Nếu muốn đổi model, thêm `GEMINI_MODEL` (mặc định `gemini-2.5-flash`).
3. Redeploy (hoặc báo tôi deploy lại). Vào H2O Brain, dòng trạng thái dưới tiêu đề sẽ đổi từ *"AI chưa cấu hình"* thành *"AI đang bật · gemini · gemini-2.5-flash"*.

**Không cần migration** — cột `source` của bảng đề xuất đã chừa sẵn giá trị `'ai'` từ lượt trước.

- **Thứ tự ưu tiên: luật → tiền lệ → AI.** AI **chỉ được gọi cho tài liệu mà luật và tiền lệ không xử lý được**. Đây là điểm quan trọng nhất về chi phí: thả 30 file mà 25 file đã khớp luật thì chỉ 5 file được gửi lên Gemini. Đưa vào hàng đợi thứ đã có luật xử lý thì **tốn 0 đồng**.
- **Khóa API nằm trong biến môi trường, không nằm trong database** — giống hệt cách repo đang lưu `EMAIL_API_KEY`, `PAYMENT_WEBHOOK_SECRET`. Trình duyệt không bao giờ nhận khóa; API trạng thái chỉ trả về "bật/tắt + tên model".
- **Gọi theo lô, tối đa 25 tài liệu/lần gọi**, các lô chạy tuần tự để không bắn một loạt request song song vào giới hạn tốc độ.
- **AI hỏng thì hàng đợi vẫn chạy.** Hết hạn khóa, mất mạng, quá giới hạn tốc độ, model trả về rác — tất cả đều bị nuốt lặng lẽ, tài liệu vẫn vào hàng đợi với đề xuất từ luật/tiền lệ. AI **không bao giờ là điều kiện bắt buộc**, đúng nguyên tắc số 1 của dự án ("Never make an AI provider a required dependency").
- **🔒 Chống AI bịa đặt — phần tôi làm kỹ nhất:** mọi `stageId`/`nodeId` model trả về đều được **đối chiếu với danh sách thật**; id không tồn tại thì **bỏ hẳn**, không sửa thành id gần giống. Đặc biệt: nếu model chọn đúng giai đoạn nhưng chọn học phần **thuộc giai đoạn khác**, học phần đó bị loại — vì lỗi này trông "hợp lệ" trong API nhưng xếp tài liệu sai nhánh trong cây. Model cũng được dặn rõ "không đủ căn cứ thì để trống, đoán bừa gây hại hơn bỏ trống".
- **Nút "Phân tích lại"** trên từng mục — chạy lại luật/tiền lệ/AI cho riêng mục đó. Dùng sau khi vừa viết luật mới, hoặc khi lần đầu chưa ra kết quả. Đây là cách bạn chủ động kiểm soát chi phí.
- **AI được cho biết những gì:** tên file, tiêu đề, mô tả, **tên thư mục**, **các thẻ**, loại MIME, phân loại con. Prompt nói thẳng với model rằng nó **không đọc được nội dung bên trong file** và không được suy đoán về nội dung — vì `assets` không lưu văn bản trích xuất (đã nêu trong audit module 24).
- Kiểm chứng: typecheck sạch · lint 0 lỗi (51 cảnh báo nền) · **179/179 test — thêm 13 test mới cho riêng phần kiểm chứng phản hồi AI** (id bịa, học phần sai giai đoạn, confidence ngoài khoảng, JSON hỏng, model từ chối trả lời) · test:sql qua · build thành công.

⚠️ **Chưa kiểm chứng bằng khóa thật**: tôi **chưa có khóa Gemini nên chưa gọi thử API thật một lần nào**. Phần logic parse/kiểm chứng đã có 13 test phủ, nhưng đường mạng thật (định dạng request, tên model, mã lỗi) chỉ được xác nhận khi bạn cắm khóa vào. Nếu model `gemini-2.5-flash` không đúng tên ở tài khoản của bạn, đổi biến `GEMINI_MODEL` là xong, không cần sửa code.

⚠️ **Giới hạn còn nguyên**: AI vẫn chỉ nhìn thấy **metadata**, chưa đọc nội dung file. Muốn AI đọc thật cần thêm bước trích xuất văn bản vào `assets` — việc riêng, chưa làm.

---

**2026-08-07 — 🧠 Đã merge + deploy: H2O Brain — hàng đợi duyệt giữa Kho tài sản và Lộ trình (KHÔNG dùng AI) — ⚠️ CẦN CHẠY MIGRATION 0044.**

**Việc bạn cần làm:** Supabase → SQL Editor → chạy `_RUN-0044-ONLY.sql`.

- **Bối cảnh**: module nguồn `v5/24-H2OBOOK_H2O_BRAIN_CURATOR_V1` đề xuất một lớp AI nội bộ cho Admin: AI đọc tài liệu → đề xuất giai đoạn/vị trí → Admin duyệt → ghi vào lộ trình. Audit đầy đủ ở `docs/module-24-brain-curator-audit.md`.
- **Đây là module sạch nhất từ đầu phiên về schema** — 6 bảng đề xuất, **không bảng nào trùng lặp** với hệ đã có, tự cấm đúng các bảng từng bị tạo nhầm, và thiết kế "AI chỉ đề xuất, Admin duyệt mới ghi" là đúng.
- **🔴 Nhưng phần AI không thể chạy như hiện trạng, vì 2 lý do:**
  1. **Gói không có provider AI nào.** `provider-gateway.ts` chỉ có một registry rỗng, không file nào đăng ký provider → hàm gọi AI **luôn ném lỗi**. Gói giao kiến trúc, không giao phần chạy được.
  2. **Không có nội dung cho AI đọc.** Code đòi `asset.extractedText` nhưng **bảng `assets` không có cột đó**. Văn bản trích xuất nằm ở `content_nodes.text_content` gắn với `book_documents` — chỉ có với tài liệu đã qua luồng nhập sách. Nghĩa là AI thực tế chỉ nhìn thấy **tên file + tiêu đề + mô tả**.
- **Vì đây là quyết định liên quan tới khóa API và chi phí của bạn, tôi dừng lại hỏi** — bạn chọn phương án hẹp nhất trong 4: **xây hàng đợi duyệt + luật xác định, chừa sẵn chỗ cắm AI về sau**.

**Đã xây (chạy được ngay, không cần khóa API, không tốn phí gọi):**
- **Màn hình mới `/academy-admin/brain`** với 2 tab: **Hàng đợi** và **Luật phân loại**.
- **Hàng đợi**: chọn tài sản từ kho → hệ thống đề xuất giai đoạn/chương trình/khu vực → bạn xem lại, sửa nếu cần, rồi **Duyệt vào lộ trình** hoặc **Từ chối**. Không có gì tự động ghi vào lộ trình học viên.
- **Đề xuất đến từ 2 nguồn, cả hai đều giải thích được**:
  - **Luật bạn tự viết** (ví dụ: "tên file chứa `makeup` → Giai đoạn 1, khu vực Learn"). Số ưu tiên nhỏ hơn thì thắng khi 2 luật cùng chỉ định một trường.
  - **Tiền lệ đã duyệt** — đây là phần thay thế AI trong bản này: duyệt 3 lần "video trong thư mục X → Giai đoạn 2" thì lần thứ 4 hệ thống tự đề xuất như vậy. **Chính quyết định của bạn trở thành bộ phân loại**, không cần mô hình, không cần khóa API.
  - Mỗi đề xuất ghi rõ lý do và độ tin cậy; luật (95%) luôn xếp trên tiền lệ (tối đa 85%).
- **Khi duyệt, việc ghi đi qua đúng hàm `attachResource` mà Stage Workspace đang dùng** — tài liệu do Brain xếp không khác gì tài liệu xếp tay, cùng ràng buộc chống trùng, cùng cách tính thứ tự. Brain **không có đường ghi riêng** vào `career_stage_resources`.

**Đã cố ý BỎ 2/6 bảng của gói nguồn, nêu rõ lý do:**
- **`brain_provider_settings`** — bảng này lưu **khóa API bên thứ ba mã hóa trong database**. Toàn bộ repo hiện lưu khóa bên thứ ba trong **biến môi trường, không khóa nào nằm trong Postgres** (`lib/email/provider.ts`, `lib/payments/provider.ts`). Chưa có provider AI nào thì bảng cũng chưa có ai đọc.
- **`brain_runs`** — ghi mỗi lần gọi AI kèm chi phí/lỗi. Với luật xác định, việc đánh giá là đồng bộ và không thể hỏng nửa chừng; dòng đề xuất đã ghi luật nào khớp và lúc nào, còn `domain_events` đã là nhật ký kiểm toán. Một bảng mà người ghi duy nhất luôn ghi "thành công" không phải là nhật ký.
- Kiểm chứng: typecheck sạch · lint 0 lỗi (51 cảnh báo nền, không phát sinh mới) · **166/166 test — trong đó 23 test mới thật sự cho logic khớp luật/tiền lệ** (lần đầu trong nhiều lượt có logic thuần để test) · test:sql qua · build thành công.

⚠️ **Chưa kiểm chứng trên production**: chưa chạy migration 0044. ⚠️ **Chưa làm**: **không có AI trong bản này** — cột `source` của bảng đề xuất đã chừa sẵn giá trị `'ai'` nên cắm provider sau không cần migration mới, nhưng muốn AI chạy thật thì vẫn cần (a) viết provider gọi Gemini/OpenAI/Anthropic, (b) giải quyết việc chưa có nội dung tài liệu để đọc. Luật hiện chỉ hỗ trợ 1 điều kiện khi tạo từ giao diện (engine hỗ trợ nhiều điều kiện, giao diện chưa cho nhập nhiều).

---

**2026-08-07 — 🔧 Đã merge + deploy: rà soát tổng thể Admin Panel — sửa 3 lỗi hồi quy + 6 nâng cấp cho việc cấu hình giai đoạn — ⚠️ CẦN CHẠY MIGRATION 0043.**

**Việc bạn cần làm:** Supabase → SQL Editor → chạy `_RUN-0043-ONLY.sql` (sau 0040/0041/0042 đã chạy).

**🔴 3 lỗi do chính tôi gây ra trong 2 lượt tích hợp trước, nay đã sửa** — nói rõ vì đây là lỗi tôi tạo ra chứ không phải của module nguồn:
1. **Không đặt được tài liệu tiên quyết.** Khi chọn luật mở khóa "Sau khi học xong tài liệu khác", ô chọn tài liệu **rỗng hoàn toàn** — tôi quên đưa danh sách tài liệu vào khi viết lại giao diện 3 cột. Nghĩa là luật `after_resource` và `progress_gte` **không dùng được** kể từ lượt trước. Nay đã có đủ danh sách.
2. **Mất ô nhập % tiến độ.** Luật "Khi đạt % tiến độ tài liệu khác" không có chỗ nhập ngưỡng %. Nay đã khôi phục (mặc định 80%).
3. **Mất nút ẩn/hiện và lưu trữ giai đoạn.** Khi làm lại trang danh sách giai đoạn, tôi bỏ mất 2 nút này — chỉ còn cách publish, không có cách tạm ẩn hay lưu trữ một giai đoạn. Nay đã khôi phục cả hai.

**🔴 1 lỗi cấu trúc nghiêm trọng hơn, cũng đã sửa: lưu trữ chương trình làm biến mất toàn bộ nội dung bên trong.** Lưu trữ một chương trình chỉ đánh dấu đúng chương trình đó, còn học phần/nhóm con vẫn "đang hoạt động" nhưng **không còn chỗ nào hiển thị** (cây chỉ vẽ con bên trong cha, mà cha đã bị ẩn) — dữ liệu vẫn nằm trong database nhưng không ai nhìn thấy để khôi phục. Tài liệu bên trong cũng vậy. Nay: lưu trữ một nhánh sẽ lưu trữ cả cây con, và **thả toàn bộ tài liệu bên trong về mục "Chưa phân loại"** để còn tìm lại được.

**6 nâng cấp cho đúng chỗ bạn cần — cấu hình 6 giai đoạn và thêm giai đoạn mới:**
- **Sắp xếp lại thứ tự giai đoạn** (mũi tên lên/xuống trên từng thẻ). Trước đây giai đoạn mới luôn bị đẩy xuống cuối và **không có cách nào đưa lên giữa** — chặn thẳng nhu cầu "tương lai thêm giai đoạn 7, 8, 9". Thứ tự này chính là thứ tự học viên thấy trên lộ trình. Giai đoạn tạo mới giờ mặc định ở trạng thái **nháp**, không hiện ngay cho học viên khi chưa soạn xong.
- **Khu vực học viên (Learn/Create/Business/H2O Coaching) đặt được ở cấp chương trình**, tài liệu bên trong **tự kế thừa**. Trước đây phải đặt tay cho từng tài liệu — một chương trình 20 tài liệu là 20 lần lặp lại cùng một câu trả lời, và nhìn vào cây bên trái không biết nhánh đó thuộc khu vực nào. (Migration 0043.)
- **Đổi tên và sắp xếp chương trình/học phần/nhóm** ngay trong cây (bút chì để sửa tên, mũi tên để đổi thứ tự). Trước chỉ tạo được và lưu trữ, **không sửa được tên** — gõ sai một chữ là phải xóa làm lại.
- **Mục "Chưa phân loại"** trong cây, kèm số lượng. Tài liệu chưa xếp vào chương trình nào trước đây lẫn trong danh sách chung, không có cách lọc riêng. Ở chế độ xem "Toàn bộ giai đoạn", mỗi tài liệu giờ hiện rõ đường dẫn `Chương trình › Học phần › Nhóm`. Inspector có thêm ô **"Thuộc"** để chuyển tài liệu sang chương trình/học phần khác.
- **Đổi nhãn "Module" → "Học phần"** trong Stage Workspace. Trước đây "Module" có 2 nghĩa khác nhau trong cùng khu Admin (học phần trong giai đoạn vs module trong Khóa học video — hai bảng hoàn toàn khác nhau), rất dễ nhầm khi giao việc.
- **Trang Tổng quan đào tạo giờ có nói về giai đoạn.** Trước đây trang chủ Academy chỉ báo số khóa học video, **không hề nhắc tới 6 giai đoạn** — trong khi đó mới là việc admin làm hằng ngày. Nay 2 ô số đầu tiên là "Giai đoạn đã publish" và "Tài liệu trong lộ trình", nút chính dẫn thẳng vào Giai đoạn & lộ trình.

**2 cải thiện độ chính xác của số liệu:**
- **Stage Health giờ kiểm tra tài liệu có thật sự còn tồn tại không** (trước chỉ đếm "có tài liệu hay không"). Tài liệu trỏ tới nội dung đã bị xóa nay bị báo lỗi và **chặn publish**. Mã cũ dạng slug hoặc liên kết ngoài được ghi là "không kiểm chứng được" thay vì báo lỗi oan.
- **Bỏ trừ điểm oan cho "Giao diện học viên".** Vì tính năng này chưa nối vào sidebar thật, không giai đoạn nào có thể đạt 100% ở mục đó — tính vào điểm sẽ khiến **mọi giai đoạn vĩnh viễn tối đa 80/100** và trông như đang có lỗi. Nay mục này hiển thị riêng, không tính vào điểm, và có ghi chú giải thích ngay dưới bảng.
- **Thứ tự tài liệu (`position`) nay tính trong phạm vi học phần** thay vì toàn giai đoạn. Trước đây tài liệu thả vào một học phần trống bắt đầu từ số 40-mấy, sắp đúng chỉ là ăn may; và tài liệu gắn từ Kho nội dung luôn nhận số 0.
- Kiểm chứng: typecheck sạch · lint 0 lỗi (51 cảnh báo nền, không phát sinh mới) · **143/143 test** · test:sql qua · build thành công.

⚠️ **Chưa kiểm chứng trên production**: chưa chạy migration 0043. ⚠️ **Chưa làm** (giữ nguyên như 2 lượt trước): sidebar học viên thật vẫn chưa đọc cấu hình Giao diện học viên · không có "Preview as Student" · tab Bài tập/Analytics vẫn là màn hình giải thích · đồng bộ Kho nội dung vẫn là bấm tay.

---

**2026-08-07 — 🩺 Đã merge + deploy: Stage Workspace V3 — 3-pane, Stage Health, Preflight, Publish — ⚠️ CẦN CHẠY MIGRATION 0042 SAU 0041.**

**Việc bạn cần làm:** Supabase → SQL Editor → chạy theo đúng thứ tự `_RUN-0040-ONLY.sql` → `_RUN-0041-ONLY.sql` → `_RUN-0042-ONLY.sql` (nếu 2 cái đầu đã chạy rồi thì chỉ cần chạy 0042).

- **Bối cảnh**: module nguồn `v5/23-h2obook-stage-workspace-v3` là toàn bộ giao diện + mock data (139 dòng code, không có backend thật) đề xuất nâng "Chương trình/module" + "Tài nguyên" từ dạng bảng phẳng thành layout 3 cột (Structure Explorer → Content Canvas → Inspector), thêm Resource Picker tìm kiếm (bỏ nhập UUID tay), Stage Health, Preflight, publish workflow.
- **Audit trước khi ghép**: gần như toàn bộ 6 cột module nguồn đề xuất thêm vào `career_stage_resources` (`resource_role`, `access_mode`, `unlock_resource_id`, `sort_order`, `featured`, `visible`) **đã có tên khác trên đúng bảng đó** từ các migration trước (`requirement_type`, `access`, `prerequisite_binding_id`, `position`, `is_featured`, `status`). Không thêm cột nào trong số này — dùng lại toàn bộ. Migration 0042 **chỉ thêm 2 cột thật sự mới**: `career_stages.published_at` và `archived_at`.
- **Giao diện 3 cột mới thay cho 2 tab cũ** ("Chương trình/module" + "Tài nguyên" gộp thành 1 tab "Cấu trúc & Nội dung"): Structure Explorer bên trái (cây Program→Module→Group, bấm để lọc), Content Canvas ở giữa (danh sách tài liệu của node đang chọn, có nút sắp xếp lên/xuống bằng `position`), Inspector bên phải (sửa vai trò/quyền xem/luật mở khóa/nav section/hiển thị ngay khi chọn 1 tài liệu — không cần lưu riêng).
- **Resource Picker**: modal tìm theo tên trong Kho nội dung Academy (`content_items`, đã xây hôm qua), gắn thẳng vào node đang chọn — không còn phải gõ UUID/resourceId tay cho sách/ấn phẩm/template/knowledge space/asset (khóa học video vẫn nhập tay qua nút "Gắn thủ công", vì `academy_courses` không nằm trong catalog theo đúng quyết định đã chốt).
- **Stage Health** (mục Tổng quan) và **Preflight** (nút ở đầu trang, chặn Publish nếu có mục "fail") — **tính thật từ dữ liệu thật** lúc đọc (`lib/academy-control/health.ts`), không lưu điểm số riêng nên không bao giờ lệch với dữ liệu: cấu trúc (chương trình có module chưa), độ phủ nội dung (module/nhóm có tài liệu chưa), toàn vẹn tài nguyên, quy tắc mở khóa (luật `after_resource`/`progress_gte`/`date` có đủ điều kiện không), giao diện học viên (đã xuất bản `academy_stage_ui_config` chưa).
- **Publish** — bấm Preflight → nếu không có mục "fail" thì Publish được, set `career_stages.status='active'` + `published_at` (chỉ set lần đầu, publish lại không đổi mốc gốc). Kiểm tra lại phía server (không chỉ disable nút ở client) để tránh bỏ qua preflight bằng cách gọi thẳng API.
- **Stage Portfolio Board** (`/academy-admin/stages`) hiển thị Stage Health + số cảnh báo trên từng thẻ giai đoạn.
- Kiểm chứng: typecheck sạch · lint 0 lỗi (51 cảnh báo nền, không phát sinh mới) · **143/143 test** (không có test mới cho `health.ts` — hàm gọi thẳng Supabase, không tách được thành hàm thuần để unit test dễ dàng; nói rõ để không hiểu nhầm) · test:sql qua · build thành công.

⚠️ **Chưa kiểm chứng trên production**: chưa chạy migration 0042. ⚠️ **Chưa làm**: không có "Preview as Student" (xem trước dạng học viên), không có mô phỏng thiết bị iPhone/iPad, "Bài tập"/"Analytics" vẫn là màn hình giải thích chưa nối dữ liệu thật — y hệt các mục đã nêu "chưa làm" ở lượt tích hợp Academy Control Center V2 hôm qua, chưa thay đổi.

---

**2026-08-07 — 🏛️ Đã merge + deploy: Academy Control Center V2 (Stage Workspace, Kho nội dung, Student Experience Builder nền tảng) — ⚠️ CẦN CHẠY MIGRATION 0041 SAU MIGRATION 0040.**

**Việc bạn cần làm:** Supabase → SQL Editor → chạy `_RUN-0040-ONLY.sql` trước (nếu chưa chạy) → sau đó chạy `_RUN-0041-ONLY.sql`. Migration 0041 tự bỏ qua bước copy dữ liệu cũ nếu 0040 chưa từng chạy, nhưng thứ tự đúng vẫn là 0040 rồi mới 0041.

- **Bối cảnh**: bạn đưa ra một sơ đồ Academy Control Center 6 nhánh khá lớn (Tổng quan, Giai đoạn & Lộ trình theo Stage Workspace riêng, Kho nội dung Academy, Student Experience Builder, Phân quyền & Distribution, Tiến độ & đánh giá) và 3 quyết định phạm vi — bạn chọn cả 3 ở mức đầy đủ nhất: **xây CMS sidebar thật**, **content_items là bảng trung tâm thật có di trú dữ liệu**, **thêm cấp phân cấp thứ 3 (group)**. Toàn bộ phân tích ở `docs/academy-control-center-v2-architecture-plan.md`.
- Sau đó bạn đưa thêm 2 gói mã nguồn: `v5/21-H2OBOOK_ACADEMY_CONTROL_CENTER_V1` (chỉ để audit — **chưa từng tích hợp**, xem Phụ lục A của tài liệu trên) và `v5/22-H2OBOOK_ACADEMY_CONTROL_CENTER_FINAL_V3` (bản có code thật, được viết bám theo đúng tài liệu phân tích ở trên — **đây là gói được tích hợp thật vào lượt này**).
- **`career_stage_programs` (migration 0040, deploy sáng cùng ngày, chưa có dữ liệu admin nào) được thay bằng `academy_stage_nodes`** — một bảng tự tham chiếu duy nhất cho cả Program/Module/Group thay vì 2 bảng tách rời, đúng cấp phân cấp bạn cần. Dữ liệu cũ (nếu có) được migration 0041 tự copy sang; bảng và cột cũ (`career_stage_programs`, `career_stage_resources.program_id`) **không bị xóa**, chỉ ngừng được ứng dụng ghi/đọc.
- **`content_items`** — bảng danh mục nội dung thật, được nạp sẵn (backfill) từ `books`, `publications`, `templates`, `knowledge_spaces`, `assets` ngay trong migration. **Không gồm `academy_courses`** — khóa học video là domain riêng, có luồng bán hàng/tiến độ riêng, gắn vào giai đoạn vẫn theo cách cũ (nhập tay resourceId). Có nút "Đồng bộ lại danh mục" ở màn hình Kho nội dung Academy và trong từng Stage Workspace để nạp các mục tạo sau này (không có đồng bộ tự động theo thời gian thực — xem phần "Chưa làm" bên dưới).
- **`career_stage_resources` có thêm 3 cột thật sự mới**: `node_id` (trỏ vào chương trình/module/nhóm), `surface` (learn/create/business/coaching — mục nav nào), `is_featured`. **Không thêm** `visibility_state`/`unlock_rule` như gói nguồn đề xuất — engine mở khóa thật (`access`/`unlock_mode`/`prerequisite_binding_id`/`required_progress`/`unlock_at`, `lib/content-access/resolver.ts`) đã giải quyết đúng việc đó từ trước; thêm cột song song là đúng lỗi đã bị audit ở module 20 gốc.
- **Đổi nhãn `/academy-admin/programs`** từ "Chương trình đào tạo" → **"Khóa học video"** — route và bảng `academy_courses` giữ nguyên, chỉ tránh nhầm với "Chương trình/module" bên trong một giai đoạn.
- **Màn hình mới**:
  - `/academy-admin/stages` — danh sách giai đoạn dạng thẻ, bấm vào để mở Stage Workspace riêng.
  - `/academy-admin/stages/[stageId]` — workspace 8 tab: Tổng quan, Chương trình/module, Nội dung, Tài nguyên, Bài tập, Mở khóa, Giao diện học viên, Analytics. Tổng quan/Chương trình-module/Nội dung/Tài nguyên/Giao diện học viên có chức năng thật; Bài tập/Mở khóa/Analytics là màn hình giải thích rõ hiện trạng, không có số liệu giả (xem "Chưa làm").
  - `/academy-admin/content` — Kho nội dung Academy độc lập: tìm kiếm, lọc theo loại, đồng bộ lại danh mục.
- **Student Experience Builder — chỉ mới xây phần soạn thảo, CHƯA nối vào sidebar học viên thật.** Admin có thể tạo bản nháp (danh sách mục nav: key/tên/icon/route/hiện-ẩn/khóa), lưu nhiều phiên bản, xuất bản. Bảng `academy_stage_ui_config` lưu đúng những gì admin soạn. **`lib/student/compact-navigation.ts` (sidebar thật học viên đang thấy) không bị đụng tới trong lượt này** — chưa có cờ tính năng, chưa có resolver đọc cấu hình đã publish. Đây là bước nền tảng, không phải tính năng hoàn chỉnh.
- Kiểm chứng: typecheck sạch · lint 0 lỗi (51 cảnh báo nền, không phát sinh mới) · **143/143 test** (không có test mới — logic phân cấp Program/Module/Group được chặn bằng trigger ở database, giống cách migration 0040 đã làm, không phải logic ứng dụng cần unit test) · test:sql qua · build thành công.

⚠️ **Chưa kiểm chứng trên production**: chưa chạy migration 0041 (và cần xác nhận 0040 đã chạy trước đó — nếu bạn chưa từng báo lại kết quả chạy 0040, hãy kiểm tra lại trước).

⚠️ **Chưa làm — nói rõ để không hiểu nhầm là đã xong**:
- **Sidebar học viên thật chưa đọc `academy_stage_ui_config`.** Admin soạn/xuất bản được, nhưng học viên vẫn thấy menu HOME/LEARN/CREATE/BUSINESS cố định như cũ. Nối vào thật là một đợt riêng, cần cờ tính năng và kiểm chứng kỹ trước khi bật — không gộp vào lượt này vì đây là thay đổi ảnh hưởng trực tiếp tới trải nghiệm học viên đang chạy.
- **Không có xem trước theo thiết bị (iPhone/iPad/Desktop)** như gói nguồn mô tả, không có "Preflight" tự động kiểm tra cấu hình lỗi trước khi publish, không có lớp gợi ý AI cho "H2O Coaching". Đây là phần UI nâng cao chưa xây trong lượt này.
- **Đồng bộ danh mục nội dung là thủ công** (nút "Đồng bộ lại danh mục"), không có trigger tự động khi tạo sách/asset/template mới. Tạo xong một cuốn sách mới thì phải bấm đồng bộ mới thấy trong Kho nội dung Academy.
- **Tab Bài tập / Analytics** chỉ là màn hình giải thích, chưa nối vào hệ bài tập hay bảng tiến độ thật.
- **Tab Mở khóa** không có UI riêng — luật mở khóa vẫn sửa trực tiếp trên từng dòng ở tab Tài nguyên như trước giờ, cố ý không dựng thêm màn hình trùng việc.

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
