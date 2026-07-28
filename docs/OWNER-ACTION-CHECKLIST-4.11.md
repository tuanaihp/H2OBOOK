# Việc chủ dự án cần trực tiếp xử lý

## 1. Source control và build

- Tạo Git repository riêng.
- Chạy `pnpm install` để sinh `pnpm-lock.yaml`.
- Commit lockfile.
- Chạy full CI.
- Chọn staging và production branch.

## 2. Supabase

- Tạo project staging và production riêng.
- Chạy migration `0001` → `0018` theo thứ tự.
- Bật email confirmation.
- Cấu hình redirect URLs.
- Kiểm tra RLS bằng tài khoản các vai trò.
- Bật backup/PITR phù hợp.

## 3. Cloudflare R2

- Tạo bucket staging/production.
- Tạo access key giới hạn đúng bucket.
- Cấu hình CORS.
- Cấu hình lifecycle/quarantine.
- Điền biến môi trường.

## 4. Security secrets

Tạo secret dài, ngẫu nhiên và khác nhau theo môi trường:

- `SUPABASE_SERVICE_ROLE_KEY`
- `FILE_SCAN_TOKEN`
- `DOCUMENT_WORKER_SECRET`
- `CRON_SECRET`
- `ENCRYPTION_KEY`
- `WEBHOOK_ENCRYPTION_KEY`
- `PAYMENT_WEBHOOK_SECRET`
- `COLLABORATION_SIGNING_SECRET`

Các webhook tạo trước migration `0018` phải được xóa/tạo lại để lưu ciphertext mã hóa.

## 5. Payment

- Chọn nhà cung cấp thanh toán Việt Nam hoặc quốc tế.
- Hoàn thiện adapter riêng.
- Cấu hình webhook endpoint.
- Kiểm tra paid, failed, duplicate, refund và replay.
- Kiểm tra tự cấp entitlement.

## 6. Email

- Chọn provider.
- Xác minh domain gửi.
- Tạo template mời học viên, thanh toán, gia hạn và reset password.

## 7. Publishing certification

- Cài Chromium/Ghostscript đúng phiên bản.
- Chuẩn bị ICC profile được cấp phép.
- Chạy EPUBCheck.
- Test SCORM Cloud.
- Test xAPI với LRS.
- Kiểm tra font licensing trước khi embed.

## 8. Enterprise

- Chọn SSO provider trước khi code handshake thật.
- Chọn LTI/LMS mục tiêu nếu cần LTI 1.3.
- Cấu hình webhook allowlist.
- Thử public API key ở staging.

## 9. Pilot

Nên pilot với:

- 1 sách master.
- 3 thương hiệu clone.
- 2 giảng viên.
- 20–50 học viên.
- 1 sản phẩm trả phí.
- 1 chiến dịch Growth Reader.

Ghi nhận lỗi và hành vi thật trước khi mở SaaS đại trà.
