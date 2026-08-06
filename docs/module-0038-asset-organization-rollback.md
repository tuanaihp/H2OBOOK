# Module 0038 — Asset Organization UI · Hướng dẫn quay lui

Ngày: 2026-08-06

## 1. Quay lui mã nguồn

Toàn bộ nằm trong một commit hợp nhất. Quay lui bằng:

```bash
git revert -m 1 <hash-cua-commit-merge>
```

Sau khi revert, `/assets` trở lại đúng trạng thái của module 0037: có lọc server-side và phân loại từng tài sản, không có thanh bên tổ chức.

**Mã nguồn có thể quay lui độc lập với database.** Nếu revert mã mà vẫn giữ migration 0038, hệ thống chạy bình thường — các cột thừa chỉ nằm im.

## 2. Quay lui database

⚠️ **Thứ tự bắt buộc: revert mã nguồn TRƯỚC, rồi mới chạy SQL bên dưới.** Nếu bỏ cột trong khi mã mới còn chạy, mọi lệnh đọc thư mục và thẻ sẽ lỗi.

```sql
begin;

-- Trigger nhật ký thêm ở 0038
drop trigger if exists asset_tags_domain_event on public.asset_tags;
drop trigger if exists asset_tag_links_domain_event on public.asset_tag_links;
drop trigger if exists asset_saved_views_domain_event on public.asset_saved_views;

-- Chỉ mục thêm ở 0038
drop index if exists public.asset_folders_child_slug_idx;
drop index if exists public.asset_folders_root_slug_idx;
drop index if exists public.asset_folders_active_idx;
drop index if exists public.asset_tags_slug_idx;

-- Cột thêm ở 0038
alter table public.asset_saved_views
  drop column if exists sort_by,
  drop column if exists sort_direction,
  drop column if exists view_mode,
  drop column if exists visible_columns;

alter table public.asset_tags
  drop column if exists slug,
  drop column if exists archived_at;

alter table public.asset_folders
  drop column if exists slug,
  drop column if exists archived_at;

commit;
```

## 3. ⚠️ Điều KHÔNG nên khôi phục

Bản quay lui **cố ý không khôi phục** ràng buộc cũ:

```sql
unique(organization_id, parent_id, name)   -- KHÔNG khôi phục
```

Đây chính là lỗi mà 0038 sửa: PostgreSQL coi hai `NULL` là khác nhau, nên ràng buộc đó **không chặn được hai thư mục gốc trùng tên** — đúng nơi thư mục được tạo nhiều nhất. Khôi phục nó là mang lỗi trở lại.

Nếu vẫn cần một ràng buộc sau khi quay lui, dùng bản không dính vấn đề NULL:

```sql
create unique index asset_folders_root_name_idx
  on public.asset_folders(organization_id, name) where parent_id is null;
create unique index asset_folders_child_name_idx
  on public.asset_folders(organization_id, parent_id, name) where parent_id is not null;
```

## 4. Mất gì khi quay lui database

| Dữ liệu | Số phận |
|---|---|
| Thư mục, thẻ, gắn thẻ, bộ lọc đã lưu | **Giữ nguyên** — bảng do 0037 tạo, 0038 không xóa bảng nào |
| Slug thư mục và thẻ | Mất (sinh lại được từ tên) |
| Trạng thái lưu trữ thư mục/thẻ | Mất — thư mục đã lưu trữ sẽ **hiện lại** |
| Cấu hình sắp xếp/hiển thị của bộ lọc đã lưu | Mất; điều kiện lọc trong `filters` **vẫn còn** |
| Tài sản | **Không đụng tới** — 0038 không sửa bảng `assets` |

## 5. Quay lui một phần

Nếu chỉ muốn bỏ giao diện mà giữ dữ liệu, không cần chạy SQL nào: revert mã nguồn là đủ. Mọi thư mục, thẻ và bộ lọc đã lưu vẫn nằm nguyên trong database, chờ lần bật lại.

## 6. Không liên quan tới 0037

Bản quay lui này **không đụng tới migration 0037**. 15 cột quản trị trên `assets`, 4 bảng tổ chức và các trigger của 0037 vẫn giữ nguyên. Muốn quay lui 0037 thì xem phần rollback ghi ở cuối chính file `0037_h2obook_asset_governance_v1.sql`, và phải chạy **sau** bản này.
