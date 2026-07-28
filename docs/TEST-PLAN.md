# H2OBOOK V2 Test Plan

## Smoke flow

1. Tạo sách mới.
2. Thêm trang và element.
3. Kéo, resize, multi-select và căn chỉnh.
4. Lưu, reload và mở lại.
5. Import ảnh, DOCX và PDF.
6. Tạo Brand Profile và áp dụng.
7. Tạo template và linked clone.
8. Publish sách và mở Reader.
9. Tạo lớp, học viên, bài tập và quiz.
10. Tạo sản phẩm, checkout, xác nhận order.
11. Xuất analytics CSV.
12. Backup, reset và restore.

## Data scale

- 300 trang/sách.
- 100 element/trang.
- 2.000 học viên/workspace.
- 10.000 analytics events/ngày.
- PDF 200 MB qua worker.

## Security

- Cross-workspace read/write.
- Role escalation.
- Signed URL expiry.
- Webhook replay.
- Malicious DOCX/HTML.
- Oversized upload and zip bomb.

## V3 test scenarios

### AI Studio
- Run all seven assist modes with and without a selected book.
- Verify local output and AI Gateway fallback behavior.
- Verify no secret is exposed to the browser.

### Review workflow
- Create review, toggle checklist, add comment, request changes and approve.
- Confirm approval notification is created.
- Confirm comments can be resolved without deleting history.

### Collaboration
- Open session list and validate active/idle users.
- Verify unresolved comments link back to the correct book.
- Test page-lock behavior after realtime adapter is connected.

### Automation
- Create a rule with multiple actions.
- Pause/resume and run manually.
- Verify run count and activity log update.
- Test retry/idempotency in production worker.

### Licensing and royalty
- Create one-time, subscription and revenue-share agreements.
- Enforce clone/seat limits at API level.
- Move payout pending → approved → paid.

### White-label
- Create portal, toggle theme/status, open `/portal/[slug]`.
- Verify custom domain ownership before activation in production.
- Validate portal only exposes assigned publications.

### Content Health
- Scan books with missing description, long text and missing images.
- Confirm report replacement per book and score range 0–100.
