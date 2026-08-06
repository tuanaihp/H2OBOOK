# Module 0038 — Asset Organization UI · Báo cáo audit

Ngày: 2026-08-06 · Tiền đề: module 0037 (Asset Governance V1)

## 1. Kết luận ngắn

Schema 0037 **chưa đủ** cho yêu cầu 0038. Thiếu 5 thứ, trong đó **1 là lỗi thật của 0037** cần sửa. Tất cả đều là **cột và chỉ mục bổ sung — không thêm bảng nào**, đúng ràng buộc "không tạo bảng mới nếu 0037 đã đủ".

## 2. Hiện trạng 0037

| Bảng | Cột đã có |
|---|---|
| `asset_folders` | `id`, `organization_id`, `parent_id`, `name`, `description`, `position`, `created_by`, `created_at`, `updated_at`, unique(org, parent_id, name) |
| `asset_tags` | `id`, `organization_id`, `name`, `color`, `created_at`, unique(org, name) |
| `asset_tag_links` | `asset_id`, `tag_id`, `organization_id`, `created_at`, PK(asset_id, tag_id) |
| `asset_saved_views` | `id`, `organization_id`, `name`, `filters` jsonb, `is_shared`, `created_by`, `created_at`, `updated_at`, unique(org, name) |
| `assets` | +15 cột quản trị, có `folder_id` |

## 3. Khoảng trống

| # | Yêu cầu 0038 | 0037 có | Xử lý |
|---|---|---|---|
| 1 | **Archive thư mục** (không xóa cứng khi còn tài sản) | Không có cột trạng thái | ➕ `archived_at` |
| 2 | **Archive thẻ** | Không có | ➕ `archived_at` |
| 3 | **Không trùng slug thẻ trong cùng organization** | Chỉ unique theo `name` | ➕ `slug` + unique |
| 4 | Saved view lưu **sort, kiểu hiển thị, danh sách cột** | Chỉ có `filters` | ➕ 4 cột riêng |
| 5 | **🔴 Lỗi trong 0037** | `unique(organization_id, parent_id, name)` | ➕ 2 chỉ mục riêng — xem §4 |

## 4. 🔴 Lỗi thật trong module 0037 — ràng buộc chống trùng thư mục không có tác dụng ở gốc

0037 viết:

```sql
unique(organization_id, parent_id, name)
```

PostgreSQL coi **hai giá trị `NULL` là khác nhau** trong ràng buộc unique. Thư mục gốc có `parent_id = NULL`. Nghĩa là:

> Tạo hai thư mục gốc **cùng tên** trong cùng một organization sẽ **thành công** — ràng buộc không chặn được gì ở cấp gốc, đúng nơi người dùng tạo thư mục nhiều nhất.

Chỉ thư mục con mới thực sự được bảo vệ. Đây là lỗi tôi tạo ra ở 0037, không phải của module gốc.

**Cách sửa:** thay bằng hai chỉ mục unique một phần dựa trên `slug`:

```sql
unique (organization_id, parent_id, slug) where parent_id is not null
unique (organization_id, slug)            where parent_id is null
```

Chỉ mục thứ hai không có `parent_id` trong khóa nên không dính vấn đề NULL.

## 5. Những thứ KHÔNG cần thêm

| Yêu cầu | Đã có sẵn |
|---|---|
| Thư mục cha/con | `parent_id` (0037) |
| Đổi vị trí thư mục | `position` (0037) |
| Màu thẻ | `color` (0037) |
| Gắn nhiều thẻ cho một tài sản | `asset_tag_links` khóa chính kép (0037) |
| Chuyển tài sản sang thư mục khác | `assets.folder_id` (0037) |
| Private view vs workspace view | `is_shared` + policy (0037) |
| Nhật ký ghi mọi thay đổi | `domain_events` + `capture_domain_event()` — 0037 đã gắn cho `assets` và `asset_folders`; **cần gắn thêm** cho `asset_tags`, `asset_tag_links`, `asset_saved_views` |
| Soft delete tài sản | `assets.deleted_at` (0011) |
| Cách ly organization | `is_org_member` / `has_org_role` + RLS (0037) |

## 6. Chống vòng lặp thư mục cha/con

`parent_id` cho phép A → B → A. Vòng như vậy khiến cây không bao giờ vẽ được và truy vấn đệ quy chạy vô hạn. PostgreSQL không diễn đạt được ràng buộc này bằng `check` (đây là phép duyệt, không phải điều kiện đơn), nên chặn ở tầng ứng dụng — **cùng cách đã dùng cho `prerequisite_binding_id` ở module 18**.

## 7. Rủi ro migration

- **Thấp.** Toàn bộ là `add column if not exists` + `create index if not exists`. Có bước backfill `slug` từ `name` cho dữ liệu cũ trước khi tạo chỉ mục unique.
- **Rủi ro thật:** nếu trong database đã tồn tại hai thư mục gốc trùng tên (do lỗi §4), chỉ mục unique mới sẽ **không tạo được**. Migration xử lý bằng cách thêm hậu tố vào slug trùng trước khi tạo chỉ mục, thay vì để migration đổ.

## 8. Route và API hiện tại

| Thành phần | Hiện trạng | 0038 làm gì |
|---|---|---|
| `app/assets/page.tsx` | AppShell + upload + lọc server-side + phân loại từng tài sản | Giữ nguyên, thêm điều hướng cấp hai, cây thư mục, khu vực thẻ, nút lưu chế độ xem |
| `GET /api/assets` | Lọc server-side, trả kèm `folders` + `counts` | Bổ sung phân trang, sắp xếp, lọc theo thẻ |
| `PATCH /api/assets/[id]/classify` | Cập nhật phân loại một tài sản | Giữ nguyên |
| Chưa có | — | Thêm API thư mục, thẻ, gắn thẻ, bộ lọc đã lưu, chuyển thư mục hàng loạt |

## 9. ⚠️ Điều kiện chặn deploy

Yêu cầu ghi rõ: *"Không deploy nếu migration 0037 chưa được xác nhận đã chạy thành công."*

**Chưa có xác nhận đó.** Ngoài ra có một hệ quả cần nói rõ: mã của 0037 **đã được deploy ở lượt trước**, và `GET /api/assets` hiện đang `select` các cột do 0037 thêm vào. Nếu 0037 **chưa chạy**, lệnh select đó sẽ lỗi và trang `/assets` sẽ không tải được danh sách.

→ Cần bạn mở `/assets` và xác nhận danh sách tài sản hiển thị bình thường, hoặc chạy `supabase/_RUN-0037-ONLY.sql`, trước khi deploy 0038.
