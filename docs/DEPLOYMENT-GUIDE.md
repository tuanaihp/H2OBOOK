# Deployment Guide

## 1. Chuẩn bị biến môi trường

```bash
cp .env.example .env.local
```

Điền Supabase, R2 và thay toàn bộ secret mẫu. `NEXT_PUBLIC_APP_MODE` chỉ chuyển sang `production` sau khi migration đã chạy.

## 2. Database

Chạy lần lượt:

```text
0001_h2obook_core.sql
0002_h2obook_v2_integrated.sql
0003_h2obook_v3_integrated.sql
0004_h2obook_production_core.sql
0005_h2obook_security_hardening.sql
```

## 3. Dịch vụ xử lý

```bash
docker compose -f docker-compose.production.yml up --build
```

Các service nội bộ:

- `redis`: queue.
- `clamav`: malware scanner.
- `document-processor`: PDF/DOCX/OCR/export.
- `document-worker`: BullMQ consumer.
- `web`: Next.js app.

## 4. Kiểm tra readiness

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/readiness
```

Trong production, readiness trả HTTP 503 cho tới khi Supabase, R2, Redis và File Scanner được cấu hình.

## 5. Webhook và cron

- Payment webhook: `/api/payments/webhook/<provider>`.
- Automation cron: `POST /api/cron/automation` với `Authorization: Bearer <CRON_SECRET>`.

## 6. Release check

```bash
npm run validate
npm run validate:imports
npm run typecheck
npm run smoke
npm run build
```
