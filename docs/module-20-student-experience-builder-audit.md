# Module 20 — Student Experience Builder Final V2 · Báo cáo audit

Ngày: 2026-08-06 · Nguồn: `v5/20-h2obook-student-experience-builder-final-v2`

## 1. Kết luận ngắn

Module đề xuất **12 bảng** (8 ở migration 0038, 4 ở migration 0039) cộng ~1.500 dòng domain/resolver/UI, dựng thành một **hệ CMS quản lý sidebar học viên hoàn chỉnh** với versioning, draft/publish/rollback, luật hiển thị theo stage/program/membership/role/nhóm, override từng học viên, và luồng xin mở khóa.

Sau audit: **phần lớn trùng lặp trực tiếp với 3 hệ thống đã dựng và deploy trong chính phiên làm việc này** (`career_stages`/`career_stage_resources` — 0033/0036, bộ giải quyết quyền `lib/content-access/resolver.ts` — 0034, và sidebar học viên thật `lib/student/compact-navigation.ts`). Đây không phải fix bug — đây là **quyết định phạm vi sản phẩm lớn**, nên tôi dừng lại xin ý kiến bạn thay vì tự quyết và đổ 1.500 dòng vào production.

## 2. Đối chiếu trùng lặp — bằng chứng cụ thể

| Module 20 đề xuất | Đã có sẵn, đã deploy | Ghi chú |
|---|---|---|
| `student_stage_workspaces` (stage_key **text tự do**) | `career_stages` (id uuid, có FK thật) | **Đây là hồi quy**: `stage_key` không tham chiếu `career_stages.id` — dựng một khái niệm "giai đoạn" song song, không liên kết được với hệ đã có |
| `student_navigation_resource_links` + `student_stage_content_placements` | `career_stage_resources` (resource_type/resource_id/access/position) | Cùng một việc: gắn tài nguyên vào giai đoạn |
| `unlock_rule` jsonb + `access_state` enum (unlocked/locked/scheduled/approval_required) | `career_stage_resources.unlock_mode` (immediate/stage_active/**after_resource**/**progress_gte**/**date**/manual) — 0036 | Resolver của module 20 (`evaluateUnlockRule`) kiểm tra **đúng những điều kiện y hệt**: tiến độ giai đoạn, năng lực, entitlement, bài tập bắt buộc, lịch, cần duyệt — 0034/0036 đã giải quyết bằng `lib/content-access/resolver.ts` |
| `student_navigation_items` + `student_navigation_rules` (CMS điều hướng, khóa theo role/membership/nhóm) | `lib/student/compact-navigation.ts` — **sidebar học viên thật đang chạy trên production** | Đây là thay thế toàn bộ sidebar đang sống bằng một hệ cấu hình qua database — rủi ro cao nhất trong toàn bộ đề xuất |
| `student_experience_versions/settings/publish_logs` (draft→publish→rollback) | Không có tương đương — **nhưng cũng không có nhu cầu xác nhận** | Hạ tầng versioning cho toàn bộ cây điều hướng là khối lượng lớn nhất trong 12 bảng, phục vụ một quy trình vận hành (soạn nháp → duyệt → xuất bản → khôi phục) chưa từng được bạn yêu cầu trong phiên này |
| `student_navigation_overrides` + `student_navigation_unlock_requests` | `entitlements` (cấp quyền từng học viên, đã có UI ở Distribution) | Cùng một việc dưới tên khác |

## 3. Lỗi bảo mật cùng khuôn mẫu đã gặp ở module 18 và 19

`h2obook_can_manage_student_experience()` cho phép vai trò **`'academic_ops'`** — vai trò này **không tồn tại** trong `public.member_role` (chỉ có `owner/admin/designer/partner/teacher/student`). Hàm cũng tự dò `workspace_members` (bảng không tồn tại trong repo) thay vì dùng thẳng `has_org_role()` đã có.

Đây là mẫu lỗi thứ ba tôi gặp trong 3 module liên tiếp: tự dựng hàm xác thực riêng thay vì dùng hàm đã có, và giả định vai trò không tồn tại.

## 4. Phần có giá trị thật, nếu tách riêng

Bỏ hết phần trùng lặp, thứ duy nhất module này thêm mà hệ hiện tại **chưa có** là: **nhóm nhiều tài nguyên trong một giai đoạn thành "chương trình" và "module"** — hiện `career_stage_resources` là danh sách phẳng, không phân cấp. Nếu một giai đoạn có hàng trăm tài liệu, danh sách phẳng sẽ khó dùng.

**Nhưng: chưa có bằng chứng đây là nhu cầu thật hiện tại.** Không giai đoạn nào bạn đã tạo có tới mức cần phân nhóm, và không có yêu cầu nào trong phiên này về việc này. Xây nó bây giờ là thiết kế theo nhu cầu giả định — đúng điều nguyên tắc làm việc của tôi yêu cầu tránh.

## 5. Đề xuất

**Từ chối toàn bộ 12 bảng và hệ CMS điều hướng.** Không có gì để tích hợp mà không đụng tới sidebar đang chạy thật hoặc dựng lại thứ đã có.

Nếu bạn thực sự cần một trong các khả năng dưới đây, nói rõ cái nào — tôi sẽ dựng **đúng phần đó**, additive vào hệ đã có (`career_stages`/`career_stage_resources`), không đụng tới sidebar thật và không tạo bảng versioning:

- **(A)** Nhóm tài nguyên trong 1 giai đoạn thành chương trình/module có phân cấp.
- **(B)** Cho admin tự đổi tên/thêm/bớt các mục trong sidebar học viên (thay vì mã cứng HOME/LEARN/CREATE/BUSINESS).
- **(C)** Học viên tự gửi yêu cầu xin mở khóa một tài liệu, admin duyệt.
- **(D)** Không cần gì — giữ nguyên hiện trạng.

Không mục nào trong 4 mục trên được code trong lượt này; tôi dừng ở audit để chờ quyết định của bạn.
