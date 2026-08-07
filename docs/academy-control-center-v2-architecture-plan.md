# Academy Control Center v2 — Kiến trúc mục tiêu & kế hoạch tích hợp

Ngày: 2026-08-07 · Dựa trên đề xuất IA 6 nhánh bạn đưa ra, đối chiếu với schema thật đang chạy production.

Tài liệu này viết cho việc **brief ChatGPT viết code**, sau đó bạn đưa lại cho tôi tích hợp. Không có dòng code nào trong tài liệu này là để chạy trực tiếp — đây là bản thiết kế + danh sách ràng buộc bắt buộc.

---

## 0. Phát hiện quan trọng — đọc trước khi giao việc

### 0.1. Đã có 2 mô hình nội dung song song, chưa hợp nhất

| | `academy_courses` (migration 0024) | `career_stages` (migration 0033/0036/0040) |
|---|---|---|
| Cấu trúc | Khóa học → Module → Lesson (video, transcript, tiến độ xem) | Giai đoạn → Chương trình → Module → Resource (trỏ tới sách/khóa học/asset/...) |
| Nav admin hiện tại | `/academy-admin/programs` — nhãn **"Chương trình đào tạo"** | `/academy-admin/stages` — nhãn "Giai đoạn & tài liệu" |
| Theo dõi tiến độ | `academy_lesson_progress` | Chưa có bảng progress riêng cho resource — dựa vào entitlement + unlock_mode |
| Sinh doanh thu | Có luồng: đơn đăng ký công khai → duyệt → mời tài khoản → cấp quyền (`academy_applications`) | Không có luồng bán hàng riêng, dựa vào `entitlements`/membership |

**Hệ quả**: đề xuất của bạn dùng chữ "Chương trình" và "Module" cho lớp nhóm bên trong Giai đoạn (`career_stage_programs`, vừa deploy) — nhưng app đã dùng đúng nhãn **"Chương trình đào tạo"** cho `academy_courses` ở menu admin hiện tại. Đây là **trùng tên, khác bảng**. Nếu ChatGPT không biết điều này, rất dễ:
- Viết nhầm vào bảng sai (tưởng "Chương trình" là `academy_courses`, thực ra bạn đang thao tác `career_stage_programs`), hoặc
- Tạo thêm một khái niệm "chương trình" thứ ba.

**Đã chốt**: đổi nhãn hiển thị (không đổi bảng, không đổi route) để tránh nhầm lẫn khi làm việc với ChatGPT:
- `/academy-admin/programs` (`academy_courses`) → đổi nhãn menu từ "Chương trình đào tạo" thành **"Khóa học video"**.
- `academy_stage_nodes` (Phụ lục A.1, thay `career_stage_programs`) bên trong `/academy-admin/stages` → giữ nguyên nhãn **"Chương trình / module"** vì đây đúng là khái niệm bạn đã duyệt tuần trước.
- Hai khái niệm này **luôn tách biệt hoàn toàn** trong toàn bộ tài liệu — không hợp nhất (xem quyết định ở mục 6).

### 0.2. IA 6 nhánh bạn đề xuất đã có sẵn ~60%

| Nhánh đề xuất | Route/bảng thật đã có |
|---|---|
| 1. Tổng quan Academy | `/academy-admin` (dashboard) |
| 2. Giai đoạn & Lộ trình | `/academy-admin/stages` — `career_stages` + `career_stage_programs` (mới) + `career_stage_resources` |
| 7. Phân quyền & Distribution | `/academy-admin/distribution` — `entitlements` |
| 8. Tiến độ & đánh giá | `academy_lesson_progress`, hệ nộp bài (`brain_assignment_submissions`) — chưa gộp thành 1 màn hình tổng |
| 3. Kho nội dung Academy | **Chưa có** — xem mục 1 |
| 4. Student Experience Builder | **Chưa có** — xem mục 2 |
| Khóa học video (không có trong sơ đồ của bạn nhưng đã tồn tại) | `/academy-admin/programs` — `academy_courses` |

Việc thật sự cần code mới chỉ nằm ở mục 3, 4, và phần "nhóm tài liệu" cấp 3 trong mục 2 — không phải toàn bộ 6 nhánh.

### 0.3. Đã có sẵn 1 module nguồn khác đúng chủ đề này — `v5/H2OBOOK_ACADEMY_CONTROL_CENTER_V1`

Sau khi viết bản đầu tài liệu này, rà lại thư mục `v5/H2OBOOK_ACADEMY_CONTROL_CENTER_V1` thì thấy đây **chính là module giải quyết đúng đề xuất của bạn** (Program → Module → Group, Student Experience Builder theo surface LEARN/CREATE/BUSINESS/COACHING) — và module này **kỷ luật hơn hẳn** các module 18/19/20 trước: README của nó tự nêu rõ "reuse `career_stages`/`career_stage_resources`/`entitlements`/`assets`, không tạo `media_assets`/`books_v2`/`entitlements_v2`". Đây là bộ khung tốt để đưa cho ChatGPT bám theo, **sau khi sửa 4 điểm** — chi tiết đầy đủ ở **Phụ lục A**. Kết luận nhanh:

- **Thiết kế phân cấp của nó (`academy_stage_nodes` — 1 bảng generic, tự tham chiếu, `node_type` = program/module/group) tốt hơn** phương án 2-bảng tôi vẽ ở mục 2 bên dưới. Khuyến nghị **thay thế `career_stage_programs`** (migration 0040, vừa deploy hôm nay, chưa có dữ liệu thật) bằng bảng generic này — xem Phụ lục A.1.
- **`visibility_state` + `unlock_rule jsonb` của nó trùng lặp với engine mở khóa thật đã có** (`unlock_mode`/`prerequisite_binding_id`/`required_progress`/`unlock_at`, migration 0034/0036, do `lib/content-access/resolver.ts` giải quyết) — đúng loại lỗi đã bị audit ở module 20 gốc. Phải bỏ, dùng lại cột đã có — xem Phụ lục A.2.
- **`student_label` trùng `title_override`, `sort_order` trùng `position`** — cột đã có sẵn trên `career_stage_resources`, không cần thêm — Phụ lục A.2.
- **`surface` (learn/create/business/coaching) là ý tưởng mới, không trùng gì** — nên giữ, đây đúng là mảnh còn thiếu cho Student Experience Builder — Phụ lục A.2.
- **`academy_stage_ui_config`** (1 bảng, mỗi dòng có `version` + `status draft/published/archived` + `config jsonb`) là cách làm versioning **nhẹ hơn nhiều** so với hệ 3-bảng của module 20 gốc, chi phí thấp — khuyến nghị **dùng luôn**, thay cho 2 bảng `student_navigation_items`/`student_navigation_visibility_rules` tôi vẽ ở mục 3 — xem Phụ lục A.3.
- **Số hiệu migration của nó là `0040` — trùng với migration 0040 thật đã deploy hôm nay** (`career_stage_programs`). Bắt buộc đổi thành `0041` khi đưa cho ChatGPT.

**Mục 1, 2, 3 bên dưới vẫn còn giá trị tham khảo (đặc biệt mục 1 — module nguồn này giả định "Resource Registry" đã tồn tại, không tự đề xuất) nhưng bản thiết kế phân cấp + Student Experience Builder cuối cùng nên theo Phụ lục A, không phải bản nháp ở mục 2–3.**

---

## 1. Kho nội dung Academy (`content_items`) — bảng trung tâm thật

Bạn đã chọn: **bảng thật, di trú dữ liệu** (không phải view ảo). Vì `assets` đã có 22 khóa ngoại và `books`/`publications`/`templates` đều đang là nguồn thật cho các hệ khác, **di trú = sao chép vào bảng catalog mới, không xoá/di dời bảng gốc**. Di dời thật (đổi FK ở 22 chỗ) là việc rủi ro không tương xứng lợi ích.

**Đã chốt (mục 6): `academy_courses` KHÔNG vào `content_items`.** Khóa học video có luồng bán hàng/tiến độ/video riêng (`academy_applications`, `academy_lesson_progress`) — không phải "tài liệu tĩnh" cùng loại với sách/asset/template. Gắn một khóa học vào giai đoạn tiếp tục đi qua đường hiện tại (`resource_type='course'`, chọn `resourceId` trực tiếp từ `/academy-admin/programs`), không qua danh mục `content_items`. Vì vậy `content_type` bên dưới **bỏ giá trị `'course'`**.

### Thiết kế đề xuất

```
content_items
  id uuid pk
  organization_id uuid fk organizations
  content_type text check (in 'book','publication','template','knowledge_space',
                            'roadmap','link','asset','article','checklist','sop','worksheet',
                            'quiz','flashcard','rubric','case_study')
  source_table text not null        -- 'books' | 'publications' | 'templates' | 'assets' | ...  (KHÔNG có 'academy_courses')
  source_id uuid not null           -- id thật trong bảng gốc — KHÔNG BAO GIỜ mồ côi
  title text
  summary text
  cover_asset_id uuid fk assets
  tags text[]
  reuse_count integer default 0     -- số giai đoạn đang dùng lại item này
  status text
  created_at, updated_at
  unique (organization_id, source_table, source_id)   -- 1 dòng gốc chỉ có đúng 1 mục catalog
```

**Nguyên tắc bắt buộc**:
- `content_items` là **chỉ mục để duyệt/chọn**, không phải nơi lưu nội dung thật. Nội dung thật vẫn nằm ở `books.content`, `academy_course_lessons.content`, `assets.storage_key`... — không sao chép nội dung lớn vào đây, chỉ sao chép metadata hiển thị.
- Đồng bộ theo hướng **một chiều, ghi khi tạo/sửa ở bảng gốc** (trigger hoặc app-layer write-through khi gọi `createBook`/`createStage`/... hiện có) — không polling, không batch job định kỳ.
- `career_stage_resources.resource_type` + `resource_id` **giữ nguyên như hiện tại**, KHÔNG đổi sang trỏ vào `content_items.id`. Màn hình "+ Thêm tài nguyên" chỉ dùng `content_items` để hiển thị danh sách chọn dễ hơn (tìm theo tên, lọc theo loại) — khi chọn xong, ghi `resource_type = content_items.content_type`, `resource_id = content_items.source_id` như cũ. Điều này giữ nguyên toàn bộ engine quyền (`lib/content-access/resolver.ts`) không phải sửa gì.

### Việc ChatGPT KHÔNG được làm
- Không tạo bảng lưu file/binary mới (không phải `media_assets` lần nữa) — asset thật vẫn là `public.assets`.
- Không đổi kiểu `career_stage_resources.resource_id` từ trỏ-bảng-gốc sang trỏ-`content_items`.

---

## 2. Nhóm tài liệu cấp 3 (`career_stage_resource_groups`)

Bạn đã chọn: cần cấp phân cấp thứ 3 thật sự (ví dụ "Nền" bên trong module "Kỹ thuật nâng cao", chứa 8 video + 2 ebook riêng).

### Thiết kế đề xuất — additive trên `career_stage_programs`/`career_stage_resources` đã có

```
career_stage_resource_groups
  id uuid pk
  organization_id uuid fk organizations
  program_id uuid not null fk career_stage_programs   -- luôn thuộc 1 module cụ thể
  title text
  position integer
  status text check (active/hidden/archived)
```

```
alter table career_stage_resources
  add column group_id uuid references career_stage_resource_groups(id) on delete set null;
```

Đúng mẫu đã dùng ở migration 0040 (`program_id` nullable trên `career_stage_resources`) — không phá dữ liệu cũ, resource không thuộc nhóm nào vẫn hiển thị bình thường dưới module.

**Ràng buộc**: `career_stage_resource_groups.program_id` nên trỏ tới một hàng `career_stage_programs` **có `parent_id` khác null** (tức phải là module, không phải chương trình gốc) — giữ đúng ý "nhóm nằm trong module", tránh lồng sai cấp. Kiểm tra bằng trigger, cùng kiểu với `h2obook_career_stage_program_depth_check()` đã viết ở migration 0040.

---

## 3. Student Experience Builder — sidebar CMS thật

Bạn đã chọn: xây CMS thật (admin đổi tên/ẩn/hiện/khóa tab). Đây là phần rủi ro cao nhất trong toàn bộ kế hoạch vì phải thay thế `lib/student/compact-navigation.ts` — sidebar đang chạy thật trên production. Đề xuất triển khai theo 4 bước, không làm một lần:

### Bước 1 — Schema (an toàn, chưa đổi hành vi học viên)

```
student_navigation_items
  id uuid pk, organization_id uuid fk organizations
  item_key text                      -- 'home','learn','create','business','coaching'
  group_key text                     -- nhóm cha để render section (LEARN/CREATE/BUSINESS/...)
  label text, icon text, position integer
  target_kind text check ('route','program','resource')
  target_value text                  -- route tĩnh, hoặc id của career_stage_programs/resource
  status text check (active/hidden)

student_navigation_visibility_rules
  id uuid pk
  navigation_item_id uuid fk student_navigation_items
  stage_id uuid references career_stages    -- null = mọi giai đoạn
  membership_plan_code text                 -- null = mọi gói, dùng plan_code thật đã có ở organizations/entitlements
  member_role public.member_role            -- DÙNG ENUM THẬT, không tự đặt role mới
  visibility text check ('visible','locked','hidden')
```

**Bắt buộc**: `member_role` phải dùng đúng `public.member_role` (`owner/admin/designer/partner/teacher/student`). Đây chính là lỗi đã lặp lại 3 lần liên tiếp ở các module nguồn trước (bịa ra role `academic_ops` không tồn tại) — checklist ở mục 5 nhắc lại điều này.

### Bước 2 — Resolver, không đổi giao diện

Viết `resolveStudentNavigation(context)` trả về **đúng shape** mà `compact-navigation.ts` đang trả (cùng type, cùng cấu trúc HOME/LEARN/CREATE/BUSINESS). Dữ liệu mặc định (seed) khi tổ chức chưa cấu hình gì = **chép y nguyên** cấu trúc hiện tại từ `compact-navigation.ts` vào bảng — để chuyển nguồn dữ liệu không làm đổi bất kỳ pixel nào nếu admin chưa sửa gì.

### Bước 3 — Cutover có cờ tính năng

Repo đã có sẵn cơ chế feature flag (`NEXT_PUBLIC_STUDENT_EXPERIENCE_V2` trong `.env.example`) — dùng đúng mẫu này, thêm cờ riêng (ví dụ `NEXT_PUBLIC_STUDENT_NAV_CMS`) để bật resolver theo tổ chức, giữ `compact-navigation.ts` làm nguồn dự phòng khi chưa bật cờ hoặc khi resolver lỗi (fail an toàn về sidebar cũ, không phải màn hình trắng).

### Bước 4 — Gỡ code cứng

Chỉ xoá `compact-navigation.ts` sau khi resolver chạy ổn định trên production một thời gian và có xác nhận thật (không phải "chắc là ổn").

### Về hệ versioning (draft/publish/rollback)

Đề xuất gốc của module 20 có 3 bảng versioning riêng (`student_experience_versions/settings/publish_logs`). **Bạn chưa yêu cầu rõ điều này ở lần chọn vừa rồi.** Khuyến nghị: **không làm ở v1** — sửa trực tiếp + xem trước (preview) trong admin là đủ cho một CMS mới. Thêm versioning sau, khi có bằng chứng cần rollback thật (tránh lặp lại sai lầm "thiết kế theo nhu cầu giả định" đã bị audit ở chính module 20). Nếu ChatGPT tự thêm 3 bảng này, cân nhắc bỏ khi tích hợp trừ khi bạn xác nhận cần.

---

## 4. Thứ tự triển khai đề xuất

1. **Đổi nhãn `/academy-admin/programs` thành "Khóa học video"** (mục 0.1) — làm trước tiên, 1 dòng, tránh nhầm lẫn khi các bước dưới đang code song song.
2. **`content_items` + di trú metadata** (mục 1, không gồm `academy_courses`) — additive, rủi ro thấp, có ích ngay cho màn hình chọn tài nguyên.
3. **Thay `career_stage_programs` bằng `academy_stage_nodes`** (Phụ lục A.1, gồm cả cấp "group" thứ 3) — additive nhưng cần bước copy dữ liệu + rà lại 4 file dùng `program_id`, làm khi chưa có dữ liệu admin thật trong `career_stage_programs`.
4. **`career_stage_resources` thêm 3 cột `node_id`/`surface`/`is_featured`** (Phụ lục A.2) — additive, rủi ro thấp.
5. **Student Experience Builder: `academy_stage_ui_config` + resolver, sau cờ tính năng, mặc định tắt** (Phụ lục A.3) — rủi ro trung bình, cần kiểm chứng kỹ trước khi bật mặc định và trước khi gỡ `compact-navigation.ts`.

---

## 5. Checklist bắt buộc khi nhận code từ ChatGPT

Đây là các lỗi đã lặp lại ở module 18, 19, và bản gốc của module 20. **Danh sách đầy đủ, đã gộp với phát hiện ở Phụ lục A, nằm ở mục 6** (viết sau khi audit xong module `H2OBOOK_ACADEMY_CONTROL_CENTER_V1`) — dùng bản đó, không dùng bản rút gọn này.

---

## 6. Quyết định đã chốt (không còn mục nào mở)

- Nhãn `/academy-admin/programs` → **"Khóa học video"**.
- `academy_courses` **giữ tách biệt hoàn toàn** khỏi `content_items` — không hợp nhất. Đã cập nhật vào mục 1.

Tài liệu này đã đủ để đưa cho ChatGPT brief: đọc mục 0 (bối cảnh + 2 mô hình song song), Phụ lục A (thiết kế phân cấp + Student Experience Builder cuối cùng, thay cho mục 2–3), mục 1 (content_items, đã chốt phạm vi), mục 4 (thứ tự triển khai) và mục 5 + A.5 (checklist bắt buộc, gộp lại thành một danh sách duy nhất bên dưới).

### Checklist tổng hợp cuối cùng (gộp mục 5 + A.5)

- [ ] Không có bảng nào tên `media_assets` — asset thật là `public.assets`.
- [ ] Không có bảng `workspace_members` — dùng `public.organization_members`.
- [ ] Không có role nào ngoài `owner/admin/designer/partner/teacher/student` (enum `public.member_role`).
- [ ] Không tự viết hàm xác thực riêng — dùng `public.has_org_role()` / `public.is_org_member()` đã có; mọi `array['owner','admin']` truyền vào phải có `::public.member_role[]`.
- [ ] Mọi `create policy` / `create trigger` có `drop ... if exists` ngay trước.
- [ ] Đánh số migration tiếp theo là **0041** (0040 đã dùng cho `career_stage_programs`, deploy 2026-08-07).
- [ ] Phân cấp Program/Module/Group dùng **1 bảng generic `academy_stage_nodes`** (Phụ lục A.1), thay thế `career_stage_programs` — kèm bước copy dữ liệu + grep `programId`/`program_id` trước khi drop cột/bảng cũ.
- [ ] `career_stage_resources` chỉ thêm 3 cột thật sự mới: `node_id`, `surface`, `is_featured` (Phụ lục A.2) — **không** thêm `visibility_state`/`unlock_rule`/`student_label`/`sort_order` vì đã trùng `access`+`unlock_mode`+`prerequisite_binding_id`+`required_progress`+`unlock_at`/`title_override`/`position`.
- [ ] Trạng thái hiển thị (hidden/locked/open) học viên nhìn thấy phải **derive** từ `lib/content-access/resolver.ts` tại thời điểm đọc, không lưu cột riêng.
- [ ] `content_items`: không sao chép nội dung lớn (chỉ metadata hiển thị), không đổi cách `career_stage_resources` trỏ tài nguyên, **không** gồm `academy_courses`.
- [ ] Student Experience Builder dùng `academy_stage_ui_config` (Phụ lục A.3) — 1 bảng, `version`+`status`, không dựng hệ 3-bảng versioning. Seed mặc định = sao y `compact-navigation.ts`. Có cờ tính năng + fallback về sidebar cũ khi lỗi.
- [ ] `/academy-admin/programs` đổi nhãn thành "Khóa học video" — không đổi route, không đổi bảng.
- [ ] Mọi bảng mới có `organization_id` + RLS bật + policy đọc/ghi tách bạch owner/admin khỏi học viên.

---

## Phụ lục A — Audit `v5/H2OBOOK_ACADEMY_CONTROL_CENTER_V1` và thiết kế cuối cùng

Module này gồm: `README.md`, `CLAUDE_INTEGRATION_PROMPT.md` (brief cho AI đọc trước khi code), migration `0040_academy_control_center_v1.sql`, `lib/academy-control/{types,repository,student-resolver}.ts`, và các trang admin dạng khung (`content`, `experience`, `distribution`, `stages` — mỗi file 1–3 dòng, chưa có logic thật). Đây là dạng **spec để adapt**, không phải code chạy thẳng — đúng như `CLAUDE_INTEGRATION_PROMPT.md` tự ghi: "Không chạy mù, audit schema thật trước".

### A.1. Phân cấp Program → Module → Group

Migration gốc:
```sql
create table public.academy_stage_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  stage_id uuid not null references public.career_stages(id) on delete cascade,
  parent_id uuid references public.academy_stage_nodes(id) on delete cascade,
  node_type text not null check (node_type in ('program','module','group')),
  name text not null, slug text not null, description text,
  sort_order integer not null default 0, is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  ...
  unique(stage_id,parent_id,slug)
);
```

Đây là **1 bảng generic tự tham chiếu cho cả 3 cấp**, đơn giản hơn phương án 2-bảng (`career_stage_programs` + `career_stage_resource_groups`) tôi vẽ ở mục 2. `career_stage_programs` mới deploy hôm nay (migration 0040 thật trong repo) và gần như chắc chắn **chưa có dữ liệu admin nào nhập vào** — nên đây là thời điểm rẻ nhất để đổi, không phải data migration rủi ro.

**Khuyến nghị**: brief ChatGPT tạo migration mới (đánh số **0041**, không phải 0040 — trùng số với migration thật) làm 3 việc:
1. Tạo `academy_stage_nodes` (giữ nguyên thiết kế gốc, chỉ sửa `has_org_role` cast — xem A.4).
2. Copy dữ liệu từ `career_stage_programs` sang `academy_stage_nodes`: hàng có `parent_id is null` → `node_type='program'`, hàng có `parent_id` → `node_type='module'`.
3. Thêm cột `career_stage_resources.node_id` (thay cho `program_id`), copy dữ liệu từ `program_id` sang, sau đó `career_stage_resources.program_id` có thể giữ lại tạm thời (deprecated, không đọc nữa) hoặc drop nếu bạn xác nhận không còn nơi nào đọc — kiểm bằng cách grep `programId`/`program_id` trong repo trước khi drop thật.

Bảng `career_stage_resource_groups` ở mục 2 của tài liệu này **không cần làm nữa** nếu theo hướng A.1 — `node_type='group'` trong `academy_stage_nodes` đã thay thế.

### A.2. Cột trùng lặp trên `career_stage_resources` — phải sửa trước khi chạy

Migration gốc mở rộng `career_stage_resources` bằng 7 cột. Đối chiếu với cột **đã có thật** từ migration 0033/0034/0036/0040:

| Cột module đề xuất | Cột thật đã có | Xử lý |
|---|---|---|
| `visibility_state` (hidden/locked/open) + `unlock_rule jsonb` (`{minStage, membership, requiresResource}`) | `access` (free_preview/stage_locked/entitlement_only) + `unlock_mode` (immediate/stage_active/**after_resource**/**progress_gte**/date/manual) + `prerequisite_binding_id` + `required_progress` + `unlock_at`, giải quyết bởi `lib/content-access/resolver.ts` | **Bỏ hẳn 2 cột này.** Trạng thái hidden/locked/open học viên nhìn thấy phải **tính ra (derive) tại thời điểm đọc** từ kết quả resolver thật (grant/deny/expired/locked), không lưu thành cột riêng dễ lệch dữ liệu. `student-resolver.ts` gốc (hàm `resolveVisibility`) viết lại đúng một phần logic resolver đã có — không dùng bản này, gọi thẳng `resolveResourceAccess` đã có. |
| `student_label` | `title_override` | Bỏ `student_label`, dùng `title_override` |
| `sort_order` | `position` | Bỏ `sort_order`, dùng `position` |
| `node_id` | *(mới, hợp lệ)* | Giữ — trỏ tới `academy_stage_nodes.id` theo A.1 |
| `surface` (learn/create/business/coaching) | *(mới, hợp lệ — không trùng `display_locations` là library/journey/smart_home, khác trục)* | Giữ nguyên |
| `is_featured` | *(mới, hợp lệ)* | Giữ nguyên nếu cần nổi bật 1 tài liệu trong danh sách |

Sau khi sửa, phần mở rộng bảng chỉ còn 3 cột thật sự mới: `node_id`, `surface`, `is_featured` — đúng tinh thần additive, không cõng thêm hệ mở khóa song song.

### A.3. Student Experience Builder — dùng `academy_stage_ui_config` gốc, không cần đổi

```sql
create table public.academy_stage_ui_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  stage_id uuid not null references public.career_stages(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  config jsonb not null default '{"sections":[...]}'::jsonb,
  published_at timestamptz, ...
);
create unique index uq_academy_stage_ui_config_active on academy_stage_ui_config(stage_id)
  where status in ('draft','published');
```

Thiết kế này **tốt hơn** 2 bảng normalize (`student_navigation_items`/`student_navigation_visibility_rules`) tôi vẽ ở mục 3 — 1 dòng/version/stage, `config` chứa toàn bộ cây `sections[].items[]` (key/label/href/icon/visibility/requiredStage/children). Có sẵn draft/published qua `status`, không cần dựng cả hệ 3-bảng version/publish/rollback như module 20 gốc. **Khuyến nghị dùng nguyên bản**, chỉ thêm:
- Seed mặc định khi tạo stage mới = chép y nguyên cấu trúc HOME/LEARN/CREATE/BUSINESS hiện tại từ `compact-navigation.ts` (đúng nguyên tắc "không đổi hành vi khi chưa cấu hình" đã nêu ở mục 3).
- Resolver đọc `status='published'` mới nhất; nếu không có dòng nào → fallback `compact-navigation.ts` — không phải màn hình trắng.
- `requiredStage` trong `StudentNavItem` nên đối chiếu bằng `career_stages.position` thật (đã có), không phải số tự nhập tay dễ lệch khi thứ tự giai đoạn đổi.

### A.4. Lỗi cú pháp cần sửa trước khi chạy

```sql
-- Bản gốc — SẼ LỖI vì array['owner','admin'] là text[], hàm cần public.member_role[]:
using (public.has_org_role(organization_id,array['owner','admin']))

-- Phải sửa thành:
using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
```
Áp dụng cho cả 2 policy trong migration gốc. Phần `drop policy/trigger if exists` của module này **đã làm đúng sẵn** — không cần sửa gì thêm ở đó.

### A.5. Tổng kết

Toàn bộ phát hiện ở Phụ lục A đã gộp vào **checklist tổng hợp cuối cùng ở mục 6** — dùng bản đó khi brief ChatGPT, không cần tra lại từng phần trong Phụ lục A.
