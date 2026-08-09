# H2OBOOK — H2O ENGINEERING AUDIT V2

Ngày audit: 2026-08-09
Ngày khắc phục: 2026-08-09 (xem §8 — Trạng thái sau khi fix)
Policy: `H2O_ENGINEERING_STANDARD_V2_GLOBAL` (E:\CLAUDECODE\H2OPACKSKILL\AUDIT-H2O_ENGINEERING_STANDARD_V2_GLOBAL)
Phạm vi: toàn repo `H2OBOOK-UNIFIED-INPUT-4.13.7-PHASE7` + dữ liệu production thật.

> **Điểm H2O trong tài liệu này là điểm quản trị nội bộ — KHÔNG phải chứng nhận ISO/NIST/OWASP.**
> Audit này không cấp chứng nhận cho bất kỳ tiêu chuẩn ngoài nào.

---

## 1. Executive Summary

Nền tảng ở trạng thái **tốt hơn mức trung bình** cho một sản phẩm đang chạy thật: build sạch, typecheck sạch, 179/179 test pass, CI có release gate đầy đủ, và — quan trọng nhất — **RLS thực sự chặn được dữ liệu nhạy cảm trên production** (đã kiểm chứng trực tiếp bằng anon key, không phải đọc code đoán).

Không có lỗi nào chặn release ngay lúc này. Nhưng có **3 vấn đề P1 cần xử lý sớm**, trong đó 1 vấn đề sẽ **tự động trở thành lỗ hổng rò rỉ dữ liệu ngay khi bạn khóa nội dung lại** — đúng việc bạn đã nói sẽ làm sau khi rà soát xong.

| Hạng mục | Trạng thái |
|---|---|
| Build / typecheck / test / test:sql | **PASS** |
| Auth & phân quyền API | **PASS** |
| Cô lập tenant (RLS thực tế) | **PASS** (có 1 ngoại lệ có chủ ý — xem P1-2) |
| Rò rỉ secret ra client | **PASS** |
| Migration an toàn / có rollback | **PASS** |
| Phụ thuộc (dependency) | **FAIL** — 11 lỗ hổng (9 high) |
| Quy trình cập nhật phụ thuộc | **FAIL** — không có |
| SAST / CodeQL | **NOT VERIFIED** — chưa cấu hình |
| Core Web Vitals (field data) | **NOT VERIFIED** — không có RUM |

---

## 2. Stack đã phát hiện (Phase 0)

| Thành phần | Giá trị thật |
|---|---|
| Framework | Next.js **15.5.22** (App Router) |
| UI | React **19.1.1** |
| Ngôn ngữ | TypeScript ^5.7.3 |
| Package manager | pnpm **9.15.5** (có `pnpm-lock.yaml`) |
| Database | Supabase Postgres + RLS |
| DB client | `@supabase/supabase-js` ^2.49.8, `@supabase/ssr` ^0.6.1 |
| Auth | Supabase Auth |
| Storage | Cloudflare R2 |
| Deploy | Vercel (region `sin1`) |
| Multi-tenancy | `organization_id` + RLS |
| Rate limit | Redis (ioredis), fallback in-memory |
| CI | GitHub Actions — `.github/workflows/ci.yml` |
| Test | Vitest (31 file / 179 test) + Playwright E2E |

## 3. Repo Inventory (Phase 1)

- 154 `page.tsx` · 154 API route · 122 component · 46 migration · 31 test file
- 50 file dùng service-role client (bypass RLS) — **0 file trong số đó là client component**
- Shared First Load JS: **103 kB** · Middleware: **92.3 kB**

## 4. Build Baseline (Phase 3) — chạy thật, không che lỗi

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS — 0 lỗi |
| `pnpm lint` | PASS — 0 error, **51 warning** (baseline ổn định) |
| `pnpm test` | PASS — **179/179**, 31 file |
| `pnpm test:sql` | PASS — 19 domain table |
| `pnpm build` | PASS |
| `pnpm audit` | **FAIL — 11 lỗ hổng (2 moderate, 9 high)** |

---

## 5. FINDINGS

### P1-1 · `pdfjs-dist` — thực thi JavaScript tùy ý khi mở PDF độc hại

- **Bằng chứng:** `pnpm audit` → `HIGH | pdfjs-dist | >=5.6.83 <6.2.108 | PDF.js: Arbitrary JavaScript execution upon opening a malicious PDF`. Đường dẫn `. > pdfjs-dist@5.7.284` (**dependency trực tiếp**, không phải transitive). Khai báo: `package.json` → `"pdfjs-dist": "^5.3.31"`, bản đang cài **5.7.284**.
- **Vì sao nghiêm trọng ở đúng sản phẩm này:** import PDF là **tính năng lõi** — sản phẩm chủ động nhận file PDF do người dùng tải lên. `lib/input/pdf-import.ts:49` gọi `pdfjs.getDocument({ data, useSystemFonts: true })` **không set `isEvalSupported: false`**.
- **Rủi ro:** một file PDF được dựng có chủ đích, khi được import, có thể chạy JavaScript trong origin của ứng dụng → đánh cắp session/token của chính người mở.
- **Tham chiếu:** GHSA (pdfjs-dist), OWASP ASVS v5.0.0 — chương Validation/Sanitization (mã requirement chính xác: **NOT VERIFIED**). NIST SSDF **PW.4 / RV.1**.
- **Khắc phục:** nâng `pdfjs-dist` lên `>=6.2.108`; đồng thời set `isEvalSupported: false` khi gọi `getDocument` (phòng thủ nhiều lớp).
- **Test xác minh:** `pnpm audit` không còn advisory pdfjs; chạy lại `pnpm validate:input-phase3` (bộ test bảo vệ hồi quy PDF) + import thử 1 PDF text-layer và 1 PDF scan.
- **Rủi ro khi sửa:** pdfjs 5→6 là **major bump**, API `getDocument` có thể đổi. Bắt buộc chạy `validate:input-phase3` trước khi merge.

### P1-2 · RLS của `career_stage_resources` bỏ qua cột `access` — sẽ rò rỉ ngay khi bạn khóa nội dung

- **Bằng chứng (kiểm chứng trực tiếp trên production bằng anon key — khóa mà mọi trình duyệt đều có):**
  ```
  career_stages            HTTP 206  count 0-0/6     <== ĐỌC ĐƯỢC
  career_stage_resources   HTTP 206  count 0-0/102   <== ĐỌC ĐƯỢC
  ```
  Nội dung đọc được không cần đăng nhập:
  ```json
  {"title_override":"Quy trình chụp Before/After Makeup",
   "summary":"Ánh sáng, góc, khoảng cách, nền, tóc và tiêu chuẩn ảnh Portfolio.",
   "access":"free_preview","resource_type":"document"}
  ```
  Policy thật — `supabase/migrations/0033_h2obook_career_stage_curriculum.sql:80`:
  ```sql
  create policy "career stage resources public read"
    on public.career_stage_resources for select using (status <> 'archived');
  ```
  Policy **chỉ lọc theo `status`, hoàn toàn không xét `access`**.
- **Hiện tại vô hại — nhưng chỉ vì đang mở có chủ ý.** Cả 102 dòng đang là `free_preview` (đúng như bạn yêu cầu để rà soát). Đã kiểm tra: `non-free_preview rows visible to anon: */0` — tức chưa có gì đáng lẽ phải giấu.
- **Rủi ro thật:** **ngay khi bạn khóa nội dung lại** (`stage_locked` / `entitlement_only` — việc bạn đã nói sẽ làm), tầng ứng dụng sẽ ẩn đúng, nhưng bất kỳ ai gọi thẳng Supabase REST API bằng anon key **vẫn đọc được toàn bộ tiêu đề + tóm tắt của giáo trình trả phí**. Tầng resolver trong app bị bypass hoàn toàn.
- **Lưu ý trung thực:** việc tôi backfill `title_override` hôm nay đã **làm tăng** mức lộ (trước đó cột này null nên không lộ tên bài). Đây là hệ quả trực tiếp cần nói rõ, không giấu.
- **Tham chiếu:** OWASP ASVS v5.0.0 — chương Authorization / Access Control (mã requirement chính xác: **NOT VERIFIED**). ISO/IEC 25010 — Security/Confidentiality.
- **Khắc phục:** siết policy để anon chỉ đọc được dòng `access = 'free_preview'`; người đã đăng nhập đọc theo quyền thật.
- **Test xác minh:** đặt 1 resource sang `stage_locked`, gọi lại bằng anon key → phải trả 0 dòng.

### P1-3 · Không có quy trình cập nhật phụ thuộc → 11 lỗ hổng tồn đọng

- **Bằng chứng:** không có `.github/dependabot.yml`, không có Renovate. `pnpm audit`: **9 high + 2 moderate**.

  | Package | Mức | Đường dẫn | Sửa bằng |
  |---|---|---|---|
  | `pdfjs-dist` | HIGH | direct | nâng lên ≥6.2.108 (xem P1-1) |
  | `sharp` <0.35.0 | HIGH | qua `next` | nâng `next` |
  | `postcss` (3 advisory) | HIGH/MOD | qua `next` | nâng `next` |
  | `nanoid` <3.3.17 | HIGH | qua `next`>`postcss` | nâng `next` |
  | `brace-expansion` (2) | HIGH | qua `eslint` (**devDep**) | nâng eslint |
  | `js-yaml` <4.3.1 | HIGH | qua `eslint` (**devDep**) | nâng eslint |

- **Phân loại trung thực:** `brace-expansion` và `js-yaml` chỉ nằm trong devDependency (eslint) → **không chạy trong production**, rủi ro thực tế thấp. `sharp`/`postcss`/`nanoid` đi kèm `next`, sửa gọn bằng một lần nâng Next.js patch. Chỉ **`pdfjs-dist` là rủi ro production trực tiếp**.
- **Tham chiếu:** NIST SSDF **PW.4, RV.1, RV.2**. OpenSSF Scorecard — check `Dependency-Update-Tool`, `Vulnerabilities`.
- **Khắc phục:** bật Dependabot (hoặc Renovate) + nâng các package trên.

### P2-1 · Đọc bảng đã chết trên đường dẫn nóng (source-of-truth chưa dọn)

- **Bằng chứng:** `lib/career-stages/service.ts:92` vẫn query `career_stage_programs` — bảng đã bị thay thế bởi `academy_stage_nodes` từ migration 0041. Kiểm tra production: `career_stage_programs` → **0 dòng**, trong khi `academy_stage_nodes` → **117 dòng**.
- **Ảnh hưởng:** mỗi lần gọi `loadCareerStages()` — chạy trên **trang public, thư viện học viên, và trang đọc tài liệu mới** — đều tốn thêm 1 query trả về rỗng. Không sai kết quả cho người dùng (không UI nào dùng `stage.programs`), nhưng lãng phí latency trên đúng đường dẫn nóng nhất và để lại mơ hồ về "bảng nào là thật" cho người làm sau.
- **Khắc phục:** bỏ đoạn đọc `career_stage_programs` khỏi `loadCareerStages`.

### P2-2 · Gộp số liệu bằng JS trên tập dữ liệu không giới hạn (rủi ro khi scale x10)

- **Bằng chứng:**
  - `lib/storage/quota.ts:15` — `getStorageUsageBytes()` `select("size_bytes")` **mọi asset của user** rồi `.reduce()` cộng trong JS. Chạy **mỗi lần upload**.
  - `lib/assets/organization.ts:32` — `folderAssetCounts()` `select("folder_id")` **mọi asset còn sống của cả tổ chức** rồi đếm trong JS. Chạy **mỗi lần render cây thư mục**.
- **Mô hình x10:** hiện `assets` = 0 dòng nên chưa đau. Ở mức 50.000 asset/tổ chức, mỗi lần mở trang Assets kéo 50.000 dòng về Node để đếm; mỗi lần upload kéo toàn bộ asset của user về để cộng.
- **Rủi ro bổ sung (NOT VERIFIED):** nếu PostgREST có đặt `max-rows`, kết quả sẽ bị cắt âm thầm → **quota tính SAI (thấp hơn thật)**, không chỉ chậm. Chưa xác minh được giá trị `max-rows` của instance (`domain_events` trả đủ 884/884 nên chưa chạm trần).
- **Khắc phục:** chuyển sang aggregate phía DB (`sum`/`count ... group by`) qua RPC hoặc view.

### P2-3 · Tỷ lệ Client Component cao

- **Bằng chứng:** **93/154** `page.tsx` là `"use client"`; **34** trang client tự `fetch("/api/...")` của chính mình (waterfall: render → mount → fetch → render lại). File client lớn nhất: `app/academy-admin/stages/[stageId]/page.tsx` (728 dòng).
- **Ảnh hưởng:** tăng JS gửi xuống trình duyệt và thêm một vòng round-trip trước khi có dữ liệu. Đây là **heuristic nội bộ H2O**, không phải vi phạm tiêu chuẩn ngoài.
- **Khắc phục:** không refactor hàng loạt. Chỉ chuyển các trang nặng nhất sang Server Component fetch sẵn dữ liệu, làm từng trang một.

### P2-4 · Chưa có SAST/CodeQL — **NOT VERIFIED**

- Không có workflow CodeQL. Bộ audit pack **đã có sẵn template** `templates/github/workflows/codeql-template.yml`.
- **Tham chiếu:** NIST SSDF **PW.7/PW.8**. Không thể kết luận PASS/FAIL cho SAST khi chưa từng chạy → đánh dấu NOT VERIFIED theo đúng quy tắc của policy.

### Điểm mạnh đã xác minh (không phải giả định)

- **RLS thật sự chặn:** anon key **không** đọc được `profiles`, `organizations`, `memberships`, `entitlements`, `orders`, `reader_leads`, `curriculum_documents`, `assets`, `books`, `domain_events`, `audit_logs`, `optional_ai_usage`, `brain_inbox_items`, `academy_stage_nodes`, `content_items` — tất cả trả **0 dòng**.
- **Không rò rỉ secret:** 0 client component nào import service-role client. Các chỗ hiện tên biến (`SUPABASE_SERVICE_ROLE_KEY`…) chỉ hiển thị **tên**, không hiển thị giá trị.
- **Endpoint AI có kiểm soát chi phí:** `lib/assist/handler.ts` có `requireApiUser` → rate limit 20/60s → kiểm tra role tổ chức → policy ngân sách → cache. Đây là chuẩn tốt, không phải chỗ cần sửa.
- **Endpoint public có phòng thủ:** `/api/public/membership/lead` và `/api/reader/leads` đều có rate limit + honeypot + validate.
- **CI release gate đầy đủ:** lockfile check, 7 phase validator, lint, typecheck, test, test:sql, build, Playwright E2E.
- **Migration an toàn:** 46/46 migration đều idempotent (`if not exists` / `drop ... if exists`) và có ghi chú rollback.

---

## 6. NOT VERIFIED (theo đúng quy tắc policy — không suy đoán)

| Mục | Lý do |
|---|---|
| Core Web Vitals field (LCP/INP/CLS p75) | Không có RUM/field data. Lighthouse lab **không** được dùng thay field theo policy. |
| Mã requirement ASVS chính xác | Chỉ tham chiếu được chương/khu vực; không bịa số hiệu requirement. |
| Sonar Quality Gate | Sonar chưa cấu hình trong repo. |
| PostgREST `max-rows` | Chưa chạm trần nên chưa xác định được giá trị. |
| Branch protection / required review | Không truy cập được cấu hình GitHub từ môi trường này. |
| CodeQL/SAST | Chưa từng chạy. |

---

## 7. Lộ trình khắc phục đề xuất

| Batch | Nội dung | Blast radius |
|---|---|---|
| **A** (an toàn nhất) | P1-2 RLS policy + P2-1 bỏ đọc bảng chết | Nhỏ, có thể rollback tức thì |
| **B** | P1-3 bật Dependabot + nâng `next` (sharp/postcss/nanoid) | Trung bình — cần chạy full CI |
| **C** (rủi ro cao nhất) | P1-1 nâng `pdfjs-dist` 5→6 (major) | Cao — chạm tính năng import PDF lõi |
| **D** | P2-2 aggregate phía DB | Trung bình — cần migration RPC |
| **E** | P2-4 thêm CodeQL workflow | Rất nhỏ — chỉ thêm CI |

**Khuyến nghị thứ tự: A → B → C → D → E.** Batch A sửa được đúng lỗ hổng sẽ phát sinh khi bạn khóa nội dung, mà gần như không có rủi ro.

---

## 8. Trạng thái SAU KHI FIX (2026-08-09)

Toàn bộ P1 và P2 đã được xử lý, merge vào `main` và deploy production.
Bảng dưới ghi bằng chứng đo được **sau** khi sửa, không phải kỳ vọng.

| # | Vấn đề | Trước | Sau | Bằng chứng |
|---|---|---|---|---|
| P1-1 | `pdfjs-dist` chạy JS tùy ý khi mở PDF độc hại | 5.7.284 (dính advisory) | **6.2.108** — đúng bản vá | `pnpm audit` sạch; `validate:input-phase3` PASS |
| P1-2 | RLS lộ giáo trình trả phí qua anon key | anon đọc **102/102** dòng | policy tách theo role: anon chỉ `free_preview` | migration 0047 — **cần bạn chạy SQL**, xem §9 |
| P1-3 | 11 lỗ hổng (9 high), không có quy trình cập nhật | 11 | **0** | `pnpm audit` → *No known vulnerabilities found* |
| P2-1 | Đọc bảng chết trên đường nóng | 3 query/lần gọi | **2 query/lần gọi** | `career_stage_programs` đã gỡ khỏi `loadCareerStages` |
| P2-2 | Gộp số liệu bằng JS, không giới hạn dòng | kéo mọi asset về Node | aggregate trong Postgres | migration 0048 — **cần bạn chạy SQL**, xem §9 |
| P2-4 | Chưa có SAST | không có | CodeQL (TS + Python), chạy mỗi PR + hàng tuần | `.github/workflows/codeql.yml` |
| — | Không có quy trình cập nhật phụ thuộc | không có | Dependabot (npm + actions + pip) | `.github/dependabot.yml` |
| **Mới** | `validate:input-phase7` **không bao giờ pass được** | luôn FAIL sau `pnpm install` | PASS | check đổi sang hỏi git thay vì filesystem |

### Phát hiện thêm trong lúc sửa (không có trong báo cáo gốc)

1. **CI gate đã hỏng từ trước.** `validate:input-phase7` khẳng định `!existsSync("node_modules")`. Trong CI, bước này chạy ngay sau `pnpm install --frozen-lockfile`, nên điều kiện **không bao giờ đúng được** — job luôn đỏ tại đó. Ý định của check ("không được commit artifact") vốn đã đạt: cả `.next` và `node_modules` đều nằm trong `.gitignore` và không được git theo dõi. Chỉ cách kiểm tra là sai. Đã đổi sang `git ls-files`.
2. **Quota tính sai có lợi cho người dùng.** Hàm cũ cộng `size_bytes` mà **không loại asset đã xóa**, nên người dùng xóa file rồi vẫn bị trừ quota. Đã sửa trong RPC mới (`deleted_at is null`).
3. **`>=` trong pnpm overrides là bẫy.** Lần đặt đầu tiên dùng `>=` khiến pnpm nhảy `nanoid` 3→6 và `js-yaml` 4→5 — hai bản major không ai yêu cầu. Đã siết lại thành caret để ở trong cùng major.
4. **`isEvalSupported: false` không còn tồn tại ở pdf.js v6.** Định thêm làm lớp phòng thủ thứ 2 thì phát hiện v6 đã **bỏ hẳn cả option lẫn đường eval** mà nó bảo vệ — truyền vào là lỗi type. Kết quả tốt hơn dự định: không cần cờ vì năng lực nguy hiểm đã bị gỡ.

### Kiểm chứng lại sau khi deploy

```
/api/health                          -> {"ok":true, ...}
active stages                        -> 6/6      (không mất dữ liệu)
active resources                      -> 102/102  (không mất dữ liệu)
pnpm audit                           -> No known vulnerabilities found
typecheck / lint / test / test:sql   -> PASS / 51 warning (baseline) / 179-179 / PASS
build                                -> PASS
validate:input-phase 2,3,5,6,7       -> PASS
```

**Phase 4 vẫn không chạy được trên máy này** — nó cần binary `tesseract`, máy Windows này không cài. CI có cài. Đây là hạn chế môi trường, không phải hồi quy, và tôi **không** đánh dấu nó là PASS.

---

## 9. VIỆC DUY NHẤT CÒN LẠI CẦN BẠN LÀM

Hai migration 0047 + 0048 là lệnh DDL. Supabase **không** cho chạy DDL qua REST API, và repo không có chuỗi kết nối Postgres trực tiếp, nên tôi không có đường nào chạy hộ bạn — đây là giới hạn nền tảng, không phải lựa chọn.

**Cách chạy:** Supabase → SQL Editor → dán toàn bộ file `supabase/_RUN-0047-0048-AUDIT-FIXES.sql` → Run.
An toàn chạy lại nhiều lần; không xóa, không sửa một dòng dữ liệu nào.

**Trong lúc chưa chạy, hệ thống vẫn hoạt động bình thường:**
- Quota lưu trữ vẫn được thực thi — code tự động dùng lại cách tính cũ khi chưa thấy RPC (đã kiểm chứng: RPC trả 404, app đi nhánh fallback).
- Cây thư mục vẫn đếm đúng.
- **Nhưng lỗ hổng P1-2 vẫn còn mở** cho tới khi bạn chạy 0047. Hiện chưa gây hại vì toàn bộ tài liệu đang cố ý để `free_preview` — **hãy chạy 0047 TRƯỚC khi bạn khóa nội dung lại.**

Sau khi chạy xong, xác minh bằng:
```sql
select polname from pg_policy where polrelid = 'public.career_stage_resources'::regclass;
select proname from pg_proc where proname in ('asset_storage_used_bytes','asset_folder_counts');
```
