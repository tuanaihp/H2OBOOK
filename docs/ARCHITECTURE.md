# H2OBOOK V2 Integrated Architecture

## 1. Nguyên tắc

H2OBOOK V2 không tách khỏi V1. Hai phiên bản dùng chung:

- Editor schema.
- Platform domain store.
- Book and page records.
- Brand resolver.
- Template and clone metadata.
- Reader and training resources.
- Commerce and entitlement model.

## 2. Runtime layers

```text
Next.js UI
  ├─ Workspace / Admin
  ├─ H2OBOOK Studio
  ├─ Reader / Presenter
  ├─ Training
  └─ Commerce
        ↓
Application services
  ├─ Platform Store
  ├─ Editor Store
  ├─ Brand Resolver
  ├─ Clone Engine
  └─ Import / Export adapters
        ↓
Production data layer
  ├─ Supabase Auth
  ├─ PostgreSQL + RLS
  ├─ Cloudflare R2
  ├─ Redis / BullMQ
  └─ Payment provider
```

## 3. Local-first model

`store/app-store.ts` là kho dữ liệu nghiệp vụ thống nhất. `store/editor-store.ts` quản lý trạng thái tương tác nặng của editor. Editor chỉ lưu lại vào platform store khi người dùng bấm lưu hoặc publish.

Local-first giúp chạy demo không phụ thuộc backend, nhưng production phải thay action lưu bằng repository/API adapter.

## 4. Editor persistence contract

- Sách, trang và element là các record độc lập trong PostgreSQL.
- Client gửi patch kèm `baseRevision`.
- Server cập nhật transactionally và tăng `revision`.
- Revision cũ trả HTTP 409, không ghi đè âm thầm.
- Asset binary không lưu trong JSON; chỉ lưu asset ID hoặc storage key.

## 5. Brand and clone contract

- `sourceText` và `sourceQrValue` giữ mẫu Smart Field gốc để đổi Brand Profile nhiều lần.
- Independent Clone tạo ID sách, trang và element mới rồi ngắt liên kết cập nhật.
- Linked Clone lưu `sourceElementId`, source revision, local revision và override metadata.
- Bản cập nhật template được preview trước khi sync.
- Element chưa override có thể cập nhật tự động; element đã override tạo conflict.

## 6. Entitlement contract

Mọi quyền đọc sách, dùng template, clone hoặc membership đều quy đổi thành entitlement:

```text
user + resource_type + resource_id + permission + source + expiry + status
```

Webhook thanh toán không cấp quyền ở frontend. Hàm server xác minh giao dịch, cập nhật order và tạo entitlement trong một transaction.

## 7. Security boundaries

- Frontend hiding không phải authorization.
- RLS bảo vệ tenant boundary.
- Service role chỉ dùng trong trusted server environment.
- File private mở bằng signed URL ngắn hạn.
- Upload kiểm tra MIME thật, kích thước và malware.
- Webhook xác minh chữ ký và chống replay.
- Import DOCX phải sanitize nội dung.
- Audit log cho publish, clone, sync, role và payment.
