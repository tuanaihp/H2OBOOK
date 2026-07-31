# HƯỚNG DẪN LƯU TRỮ HỆ THỐNG H2OBOOK

> Tài liệu này giải thích: mỗi loại dữ liệu (nội dung sách, ảnh, video, CRM, khóa học, tài liệu chỉnh sửa) đang lưu ở đâu, cần tài khoản/dịch vụ gì để đưa vào vận hành thật, và cách kết nối. Viết cho người không rành kỹ thuật — chỉ cần đọc bảng và làm theo từng bước.
>
> Cập nhật lần cuối: 2026-07-31. Nếu code thay đổi nhiều, nhờ Claude Code đọc lại repo và cập nhật file này.

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

**Việc cần làm sau này:** nối 2 hệ thống này lại (khi có người nộp form đăng ký công khai, tự động tạo 1 lead trong CRM nội bộ) — hiện chưa làm, vì đây là quyết định nghiệp vụ (2 luồng có thể cố ý tách biệt: 1 cho khách lẻ tự đăng ký, 1 cho đội sale chủ động tìm khách).

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

1. **Tạo project Supabase thật** → điền mục 3.1 → chạy toàn bộ migration trong `supabase/migrations/` theo đúng thứ tự file (0001 → mới nhất) → chuyển `NEXT_PUBLIC_APP_MODE=production`.
2. **Tạo bucket R2** → điền mục 3.2 → bật "Public Access"/domain riêng cho ảnh hiển thị được.
3. **Đăng nhập lần đầu bằng tài khoản chủ (owner)** → hệ thống tự tạo `organization` đầu tiên → lấy `ACADEMY_ORGANIZATION_ID` điền vào env.
4. **Đồng bộ catalog khóa học lần đầu** (gọi 1 API đồng bộ 1 lần sau khi có Supabase — đã có sẵn trong `docs/ACADEMY-PRODUCTION-RUNBOOK.md`).
5. Nếu có video: **tạo tài khoản Cloudflare Stream**, upload video, dán playback ID vào từng bài học.
6. Nếu bán hàng online: **đăng ký cổng thanh toán** + **Resend email** → điền mục 3.4.
7. **Test toàn bộ luồng thật** với 1 email test: đăng ký → admin duyệt → nhận mail mời → đặt mật khẩu → vào học → xem tiến độ lưu đúng không.

*(Chi tiết kỹ thuật đầy đủ hơn cho bước 1 và 4 xem thêm `docs/ACADEMY-PRODUCTION-RUNBOOK.md` đã có sẵn trong repo.)*

---

## 6. Những điều CHƯA làm — biết trước để không bất ngờ

- 2 hệ thống CRM (mục 2.4) chưa nối nhau — cần quyết định nghiệp vụ trước khi nối.
- Vai trò nhân sự riêng (sale/support/kế toán/content manager) chưa có tài khoản thật — hiện chỉ có owner/admin/teacher/student.
- Chưa test với dữ liệu/tài khoản Supabase thật trong phiên làm việc này — toàn bộ vẫn đang ở Demo Mode tại thời điểm viết tài liệu này.
- Redis/Document Worker chưa được cấu hình — nếu bật Production Mode mà không cấu hình Redis, riêng tính năng nhập DOCX/PDF phức tạp sẽ báo lỗi (các phần khác không ảnh hưởng).
