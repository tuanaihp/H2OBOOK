# Tích hợp module vào H2OBOOK 4.14

## Copy các thư mục

Copy nguyên các đường dẫn sau vào repository H2OBOOK:

- app/design-library
- components/design-library
- lib/design-library
- types/design-library.ts
- public/design-library
- tests/unit/design-library.test.ts
- scripts/validate-design-library-module.mjs

## Thêm menu

Làm theo `integration/sidebar-entry.txt`.

## Thêm script package.json

```json
"validate:design-library": "node scripts/validate-design-library-module.mjs"
```

## Chạy kiểm tra

```bash
pnpm validate:design-library
pnpm typecheck
pnpm test
pnpm build
```

## Route

```text
/design-library
```

## Dữ liệu

Module chạy ngay bằng catalog local và Zustand store hiện tại. Không cần migration để xem giao diện. File SQL trong `optional/supabase` chỉ là đề xuất cho giai đoạn cloud persistence.

## Lưu ý

- Không copy đè toàn bộ app.
- Không sửa Editor Engine.
- Không thay package dependencies; module chỉ dùng thư viện đã có.
- Sau khi tạo thiết kế, module gọi `upsertBook()` và mở `/editor/[bookId]`.
