# Smart Roadmap + Universal Mission OS — Release 1 Report

Ngày: 2026-08-10
Phạm vi: **chỉ Release 1** (nền dữ liệu + Admin cấu hình block ở Draft). Release 2–4 chưa làm — xem lý do trong audit.

## 1. Hệ thống tái sử dụng

`learning_journey_*` (0050), `student_mission_states` (+evidence, 0051), `student_learning_actions`, entitlement/access resolver, `assignment_definitions`/`rubric_criteria`/`criterion_scores` (0026/0036), `domain_events` trigger có sẵn — không đụng, không tạo bản sao.

## 2. Schema mới — vì sao không tránh được

Đã audit kỹ `learning_blocks` (0026) trước khi quyết định — hệ thống block thật, gần giống, nhưng thuộc domain Knowledge Space (`knowledge_space_versions`), không phải Journey. Chi tiết đầy đủ trong `docs/smart-learning/01_PRODUCTION_AUDIT.md`.

Migration 0052 — 2 bảng:
- `learning_mission_workspace_configs` — 1 dòng/(journey_version_id, mission_id), `blocks jsonb`.
- `student_mission_workspace_values` — 1 dòng/(student, version, mission, block_id).

## 3. Đã xây (Release 1)

- **27 loại block** đúng registry gói nguồn, đặt tên khớp từ vựng `learning_block_type` ở chỗ trùng khái niệm.
- **Admin Mission Workspace Builder** — tích hợp thẳng vào Mission Inspector đã có ở `/academy-admin/journey` (không tạo app admin riêng, đúng §8): thêm/xóa/sắp xếp lại block, đánh dấu bắt buộc, gắn canonical binding (resource/tool/assignment) bằng cách chọn từ binding **đã có sẵn của chính Mission đó** — không cho phép gõ tay UUID.
- **Chỉ sửa được khi version đang Draft** — publish rồi thì khóa, đúng nguyên tắc versioning đã dùng xuyên suốt từ Release A.
- **Clone Version giờ copy luôn Workspace config** — sửa `duplicateVersion()` (trước đây chỉ copy Outcome/Milestone/Mission/binding, sẽ làm mất toàn bộ block đã cấu hình khi Admin bấm "Nhân bản phiên bản").
- **Preflight mở rộng** — block id trùng lặp (blocker), block tham chiếu canonical (resource/tool/assignment) chưa gắn binding (blocker), Mission chưa có Workspace config nào (warning).

## 4. KHÔNG xây trong lượt này — vì sao

Gói nguồn tự chia 4 đợt (§20 trong file lệnh). Đây là gói lớn nhất từ đầu tới giờ:

| Đợt | Nội dung | Trạng thái |
|---|---|---|
| Release 1 | Schema + Admin block builder (Draft) | ✅ Đã làm — báo cáo này |
| Release 2 | Smart Roadmap nâng cấp, route `/student/missions/[missionId]`, Universal Mission Workspace hiển thị cho học viên, readiness/progress | ⛔ Chưa làm |
| Release 3 | Evidence/Result tích hợp đầy đủ, Result Card | ⛔ Chưa làm |
| Release 4 | H2O Journey AI, H2O Mission AI, forecast | ⛔ Chưa làm |

**Học viên hiện CHƯA thấy gì thay đổi** — `/student/courses` vẫn y như Journey V2 (Release B). Block Admin vừa cấu hình chưa có nơi nào hiển thị cho học viên cho tới khi làm Release 2. Đây là quyết định phạm vi có chủ đích, không phải làm dở — khối lượng Release 2 (route mới + renderer 27 loại block + đồng bộ 2 chiều Roadmap↔Workspace) đủ lớn để cần một lượt riêng.

## 5. Tests (theo đúng §19 gói nguồn)

| # | Test | Kết quả |
|---|---|---|
| 1 | Student sees assigned published Journey only | N/A Release 1 — chưa có route học viên nào đọc Workspace |
| 2 | Draft version invisible | ✅ Không đổi từ Release A/B — vẫn đúng |
| 10 | Admin +/− block updates Draft only | ✅ `requireDraftVersion()` chặn ghi khi version không phải draft |
| 11 | Removing block from Draft does not delete prior published student data | ✅ Đúng theo thiết kế: xóa block chỉ sửa `blocks` jsonb của **draft** row — version đã publish có `journey_version_id` khác, không chung dòng |
| 12 | Resource block resolves canonical title and entitlement | ✅ Binding picker chỉ cho chọn trong danh sách binding đã resolve title thật của Mission (tái dùng UI đã có từ Journey V2) |
| 13 | No resource copy into workspace config | ✅ Block chỉ lưu `bindingId`, không copy title/nội dung |
| 22 | CREATE/BUSINESS unchanged | ✅ Không đụng file nào |
| 23 | typecheck/lint/tests/build PASS | ✅ typecheck sạch · lint 52 warning (tăng 1 từ 51 — cùng loại warning `useEffect` đã có sẵn nhiều nơi khác trong repo, không phải lỗi mới) · 179/179 test · `test:sql` sạch · build thành công |

Các test còn lại (#3–9, 14–21) thuộc phạm vi Release 2 (route học viên, readiness, sync Roadmap↔Workspace) — chưa áp dụng được.

## 6. NOT VERIFIED

- Chưa test bằng trình duyệt thật (thêm/xóa/sắp xếp block trong Admin UI).
- Chưa test clone version có block thật (cần Admin tự thêm ít nhất 1 block rồi Clone Version để xác nhận).
- Migration 0052 **chưa chạy trên production** tại thời điểm viết báo cáo này — sẽ xác nhận bằng dữ liệu thật ngay sau khi bạn chạy.

## 7. Việc cần bạn làm

1. Chạy `supabase/_RUN-0052-ONLY.sql`.
2. Báo tôi — tôi sẽ kiểm chứng bằng dữ liệu thật (thêm 1 block test, xác nhận Preflight bắt lỗi đúng, dọn dẹp).
3. **Quyết định có làm Release 2 hay không** — đây là route học viên hoàn toàn mới (`/student/missions/[missionId]`) + renderer cho 27 loại block, khối lượng lớn tương đương 1 đợt riêng.
