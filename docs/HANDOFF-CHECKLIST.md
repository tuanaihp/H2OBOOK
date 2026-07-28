# H2OBOOK V2 Production Handoff Checklist

## Source

- [x] V1 và V2 nằm trong một codebase.
- [x] Có source validator.
- [x] Không hardcode secret thật.
- [x] Có migration V1 và V2.
- [ ] Chạy `npm install`, `npm run typecheck`, `npm run build` trên CI có mạng.

## Auth và tenant isolation

- [ ] Bật Supabase Auth và email confirmation.
- [ ] Tạo middleware bảo vệ route.
- [ ] Test hai workspace không đọc được dữ liệu của nhau.
- [ ] Test từng role owner/admin/designer/partner/teacher/student.

## Editor và assets

- [ ] Thay localStorage bằng API patch theo revision.
- [ ] R2 private bucket và presigned upload.
- [ ] Kiểm tra MIME, dung lượng, checksum và malware.
- [ ] Tạo thumbnail/WebP/AVIF bằng worker.
- [ ] Test sách 10, 100 và 300 trang.

## Import/export

- [ ] PDF/DOCX lớn chạy queue worker.
- [ ] Retry theo bước và checkpoint.
- [ ] Sanitize HTML từ DOCX.
- [ ] Export PDF production với font được cấp phép.

## Commerce

- [ ] Payment adapter thật.
- [ ] Webhook signature + idempotency.
- [ ] Order paid và entitlement trong transaction.
- [ ] Membership renewal, expiry và refund.

## Reader/training

- [ ] Signed URL có thời hạn.
- [ ] Device/session policy.
- [ ] Assignment submission storage.
- [ ] Quiz attempt, scoring và certificate.

## Operations

- [ ] Sentry/OpenTelemetry.
- [ ] Structured logs.
- [ ] Rate limit.
- [ ] Daily backup và restore drill.
- [ ] E2E desktop/iPhone/Android.
- [ ] Kiểm tra bản quyền font, ảnh và nội dung.
