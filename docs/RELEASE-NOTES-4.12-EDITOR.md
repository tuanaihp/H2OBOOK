# Release Notes — H2OBOOK Professional Editor 4.12

## Mục tiêu

Nâng trực tiếp codebase Professional 4.11 theo ba trụ cột:

1. Compose Engine schema-based.
2. Text Flow Engine nhiều khung và nhiều trang.
3. Editor UI dễ đọc và dễ thao tác hơn.

AI không tham gia và không phải điều kiện vận hành của bất kỳ tính năng nào trong bản này.

## Compose Engine mới

- Thay `contentEditable + document.execCommand` bằng Tiptap/ProseMirror.
- Schema semantic giữ ID ổn định cho chapter, section, heading, paragraph, list, table, image, footnote và citation.
- Hỗ trợ heading 1–3, bold, italic, underline, strike, link, bullet list, numbered list, quote, divider và căn lề.
- TableKit: chèn bảng, thêm hàng/cột, header, gộp/tách và xóa bảng.
- Paste cleanup cho nội dung Word cơ bản.
- Autosave local và cloud save thủ công, hiển thị riêng trạng thái local/cloud.
- Chuyển đổi hai chiều Semantic Content ↔ Tiptap JSON.
- Publishing HTML giữ rich marks, link, table, footnote và citation.

## Text Flow Engine

- Liên kết nhiều text frame thành một flow chain.
- Thứ tự frame ổn định qua `flowOrder`.
- Nội dung gốc chỉ nằm ở frame đầu qua `flowSourceText`.
- Đo độ rộng text bằng Canvas trong trình duyệt; fallback deterministic cho test/worker.
- Tự ngắt dòng theo kích thước, font, line-height, letter-spacing và padding.
- Tự dàn lại khi resize hoặc đổi typography.
- Tạo trang tiếp nối dựa trên khung cuối.
- Hiển thị badge FLOW và cảnh báo tràn trên canvas.
- Preflight kiểm tra overflow, trùng thứ tự và thiếu nguồn.
- Fixed-layout publishing ghi lại flow chain metadata.

## Editor UI

- Topbar 68 px; control chính 40 px.
- Rail 84 px với nhãn 11 px.
- Panel trái 300 px, panel phải 344 px.
- Input/select/textarea tối thiểu 42 px, chữ 13 px.
- Property labels 12 px; toolbar và layer controls lớn hơn.
- Compose paper 19 px, heading rõ ràng, table và footnote có style riêng.
- Responsive breakpoint cho laptop, tablet và mobile.

## Tương thích dữ liệu

- Giữ storage key `h2obook-editor-v2`.
- Persist schema nâng lên version 3 với migrate pass-through.
- Tất cả field Text Flow đều optional, sách cũ vẫn mở bình thường.
- Semantic document cũ được chuyển sang Tiptap JSON khi mở Compose Mode.
