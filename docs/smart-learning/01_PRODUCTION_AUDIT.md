# Smart Roadmap + Universal Mission OS — Production Audit

Ngày: 2026-08-10
Theo yêu cầu §1 gói nguồn — audit trước, không tạo migration trước khi audit xong.

## Quy mô thật của gói nguồn — cần nói rõ trước khi bắt đầu

Gói nguồn tự định nghĩa lộ trình 4 đợt (§20):
- Release 1: repo adapters, block definition/value model, Admin Mission Workspace Builder (Draft).
- Release 2: Smart Roadmap nâng cấp, route `/student/missions/[missionId]`, Universal Mission Workspace, readiness/progress.
- Release 3: Evidence/Result tích hợp đầy đủ, Result Card.
- Release 4: H2O Journey AI, H2O Mission AI, forecast/adaptive suggestion.

Đây là gói lớn nhất trong toàn bộ các đợt tích hợp tới giờ (27 loại block, AI 2 vai trò, route học viên mới, engine readiness). Theo đúng khuyến nghị chính gói nguồn đưa ra ("không big-bang"), lượt này **chỉ làm Release 1** — nền dữ liệu + màn hình Admin cấu hình block ở trạng thái Draft. Release 2–4 cần bạn xác nhận riêng vì khối lượng lớn và đụng tới trải nghiệm học viên trực tiếp.

## Bảng audit

| Component | Nguồn thật hiện có | Reuse/Extend/New |
|---|---|---|
| Journey Blueprint/Version/Outcome/Milestone/Mission | `learning_journey_*` (migration 0050) | ✅ Reuse nguyên vẹn |
| Mission resource/tool/assignment binding | `learning_mission_*_bindings` (0050) | ✅ Reuse — block loại `resource` sẽ trỏ tới binding id có sẵn, không tạo lại |
| Student mission state | `student_mission_states` (0050+0051) | ✅ Reuse |
| Actions | `student_learning_actions` (0050) | ✅ Reuse |
| Evidence/Result | `student_mission_states.evidence`/`verified_by` (0051) | ✅ Reuse — Tab Evidence/Kết quả của Workspace sẽ ghi vào đúng cột này, không tạo evidence engine thứ hai |
| Assignments/rubric | `assignment_definitions`, `rubric_criteria`, `brain_assignment_submissions.criterion_scores` (0026, 0036) | ✅ Reuse khi Mission cần assignment thật — nhưng **rỗng trong tổ chức này** (đã xác nhận nhiều lần ở các đợt trước), block `assignment` sẽ không có gì để bind |
| **"Generic block/form builder" — điểm audit quan trọng nhất** | `learning_blocks` + `learning_sections` (migration 0026) | ⚠️ **Gần giống nhưng KHÔNG tương đương — xem giải thích bên dưới** |
| domain_events | `capture_domain_event()` trigger có sẵn trên mọi bảng Journey | ✅ Reuse |
| Entitlement/access resolver | `lib/content-access/facts.ts`, `lib/student/stage-access.ts` | ✅ Reuse, không đụng |
| H2O Brain/AI Provider Gateway | `lib/brain/providers/gemini.ts` | Có sẵn cho Release 4, không dùng ở Release 1 |
| Queue/cron/daily snapshot | Không tồn tại (đã xác nhận ở audit Release B trước) | Vẫn không tồn tại — không cần cho Release 1 |

## Vì sao không tái sử dụng `learning_blocks`

`learning_blocks` (migration 0026) là hệ thống block thật, đã có `block_type` enum phong phú (`mission_brief, checklist, assignment, tool_embed, result, before_after`...), `payload jsonb`, `position`, `required` — **rất gần** với "Mission Block Engine" gói nguồn muốn. Đã cân nhắc kỹ trước khi quyết định không dùng lại, vì 2 lý do thật:

1. **Cha khác domain.** `learning_blocks` thuộc về `learning_sections → knowledge_space_versions → knowledge_spaces` — Knowledge Space là nội dung đọc/học (Tab 2 "Học & ghi nhớ"), có version riêng của chính nó. Mission Workspace cần gắn vào `journey_version_id` + `mission_id` (version của Journey, không phải version của Knowledge Space). Ép Mission dùng `knowledge_spaces` làm cha nghĩa là mỗi Mission phải giả vờ là 1 Knowledge Space — vi phạm đúng nguyên tắc "hai graph không được trộn" mà toàn bộ các đợt trước (Release A/B, Journey V2) đã giữ nghiêm ngặt.
2. **27 loại block gói nguồn muốn không khớp hết `learning_block_type` hiện có** — thiếu `kpi, action_plan, kanban, calculator, ai_question, ai_analysis, multi_select, number, select`... Muốn dùng chung phải mở rộng enum của hệ thống Knowledge Space cho một mục đích khác hẳn — rủi ro làm rối nghĩa cột `block_type` cho cả 2 hệ thống.

**Quyết định:** tạo 2 bảng mới, nhỏ, đúng như file SQL tham khảo của gói nguồn gợi ý — nhưng **dùng chung từ vựng tên loại block** với `learning_block_type` ở những chỗ trùng khái niệm thật (`checklist`, `assignment`, `result`...) để không tạo ra 2 cách gọi khác nhau cho cùng 1 ý niệm trong toàn bộ database.

## Kết luận migration

Cần đúng 2 bảng mới, additive, không đụng bảng nào đang chạy:
- `learning_mission_workspace_configs` — cấu hình block/mission/version (Admin viết, chỉ khi version draft).
- `student_mission_workspace_values` — giá trị học viên nhập (mỗi học viên tự ghi của mình).
