# Module 0038 — Asset Organization UI · Changelog

Ngày: 2026-08-06 · Nhánh: `feat/module-0038-asset-organization`

## Migration `0038_h2obook_asset_organization.sql`

Cộng thêm, **không tạo bảng mới** — 0037 đã có đủ 4 bảng.

| Bảng | Thêm |
|---|---|
| `asset_folders` | `slug`, `archived_at`; 2 chỉ mục unique một phần; chỉ mục lọc thư mục còn hoạt động |
| `asset_tags` | `slug`, `archived_at`; unique `(organization_id, slug)` |
| `asset_saved_views` | `sort_by`, `sort_direction`, `view_mode`, `visible_columns` |
| `asset_tags`, `asset_tag_links`, `asset_saved_views` | Trigger `capture_domain_event` (0037 mới gắn cho `assets` và `asset_folders`) |

**Sửa lỗi của 0037**: `unique(organization_id, parent_id, name)` không chặn được thư mục gốc trùng tên, vì PostgreSQL coi hai `NULL` là khác nhau. Thay bằng:

```sql
unique (organization_id, parent_id, slug) where parent_id is not null
unique (organization_id, slug)            where parent_id is null
```

Migration có bước backfill `slug` từ `name` (bỏ dấu tiếng Việt) và **thêm hậu tố cho slug trùng** trước khi tạo chỉ mục, để không đổ nếu dữ liệu cũ đã có trùng.

## Mã nguồn

| File | Vai trò |
|---|---|
| `lib/assets/organization-rules.ts` | **Mới** — logic thuần: slug, chống vòng lặp cây, dựng cây, gom cây con, luật phân quyền |
| `lib/assets/organization.ts` | **Mới** — đọc/ghi thư mục, thẻ, gắn thẻ, chuyển thư mục hàng loạt |
| `lib/assets/request.ts` | **Mới** — cổng xác thực dùng chung cho `/api/assets/*`, có cờ `manage` |
| `lib/assets/governance.ts` | Thêm phân trang, sắp xếp, lọc theo thẻ |
| `app/api/assets/folders/route.ts` + `[id]` | **Mới** — liệt kê/tạo/sửa/lưu trữ/khôi phục thư mục |
| `app/api/assets/tags/route.ts` + `[id]` | **Mới** — liệt kê/tạo/sửa/lưu trữ thẻ, gắn-gỡ thẻ hàng loạt |
| `app/api/assets/saved-views/route.ts` + `[id]` | **Mới** — bộ lọc đã lưu, riêng tư và dùng chung |
| `app/api/assets/bulk/route.ts` | **Mới** — chuyển nhiều tài sản sang thư mục |
| `app/api/assets/route.ts` | Thêm phân trang, sắp xếp, lọc theo thẻ, trả `totalMatching` |
| `components/assets/asset-organization-panel.tsx` | **Mới** — thanh bên: chế độ xem, cây thư mục, khu vực thẻ có tìm kiếm |
| `app/assets/page.tsx` | Nối thanh bên, chọn nhiều, thao tác hàng loạt, phân trang, nút lưu chế độ xem |
| `app/globals.css` | Bố cục 2 cột, gộp 1 cột dưới 1024px |

## Quyết định thiết kế đáng ghi

**Lưu trữ thay vì xóa.** Thư mục còn tài sản **bị từ chối xóa hẳn** (409 kèm số lượng). Xóa nó thì hoặc bỏ rơi tài sản, hoặc kéo theo mất tài sản — không cái nào là ý nghĩa của "dọn lại danh sách thư mục". Lưu trữ ẩn thư mục và giữ nguyên tài sản; chúng chuyển sang mục "chưa xếp thư mục".

**Lưu trữ thẻ vẫn giữ liên kết.** Một tấm ảnh không ngừng là ảnh before/after chỉ vì ai đó dọn danh sách thẻ — và khôi phục thẻ phải mang lại đúng số tài sản cũ.

**Chống vòng lặp ở tầng ứng dụng.** A → B → A khiến cây không bao giờ vẽ được. PostgreSQL không diễn đạt được bằng `check` (đây là phép duyệt), nên chặn trước khi ghi — cùng cách đã dùng cho chuỗi bài tập tiên quyết ở module 18.

**Phân quyền không dựa vào việc ẩn nút.** `resolveAssetAccess(request, { manage: true })` kiểm tra vai trò ở **mọi** route ghi. Giao diện có ẩn nút, nhưng đó là tiện lợi, không phải hàng rào.

**Giảng viên không quản trị cấu trúc chung.** Chủ sở hữu, quản trị viên và nhà thiết kế được; giảng viên thì không — đổi tên một thẻ dùng chung sẽ ảnh hưởng mọi màn hình, trong khi phạm vi của giảng viên là lớp và bài nộp của họ.

**Nhãn tiếng Việt dài thì xuống dòng, không cắt.** Một thư mục hiện thành "Ảnh cô dâu mùa c…" là thư mục không ai phân biệt được với thư mục bên cạnh.

**Bộ lọc đã lưu lưu câu truy vấn, không lưu kết quả.** Không có chỗ nào cache danh sách tài sản, nên file tải lên ngày mai tự xuất hiện trong chế độ xem cũ.

## Chưa làm

- Chưa có giao diện đổi tên/di chuyển thư mục bằng kéo-thả (API `PATCH` đã có, thanh bên mới có tạo và chọn).
- Chưa có chế độ hiển thị dạng lưới (`view_mode` đã lưu được, giao diện chỉ có dạng danh sách).
- Chưa có chọn cột hiển thị (`visible_columns` đã lưu được).
- Mục "Theo lộ trình" trong điều hướng cấp hai **chưa làm** — cần quyết định có thêm `'asset'` vào `career_stage_resources.resource_type` hay không, và đó là quyết định về cấu trúc dữ liệu, không tự quyết trong module này.
- Thùng rác (`assets.deleted_at`) chưa có màn hình riêng.
