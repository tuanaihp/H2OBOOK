# Module 0038 — Asset Organization UI · Báo cáo kiểm thử

Ngày: 2026-08-06

## 1. Lệnh đã chạy

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | ✅ Qua, không lỗi |
| `pnpm lint` | ✅ 0 lỗi · 51 cảnh báo (đúng bằng mức nền có sẵn, **không phát sinh mới**) |
| `pnpm test` | ✅ **29 file / 143 test** — qua toàn bộ (18 test mới) |
| `pnpm test:sql` | ✅ Qua cho 19 bảng domain |
| `pnpm build` | ✅ Thành công; 8 route `/api/assets/*` được biên dịch |

## 2. Đối chiếu 8 yêu cầu kiểm thử

| # | Yêu cầu | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | Organization A không đọc folder/tag của B | ⚠️ **Không phủ bằng unit test** — xem §3 | RLS trong 0037 + `resolveAssetAccess` |
| 2 | Instructor không quản trị workspace tag | ✅ Có test | `canManageAssetOrganization` — 3 vai được, 3 vai bị từ chối |
| 3 | Không tạo trùng slug folder/tag | ✅ Có test (phần sinh slug) + chỉ mục DB | `toAssetSlug` gộp tên khác nhau về cùng slug; unique index chặn ở DB |
| 4 | Archive folder không xóa asset | ✅ Có test (gom cây con) + luật API | `collectSubtreeIds`; `DELETE` trả 409 khi còn tài sản |
| 5 | Saved View cập nhật khi có asset mới | ✅ Theo thiết kế + test | Không cache kết quả; test giữ nguyên bộ lọc qua các trang |
| 6 | Bộ lọc saved view hoạt động qua phân trang | ✅ Có test | Bộ lọc trang 1 và trang 2 bằng nhau |
| 7 | Bulk move chỉ tác động asset được chọn | ⚠️ **Không phủ bằng unit test** — xem §3 | Truy vấn `.in("id", assetIds).eq("organization_id", …)` |
| 8 | Build, lint, typecheck, test:sql, test đạt | ✅ | §1 |

## 3. Nói rõ phần KHÔNG được phủ — và vì sao

**Yêu cầu 1 và 7 là hành vi của database, không phải của hàm.**

Cách ly organization được thực thi bởi **RLS trong PostgreSQL** (`is_org_member`, `has_org_role`) cộng với mệnh đề `.eq("organization_id", …)` ở mọi truy vấn. Muốn kiểm chứng thật thì phải chạy hai organization thật trên một database thật rồi xác nhận A không đọc được của B.

Bộ test hiện tại của repo là **vitest chạy hoàn toàn trong bộ nhớ, không có database**. Viết một test dùng mock Supabase sẽ chỉ chứng minh rằng **mock của tôi trả về đúng thứ tôi đã lập trình cho nó** — nó sẽ có màu xanh kể cả khi RLS bị tắt hoàn toàn. Đó là loại test tệ hơn không có test, vì nó tạo cảm giác an toàn sai.

**Cách kiểm chứng đúng cho 2 mục này** (chưa làm, cần database thật):
1. Tạo 2 organization, mỗi bên 1 thư mục và 1 thẻ.
2. Đăng nhập bằng tài khoản của A, gọi `GET /api/assets/folders?organizationId=<B>` → phải trả **403**.
3. Truy vấn trực tiếp bằng khóa `anon` của A trên `asset_folders` của B → phải trả **0 dòng**.
4. Gọi `POST /api/assets/bulk` với `assetIds` gồm 1 id của A và 1 id của B → phản hồi phải báo `moved: 1`, `requested: 2`.

Điểm 4 là lý do API trả về **số dòng database thực sự đổi** chứ không phải số id được gửi: nếu hai con số lệch nhau, người gọi biết ngay có id bị từ chối, thay vì được báo là mọi thứ đều ổn.

## 4. 18 test mới

| Nhóm | Số test | Nội dung |
|---|---|---|
| Slug | 2 | Giữ tên tiếng Việt đọc được; gộp tên chỉ khác dấu câu |
| Vòng lặp thư mục | 4 | Tự làm cha mình; chuyển vào con cháu; trường hợp hợp lệ; **dừng được khi dữ liệu đã có vòng lặp sẵn** |
| Cây con | 1 | Gom đúng thư mục + toàn bộ con cháu |
| Dựng cây | 2 | Lồng và sắp xếp theo vị trí rồi tên; **thư mục mồ côi nổi lên gốc thay vì biến mất** |
| Phân quyền | 2 | 3 vai được / 3 vai bị từ chối |
| Sở hữu bộ lọc đã lưu | 3 | View riêng của mình; **không sửa được view riêng của người khác dù là chủ sở hữu**; view chung theo vai trò |
| Phân trang | 4 | Vòng lặp filter+page+sort; giữ bộ lọc khi đổi trang; **chặn cột sắp xếp lạ và số trang âm** |

## 5. Chưa kiểm chứng trên production

**Không có mục nào được kiểm chứng trên production**, vì:

> Yêu cầu ghi rõ: *"Không deploy nếu migration 0037 chưa được xác nhận đã chạy thành công."* — và chưa có xác nhận đó.

Ngoài ra: mã của 0037 **đã deploy ở lượt trước**, và `GET /api/assets` đang `select` các cột do 0037 thêm. Nếu 0037 chưa chạy, lệnh select đó lỗi và trang `/assets` không tải được danh sách. Cần xác nhận điều này trước.
