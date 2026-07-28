# H2OBOOK V3.5 Production Edition

Bản này hợp nhất V1, V2, V3 và các nâng cấp V3.1–V3.5 trong cùng codebase.

## Production Core

- Supabase Auth, callback, logout và middleware bảo vệ route.
- Role lấy từ `organization_members`, không tin role do frontend hoặc metadata gửi lên.
- Tự tạo workspace riêng cho tài khoản owner mới.
- RLS, tenant isolation, audit log và soft delete.
- Editor cloud save bằng một PostgreSQL RPC transaction.
- Version history tăng sau mỗi lần Cloud Save.
- Workspace snapshot tự đồng bộ cho owner/admin; không lộ dữ liệu tài chính cho role khác.

## File và document processing

- R2 presigned upload/download.
- Kiểm tra MIME, extension, dung lượng, storage scope và object thực tế.
- Quarantine trước khi download.
- File scanner HTTP adapter và dịch vụ ClamAV.
- Redis/BullMQ queue.
- Python processor thực hiện PDF import, DOCX extraction, OCR Việt–Anh, thumbnail và PDF export.

## Commerce

- Checkout production đọc giá từ bảng `products`, không tin số tiền từ client.
- Webhook xác minh HMAC và chống xử lý trùng.
- RPC cấp entitlement trong transaction.
- Khách mua trước khi có tài khoản nhận pending grant theo email.
- Login/callback tự nhận quyền đang chờ.

## Vận hành

- Integrations Center và Readiness API.
- Processing Queue lấy job thật từ PostgreSQL.
- Security Center không dùng session giả.
- Dockerfile web, worker, document processor và Docker Compose production.
- Demo Mode vẫn chạy độc lập khi chưa có tài khoản dịch vụ.
