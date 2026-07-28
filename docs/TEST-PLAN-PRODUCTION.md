# H2OBOOK V3.5 Production Test Plan

## Auth & tenant isolation

1. Tạo hai organization A/B.
2. Thành viên A không đọc hoặc ghi sách của B.
3. Student không gọi được upload/save API của designer.
4. Logout xóa session và redirect về `/login`.

## Editor cloud save

1. Mở sách 100 trang, sửa 10 trang và bấm Lưu.
2. Kiểm tra RPC hoàn tất hoặc rollback toàn bộ.
3. Mở máy khác và tải lại đúng sách từ cloud.
4. Ngắt mạng khi sửa, xác nhận localStorage vẫn giữ dữ liệu.

## Storage

1. Upload JPG/PDF/DOCX hợp lệ.
2. Từ chối file sai MIME, đổi giả phần mở rộng và file quá giới hạn.
3. Signed URL hết hạn đúng thời gian.
4. Tài khoản organization khác không tạo URL cho key của tổ chức này.

## Queue

1. Chạy Redis + worker.
2. Tạo PDF import, OCR và export.
3. Theo dõi queued → processing → completed.
4. Dừng worker, xác nhận retry/backoff và error trong database.

## Payment

1. Sửa giá frontend và xác nhận server vẫn dùng giá trong bảng products.
2. Gửi webhook sai chữ ký và xác nhận bị từ chối.
3. Gửi webhook đúng hai lần và xác nhận chỉ xử lý một lần.
4. Đơn paid tự tạo entitlement đúng tài nguyên và thời hạn.

## Backup & recovery

1. Tạo snapshot cloud.
2. Xóa dữ liệu local.
3. Pull snapshot và xác nhận sách, template, học viên, order được phục hồi.
4. Thử restore backup database trên staging.
