# Asset Governance V1 — Báo cáo audit tích hợp

Ngày: 2026-08-06 · Nguồn: `v5/19-h2obook_asset_governance_v1`

Module tự yêu cầu audit repo trước khi code. Đây là kết quả.

## 1. Kết luận ngắn

Module đề xuất **11 bảng**. Sau audit: **từ chối 7, nhận 4**, và **không tạo bảng tài sản song song**. Toàn bộ metadata quản trị được thêm bằng cột vào bảng `public.assets` đã có.

## 2. Phát hiện chặn đường — bảng tài sản thật tên là `assets`, không phải `media_assets`

Migration của module có dòng:

```sql
create table if not exists public.media_assets ( … );
```

Trong repo này **không có bảng nào tên `media_assets`**. Bảng tài sản thật là **`public.assets`** (migration 0001), và nó là trung tâm của hệ thống:

| Số liệu | Giá trị |
|---|---|
| Khóa ngoại trỏ tới `public.assets(id)` | **22** |
| Số migration chứa các khóa ngoại đó | **10** (0001, 0002, 0003, 0006, 0008, 0011, 0012, 0014, 0017, 0020) |
| API đang đọc | `app/api/assets/route.ts` → `from("assets")` |

`create table if not exists media_assets` sẽ **không báo lỗi** — nó sẽ lặng lẽ tạo một bảng thứ hai, rỗng, trong khi toàn bộ dữ liệu thật và 22 khóa ngoại vẫn nằm ở `assets`. Kết quả: hai nguồn sự thật cho cùng một khái niệm, và trang quản trị mới nhìn vào cái rỗng.

Đây đúng là điều README của module cấm: *"Không tạo bảng `media_assets` song song nếu đã tồn tại."* Nó tồn tại — chỉ là dưới tên khác.

**Xử lý:** giữ `public.assets` làm nguồn sự thật, thêm metadata bằng `alter table … add column if not exists`.

## 3. Đối chiếu 11 bảng đề xuất

| Bảng đề xuất | Repo đã có | Quyết định |
|---|---|---|
| `media_assets` | **`assets`** (0001) + `checksum`, `quarantine_status`, `deleted_at` (0011) | ❌ Từ chối — xem §2 |
| `asset_audit_logs` | **`domain_events`** (0007) + trigger `capture_domain_event()` | ❌ Từ chối — module 17 đã chốt bỏ bảng audit riêng |
| `asset_upload_batches` + `asset_upload_batch_items` | **`input_sessions`**, **`input_session_events`**, **`ingestion_runs`**, **`document_jobs`** | ❌ Từ chối — lô nạp file đã được mô hình hóa ở Input Gateway |
| `asset_versions` | `asset_variants` (0008) là **bản kết xuất** (thumbnail/webp…), không phải phiên bản | ⏸ Hoãn — khái niệm thật nhưng không thuộc vấn đề "phân loại & tìm kiếm" của V1 |
| `asset_stage_links` | **`career_stage_resources`** (0033) đã map giai đoạn → tài nguyên | ❌ Từ chối — xem §4 |
| `asset_resource_links` | Không có "resource registry" riêng; `career_stage_resources` dùng `resource_type` + `resource_id` | ❌ Từ chối — xem §4 |
| `asset_folders` | Không có | ✅ Nhận |
| `asset_tags` | Không có | ✅ Nhận |
| `asset_tag_links` | Không có | ✅ Nhận |
| `asset_saved_views` | Không có | ✅ Nhận |

## 4. Vì sao từ chối `asset_stage_links` và `asset_resource_links`

Module mô tả chuỗi:

```text
media_asset → asset_resource_link → resource registry → stage-resource mapping → entitlement → student library
```

Trong repo, **ba mắt xích giữa đã là một**: `career_stage_resources` (migration 0033) map giai đoạn → tài nguyên bằng `resource_type` + `resource_id`, và Content Access Engine (0034 + `lib/content-access/resolver.ts`) đọc thẳng từ đó. Thêm hai bảng liên kết nữa sẽ tạo **hai đường map giai đoạn song song** — đúng loại phân mảnh mà toàn bộ các module trước đã dọn.

Nếu sau này cần gắn tài sản thô vào giai đoạn, cách đúng là **thêm `'asset'` vào danh sách `resource_type` của `career_stage_resources`**, không phải dựng bảng thứ hai. Lần này không làm, vì vấn đề V1 đang giải là *phân loại và tìm được file trong hàng nghìn file*, không phải cấp quyền.

## 5. Phần đã nhận — hiện trạng `public.assets`

Có sẵn: `organization_id`, `uploaded_by`, `asset_type`, `original_name`, `storage_key` (unique), `mime_type`, `size_bytes`, `width`, `height`, `metadata` jsonb, `status`, `created_at`, `checksum`, `quarantine_status`, `deleted_at`.

Thiếu cho quản trị: tên hiển thị, mô tả, phân loại con, thư mục, người phụ trách, trạng thái phân loại/duyệt/vòng đời, ngôn ngữ, quyền sử dụng.

## 6. Rủi ro migration

- **Thấp.** Toàn bộ là `add column if not exists` có giá trị mặc định, cộng 4 bảng mới không bảng nào đang tồn tại. Không đổi cột cũ, không đụng dữ liệu.
- `assets` chưa có trigger `capture_domain_event` → thêm vào để mọi thay đổi tài sản được ghi nhật ký như các bảng khác, thay cho `asset_audit_logs`.
- Rủi ro thật duy nhất là **chạy nguyên bản migration của module**, vì nó tạo `media_assets` song song. Không dùng file đó.

## 7. Chưa làm

- Trình hướng dẫn tải theo lô, phát hiện trùng, thao tác hàng loạt, 10 mục điều hướng cấp hai và `asset_versions` — thuộc các bản sau.
- Giao diện lần này chỉ nâng cấp phần **phân loại, lọc và tìm kiếm**, đúng phạm vi vấn đề đã nêu.
