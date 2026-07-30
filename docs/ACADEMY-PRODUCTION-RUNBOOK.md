# Academy Production Runbook (V4.16)

Runbook này đưa vòng doanh thu Academy từ Demo Mode sang Production Mode:

`đăng ký → CRM → duyệt → Auth invite → entitlement → học bài → Skill Map → thanh toán/email`

## 1. Điều kiện bắt buộc

- Một Supabase project và ba biến `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Một organization Academy đã có owner. Khai báo chính xác `ACADEMY_ORGANIZATION_ID` (khuyến nghị) hoặc `ACADEMY_ORGANIZATION_SLUG`.
- `NEXT_PUBLIC_APP_URL` là origin HTTPS thật; Supabase Auth Redirect URLs phải cho phép `${NEXT_PUBLIC_APP_URL}/auth/callback`.
- R2 private bucket đã cấu hình theo `.env.example` cho giáo trình/tài nguyên.
- Email provider (`resend` hoặc `webhook`) và payment provider/webhook nếu bật thu tiền online.

Không đưa `SUPABASE_SERVICE_ROLE_KEY`, payment secret, email token hoặc `CRON_SECRET` ra biến `NEXT_PUBLIC_*`.

## 2. Database và catalog

Chạy toàn bộ migration theo thứ tự, kết thúc ở:

```text
supabase/migrations/0024_h2obook_v416_academy_revenue_loop.sql
```

Migration tạo các bảng Academy, RLS, progress trigger, email dedupe log và bổ sung `course` vào loại sản phẩm.

Sau lần đăng nhập đầu tiên của owner/admin, đồng bộ catalog một lần:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/academy/catalog/sync" \
  -H "content-type: application/json" \
  -H "cookie: <admin-session-cookie>" \
  -d '{}'
```

API này idempotent. Form đăng ký/checkout cũng tự đồng bộ đúng sản phẩm khi cần, nên không tạo product trùng.

## 3. Cloudflare Stream

Mỗi bài học lưu provider và playback ID trong `academy_course_lessons`:

```sql
update public.academy_course_lessons
set video_provider='cloudflare_stream', video_playback_id='<STREAM_UID>'
where id='<LESSON_UUID>';
```

Nếu account dùng customer subdomain, điền `NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE`. Player dùng CSP chỉ cho phép frame/media từ Cloudflare Stream. Khi chưa có playback ID, player vẫn giao nội dung/checklist nhưng hiển thị trạng thái “video đang chuẩn bị”, không giả vờ đã có video.

## 4. Email giao dịch

Khuyến nghị:

```dotenv
EMAIL_PROVIDER=resend
EMAIL_API_KEY=...
EMAIL_FROM=H2OBOOK Academy <academy@your-domain.vn>
```

Luồng đã nối:

- xác nhận nhận hồ sơ;
- duyệt hồ sơ/cấp quyền;
- Supabase Auth invite và màn hình đặt mật khẩu;
- biên nhận thanh toán;
- nhắc quay lại học sau 7 ngày;
- nhắc gia hạn membership trước 3 ngày.

Gọi cron hằng ngày với header bí mật:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/academy/email/reminders" \
  -H "authorization: Bearer $CRON_SECRET"
```

`transactional_email_log` chống gửi trùng theo template/dedupe key.

## 5. Payment webhook

Provider phải POST raw JSON về:

```text
/api/payments/webhook/<provider>
```

với chữ ký HMAC SHA-256 trong `x-h2obook-signature` hoặc `x-signature`. Khi nhận trạng thái `paid`, hệ thống:

1. chống xử lý trùng theo provider event ID;
2. tạo/mời Auth user nếu buyer chưa có tài khoản;
3. gọi `mark_order_paid` để cấp entitlement/membership;
4. ghi domain event/analytics;
5. gửi biên nhận.

Manual provider chỉ tạo payload chuyển khoản. Production cần webhook xác nhận thật trước khi cấp quyền.

## 6. Kiểm tra trước khi mở bán

```bash
pnpm validate:migrations
pnpm test:sql
pnpm typecheck
pnpm test
pnpm build
```

Smoke test nghiệp vụ bằng một email test mới:

1. Gửi form tại `/academy/courses/<slug>`.
2. Xác nhận hồ sơ xuất hiện tại `/students`.
3. Admin bấm “Duyệt & cấp tài khoản”.
4. Mở email invite, đặt mật khẩu tại `/auth/accept-invite`.
5. Đăng nhập và mở `/student/courses/<slug>`.
6. Hoàn thành một bài; refresh trang và kiểm tra progress còn nguyên.
7. Kiểm tra Skill Map tại `/student/roadmap`.
8. Thanh toán một order test và gửi webhook `paid`; xác minh entitlement cùng email receipt chỉ xuất hiện một lần.

`/api/readiness` phải trả `ready` ở Production. Nếu thiếu Supabase, R2, Redis, scanner hoặc worker, không coi rollout là hoàn tất dù UI vẫn render.
