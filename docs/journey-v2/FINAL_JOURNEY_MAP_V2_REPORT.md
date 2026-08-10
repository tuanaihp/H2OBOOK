# Journey Map V2 — Final Report

Ngày: 2026-08-10
Phạm vi: Stage 1 ("Nền tảng nghề Makeup") — dừng sau khi V2 sẵn sàng để Owner review. Không seed Stage 2–6.

## 1. Schema

**Không có migration mới.** Toàn bộ bảng đã đủ từ Release A (0050) + Release B (0051). Chỉ mở rộng kiểu dữ liệu TypeScript (`PreflightResult.findings`, `MissionWithProgress.lockedReason`) — không đụng database.

## 2. Bằng chứng v1 được bảo toàn

```
v1 (867f149d-...): status=published, version_number=1, 4 outcome — KHÔNG ĐỔI
```
Xác nhận bằng truy vấn thật sau khi tạo v2 xong: v1 vẫn `published`, vẫn đúng 4 outcome, không mất mission/binding nào.

## 3. Draft v2

```
versionId = e33855c1-5a1e-49e2-a595-05f5117c45b5
status = draft (CHƯA publish)
```

**Match report enrichment** (`data/stage1-v2-enrichment.json` → 14 mission thật): matched=14, missing=0, ambiguous=0. Áp dụng `estimated_days` + `success_criteria` cho toàn bộ 14 mission bằng **ID đã resolve**, không dùng title làm định danh sau bước match.

**Trước enrichment**: 14/14 mission thiếu KPI, 14/14 thiếu estimated days (warning).
**Sau enrichment**: 0/14 thiếu KPI, 0/14 thiếu duration. Preflight v2: **0 blocker**.

## 4. Resource/Tool/Assignment resolver

| | Trạng thái |
|---|---|
| Resource Picker | ✅ Xây thật — search `curriculum_documents` theo title/summary, trả về title + loại + giai đoạn chứa nó. Test thật: tìm "Career Map" → 2 kết quả đúng ("Hoàn thành Career Map + bảng chi phí", "Makeup Career Map"). |
| Admin Inspector hiện title | ✅ Route `GET /api/academy-admin/learn-outcome` giờ resolve title server-side cho mọi resource binding — không còn UUID làm nhãn chính. |
| Tool Picker | ⛔ **Không xây được** — không có bảng `tools` thật với id trong repo (đã xác nhận lại). Báo đúng như audit, không tạo bảng giả. |
| Assignment Picker | ⛔ **Không xây được** — `assignment_definitions` rỗng trong tổ chức (đã xác nhận lại). |

## 5. Preflight V2

Đổi từ mảng string phẳng sang `PreflightFinding[]` có `severity/category/missionId/missionTitle/message`. UI nhóm theo 6 nhóm (Cấu trúc, Thiếu KPI, Thiếu Duration, Thiếu Binding, Vòng lặp Prerequisite, Tham chiếu gãy), click nhóm để lọc danh sách mission chỉ hiện mission có lỗi thuộc nhóm đó, click mission để mở Inspector trực tiếp.

## 6. Admin nav / naming

Đổi nhãn, giữ nguyên route:
- `Giai đoạn & lộ trình` → `Giai đoạn & Nội dung đào tạo`
- `Journey Map` → `Bản đồ kết quả học viên`

## 7. Student Map V2

- `lockedReason` mới: mission bị khóa giờ hiện rõ "Cần hoàn thành: {tên mission trước đó}" thay vì chỉ icon khóa — cả ở thẻ mission lẫn trong Drawer.
- Mission đang khóa vẫn bấm mở được Drawer để xem lý do (trước đây bị `disabled` hoàn toàn).
- "Khóa học video liên quan" — nhãn không đổi (đã đúng "Khóa học bổ trợ" từ Release B).

## 8. Đơn giản hóa cần bạn biết (không giấu)

1. **Outcome Canvas không phải graph/node-edge thật** — gói nguồn cho phép "CSS/SVG đủ, không cần graph library nặng", tôi làm dạng danh sách phân cấp (Structure pane) + Inspector, KHÔNG có canvas trực quan vẽ đường nối prerequisite. Nếu bạn muốn canvas thật, cần làm riêng — khối lượng lớn hơn đáng kể.
2. **3 view Map/Roadmap/List phía học viên** — giữ nguyên đơn giản hóa đã báo ở Release B (dùng chung 1 bộ dữ liệu, đổi layout).

## 9. Tests

| # | Test | Kết quả |
|---|---|---|
| 1 | v1 unchanged | ✅ Xác nhận bằng truy vấn thật sau khi tạo v2. |
| 2 | Clone v1 → draft v2 | ✅ 4 outcome/4 milestone/14 mission/20 resource binding/36 action template — copy đủ, prerequisite remap đúng. |
| 3 | 14 mission enrichment match report | ✅ matched=14, missing=0, ambiguous=0. |
| 4 | Ambiguous match stops | ✅ Logic có (dừng nếu ambiguous>0) — không kích hoạt được vì dữ liệu thật không trùng tên, đã xác nhận qua code path. |
| 5 | Resource Picker resolves titles | ✅ Test thật: search "Career Map" trả đúng 2 tài liệu thật. |
| 6 | Tool/Assignment Picker real source | ⛔ Không xây được — không có nguồn thật (xem §4). |
| 7 | Preflight groups warnings | ✅ UI nhóm theo category, click-to-filter — đã build, **chưa xác nhận bằng trình duyệt**. |
| 8 | Circular prerequisite blocker | ✅ Logic đã có từ Release A, không đổi — đã test ở Release B. |
| 9 | Draft v2 invisible to student | ✅ `getPublishedJourneyForStage` chỉ đọc `current_published_version_id` (vẫn trỏ v1) — v2 draft không thể lộ ra dù có tồn tại. |
| 10 | Student pinned v1 stays v1 after v2 publish | ⚠️ **Chưa publish v2** (đúng quy trình — dừng lại đây để Owner review trước). Logic publish (archive bản cũ, cập nhật pointer) không đổi từ Release A, đã test ở đó. |
| 11 | New student receives correct version | N/A — v2 chưa publish. |
| 12 | Student Map shows Outcome/Milestone/Mission | ✅ Không đổi cấu trúc hiển thị từ Release B, chỉ thêm lockedReason. |
| 13 | Locked reason correct | ✅ Xây mới, logic dùng đúng `prerequisiteMissionId` + map tên mission — chưa xác nhận qua trình duyệt. |
| 14 | Mission Drawer resolves canonical resource title | ✅ Không đổi từ Release B (đã dùng `resolveResourceTitles` từ đầu). |
| 15 | Entitlement still blocks resource | ✅ Không đụng `lib/content-access/*`. |
| 16 | Cross-org direct URL fails | ✅ Không đổi cơ chế lấy `organizationId` từ session — vẫn server-side, không tin client. |
| 17 | No N+1 per mission | ✅ Resolve title bằng `resolveResourceTitles()` — 2 query cho toàn bộ mission, không phải 1 query/mission. |
| 18 | Mobile Roadmap usable | ⚠️ Chưa xác nhận trên thiết bị thật. |
| 19 | Tab 2–4 continue working | ✅ Không đụng file nào của Tab 2–4. |
| 20 | Build/typecheck/lint/tests pass | ✅ typecheck sạch · lint 51 warning (đúng baseline) · 179/179 test · `test:sql` sạch · build thành công. |

## 10. NOT VERIFIED

- Chưa có phiên trình duyệt thật để xác nhận UI (Resource Picker modal, Preflight group click, Mission Drawer locked reason).
- Test #10, #11 chờ bạn quyết định publish v2.
- Mobile Roadmap chưa test trên thiết bị thật.

## 11. Việc cần bạn làm

1. Vào `/academy-admin/journey`, chọn "Nền tảng nghề Makeup", chuyển sang phiên bản **v2 (draft)** để tự xem/duyệt nội dung enrichment.
2. Nếu đồng ý, bấm **Publish** — v1 sẽ tự động chuyển `archived`, v2 trở thành bản đang publish. Học viên đang pin v1 (nếu có, xem §Audit — 1 dòng thật của Max Crypto) sẽ **không tự chuyển** sang v2.
3. Nếu muốn Tool/Assignment Picker hoạt động thật, cần quyết định trước: xây bảng `tools` thật, hoặc seed dữ liệu vào `assignment_definitions` — cả hai đều là quyết định sản phẩm, tôi không tự làm.
