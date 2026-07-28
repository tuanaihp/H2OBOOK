# Kiến trúc H2OBOOK Professional Editor 4.12

## 1. Hai không gian chỉnh sửa

### Compose Mode

Dùng Tiptap/ProseMirror để quản lý nội dung semantic:

```text
BookDocument
→ Chapter / Section
→ Heading / Paragraph / List / Table
→ RichTextSpan + Marks
```

Compose Mode không lưu HTML làm nguồn sự thật. HTML chỉ là giao diện biên tập; dữ liệu được chuyển về `SemanticContentNode[]` trước khi lưu.

### Design Mode

Dùng React Konva/Konva để quản lý bố cục fixed-layout:

```text
Book
→ Pages
→ Positioned Elements
→ Text / Image / Shape / Line / QR
```

## 2. Compose bridge

```text
Semantic nodes
→ semanticNodesToTiptapDoc()
→ ProseMirror transactions
→ tiptapDocToSemanticNodes()
→ local/cloud semantic save
```

Semantic IDs được giữ qua thuộc tính `data-h2o-node-id` để layout, versioning và citations không bị mất liên kết.

## 3. Text Flow

```text
flowSourceText
→ collectTextFlowFrames()
→ fitTextToFrame()
→ flowTextAcrossFrames()
→ applyTextFlow()
→ rendered frame segments
```

Mỗi text element có thể chứa:

- `flowChainId`
- `flowOrder`
- `flowSourceText`
- `flowPadding`
- `flowOverflow`
- `flowMetrics`

Frame đầu giữ nguồn. Các frame sau chỉ giữ segment đã được compositor phân phối.

## 4. Giới hạn hiện tại

Text Flow 4.12 là compositor plain-text thực dụng cho fixed layout. Nó chưa hỗ trợ đầy đủ:

- rich marks chạy xuyên frame;
- hyphenation theo từ điển;
- widow/orphan tự động;
- multi-column balancing;
- footnote placement trong text flow;
- bidirectional text nâng cao;
- shaping chuyên sâu như desktop publishing engine.

Các phần này nên thuộc Editor 4.13+ thay vì che giấu như đã hoàn thiện.
