# Production Setup

## 1. Environment

Sao chép `.env.example` thành `.env.local` và điền biến thật. Không commit `.env.local`.

## 2. Database

Chạy theo thứ tự:

```text
0001_h2obook_core.sql
0002_h2obook_v2_integrated.sql
```

Sau đó tạo ít nhất hai tài khoản test và kiểm thử RLS chéo workspace trước khi nhập dữ liệu thật.

## 3. Storage

- Tạo R2 private bucket.
- Server sinh presigned PUT URL.
- Client upload trực tiếp.
- Worker tạo thumbnail/variant.
- Reader nhận signed GET URL có thời hạn.

## 4. Worker

Document worker cần các job:

```text
pdf.render_pages
docx.extract
ocr.layout
asset.optimize
book.export_pdf
book.generate_thumbnails
```

Mỗi job phải có progress, retry, idempotency key và dead-letter handling.

## 5. Payment

Cài adapter theo interface createCheckout/verifyWebhook/refund/queryTransaction. Chỉ trusted server handler được gọi `mark_order_paid`.

## 6. Deploy

```bash
npm ci
npm run validate
npm run typecheck
npm run build
npm run start
```

CI phải block deploy khi validate, typecheck, unit test hoặc build thất bại.

## V3 production services

### AI Gateway
Configure `AI_GATEWAY_URL` and `AI_GATEWAY_TOKEN`. The gateway must enforce model allowlists, request limits, prompt logging policy and tenant isolation.

### Realtime collaboration
Use Supabase Realtime or a dedicated WebSocket/Yjs service. Persist session presence separately from book content and expire stale presence rows.

### Automation worker
Process `automation_runs` through Redis/BullMQ or an equivalent queue. Every action must be idempotent and webhook targets must be allowlisted.

### White-label domains
Require DNS ownership verification before setting a portal to active. Provision SSL and resolve the portal by hostname at the edge or middleware layer.

### Licensing and royalty
Enforce seat and clone limits server-side. Royalty calculations should be generated from paid order line items and locked after approval.
