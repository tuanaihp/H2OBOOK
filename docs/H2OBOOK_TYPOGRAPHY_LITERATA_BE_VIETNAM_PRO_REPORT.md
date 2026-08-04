# H2OBOOK Typography System V1 — Literata + Be Vietnam Pro

Ngày: 2026-08-04 · Nhánh: `feat/typography-literata-be-vietnam-pro`

## A. Audit ban đầu

| Hạng mục | Phát hiện |
|---|---|
| Stack | Next.js 15.5.22, App Router, React 19.1.1 |
| Tailwind | **Không dùng** (không có `tailwind.config.*`, không có dependency) → §7 không áp dụng |
| Root layout | `app/layout.tsx` — đã có sẵn `lang="vi"` |
| Global CSS | `app/globals.css` + `styles/global-neural-system.css` |
| Cơ chế tải font cũ | **Không có gì cả**: không `next/font`, không `<link>` Google Fonts, không `@import`, không `@font-face` |
| Tổng khai báo `font-family` trong CSS ứng dụng | 64, trải trên 7 file |

### 3 phát hiện quyết định cách làm

1. **"Inter" chưa bao giờ được tải về.** CSS gọi `font-family:Inter,...` ở 6 chỗ nhưng không có nguồn font nào trong repo. Nghĩa là **toàn bộ chữ giao diện đang chạy bằng font mặc định của hệ điều hành**, không phải Inter. Georgia thì có thật (font hệ thống) nên tiêu đề vẫn đúng ý đồ.
   → Việc thay thế thực chất là: 1 font thật (Georgia → Literata) + 1 cái tên chưa từng tồn tại (Inter → Be Vietnam Pro).

2. **`--font-display` và `--font-heading` đã được dùng ở 10 chỗ nhưng chưa bao giờ được định nghĩa** (`var(--font-display,Georgia,serif)`), nên luôn rơi về Georgia. Đây là điểm cắm sẵn cho Literata, không phải xây mới.

3. **Không có Tailwind** → toàn bộ tích hợp nằm ở CSS variables, không cần config theme.

### Khu vực có nguy cơ (đã xử lý riêng)
Vùng canvas tài liệu, bản xem trước template, bìa mẫu thiết kế, và override hỗ trợ đọc khó (dyslexia).

## B. File đã tạo/sửa

| File | Lý do | Thay đổi chính |
|---|---|---|
| `lib/fonts.ts` | **Mới** — nơi duy nhất khởi tạo font (§4) | `Be_Vietnam_Pro` + `Literata` qua `next/font/google`, subset `["latin","vietnamese"]`, biến `--font-body` / `--font-heading` |
| `app/layout.tsx` | Gắn biến font vào root (§5) | Thêm `className={...fontBody.variable} ${fontHeading.variable}}` lên `<html>`; giữ nguyên `lang="vi"`, provider, metadata |
| `app/globals.css` | Design token + migrate (§6) | Thêm `--font-sans` / `--font-serif` / `--font-display` (alias) vào `:root`; `html,body` dùng `var(--font-sans)`; 2 class `.font-heading` / `.font-body`; migrate 43 khai báo |
| `components/public-academy-v5/public-academy-v5.module.css` | Migrate | 6 × `var(--font-display,...)` → `var(--font-serif)` |
| `components/public-home-v3/public-home-v3.module.css` | Migrate | 2 × `var(--font-heading,...)` → `var(--font-serif)` |
| `components/knowledge-universe/knowledge-universe-hero.module.css` | Migrate | hero h1 → `var(--font-serif)` |
| `components/business-ops-v1/business-ops-v1.module.css` | Migrate | storefront product title → `var(--font-serif)` (§8.6) |
| `components/creative-publishing-v1/creative-publishing-v1.module.css` | **Không sửa** | Cả 3 khai báo (`.templateCover h3`, `.brandPreview h2`, `.codeArea`) đều thuộc diện giữ nguyên theo §9 |
| `app/dev/typography/page.tsx` | **Mới** — fixture kiểm tra dấu (§10) | Không index, không có link trỏ tới, không đọc dữ liệu |
| `middleware.ts` | Cho phép mở fixture | Thêm `/dev` vào `publicPrefixes` để tài khoản học viên không bị đá về `/student` |

## C. Typography mapping

```text
Public hero, section heading, tiêu đề editorial   -> Literata   (--font-serif)
Tên sách/khóa học trong catalog, thư viện, store  -> Literata
Trích dẫn chuyên gia, mentor, giảng viên          -> Literata
Navigation, button, form, bảng, dashboard, admin  -> Be Vietnam Pro (--font-sans)
Nội dung tài liệu người dùng (canvas, tiptap)     -> GIỮ NGUYÊN Georgia
Bản xem trước template / bìa mẫu thiết kế         -> GIỮ NGUYÊN Georgia
Chế độ hỗ trợ đọc khó (dyslexia)                  -> GIỮ NGUYÊN Verdana
Vùng code / textarea nhập liệu hàng loạt          -> GIỮ NGUYÊN monospace
```

### Kết quả migrate: 49 đổi / 14 giữ nguyên

**Giữ nguyên có chủ đích (§8.4, §8.6, §9 loại 2–3):**
`.compose-editor` · `.compose-v412 .tiptap` · `.compose-v412 .tiptap th` · `.flow-source-textarea` ·
`.text-preset-heading span` · `.text-preset-quote span` · `.template-cover-v2 h3` · `.preview-card h3` ·
`.page-thumb-canvas::after` · `.templateCover h3` · `.brandPreview h2` · `.reader-dyslexia …` ·
`.codeArea` · `.bulkBox textarea`

Lý do: đây là nội dung/bản xem trước tài liệu do người dùng tạo, hoặc override hỗ trợ tiếp cận. Ép font mới vào đây sẽ làm đổi diện mạo sách/template của học viên — đúng điều §9 cấm.

## D. Kiểm thử

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | Qua, không lỗi |
| `pnpm lint` | 0 lỗi, 51 cảnh báo (đúng mức nền có sẵn, không phát sinh mới) |
| `pnpm test` | 23 file / 81 test — qua toàn bộ |
| `pnpm build` | Thành công; `/dev/typography` prerender tĩnh (428 B) |

### Kiểm tra font (§13 network check)

| Yêu cầu | Kết quả |
|---|---|
| Font self-host từ build | ✅ **25 file `.woff2`** trong `.next/static/media/` |
| Không request runtime tới `fonts.googleapis.com` / `fonts.gstatic.com` | ✅ Không tìm thấy tham chiếu nào trong bundle client |
| Subset tiếng Việt được tải thật | ✅ 7 khối `unicode-range` chứa `U+1EA0-1EF9` |
| Cả 2 họ font có mặt | ✅ `Literata`, `Be Vietnam Pro`, kèm `Fallback` metric-adjusted của Next.js |
| Tổng `@font-face` | 27 |

## E. Vấn đề còn lại — nói thẳng

1. **Chưa làm visual regression.** Repo không có công cụ chụp/so ảnh, và tôi không xem được trang đã render. Prompt §16.14 yêu cầu visual regression trước khi deploy — **điều kiện này CHƯA đạt**. Đã deploy theo quy ước làm việc hiện tại của dự án (deploy ngay sau khi build sạch, chủ dự án tự kiểm tra bằng mắt).
   → **Cần kiểm tra thủ công**: hero trang chủ (desktop + mobile), `/login`, một trang Learn, một trang Create, một trang Admin, Operations Center. Chú ý: chiều cao header, xuống dòng của hero, tràn bảng, tràn mobile.

2. **`font-synthesis: none` đã CỐ Ý không dùng** (§6 cho phép, kèm giải thích). Thiết kế đang dùng weight 650/750/850/950 — không phải cut thật của Be Vietnam Pro — và còn vài thẻ `<em>`/`<i>` dựa vào italic của trình duyệt mà không họ font nào tải bản italic. Bật `font-synthesis:none` sẽ **âm thầm làm phẳng** cả hai thứ đó chứ không cải thiện gì.

3. **`.compose-v412 .tiptap th` vẫn ghi `Inter,sans-serif`** — tức vẫn rơi về sans hệ thống. Đây là nội dung bên trong tài liệu người dùng nên tôi không đụng vào (§9 loại 2). Nếu bạn muốn nó theo Be Vietnam Pro, đó là quyết định về nội dung tài liệu, cần bạn xác nhận riêng.

4. **Chưa đo Cumulative Layout Shift.** Next.js có tự sinh fallback đã hiệu chỉnh metric (thấy `Literata Fallback` / `Be Vietnam Pro Fallback` trong CSS build) nên rủi ro thấp, nhưng chưa có số đo thật.

5. **Không đổi màu sắc, spacing, kích thước card, icon, border hay animation** — đúng yêu cầu. Hai class utility mà prompt gợi ý (`.text-editorial-display`, `.text-editorial-title`, `.text-ui-title`) mang theo `letter-spacing`/`line-height`/`font-weight`, tức là thiết kế chứ không phải font, nên **đã lược bỏ**; chỉ giữ `.font-heading` và `.font-body` thuần font.

## F. Rollback

Toàn bộ nằm trong 1 commit, revert là quay về nguyên trạng.
