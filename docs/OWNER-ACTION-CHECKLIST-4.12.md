# Owner Action Checklist — Editor 4.12

## Bắt buộc trước khi deploy

1. Chạy `corepack enable` và cài pnpm 9.15.5 trên máy có Internet.
2. Chạy `pnpm install` để tạo `pnpm-lock.yaml`, sau đó commit lockfile.
3. Chạy `pnpm validate:editor412`.
4. Chạy `pnpm typecheck`.
5. Chạy `pnpm test`.
6. Chạy `pnpm build`.
7. Chạy Playwright trên Chrome/Edge thật.

## Kiểm thử thủ công Editor

- Mở sách V4.11 cũ và xác nhận không mất trang/layer.
- Mở Compose Mode, sửa heading, list, link và table rồi reload.
- Chọn hai text frame, liên kết và thay đổi nội dung nguồn.
- Resize frame đầu và xác nhận các frame sau tự dàn lại.
- Thêm trang tiếp nối khi badge báo tràn.
- Chạy Preflight và xác nhận lỗi Text Flow được phát hiện.
- Xuất HTML/PDF thử và xác nhận table/link/footnote còn nguyên.
- Kiểm tra giao diện ở 1366×768, 1920×1080 và mobile.
