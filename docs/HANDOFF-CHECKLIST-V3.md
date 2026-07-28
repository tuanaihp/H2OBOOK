# H2OBOOK V3 Handoff Checklist

## Source
- [x] V1 + V2 + V3 trong một codebase.
- [x] Version 3.0.0.
- [x] Navigation và dashboard đã tích hợp module V3.
- [x] Backup V3 đọc được backup V2.
- [x] Migration V3 chạy sau V1/V2.

## Trước staging
- [ ] `npm install` thành công.
- [ ] `npm run typecheck` thành công.
- [ ] `npm run build` thành công.
- [ ] Chạy ba migration trên database staging.
- [ ] Test RLS bằng ít nhất hai workspace.
- [ ] Cấu hình R2 bucket staging.
- [ ] Cấu hình AI Gateway staging.
- [ ] Cấu hình payment sandbox.

## Trước production
- [ ] Review security và upload validation.
- [ ] Webhook signature + idempotency.
- [ ] Custom-domain verification và SSL.
- [ ] Automation queue, retry, dead-letter.
- [ ] Backup/restore test.
- [ ] Monitoring, alert và audit retention.
- [ ] Kiểm thử sách 300 trang và nhiều người dùng đồng thời.
