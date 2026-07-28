# H2OBOOK 2.0.0 – Complete Integrated

## Thay đổi lớn

- Hợp nhất V1 và V2 vào cùng source, store và schema.
- Nâng editor lên multi-select, grid/snap, alignment và permission controls.
- Smart Field có source template để đổi thương hiệu lặp lại mà không mất placeholder.
- Clone tạo ID mới cho book/page/element và lưu source metadata.
- Thêm linked clone registry, update status và conflict resolution demo.
- Thêm class, student, assignment và quiz operations.
- Thêm store, checkout demo, order confirmation, refund status và membership.
- Thêm analytics CSV, admin job monitor và backup/restore.
- Thêm migration V2, `/api/version` và source validator.

## Tương thích V1

- Dự án `.h2obook.json` V2 chứa toàn bộ book và brand.
- Editor vẫn đọc cấu trúc H2OBook V1; các trường V2 đều optional ở editor schema.
- Migration V2 chạy sau migration V1, không thay thế migration nền.
