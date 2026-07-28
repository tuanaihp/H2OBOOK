# H2OBOOK V4 Smart Core Architecture

## 1. Nguyên tắc phân tầng

```text
Core Product
- Editor
- Reader
- Template / Brand Clone
- Library / Class / Quiz
- Flashcard / Spaced repetition
- Preflight / Store / Membership

Smart Core Local
- Tóm tắt dựa trên câu và từ khóa
- Tạo outline theo quy tắc
- Tạo câu hỏi tự luyện
- Tạo flashcard
- Accessibility checks
- Learning schedule

Optional Infrastructure
- Supabase / R2 / Redis
- Document workers
- Payment / Email

Optional AI
- External model gateway
- Chỉ được gọi khi owner bật
```

## 2. Không có AI vẫn hoạt động

Các route và thao tác cốt lõi không kiểm tra `AI_GATEWAY_URL`. Smart Tools gọi `lib/local-smart-engine.ts` trước. API AI chỉ dùng khi cấu hình ngoài được bật.

## 3. Offline-first

- Zustand persist giữ dữ liệu V2–V4.
- Service worker cache route lõi.
- Backup V4 chứa sách, lớp học, commerce, learning goals, notes, flashcards và sources.
- Production cloud sync là lớp bổ sung, không phải điều kiện mở ứng dụng.

## 4. Store schema V4

Các collection mới:

- `smartSettings`
- `learningGoals`
- `learningNotes`
- `flashcards`
- `studySessions`
- `knowledgeSources`
- `reusableBlocks`

Persist version được nâng lên 4 và tự migrate dữ liệu V2/V3.

## 5. Database V4

Migration `0006_h2obook_v4_smart_core.sql` thêm:

- `smart_core_settings`
- `learning_goals`
- `learning_notes`
- `flashcards`
- `study_sessions`
- `knowledge_sources`
- `reusable_blocks`
- RPC `review_flashcard`

Tất cả bảng đều bật RLS.
