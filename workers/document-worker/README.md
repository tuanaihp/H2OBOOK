# H2OBOOK BullMQ Document Worker

Worker đọc queue `h2obook-document`, gọi dịch vụ Python tại `DOCUMENT_WORKER_URL`, cập nhật progress và kết quả vào PostgreSQL.

```bash
REDIS_URL=redis://localhost:6379 \
DOCUMENT_WORKER_URL=http://localhost:8080 \
DOCUMENT_WORKER_SECRET=strong-secret \
npm run worker:document
```

Worker sẽ dừng ngay khi thiếu Redis, processor URL hoặc secret; không đánh dấu job hoàn tất giả.
