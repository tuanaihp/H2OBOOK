# H2OBOOK Roadmap after V2 Complete

## Đã tích hợp trong source này

- V1 editor/import/reader/Brand Kit.
- V2 books/templates/clones/training/store/orders/membership/analytics/admin.
- Local-first platform store dùng chung.
- Backup/restore V2.
- Migration Supabase V1 + V2.

## Việc còn lại để production hóa

### P0 – bắt buộc trước khách thật

1. Supabase Auth, invitation và session middleware.
2. Repository layer thay Zustand local persistence.
3. API autosave patch + revision conflict.
4. R2 presigned upload, asset variants và signed download.
5. Payment provider thật, webhook và idempotency.
6. Document worker cho PDF/DOCX/OCR.
7. E2E cho auth, editor save, clone, checkout và entitlement.
8. Backup, monitoring, error reporting và rate limit.

### P1 – sau khi có người dùng thật

1. Real-time collaboration bằng Yjs.
2. Template diff chi tiết theo trang/element.
3. Quiz attempt và grading production.
4. Assignment submission file upload.
5. Email automation và certificate.
6. Custom domain và white-label reader.
7. Marketplace revenue sharing.

### P2 – mở rộng

1. EPUB/SCORM.
2. AI chaptering, rewrite và quiz generation.
3. Translation and voice reading.
4. Native mobile shell.
5. Print-on-demand integration.
