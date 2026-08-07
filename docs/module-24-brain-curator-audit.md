# Module 24 — H2O Brain Curator V1 · Báo cáo audit

Ngày: 2026-08-07 · Nguồn: `v5/24-H2OBOOK_H2O_BRAIN_CURATOR_V1`

## 1. Module này đề xuất gì

Một lớp AI nội bộ chỉ dành cho Admin/Owner: nhận tài liệu từ kho `assets` → AI phân tích nội dung → đề xuất giai đoạn + vị trí (Learn/Create/Business/Coaching) + metadata + phát hiện trùng → **Admin duyệt** → ghi vào `career_stage_resources`.

**6 bảng mới**: `brain_provider_settings`, `brain_inbox_items`, `brain_runs`, `brain_suggestions`, `brain_rules`, `brain_memory_signals`.

## 2. Điểm tốt — module này kỷ luật hơn hẳn phần lớn module trước

- Tự cấm đúng những bảng đã từng bị tạo nhầm: `media_assets`, `brain_assets`, `resource_registry_v2`, `career_stage_resources_v2`, `brain_audit_logs`.
- Ghi kết quả vào `career_stage_resources` thật, dùng `domain_events` thật, `entitlements` thật.
- **Không auto-apply**: AI chỉ tạo `brain_suggestions`, chỉ hành động `approve` mới ghi vào lộ trình học viên. Đây là thiết kế đúng.
- Secret không trả về browser.
- **Không có bảng nào trùng lặp với hệ đã có** — khác hẳn module 19/20/21/22/23. Về mặt schema, đây là module sạch nhất từ đầu phiên.

## 3. Lỗi phải sửa trước khi chạy

| Lỗi | Chi tiết |
|---|---|
| **Số migration trùng** | File đánh số `0040`, trong khi `0040_h2obook_career_stage_programs.sql` đã deploy. Phải đổi thành **0044**. |
| **Thiếu ép kiểu enum** | Cả 12 policy dùng `array['owner']` / `array['owner','admin']` **thiếu `::public.member_role[]`** → lỗi ngay khi chạy. Đây là **lần thứ 3 liên tiếp** gặp đúng lỗi này (module 21, 22, nay 24). |
| **`getBrainRepoAdapter()` ném lỗi** | Là `ADAPT_ME` — toàn bộ module không chạy cho tới khi nối vào auth/Supabase thật. |
| **Trang UI là ảnh tĩnh** | 3 trang đều hardcode `—`, không gọi API nào, không dùng `SimpleOperationsShell` của repo, dùng `<a>` thay `<Link>`, nằm ở `src/app/` trong khi repo dùng `app/`. Phải viết lại toàn bộ. |

## 4. 🔴 Hai phát hiện chặn đường — phần AI **không thể chạy** như hiện trạng

### 4.1. Không có provider AI nào được cài đặt

`provider-gateway.ts` chỉ có một `registry` **rỗng**:

```ts
const registry = new Map<BrainProviderName, Factory>();
export function getBrainProvider(name) {
  const factory = registry.get(name);
  if (!factory) throw new Error(`Brain provider '${name}' is not registered...`);
}
```

Không có file nào gọi `registerBrainProvider`. Nghĩa là `runBrainProvider()` **luôn ném lỗi**. Module giao kiến trúc, không giao phần chạy được. Muốn AI hoạt động, phải tự viết provider (gọi Gemini/OpenAI/Anthropic) — không có trong gói.

### 4.2. Không có nội dung để AI đọc

Adapter yêu cầu `asset.extractedText`. **Bảng `assets` không có cột này** — và cũng không có cột nào tương đương. Cột thật của `assets` sau migration 0037: `original_name`, `title`, `description`, `mime_type`, `asset_subtype`, `page_count`, `duration_seconds`, `language_code`…

Văn bản trích xuất từ tài liệu **không nằm ở `assets`** — nó nằm ở `content_nodes.text_content` (jsonb), gắn với `book_documents`, tức là chỉ có với tài liệu đã đi qua luồng Input/nhập sách, không phải mọi asset trong kho.

**Hệ quả**: AI "phân tích nội dung tài liệu" thực ra chỉ nhìn thấy **tên file + tiêu đề + mô tả + loại MIME**. Một file `IMG_4821.jpg` hoặc `giao-trinh.pdf` chưa đặt tên tử tế thì AI không có gì để đọc. Khoảng cách giữa lời hứa của module và dữ liệu thật là rất lớn, và **không sửa được bằng cách viết thêm code trong module này** — cần một bước trích xuất nội dung riêng.

## 5. Xung đột với nguyên tắc số 1 của dự án

`CLAUDE.md` mở đầu bằng:

> **No-AI-first:** … **Never make an AI provider a required dependency.** … AI is optional assistance only.
> Do not use AI to reconstruct layout unless the user explicitly enables it; **deterministic reconstruction must exist first**.

Đối chiếu hiện trạng: **repo hiện không có bất kỳ tích hợp AI nào** — grep toàn bộ `lib/` và `app/` không có OpenAI/Anthropic/Gemini. Module này sẽ là lần đầu tiên đưa nhà cung cấp AI vào hệ thống.

Điều đó **không bị cấm** (AI được phép, miễn là tùy chọn), nhưng nó có nghĩa: thêm phụ thuộc ngoài, thêm chi phí theo lượt gọi, thêm chỗ lưu khóa bí mật, thêm một kiểu hỏng mới.

## 6. Cách repo đang lưu khóa bí mật của bên thứ ba

Module đề xuất lưu **API key mã hóa AES-GCM trong database** (`brain_provider_settings.secret_ciphertext`), khóa chính nằm ở `H2O_BRAIN_MASTER_KEY`.

Đối chiếu: **toàn bộ repo hiện lưu khóa bên thứ ba trong biến môi trường, không có khóa nào nằm trong Postgres**:
- `lib/email/provider.ts` → `EMAIL_API_KEY`
- `lib/payments/provider.ts` → `PAYMENT_WEBHOOK_SECRET`

Và **cả hai đều có chế độ mặc định chạy được mà không cần dịch vụ ngoài** (`console` cho email, `manual` cho thanh toán) — đúng tinh thần "deterministic path phải có trước".

Module cũng hỗ trợ chế độ `env_ref` (chỉ lưu *tên* biến môi trường) — chế độ này khớp với nếp nhà. Chế độ lưu-mã-hóa-trong-DB thì không: bản dump database sẽ chứa ciphertext, và thêm gánh nặng xoay khóa. **Khuyến nghị: chỉ dùng `env_ref`, bỏ hẳn 4 cột `secret_ciphertext/iv/tag` + `crypto.ts`.**

## 7. Phần có giá trị thật, tách khỏi phần AI

Bỏ hết phần AI ra, thứ còn lại vẫn **rất có giá trị và chạy được ngay hôm nay**:

> **Một hàng đợi duyệt giữa Kho tài sản và Lộ trình học viên.**
> Đưa tài sản vào hàng đợi → có đề xuất vị trí (giai đoạn/chương trình/khu vực) → Admin xem, sửa, duyệt hoặc từ chối → ghi vào `career_stage_resources` → ghi `domain_events`.

Đề xuất đó **không nhất thiết phải đến từ AI**. Nó có thể đến từ:
- **Luật xác định** (`brain_rules`, Owner tự cấu hình): "file PDF có chữ 'makeup' trong tên → đề xuất Giai đoạn 1, khu vực Learn". Chạy ngay, miễn phí, giải thích được, không cần khóa API.
- **Lịch sử quyết định** (`brain_memory_signals`): "5 lần trước Admin đều xếp loại này vào Giai đoạn 2".
- **AI** — về sau, khi có provider thật và có nội dung thật để đọc.

Tức là kiến trúc của module đã đúng: `suggestion` là một khái niệm độc lập với *nguồn* sinh ra nó. Chỉ là gói này giả định nguồn duy nhất là AI, trong khi nguồn AI lại là nguồn **chưa dùng được**.

## 8. Đề xuất

Đây là **quyết định phạm vi sản phẩm liên quan tới tiền và khóa API của bạn**, nên tôi dừng lại hỏi thay vì tự quyết.

- **(A)** Xây hàng đợi duyệt + luật xác định trước, chừa sẵn chỗ cắm AI. Chạy được ngay, không cần khóa API, không phát sinh chi phí. **(Khuyến nghị)**
- **(B)** Làm luôn cả AI: tôi viết thêm provider thật, bạn cung cấp khóa API và chấp nhận chi phí theo lượt gọi — nhưng vẫn vướng mục 4.2 (AI chỉ đọc được tên file, chưa có nội dung).
- **(C)** Làm cả AI **và** bổ sung bước trích xuất nội dung tài liệu vào `assets` để AI có cái mà đọc. Đầy đủ nhất, cũng lớn nhất.
- **(D)** Chưa làm gì — giữ nguyên hiện trạng.
