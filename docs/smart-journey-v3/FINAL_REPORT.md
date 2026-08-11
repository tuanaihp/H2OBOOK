# Smart Journey Shell V3 — Final Report

Ngày: 2026-08-10/11
Gói nguồn: `v5/31-H2OBOOK_SMART_JOURNEY_SHELL_V3` — đọc đủ **22/22 file** trước khi code (rút kinh nghiệm từ folder 30, nơi 2 đợt đầu chỉ đọc 5/22 file và bỏ sót một lỗ hổng bảo mật thật).

## 1. Audit — hệ thống tái sử dụng

Không migration nào (đúng `REFERENCE_ONLY_no_core_migration_expected.sql`). Toàn bộ dữ liệu đã có sẵn từ Release A/B và folder 30:

| Cần | Nguồn thật |
|---|---|
| Journey blueprint/version/outcome/milestone/mission | `learning_journey_*` (migration 0050) |
| Student mission state/progress | `student_mission_states` (0050/0051) |
| Actions | `student_learning_actions` |
| Evidence/Result | `student_mission_states.evidence`/`verified_at`/`result_achieved_at` |
| Prerequisite/unlock | `displayStateFor()` trong `lib/learn-outcome/student.ts` (không đổi) |
| Readiness từng Mission | `calculateMissionReadiness()` (folder 30, `lib/mission-workspace/student.ts`) |
| domain_events | Bảng có sẵn, dùng `emitDomainEvent()` có sẵn (`lib/domain/events.ts`) — không tạo bảng sự kiện mới |
| `/student/missions/[missionId]` | Đã có từ folder 30 — không đổi |

## 2. Đã xây

- **`lib/smart-journey/student.ts`** — `getSmartJourneyReadModel()`: MỘT read model cho cả 4 view (Map/Roadmap/Danh sách/Today), gộp outcome/milestone/mission + readiness từng mission + counts + todayItems + AI snapshot (luôn `unavailable`, Release 4 chưa xây).
- **`components/student/smart-journey/`** — `smart-journey-shell.tsx` (Header, Intelligence Bar, Controls, AI Panel, Mission Quick Preview Drawer — tất cả giữ nguyên khi đổi view/mode) + `views.tsx` (4 view).
- **Mission Quick Preview Drawer** — bấm Mission ở BẤT KỲ view nào đều mở cùng 1 drawer, CTA `Mở Universal Mission Workspace` điều hướng đúng `missionId` đã xem (test #8).
- **Today view** — 1–5 việc thật: bắt đầu mission hiện tại nếu chưa bắt đầu, các action bắt buộc chưa xong, nhắc nộp evidence nếu cần, nhắc đang chờ giáo viên duyệt — hoàn toàn xác định (deterministic), không cần AI.
- **Mission Control (Danh sách)** — nâng từ 1 bảng đơn giản (folder 30) thành: 6 ô tổng quan (Tổng/Đang làm/Hoàn thành/Cần Evidence/Đang khóa/AI ưu tiên) + tìm kiếm + lọc trạng thái + lọc Outcome + 2 chế độ con "Theo Outcome" / "Action Queue".
- **Roadmap** — nhóm thật theo Hôm nay → Tiếp theo → Tuần này → Sau đó → Đã hoàn thành (không copy layout Danh sách).
- **Sự kiện UI** — `journey.viewed`, `mode_changed`, `view_changed`, `mission_previewed`, `mission_workspace_opened`, `list_filtered`, `action_queue_viewed` — tái dùng `domain_events` có sẵn qua `emitDomainEvent()`, không tạo bảng mới.

## 3. Chiến lược truy vấn — không N+1

Readiness của **mọi** Mission (cần cho cột Readiness ở Danh sách và Map) được tính bằng đúng 2 truy vấn cho **cả version** (`getWorkspaceConfigsForVersion` có sẵn từ folder 30 + `getStudentBlockValuesForVersion` mới thêm), không phải 1 truy vấn/Mission — cùng cách Preflight Admin đã làm. Với Stage 1 (14 mission) là 2 câu SQL bất kể có bao nhiêu mission.

## 4. Không bịa số (test #13 "no fake ETA")

- `predictedFinishDate`: luôn `null` cho tới khi Release 4 (H2O Journey AI) có dự báo thật — giao diện hiện `—`.
- `readinessScore` toàn Journey = readiness của **Mission hiện tại** (không phải điểm trộn tự chế) — cùng con số Mission Workspace đã hiện, không thể lệch nhau.
- `ai.nextBestMissionId` luôn `null` hiện tại; code đã có bước validate id này khớp với graph thật trước khi dùng (test #12) — sẵn sàng cho khi Release 4 làm AI thật, không phải thêm sau.

## 5. Bảo mật

- Org/student luôn lấy từ server auth (`requireCurrentUser`/`requireApiUser`), không nhận từ client.
- Route sự kiện (`/api/student/smart-journey/event`) chỉ nhận đúng 7 tên sự kiện trong allowlist — không phải endpoint ghi tuỳ ý.
- Mission Draft vẫn vô hình với học viên — đọc qua đúng `getJourneyForStudent` (không đổi từ folder 30, đã test #2/#5/#6 ở đó).

## 6. Khác biệt có chủ đích so với gói nguồn

- Không thêm feature flag `SMART_JOURNEY_SHELL_V3` — nhất quán với mọi release trước của dự án (lịch sử git là đường lùi).
- `momentumScore`/`consistencyScore` (optional trong type gốc): không làm — không có nguồn dữ liệu thật để tính mà không bịa.
- AI ưu tiên (`aiPriority` trên từng Mission, badge "✦ AI PRIORITY" trong prototype gốc): không hiện — đây là output của Release 4, hiện tại luôn để trống thay vì giả.

## 7. Tests (§16)

| # | Test | Kết quả |
|---|---|---|
| 1–3 | Map/Roadmap/List cùng mission IDs · cùng current mission · cùng locked reason | ✅ Cả 3 view đọc từ đúng 1 `model` prop, không tự fetch riêng |
| 4 | Draft invisible | ✅ Không đổi từ folder 30 |
| 5 | Assigned published version only | ✅ Không đổi từ folder 30 |
| 6 | Cross-org blocked | ✅ Không đổi — `organizationId` luôn từ server |
| 7 | Same preview component | ✅ 1 `MissionQuickPreviewDrawer` dùng chung cho mọi view |
| 8 | Workspace CTA same mission ID | ✅ `onOpenWorkspace(mission.id)` — cùng id đã preview |
| 9 | List filter không mutate state | ✅ Lọc hoàn toàn client-side (`useState` cục bộ) |
| 10 | Action Queue không đưa locked/completed vào trừ khi explicit | ✅ `buildActionQueue()` loại `locked/result_achieved/verified` |
| 11 | AI-off works | ✅ `ai.status === "unavailable"` — mọi luồng học vẫn chạy |
| 12 | AI hallucinated mission ID rejected | ✅ `aiPick` chỉ dùng nếu tìm thấy trong graph đã tải, hiện luôn `undefined` vì `nextBestMissionId` luôn null |
| 13 | No fake ETA | ✅ Xem mục 4 |
| 14/20 | No N+1 | ✅ Xem mục 3 |
| 15 | Mobile usable | ✅ Kế thừa breakpoint `h2o-sr-*`/`h2o-sj-*` đã có (≤1150px, ≤760px) |
| 16 | Today uses real actionable data | ✅ Xem mục 2 |
| 17 | Result refresh updates journey progress | ✅ Không đổi — điều hướng lại `/student/courses` chạy lại Server Component, dữ liệu luôn mới |
| 18 | CREATE/BUSINESS unchanged | ✅ Không đụng file nào |
| 19 | typecheck/lint/tests/build PASS | ✅ typecheck sạch · lint 52 warning (không tăng) · 179/179 test · `test:sql` sạch · build thành công |

## 8. Xác nhận trên dữ liệu thật production (2026-08-11, chỉ đọc, không ghi)

| Kiểm tra | Kết quả |
|---|---|
| Tổng số Mission Stage 1 (v1 published) | ✅ 14 — khớp đúng số Admin đã seed |
| Trạng thái thật của học viên "Max Crypto" | ✅ Mission 1 = `result_achieved`, Mission 2 = `doing`, còn lại chưa có state row |
| Công thức readiness cho Mission đang làm | ✅ 53% — khớp lần tính tay ở báo cáo folder 30 (không đổi công thức) |

Không ghi/xóa dữ liệu nào lần này — chỉ đọc để đối chiếu, nên không cần dọn dẹp.

**Chưa test**: qua trình duyệt bằng phiên đăng nhập học viên thật (không có mật khẩu tài khoản học viên).

## 9. Rollback

Không migration, không feature flag. Rollback bằng `git revert` commit merge `feature/smart-journey-shell-v3` nếu cần.

## 10. Việc cần bạn làm

1. Tự đăng nhập học viên, thử cả 4 chế độ (Journey→Map/Roadmap/Danh sách, và Today), thử Mission Quick Preview → Mở Workspace.
2. Không cần chạy migration nào.
3. Release 3 (Result Card đầy đủ) và Release 4 (H2O Journey AI/Mission AI thật, dự báo ngày hoàn thành) của folder 30 vẫn đang chờ quyết định — folder 31 không thay đổi việc đó.
