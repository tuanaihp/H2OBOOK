# Module 25 — ThuyH2O Six-Stage Production Seed · Báo cáo audit

Ngày: 2026-08-08 · Nguồn: `v5/25-H2OBOOK_SIX_STAGE_PRODUCTION_SEED_V1`

## 1. Gói này chứa gì — đối chiếu với tuyên bố của README

README nói: 6 stages · 27 programs · 42 modules · 42 groups · **80 resource blueprints có nội dung Markdown** · 22 assignments.

Đếm thực tế trong `data/h2o-six-stage-curriculum.json`: **khớp chính xác** 6 / 27 / 42 / 42 / 80 / 22. Cấu trúc là thật và đầy đủ.

## 2. 🔴 Nội dung 80 tài liệu là KHUNG MẪU, không phải bài học hoàn chỉnh

Đây là phát hiện quan trọng nhất, và nó ngược với kỳ vọng "dữ liệu đào tạo đầy đủ cho học viên thực hành thật".

Đo trên cả 80 tài liệu:

| Chỉ số | Giá trị |
|---|---|
| Độ dài body ngắn nhất / trung vị / dài nhất | 333 / 362 / 390 ký tự |
| Số biến thể **khác nhau** của phần thân sau mục "## Mục tiêu" | **1 / 80** |

Nghĩa là **cả 80 tài liệu dùng chung y hệt một đoạn mẫu**:

```
## Học viên cần làm
- Học/xem nội dung.
- Ghi 3 ý áp dụng trực tiếp.
- Hoàn thành thực hành/checklist liên quan.
- Lưu bằng chứng vào hồ sơ H2OBOOK.

## Tiêu chuẩn hoàn thành
Có thể giải thích lại và áp dụng vào bài tập hoặc tình huống nghề thực tế.
```

Phần **thực sự riêng** của mỗi tài liệu chỉ gồm: **tiêu đề** + **một câu mục tiêu**. Ví dụ:

- *Tiêu chuẩn vệ sinh và an toàn trong Makeup* → "Vệ sinh cọ, mỹ phẩm, tay, dụng cụ và quy trình làm việc an toàn."
- *Checklist túi đồ nghề Foundation* → "Danh sách dụng cụ tối thiểu và cách kiểm tra trước buổi học/lịch khách."

**Kết luận**: đây là **bộ khung giáo trình** (tiêu đề + mục tiêu cho 80 đầu mục, sắp xếp đúng 6 giai đoạn) — rất có giá trị làm dàn ý. Nhưng **không phải nội dung giảng dạy**. Học viên mở ra sẽ thấy 6 dòng hướng dẫn chung giống hệt nhau ở mọi tài liệu.

## 3. 🔴 22 bài tập chỉ có tiêu đề

Mỗi assignment trong manifest chỉ có 4 trường: `key`, `title`, `type`, `required`.

`CLAUDE_FINAL_PROMPT.md` yêu cầu "Bài tập: dữ liệu thật; title/type/required/**rubric/submission/pass criteria**/node link" — nhưng manifest **không có** rubric, đề bài, hay tiêu chí đạt.

Thêm nữa, bảng bài tập thật `assignment_definitions` có `knowledge_space_id` **NOT NULL** → mà `knowledge_spaces.content_item_id` lại NOT NULL trỏ tới `academy_course_lessons`. Muốn tạo 22 bài tập "đúng chuẩn" sẽ phải bịa ra 22 khóa học + 22 module + 22 bài giảng giả chỉ để thỏa khóa ngoại, **cộng với** bịa toàn bộ rubric và tiêu chí chấm.

**Quyết định**: seed 22 bài tập dưới dạng tài liệu (`doc_type='assignment'`) trong một chương trình "Bài tập & đánh giá" của mỗi giai đoạn, ghi rõ trong nội dung là *"Chưa có đề bài — cần biên soạn"*. **Không bịa** rubric/điểm đạt, và **không** nối vào máy chấm bài.

## 4. 🔴 12 loại tài nguyên nhưng schema chỉ cho phép 8

Manifest dùng: `article, checklist, rubric, practice, worksheet, template, assessment, case_study, sop, script, tool_guide, playbook`.

`career_stage_resources.resource_type` chỉ nhận: `book, course, publication, template, knowledge_space, roadmap, link, asset`.

**Chỉ `template` trùng — 11/12 loại sẽ vi phạm ràng buộc CHECK và insert thất bại ngay.**

**Cách xử lý**: 12 loại đó không phải 12 nơi lưu trữ, mà là 12 **kiểu văn bản**. `resource_type` trả lời "dữ liệu nằm ở bảng nào", nên cả 12 quy về một giá trị mới `'document'`; còn phân biệt SOP với checklist nằm ở `curriculum_documents.doc_type` — đúng chỗ của nó.

## 5. 🔴 Không có bảng nào chứa văn bản Markdown

Mỗi tài liệu có `bodyMarkdown`, nhưng đã rà toàn bộ schema: **không bảng nào lưu một văn bản Markdown độc lập**.

- `books` → cần thêm `book_documents` + `content_nodes`; 80 tài liệu ngắn thành 80 "cuốn sách" là sai ngữ nghĩa.
- `knowledge_spaces` → `content_item_id` NOT NULL trỏ `academy_course_lessons`, tức 80 bài giảng giả.
- `assets` → lưu file trong object storage, không có cột nội dung.

Đây là **khoảng trống thật, không phải trùng lặp** — khác hẳn `media_assets` (module 19) hay `career_stage_resources_v2` từng bị từ chối. Nên migration 0045 tạo bảng `curriculum_documents`.

## 6. Hiện trạng database trước khi nạp (đã kiểm chứng trực tiếp)

Organization `4cdbbcbf…` (*Nguyen Van Tuan*):

| Bảng | Số bản ghi |
|---|---|
| career_stages | 2 — **đều là dữ liệu test** (`Giai ddoanj test cho makeup`, `Giai đoạn`) ở vị trí 0 và 1 |
| academy_stage_nodes | 0 |
| career_stage_resources | 3 |
| content_items | 2 |
| books | 2 |
| assets | 0 |

**Seed không xóa gì.** 6 giai đoạn mới được thêm vào **sau** vị trí lớn nhất đang có, để không tranh chỗ với 2 giai đoạn test. `index_label` vẫn hiển thị 01–06 đúng như manifest. Sau khi rà soát, bạn có thể tự lưu trữ 2 giai đoạn test bằng nút thùng rác rồi dùng mũi tên đưa 6 giai đoạn thật lên đầu.

## 7. Đúng luồng: cấu hình admin → rồi mới ra học viên

Seed ghi vào đúng các bảng mà Admin Panel đang quản lý:

```
career_stages  →  academy_stage_nodes (program → module → group)  →  career_stage_resources
                                                                          ↓ resource_id
                                                                   curriculum_documents
                                                                          ↓ catalog
                                                                     content_items
```

**Không có dòng nào được ghi thẳng vào giao diện học viên.** Học viên nhìn thấy giáo trình vì bộ giải quyết quyền hiện tại đọc đúng những dòng `career_stage_resources` mà Stage Workspace đang sửa. Sửa ở admin → học viên thấy đổi theo.

## 8. Trạng thái sau khi nạp: hiển thị + mở khóa (theo yêu cầu)

Mọi bản ghi được nạp ở trạng thái:

- `career_stages.status = 'active'` — hiện trong danh sách
- `career_stage_resources.status = 'active'`, `access = 'free_preview'`, `unlock_mode = 'immediate'` — mở hoàn toàn
- `surface` để trống ở cấp tài liệu, **kế thừa** từ chương trình (migration 0043)

⚠️ **`free_preview` nghĩa là mở cho cả người chưa đăng nhập**, không chỉ học viên đã ghi danh. Bạn đã nói sẽ khóa lại sau khi rà soát — khi cần siết, chạy trong SQL Editor:

```sql
update public.career_stage_resources
set access = 'stage_locked'
where organization_id = '4cdbbcbf-d6e1-4d06-bb87-4f63c9cac01f'
  and resource_type = 'document';
```

## 9. Chạy lại nhiều lần không nhân bản

Mọi bản ghi đều khóa theo `seed_key` ổn định từ manifest, và luôn là **insert-if-missing**:

- `career_stages` / `academy_stage_nodes` → cột `seed_key` mới + chỉ mục duy nhất **một phần** (`where seed_key is not null`), nên giai đoạn/mục do bạn tự tạo không bị ảnh hưởng.
- `curriculum_documents` → `unique(organization_id, seed_key)`
- `content_items` → `unique(organization_id, source_table, source_id)` đã có sẵn
- `career_stage_resources` → `unique(stage_id, resource_type, resource_id)` đã có sẵn

**Không bao giờ ghi đè bản ghi đã tồn tại** — nếu bạn đổi tên một chương trình rồi chạy lại seed, tên bạn sửa được giữ nguyên.

## 10. Phần KHÔNG làm trong lượt này

- **Stage gates** (`gate.minimumProgress`, `requiredAssignments`): bạn yêu cầu mọi thứ mở khóa để rà soát, nên cổng chặn tiến độ sẽ mâu thuẫn. Chưa áp dụng.
- **`studentExperience` defaults**: ghi vào `academy_stage_ui_config` được, nhưng bảng đó **chưa nối vào sidebar học viên thật** (đã nêu ở lượt module 22). Seed vào sẽ tạo cấu hình không ai đọc.
- **Máy chấm bài** (`assignment_definitions`): xem mục 3.
