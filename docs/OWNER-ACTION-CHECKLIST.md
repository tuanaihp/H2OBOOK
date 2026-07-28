# Phần chủ dự án cần trực tiếp xử lý

Code và adapter đã được chuẩn bị. Các mục dưới đây cần tài khoản, secret hoặc quyết định kinh doanh của chủ dự án.

## Hạ tầng bắt buộc

- [ ] Tạo Supabase project; lưu URL, Anon Key và Service Role Key.
- [ ] Chạy năm migration SQL theo thứ tự `0001` → `0005`.
- [ ] Tạo Cloudflare R2 bucket private và API token Object Read & Write.
- [ ] Đặt secret mạnh cho Redis, `DOCUMENT_WORKER_SECRET`, `FILE_SCAN_TOKEN`, `CRON_SECRET`.
- [ ] Chạy `docker compose -f docker-compose.production.yml up --build`.
- [ ] Kiểm tra `/api/readiness` trả về `ready`.

## Dịch vụ kinh doanh

- [ ] Chọn cổng thanh toán; map request/response trong `lib/payments/provider.ts` nếu payload khác generic adapter.
- [ ] Cấu hình URL webhook `/api/payments/webhook/<provider>` và chữ ký HMAC.
- [ ] Chọn email provider; xác minh domain gửi thư.
- [ ] Điền giá, thời hạn, giới hạn học viên và quyền clone thật trong Product/Plan.

## Domain và bảo mật

- [ ] Trỏ domain web, reader và white-label.
- [ ] Bật HTTPS, backup Supabase và bucket lifecycle/versioning.
- [ ] Cấu hình Sentry hoặc OpenTelemetry.
- [ ] Thay toàn bộ secret mẫu trước khi deploy.
- [ ] Không đặt `ALLOW_BASIC_SCAN=true` trong production; dùng ClamAV hoặc scanner được kiểm định.

## Kiểm thử trước khi bán

- [ ] Một sách 100 trang, nhiều ảnh độ phân giải cao.
- [ ] Ba Brand Kit và ba linked clone.
- [ ] 20 tài khoản học viên và ít nhất hai vai trò nhân viên.
- [ ] Mua sách khi chưa đăng ký, sau đó đăng ký đúng email và kiểm tra nhận quyền.
- [ ] Webhook gửi trùng không cấp quyền hai lần.
- [ ] File bị chặn không thể nhận signed download URL.
- [ ] Khôi phục một workspace snapshot và một phiên bản sách.
