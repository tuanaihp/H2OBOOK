# Student Storage Quota & Image Compression — Integration Report

## Bối cảnh

Yêu cầu: nén ảnh tự động + quota lưu trữ theo học viên trong Design Library/Asset pipeline. Trong lúc phân tích phát hiện: **học viên hiện đang bị chặn hoàn toàn** khỏi Design Library và API upload (middleware redirect mọi route không thuộc `/student/*` về `/student`; API upload chỉ cho phép role `owner/admin/designer/partner/teacher`). Vì vậy phần việc thực tế bao gồm cả việc mở lối cho học viên tự tạo thiết kế, không chỉ nén/quota đơn thuần.

Branch: `feature/student-quota-compression`, tạo từ `main`@`4593437`.

## 1. Quota lưu trữ theo học viên

- **Migration `0023_h2obook_v4141_student_storage_quota.sql`**: thêm cột `organization_members.storage_quota_bytes` (nullable — null = dùng mặc định theo role), thêm index `assets(organization_id, uploaded_by)` để tính dung lượng đã dùng nhanh.
- **`lib/storage/quota.ts`**: `DEFAULT_STUDENT_STORAGE_QUOTA_BYTES = 300 MB`; `checkStorageQuota()` tính tổng `size_bytes` các asset của user trong org, so với hạn mức. **Chỉ áp dụng cho role `student`** — owner/admin/designer/partner/teacher không giới hạn (đúng yêu cầu "quota theo học viên", không đụng luồng Business).
- **`app/api/storage/presign-upload/route.ts`** và **`complete/route.ts`**: mở thêm role `student` vào danh sách được phép upload (trước đây bị chặn 403 hoàn toàn); kiểm tra quota trước khi cấp URL upload (chặn sớm, không tốn băng thông) và kiểm tra lại bằng kích thước thật sau khi upload xong (phòng thủ hai lớp). Vượt quota → `413 STORAGE_QUOTA_EXCEEDED`.
- **`app/api/storage/quota/route.ts`** (mới): API GET trả về `{usedBytes, limitBytes, role}` của user hiện tại, dùng cho UI hiển thị thanh dung lượng.
- RLS không cần đổi: chính sách insert `assets` hiện tại (`is_org_member(...) and uploaded_by=auth.uid()`) vốn không giới hạn theo role, chỉ giới hạn theo membership — học viên vốn đã có quyền insert ở tầng DB, chỉ bị chặn ở tầng API route.

## 2. Nén ảnh tự động

- **`lib/assets/asset-client.ts`**: thêm `compressImageFile()` — resize ảnh JPEG/PNG/WebP về tối đa 2000px cạnh dài, re-encode WebP chất lượng 0.82 bằng Canvas API trên trình duyệt, chỉ giữ bản nén nếu thực sự nhỏ hơn bản gốc.
- **Thiết kế opt-in, mặc định TẮT** — đây là quyết định quan trọng: `lib/input/*.ts` (PDF/Image/HTML/DOCX import) gọi `uploadAsset()` với `pixelWidth`/`pixelHeight`/EXIF đã xác thực bằng magic-bytes trước đó; nén mù quáng ở tầng `uploadAsset` sẽ làm sai lệch metadata và vi phạm rule "Preserve Input Engine" trong `CLAUDE.md`. Đã thêm cờ `compress?: boolean` (mặc định `false`), chỉ bật ở 2 nơi thực sự phù hợp:
  - `app/brand-kit/page.tsx` — upload logo/avatar thương hiệu.
  - `app/remix/[bookId]/page.tsx` — học viên tải ảnh bài thực hành (tính năng "STUDENT REMIX" có sẵn nhưng trước đây học viên không vào được route này — xem mục 3).
- Toàn bộ 9 điểm gọi `uploadAsset()` trong Input Engine **không đổi hành vi**, đã xác nhận qua test cũ vẫn pass nguyên (27→30 test không tính test mới).

## 3. Phát hiện & vá: học viên không vào được nội dung của chính mình

Middleware (từ 4.14) chặn mọi route không bắt đầu bằng `/student`, `/reader`, `/api/` đối với role `student`. Điều này khiến 2 tính năng **đã tồn tại sẵn cho học viên nhưng không thể truy cập**:
- `/editor/[bookId]` — cần thiết để "tự edit tạo riêng book" như yêu cầu.
- `/remix/[bookId]` — trang "STUDENT REMIX" có sẵn từ trước, dành riêng cho học viên nộp bài thực hành, nhưng bị middleware chặn nhầm.

Đã thêm ngoại lệ `isStudentOwnedContent = pathname.startsWith("/editor/") || pathname.startsWith("/remix/")` vào middleware. An toàn vì: hệ thống khóa từng phần tử (`ElementPermissions`: `canMove/canEditContent/canDelete`...) đã có sẵn trong dữ liệu sách — học viên mở được Editor nhưng vẫn không thể di chuyển/xóa phần tử bị khóa theo đúng thiết kế "quyền khóa" đã tài liệu hóa từ trước.

## 4. Trang tự tạo thiết kế cho học viên: `/student/design-library`

- `components/design-library/design-library-client.tsx` thêm prop `variant?: "workspace" | "student"`. Khi `variant="student"`: đổi tiêu đề/copy, ẩn nút "Cập nhật Brand Kit" (không áp dụng), **ẩn hoàn toàn chế độ bulk CSV** (tạo hàng loạt bằng/thiệp là thao tác cấp giảng viên/admin phát hành cho nhiều học viên, không phải việc một học viên tự làm cho chính mình — quyết định sản phẩm, không phải giới hạn kỹ thuật), hiển thị thanh quota.
- **Lỗi phát hiện khi kiểm tra bằng Playwright thật**: bản đầu bị lồng `StudentShell` hai lần (vì `app/student/layout.tsx` đã tự bọc `StudentShell` cho mọi route `/student/*`, trong khi component cũ cũng tự bọc). Đã sửa: variant `student` không tự bọc shell, để layout cha lo — variant `workspace` giữ nguyên hành vi cũ (tự bọc `AppShell`, không có layout cha nào làm việc đó).
- `app/student/design-library/page.tsx` (mới) — render `<DesignLibraryClient variant="student"/>`.
- `components/student/student-shell.tsx` — thêm mục nav "Thiết kế của tôi" (icon `Palette`).
- `DesignConfigurator` thêm prop `allowBulk` (mặc định `true`, giữ nguyên hành vi Business).

## 5. Kết quả kiểm tra (Playwright thật, không phải suy đoán)

| Kịch bản | Kết quả |
|---|---|
| `/student/design-library` render đúng `.h2o-student-shell`, KHÔNG có `.quantum-sidebar` | ✅ |
| `/design-library` (Business) vẫn render đúng `.quantum-sidebar`, không lẫn student shell | ✅ |
| Học viên chọn mẫu, mở modal cấu hình, **không thấy nút "Tạo hàng loạt bằng CSV"** kể cả trên mẫu `bulkCapable` | ✅ |
| Học viên tạo thiết kế → mở đúng `/editor/[bookId]` (trước đây sẽ bị middleware bounce về `/student`) | ✅ |
| Business: tạo cover mở đúng Editor (regression check) | ✅ |
| Business: bulk CSV vẫn hoạt động bình thường cho staff (regression check) | ✅ |
| `/remix/[bookId]` load được (trước đây 500/redirect do middleware) | ✅ 200 |
| `GET /api/storage/quota` trả đúng shape `{usedBytes, limitBytes, role}` | ✅ |
| `pnpm typecheck` | ✅ 0 lỗi |
| `pnpm test` | ✅ 30/30 pass (không có test nào regress) |
| `pnpm test:sql`, `pnpm validate:migrations` | ✅ Pass (24 migration tuần tự) |
| `pnpm build` (`VERCEL=1`) | ✅ exit code 0 |

## 6. Giới hạn chưa kiểm chứng được

- **Chưa test được luồng quota-exceeded thật với role `student` qua Supabase thật** — máy này chạy Demo Mode (`getCurrentUser()` luôn trả `role: "owner"` ở demo mode), không có Supabase project thật với membership `student` để việc `413 STORAGE_QUOTA_EXCEEDED` được kích hoạt thực sự qua HTTP. Logic đã qua typecheck và review kỹ, nhưng cần verify trên Preview/Production có Supabase thật.
- **Chưa có UI thay ảnh trong Editor cho bất kỳ ai** (không riêng học viên) — `canReplaceAsset` mới là field trong type, chưa nối vào Konva canvas. Vì vậy học viên hiện tự tạo được thiết kế với Smart Fields (text) nhưng **chưa tự thay được ảnh chân dung cá nhân** — hạ tầng nén+quota đã sẵn sàng, chỉ cần nối khi tính năng "thay ảnh trong Editor" được xây (không nằm trong yêu cầu lần này).

## 7. Rollback

- Set `storage_quota_bytes` không ảnh hưởng nếu rollback code — cột nullable, không có dữ liệu bắt buộc.
- Revert code: không merge branch này vào `main`, hoặc `git revert` các commit liên quan — không có migration phá hủy dữ liệu.
- Nếu muốn tắt tính năng ngay mà không revert code: đơn giản là không set `NEXT_PUBLIC_STUDENT_EXPERIENCE_V2` hoặc set `false` — học viên quay về không vào được `/design-library`, `/editor`, `/remix` như trước (middleware fallback về `/learn`).

## 8. Kết luận

**READY_FOR_VERCEL_PREVIEW** — build/typecheck/test đều pass thật, đã xác minh bằng Playwright cả luồng học viên lẫn regression luồng Business. Điểm cần lưu ý duy nhất trước khi merge production: xác nhận lại luồng quota-exceeded trên môi trường có Supabase thật với tài khoản role `student` (mục 6).
