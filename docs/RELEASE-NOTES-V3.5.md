# H2OBOOK 3.5 – Unified Production Suite

## Nâng cấp chính

- Hợp nhất V1–V3 và V3.1–V3.5 vào một repository.
- Auth và workspace bootstrap thật.
- Cloud save transaction và version history.
- Tự đồng bộ dữ liệu vận hành owner/admin.
- R2 direct upload, object verification, quarantine và signed download có kiểm tra quyền.
- Document processor Docker: PDF, DOCX, OCR, thumbnail, PDF export.
- Redis/BullMQ worker không còn mô phỏng hoàn tất.
- Checkout lấy giá server-side, webhook idempotency và pending access theo email.
- Security Center và Admin đọc trạng thái runtime thật.
- Docker deployment và readiness gate.

## Khả năng tương thích

- Giữ khóa localStorage `h2obook-platform-v2` để không mất dữ liệu V2/V3.
- Migration database mở rộng tuần tự, không tạo dự án tách riêng.
- Demo Mode vẫn hoạt động khi chưa cấu hình cloud.
