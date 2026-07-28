# H2OBOOK Document Processor

Dịch vụ Python tách riêng khỏi Next.js để xử lý PDF fixed-layout, PDF semantic reconstruction, DOCX, OCR có bounding box, thumbnail, PDF export và quét file.

## Chạy Docker

```bash
docker build -t h2obook-document-processor .
docker run --env-file ../../.env.local -p 8080:8080 h2obook-document-processor
```

Đặt `DOCUMENT_WORKER_URL=http://document-processor:8080` và `FILE_SCAN_URL=http://document-processor:8080/scan`.
Quét malware đầy đủ cần `CLAMAV_HOST`; chỉ đặt `ALLOW_BASIC_SCAN=true` trong môi trường thử nghiệm có kiểm soát.
