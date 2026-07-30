# H2OBOOK Knowledge Universe Hero — Integration Report

## 1. Branch và tag backup

- Base: `main` @ `1827af8`
- Branch: `feature/h2obook-knowledge-universe-hero`
- Tag backup: `h2obook-before-knowledge-universe-hero`
- Node `v24.16.0`, pnpm `9.15.5`, working tree sạch trước khi bắt đầu.

## 2. File đã thêm / sửa

### Thêm mới (không ghi đè file nào)
- `components/knowledge-universe/` — `index.ts`, `knowledge-universe-hero.tsx`, `knowledge-universe-hero.module.css`
- `lib/knowledge-universe/` — `data.ts`, `feature.ts`, `types.ts`
- `app/academy/knowledge-universe/page.tsx`
- `scripts/validate-knowledge-universe-module.mjs`
- `tests/unit/knowledge-universe.test.ts`, `tests/e2e/knowledge-universe.spec.ts`
- `docs/KNOWLEDGE-UNIVERSE-DESIGN-CONCEPT.md`, `docs/KNOWLEDGE-UNIVERSE-INTEGRATION-GUIDE.md`

### Sửa tối thiểu
| File | Thay đổi |
|---|---|
| `app/page.tsx` | Tách Hero cũ thành `LegacyPublicHero()` giữ nguyên từng dòng; thêm 2 import; thay khối hero bằng một biểu thức cờ. 9 section phía dưới không đụng tới. |
| `package.json` | Thêm script `validate:knowledge-universe` |
| `.env.example` | Thêm `NEXT_PUBLIC_KNOWLEDGE_UNIVERSE_HERO_V1=true` |
| `tests/e2e/knowledge-universe.spec.ts` | Sửa lỗi strict-mode trong spec đi kèm module (xem §14) |
| `tests/e2e/ui-414.spec.ts` | Cập nhật khẳng định hero cho đúng trạng thái mới (xem §14) |

Không đụng: `middleware.ts`, auth, store, database, migration, API, Editor Engine, `PublicShell`/Header/Footer, `pnpm-lock.yaml`, `.env.local`. Không thêm dependency nào (module chỉ dùng `react`, `next/link`, `lucide-react` đã có).

## 3. Cách giữ Hero cũ

Hero cũ được bọc nguyên vẹn trong `LegacyPublicHero()` ngay trong `app/page.tsx`, không xoá dòng nào. Render theo đúng contract yêu cầu:

```tsx
{isKnowledgeUniverseHeroEnabled() ? <KnowledgeUniverseHero/> : <LegacyPublicHero/>}
```

Không bao giờ render đồng thời hai Hero.

## 4. Feature flag

```env
NEXT_PUBLIC_KNOWLEDGE_UNIVERSE_HERO_V1=true
```

`isKnowledgeUniverseHeroEnabled()` trả `false` chỉ khi giá trị đúng bằng chuỗi `"false"` — mặc định bật.

**Đã kiểm chứng thật, không suy đoán:** chạy lại dev server với `NEXT_PUBLIC_KNOWLEDGE_UNIVERSE_HERO_V1=false` và đo HTML trả về:
- `h2o-public-hero-copy` (Hero cũ): **2 lần xuất hiện** → Hero cũ trở lại
- `bộ não tri thức` (Hero mới): **0** → Hero mới biến mất
- `h2o-public-section`: vẫn còn → các section phía dưới nguyên vẹn

## 5. Kết quả route demo `/academy/knowledge-universe` (8/8)

Kiểm tra bằng trình duyệt thật trước khi đụng homepage, đúng thứ tự Bước 6 yêu cầu:

| Yêu cầu | Kết quả |
|---|---|
| Không 404 | ✅ 200 |
| Không console error / pageerror | ✅ 0 lỗi |
| 10 hành tinh hiển thị | ✅ đúng 10 |
| Hover cập nhật bảng chi tiết | ✅ |
| Focus cập nhật bảng chi tiết | ✅ |
| Click mở đúng route | ✅ 10/10 href hợp lệ: `/academy/books`, `/academy/courses`, `/academy/strategies`, `/academy/learning-paths`, `/student`, `/student/mentor`, `/design-library`, `/books`, `/input`, `/publish` |
| Pause/Play hoạt động | ✅ nhãn đổi `NẠP DỮ LIỆU` → `KẾT NỐI` |
| Mobile có planet rail | ✅ hiện ở 390px |
| Reduced motion | ✅ nội dung vẫn đọc được |

## 6. Kết quả responsive

Không tràn ngang tại cả 4 breakpoint yêu cầu — đo bằng `scrollWidth` vs `clientWidth`, trên **cả** route demo **và** homepage:

| Breakpoint | Demo | Homepage |
|---|---|---|
| 1440×900 | ✅ | ✅ |
| 1280×800 | ✅ | ✅ |
| 768×1024 | ✅ | ✅ |
| 390×844 | ✅ | ✅ |

## 7. Kết quả accessibility

- **Focus indicator hiện rõ:** planet focus tạo ring `0 0 0 3px` + đổ bóng. Lưu ý kỹ thuật: `outline:none` đặt trên thẻ `<a>`, chỉ báo nằm ở phần tử con `.planetFace` — đã đo `boxShadow` thực tế để xác nhận, không kết luận từ việc thấy `outline:none`.
- **Touch target:** hai CTA chính của Hero cao **52px** ở 390px, vượt ngưỡng ~40px.
- Tab bằng bàn phím tới planet hoạt động, `aria-label` mô tả đủ tên + mức truy cập.
- `prefers-reduced-motion`: nội dung và link vẫn hiển thị, đọc được.

## 8. Validator

| Lệnh | Kết quả |
|---|---|
| `pnpm validate:knowledge-universe` | ✅ 9 file, 8 architecture checks |
| `pnpm validate:global-neural` | ✅ 8 file, 7 surfaces |
| `pnpm validate:ui414` | ✅ 24 file, 9 checks, 3167 CSS blocks |
| `pnpm validate:imports` | ✅ 356 file |
| `pnpm validate` | ✅ 51 core file |
| `pnpm validate:professional` / `validate:editor412` / `validate:design-library` | ✅ pass |

## 9. Typecheck

`pnpm typecheck` → **0 lỗi**. Không dùng `any`, `@ts-ignore`, không tắt lint/typecheck.

## 10. Unit test

`pnpm test` → **46/46 pass** (14 file, tăng từ 41 nhờ 5 test mới của module).

## 11. Build

`pnpm build` (mô phỏng Vercel bằng `VERCEL=1`) → **exit code 0**. Route `/academy/knowledge-universe` sinh ra ở 182 B / 119 kB First Load.

## 12. E2E

**19/19 pass** trên Chromium, gồm spec chính thức của module + hai bộ regression `ui-414` và `smoke` + các kiểm tra tôi viết thêm cho demo/homepage.

## 13. Kiểm tra tương thích (Bước 9)

9/9 route trả 200: `/`, `/academy/knowledge-universe`, `/academy/books`, `/student`, `/dashboard`, `/design-library`, `/editor/book_makeup_pro`, `/input`, `/publish`.

Xác minh Hero mới **không rò rỉ** ra ngoài web công khai: đếm chuỗi `bộ não tri thức` trong HTML của `/editor/book_makeup_pro` = **0**, `/dashboard` = **0**.

Global Neural Design System vẫn hoạt động: `<html data-h2o-surface="public" data-h2o-neural="on">` trên homepage. Header/Footer của `PublicShell` giữ nguyên (đã assert logo, nav, dòng copyright).

## 14. Lỗi còn lại / hai sửa đổi test cần nói rõ

Không còn lỗi tồn đọng. Hai file test bị sửa, cả hai đều có lý do thực chất chứ không phải để "che lỗi":

1. **`tests/e2e/knowledge-universe.spec.ts` (spec đi kèm module) có bug strict-mode.** Mỗi node xuất hiện **hai lần** trong DOM: một planet quỹ đạo (`aria-label="<tên>. <mức truy cập>"`) và một link phẳng trong mobile rail. Locator `getByRole("link", { name: /Thư viện sách/i })` khớp cả hai nên Playwright báo strict-mode violation. Đã đổi sang selector nhắm đúng planet (`a[aria-label^="..."]`). Đây là lỗi trong test của module, sản phẩm không sai.
2. **`tests/e2e/ui-414.spec.ts` khẳng định tiêu đề Hero cũ** (`/Biến kiến thức nghề Makeup/i`). Đây chính là thứ nhiệm vụ này cố tình thay. Đã cập nhật sang tiêu đề Hero mới kèm chú thích rằng chuỗi cũ chỉ còn xuất hiện khi cờ tắt. Phần còn lại của test (không có `.quantum-sidebar`, có Strategy Intelligence Hub) giữ nguyên.

Một quan sát về hành vi, không phải lỗi: planet quay liên tục nên Playwright không "hover" được vào mục tiêu đang di chuyển bằng cách thông thường (`element is not stable`). Đây là giới hạn của công cụ tự động hoá với animation, không ảnh hưởng người dùng thật.

## 15. Cách rollback

- **Nhanh nhất, không đụng code:** đặt `NEXT_PUBLIC_KNOWLEDGE_UNIVERSE_HERO_V1=false` trên Vercel rồi redeploy → Hero cũ trở lại nguyên vẹn (đã kiểm chứng ở §4).
- **Rollback code:** không merge branch này, hoặc `git reset --hard h2obook-before-knowledge-universe-hero`.
- Module không có migration nên không cần rollback database.

## 16. Kết luận

**READY_FOR_VERCEL_PREVIEW**

Toàn bộ cổng chất lượng đã chạy thật và đạt: 8 validator pass, typecheck 0 lỗi, 46/46 unit test, build exit 0, 19/19 E2E, 9/9 route tương thích, rollback bằng cờ đã kiểm chứng.
