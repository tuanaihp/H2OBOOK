# H2OBOOK Content Access Engine V1 — Báo cáo tích hợp (module 18)

Ngày: 2026-08-05 · Nguồn: `v5/18-h2obook-content-access-engine-v1`

## 1. Kết luận ngắn gọn

Module đề xuất **12 bảng mới** (`ca_*`). Sau khi audit: **từ chối toàn bộ 12 bảng**, **nhận phần lõi thật sự có giá trị** là bộ giải quyết quyền (Access Resolver) và các luật mở khóa nâng cao — chuyển thành **6 cột bổ sung** vào bảng đã có, không thêm bảng nào.

Chính README của module cũng yêu cầu điều này: *"Claude Code cần audit repo trước, giữ các bảng nguồn hiện có."*

## 2. Đối chiếu trùng lặp

| Module 18 đề xuất | Repo đã có sẵn | Quyết định |
|---|---|---|
| `ca_learning_paths` + `ca_path_stages` | **`career_stages`** (migration 0033, dựng hôm nay) | ❌ Trùng hoàn toàn |
| `ca_stage_resource_bindings` | **`career_stage_resources`** (0033) | ❌ Trùng — nhưng lấy các cột luật mở khóa |
| `ca_access_grants` (sổ cấp quyền) | **`entitlements`** (0001) — đã có `status`, `source_type`, `starts_at`, `expires_at`, `reason`, `granted_by` | ❌ Trùng |
| `ca_student_package_subscriptions` | **`memberships`** (0001) — được `mark_order_paid()` ghi thật | ❌ Trùng |
| `ca_access_packages` + 2 bảng con | **`products`** (loại `membership`) + `entitlements` | ❌ Trùng |
| `ca_access_audit_logs` | **`domain_events`** (0007, `capture_domain_event()`) | ❌ Trùng — module 17 đã chốt bỏ bảng audit riêng |
| `ca_resources` (sổ đăng ký tài nguyên) | `books`, `academy_courses`, `academy_course_lessons`, `publications`, `products` | ❌ Là bản sao chiếu của nội dung thật |
| `ca_resource_progress` | `academy_lesson_progress`, `block_progress`, `knowledge_space_progress` | ❌ Trùng |
| `ca_student_enrollments` | `entitlements` + `memberships` + `class_members` | ❌ Trùng |
| `ca_is_org_admin()` | **`has_org_role()`** | ❌ Trùng — xem §3 |
| `ca_set_updated_at()` | Trigger `updated_at` đã có | ❌ Trùng |

## 3. Lỗi bảo mật trong hàm quyền của module — lý do bắt buộc phải bỏ

`ca_is_org_admin()` đọc vai trò từ **JWT** (`app_metadata.role` / `user_metadata.role`) và dự phòng bằng bảng `workspace_members`.

Trong repo này:
- **Vai trò KHÔNG nằm trong JWT.** Nguồn sự thật là bảng `organization_members`, tra qua `has_org_role()`.
- **Bảng `workspace_members` không tồn tại.**
- `user_metadata` là dữ liệu **người dùng tự sửa được** — dùng nó để xét quyền admin là lỗ hổng leo thang đặc quyền.

Ngoài ra hàm còn chấp nhận `v_org = ''` (không có organization trong token) **là hợp lệ**, tức một token thiếu trường đó sẽ qua được cửa cho **mọi** organization.

Nếu chạy nguyên bản migration này, bất kỳ ai tự đặt `role: "admin"` trong metadata của mình sẽ có toàn quyền ghi lên 12 bảng đó. Đây là lý do đủ để từ chối, độc lập với chuyện trùng lặp.

## 4. Phần ĐÃ NHẬN — giá trị thật của module

### 4.1 Access Resolver (giá trị lớn nhất)

Repo hiện có **4 nơi tự quyết định quyền truy cập**, mỗi nơi một luật riêng:

| File | Phạm vi |
|---|---|
| `lib/student/stage-access.ts` | Mở khóa giai đoạn |
| `lib/student/outcome-access.ts` | Công cụ Create |
| `lib/business/access.ts` | Tính năng Business |
| `lib/academy/student-course.ts` | Khóa học |

Module đưa ra một **hàm thuần** với thứ tự ưu tiên rõ ràng, thay cho 4 luật rời rạc:

```
1. Chưa xuất bản        → từ chối
2. Có lệnh CHẶN         → từ chối (thắng mọi thứ, kể cả đã mua)
3. Đã mua               → cho phép
4. Admin cấp tay        → cho phép
5. Gói → tài nguyên     → cho phép
6. Gói → giai đoạn      → cho phép
7. Giai đoạn học        → cho phép
8. Đánh dấu miễn phí    → cho phép
9. Từng có nhưng hết hạn→ "hết hạn"  (khác với "chưa mở khóa")
10. Còn lại             → "khóa", kèm tên giai đoạn kế tiếp
```

Hai điểm đắt giá: **CHẶN thắng mọi thứ** (thu hồi quyền vì lý do bảo mật không bị membership vô hiệu hóa), và **phân biệt "hết hạn" với "chưa mở khóa"** — hai thông điệp hoàn toàn khác nhau đối với người học.

### 4.2 Luật mở khóa nâng cao → 6 cột bổ sung, không thêm bảng

`career_stage_resources` được bổ sung:

| Cột | Ý nghĩa |
|---|---|
| `unlock_mode` | `immediate` · `stage_active` · `after_resource` · `progress_gte` · `date` · `manual` |
| `prerequisite_resource_id` | Phải học xong tài liệu nào trước |
| `required_progress` | Ngưỡng % để mở |
| `unlock_at` | Mở theo mốc thời gian |
| `requirement_type` | `required` · `optional` · `bonus` |
| `display_locations` | Hiện ở đâu: Thư viện · Hành trình · Smart Home |

## 5. Ánh xạ sang bảng thật

| Khái niệm của module | Bảng thật dùng thay |
|---|---|
| `ca_access_grants` effect=grant | `entitlements` status=`active` |
| `ca_access_grants` effect=deny | `entitlements` status=`revoked` — xem §6 |
| `ca_student_package_subscriptions` | `memberships` status=`active` |
| `ca_path_stages` | `career_stages` |
| `ca_stage_resource_bindings` | `career_stage_resources` |
| `ca_resources.visibility='free'` | `career_stage_resources.access='free_preview'` |
| `ca_access_audit_logs` | `domain_events` (trigger tự động) |

## 6. Một quyết định sản phẩm cần nói rõ

Repo không có khái niệm "lệnh chặn" riêng. Tôi ánh xạ `entitlements.status = 'revoked'` thành **lệnh chặn cho đúng tài nguyên đó**, chứ không chỉ là "bỏ qua bản cấp quyền này".

Lý do: nếu quản trị viên thu hồi quyền của một học viên với tài liệu X, ý định là *"học viên này không được xem X"*. Nếu để membership âm thầm mở lại thì việc thu hồi trở nên vô nghĩa. Diễn giải này chặt hơn và đúng với kỳ vọng của người quản trị.

**Nếu bạn muốn hành vi ngược lại** (thu hồi chỉ hủy đúng bản cấp quyền đó, membership vẫn mở được), báo tôi đổi — đây là quyết định kinh doanh, không phải kỹ thuật.

## 7. Chưa làm — nói rõ

- **`after_resource` và `progress_gte`**: resolver hỗ trợ đầy đủ và có test, nhưng nguồn tiến độ hiện chỉ có cho **khóa học** (`academy_lesson_progress`). Với sách chưa có bảng tiến độ đọc, nên hai chế độ này với sách sẽ luôn cho ra "chưa đủ điều kiện". Cần bảng tiến độ đọc mới dùng được đầy đủ.
- **Admin Content Access Center** của module chưa dựng — màn hình `/academy-admin/stages` (0033) đã làm phần thêm/sửa/xóa; các cột luật mới chưa có ô nhập trên giao diện.
- **Chưa gộp 4 nơi quyết định quyền cũ** về resolver. Lần này resolver được dùng cho Thư viện học viên; việc chuyển 3 nơi còn lại là bước sau, có rủi ro hồi quy nên không gộp chung một lượt.
