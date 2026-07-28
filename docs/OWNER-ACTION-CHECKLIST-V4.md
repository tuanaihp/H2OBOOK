# Owner Action Checklist – V4

## Bắt buộc trước production

- [ ] Chạy `npm install` trên máy có Internet.
- [ ] Chạy `npm run typecheck`.
- [ ] Chạy `npm run build`.
- [ ] Tạo Supabase và chạy migration 0001–0006.
- [ ] Kiểm tra RLS bằng hai tài khoản workspace khác nhau.
- [ ] Chọn domain và cấu hình HTTPS.
- [ ] Kiểm tra backup/restore thật.

## Tùy chọn theo nhu cầu

- [ ] Cloudflare R2 cho file lớn.
- [ ] Redis/BullMQ cho PDF/OCR nặng.
- [ ] Cổng thanh toán.
- [ ] Email provider.
- [ ] Monitoring.
- [ ] AI Gateway.

AI Gateway không phải yêu cầu bắt buộc.
