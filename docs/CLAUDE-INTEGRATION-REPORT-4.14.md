# H2OBOOK 4.14 Integration Report — AI Student Experience & Public Academy

## 1. Phiên bản trước khi nâng

`4.13.7` (commit `b4ef687`, branch `main`, đã deploy production tại `h2obook-app.vercel.app`).

## 2. Branch đã tạo

`feature/h2obook-4.14-student-public` — tạo từ `main` tại commit `b4ef687`. Chưa merge vào `main`.

## 3. Tag backup

`h2obook-before-4.14-upgrade` — trỏ vào `main`@`b4ef687`, đã push lên `origin`. Dùng để rollback tức thời nếu cần (`git checkout h2obook-before-4.14-upgrade`).

## 4. Danh sách file thêm mới (35 file)

**Public Academy**
- `app/page.tsx` (thay landing cũ redirect thẳng /dashboard)
- `app/academy/layout.tsx`, `app/academy/page.tsx`
- `app/academy/books/page.tsx`, `app/academy/books/[slug]/page.tsx`
- `app/academy/courses/page.tsx`, `app/academy/courses/[slug]/page.tsx`
- `app/academy/strategies/page.tsx`, `app/academy/strategies/[slug]/page.tsx`
- `app/academy/learning-paths/page.tsx`, `app/academy/about/page.tsx`, `app/academy/membership/page.tsx`, `app/academy/success-stories/page.tsx`
- `app/api/public/catalog/route.ts`
- `components/marketing/public-shell.tsx`
- `lib/public-site/content.ts`

**Student Experience**
- `app/student/layout.tsx`, `app/student/page.tsx`
- `app/student/courses/page.tsx`, `app/student/courses/[slug]/page.tsx`
- `app/student/library/page.tsx`, `app/student/assignments/page.tsx`, `app/student/roadmap/page.tsx`, `app/student/mentor/page.tsx`, `app/student/profile/page.tsx`
- `components/student/student-shell.tsx`
- `lib/student/experience.ts`

**Test/tài liệu**
- `scripts/validate-ui-414.mjs`, `tests/e2e/ui-414.spec.ts`, `tests/unit/ui-414-content.test.ts`
- `docs/CHANGED-FILES-4.14.0.md`, `docs/INTEGRATION-GUIDE-4.14-VERCEL.md`, `docs/OWNER-ACTION-CHECKLIST-4.14.md`, `docs/RELEASE-NOTES-4.14-AI-STUDENT-PUBLIC.md`, `docs/VALIDATION-REPORT-4.14.0.md`, `SOURCE-MANIFEST-4.14.0.txt`

## 5. Danh sách file đã merge (không copy nguyên khối)

| File | Cách merge |
|---|---|
| `middleware.ts` | Lấy allowlist route công khai mới (`/academy`, `/api/public`, `/reader` — bổ sung thêm `/reader` theo yêu cầu spec mà bản 4.14 gốc thiếu) và logic redirect theo role student; **giữ `btoa()` thay vì `Buffer.from()`** (Edge Runtime không có `Buffer`, đã từng gây `MIDDLEWARE_INVOCATION_FAILED` ở bản 4.13.7 production) |
| `app/globals.css` | Lấy toàn bộ CSS 4.14 (thêm hệ `h2o-public-*`/`h2o-student-*`, thuần cộng thêm) + giữ lại `.badge-danger` (fix trước đó) + thêm mới rule `prefers-reduced-motion` |
| `package.json` | Bump version 4.14.0, thêm script `validate:ui414`, **giữ nguyên** `next@15.5.22`/`eslint-config-next@15.5.22` (bản 4.14 gốc vẫn là `15.4.5` — phiên bản có lỗ hổng bảo mật đã biết) |
| `.env.example` | Thêm khối `NEXT_PUBLIC_PUBLIC_SITE_V2` / `NEXT_PUBLIC_STUDENT_EXPERIENCE_V2` |
| `app/dashboard/page.tsx`, `components/layout/sidebar.tsx` | Chỉ đổi nhãn hiển thị "4.12" → "4.14" |
| `app/login/page.tsx`, `app/layout.tsx`, `public/manifest.webmanifest`, `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `VERSION` | Lấy nguyên bản 4.14 (đã xác nhận diff thuần cộng thêm/metadata, không đụng logic đã fix) |
| 8 script `scripts/validate-*.mjs`, `scripts/smoke-test.mjs`, `scripts/audit-production-readiness.mjs` | Lấy nguyên bản 4.14 (chỉ đổi regex version, không đổi logic) |

## 6. File giữ nguyên (không lấy bản 4.14 vì có bugfix quan trọng)

`next.config.ts` (webpack `canvas:false` + `output:"standalone"` chỉ bật khi build Docker, tắt trên Vercel qua `process.env.VERCEL`), `tsconfig.json` (`target: ES2020`), `vercel.json` (`framework: nextjs`), `.gitignore`, `app/api/input/sessions/route.ts`, `app/publish/page.tsx`, `app/preflight/page.tsx`, `components/editor/editor-workspace.tsx`, `components/ui/badge.tsx`, `lib/editor/tiptap-content.ts`, `lib/input/pdf-import.ts`, `lib/observability/input-observability.ts`, `lib/supabase/server.ts`, `packages/enterprise-core/src/index.ts`, `store/editor-store.ts`.

Lý do: bản đóng gói 4.14 được xuất từ một snapshot 4.13.7 **trước khi** các lỗi build/deploy này được vá ở phiên làm việc trước (12 lỗi TypeScript, lỗi Buffer/Edge Runtime, lỗi `output:standalone` phá routing trên Vercel, Next.js có CVE, thiếu Suspense boundary). Nếu lấy nguyên các file này từ 4.14 sẽ tái phát toàn bộ các lỗi đã sửa.

## 7. Dependencies thay đổi

Không có dependency mới. `next`/`eslint-config-next` giữ `15.5.22` (không hạ về `15.4.5` như 4.14 gốc). `pnpm-lock.yaml` không đổi cấu trúc, chỉ resync sau khi thêm script.

## 8. Route mới

`/` (Public Academy home), `/academy/books[+[slug]]`, `/academy/courses[+[slug]]`, `/academy/strategies[+[slug]]`, `/academy/learning-paths`, `/academy/about`, `/academy/membership`, `/academy/success-stories`, `/api/public/catalog`, `/student`, `/student/courses[+[slug]]`, `/student/library`, `/student/assignments`, `/student/roadmap`, `/student/mentor`, `/student/profile`. Tổng 40 route mới (136 route tĩnh sau build, tăng từ 96).

## 9. Role redirect

Dùng contract role có sẵn (`lib/auth/current-user.ts`, đã có `"student"` trong union type từ trước, fallback về `student` nếu không có membership — không tạo role giả). Middleware (chỉ chạy khi `NEXT_PUBLIC_APP_MODE=production` và có Supabase):
- Chưa đăng nhập + vào route riêng tư → `/login?next=...`
- Đã đăng nhập, role `student`, đang ở route không public/không `/student`/không `/api/*` → redirect `/student`
- Đăng nhập xong ở `/login`/`/signup` → `/student` (nếu `STUDENT_EXPERIENCE_V2` bật) hoặc `/learn`, còn lại → `/dashboard`
- Public không cần đăng nhập: `/`, `/academy/*`, `/portal/*`, `/reader/*`, `/api/public/*`, `/login`, `/signup`, `/auth`, `/api/health`, `/api/readiness`, `/api/payments/webhook`

## 10. Feature flags

`NEXT_PUBLIC_PUBLIC_SITE_V2=true`, `NEXT_PUBLIC_STUDENT_EXPERIENCE_V2=true` — cả hai đã có trong `.env.example`. Set `false` → `/` redirect về `/dashboard`, `/student` layout redirect về `/learn`. Không xoá code cũ.

## 11. Kết quả từng validator

| Lệnh | Kết quả |
|---|---|
| `pnpm validate` | ✅ Pass (51 core files) — **đã sửa lỗi gốc**: `validate-source.mjs` dùng `new URL().pathname` gây ENOENT nhân đôi ổ đĩa trên Windows, đổi sang `fileURLToPath` |
| `pnpm validate:imports` | ✅ Pass (317 files) |
| `pnpm validate:ui414` | ✅ Pass (24 files, 9 kiến trúc, 3165 CSS blocks) |
| `pnpm validate:input-phase2` | ✅ Pass |
| `pnpm validate:input-phase3` | ✅ Pass |
| `pnpm validate:input-phase4` | ❌ Blocked — cần Tesseract OCR binary (chưa cài trên máy này, môi trường không có sẵn, không phải lỗi code) |
| `pnpm validate:input-phase5` | ✅ Pass |
| `pnpm validate:input-phase6` | ✅ Pass |
| `pnpm validate:input-phase7` | ⚠️ 13/14 assertion pass; assertion còn lại ("không có `node_modules`/`.next`") chỉ đúng với gói nguồn thuần trước khi cài đặt, không thể pass khi đang chạy dev/build thật — đã xác minh thủ công 13 kiến trúc còn lại pass |
| `pnpm validate:migrations` | ✅ Pass (22 migration, không có migration mới ở 4.14) |
| `pnpm test:sql` | ✅ Pass (12 bảng domain) |
| `pnpm check:input-storage` | ✅ Pass |

## 12. Kết quả typecheck

`pnpm typecheck` → **✅ 0 lỗi** trên toàn bộ codebase đã merge (bao gồm toàn bộ file Academy/Student mới).

## 13. Kết quả unit test

`pnpm test` → **✅ 27/27 pass** (11 file). Ban đầu 5 file fail do `vitest.config.ts` thiếu alias cho các package nội bộ `@h2obook/*` (chỉ Next.js/tsconfig đọc được `paths`, Vitest thì không) — đã sửa gốc bằng cách thêm alias khớp `tsconfig.json` cho cả 10 package. Một test `html-import.test.ts` fail vì `lib/input/html-import.server.ts` làm rớt nội dung block (table) bị HTML5 tự sửa lỗi lồng vào heading/list-item — đã sửa gốc, không phải lỗi do 4.14 gây ra (file tiền tồn tại từ trước, chưa từng chạy `pnpm test` thành công cho tới phiên này).

## 14. Kết quả build

`pnpm build` (mô phỏng môi trường Vercel bằng `VERCEL=1`) → **✅ exit code 0**, 136/136 trang tĩnh generate thành công, 0 lỗi type/lint. Khi chạy trên Windows thường (không set `VERCEL=1`) có warning `EPERM` ở bước copy symlink cho `output:"standalone"` — đây là giới hạn hệ điều hành Windows đối với chế độ build Docker self-host, **không ảnh hưởng đến Vercel** (đã gate bằng `process.env.VERCEL`, xác nhận qua build sạch ở trên).

## 15. Kết quả E2E

`pnpm test:e2e` (Playwright, chromium):
- `tests/e2e/ui-414.spec.ts` (Public Academy + Student nav + Business route) → **✅ 3/3 pass** sau khi sửa 1 locator quá rộng (`getByRole("link", {name:/H2O Mentor/i})` khớp 3 phần tử — thêm `.first()`)
- `tests/e2e/smoke.spec.ts` → ✅ pass
- `tests/e2e/input-orchestrator.spec.ts` (Input Engine, **không thuộc phạm vi 4.14**, code không bị đụng tới) → ❌ 2/3 fail — lỗi tiền tồn tại, chưa từng được Playwright chạy qua trước phiên này (kể cả ở 4.13.7). Một lỗi là timeout chờ nút "Commit vào H2OBOOK"; lỗi còn lại đáng chú ý hơn — locator khớp `"URL đã sẵn sàng: file:///etc/passwd"` thay vì thông báo từ chối, cho thấy UI có thể đang hiển thị `file://` URL là "sẵn sàng" ở bước preview thay vì chặn ngay — **cần đội ngũ Input Engine kiểm tra lại**, tôi không sửa vì ngoài phạm vi nhiệm vụ này và đụng vào logic bảo mật SSRF nhạy cảm.
- Project `mobile` (WebKit) — `tests/e2e/ui-414.spec.ts` + `smoke.spec.ts` → **✅ 4/4 pass** sau khi cài `pnpm exec playwright install webkit`.

## 16. Lỗi/giới hạn còn tồn tại

1. **Tesseract OCR binary chưa cài trên máy** → `validate:input-phase4` và các test OCR/ảnh liên quan không chạy được đầy đủ. Cần cài đặt ở máy CI/production thật.
2. **`input-orchestrator.spec.ts` có 2/3 test fail** — tiền tồn tại, ngoài phạm vi 4.14, cần đội Input Engine xem lại (đặc biệt điểm nghi vấn về xử lý `file://` URL).
3. **Chưa xác minh luồng Supabase student-role/RLS thật** — chỉ chạy được Demo Mode (không có Supabase project thật để test). Logic role-redirect đã qua typecheck và bám sát đúng pattern của chính bản 4.14 gốc.
4. Design polish (bảng màu, contrast số, kiểm tra pixel-level ở 4 breakpoint) mới kiểm tra tĩnh qua CSS, chưa chụp ảnh màn hình thực tế trên trình duyệt.

## 17. Environment Variables cần thêm trên Vercel

Vào **Project `h2obook-app` → Settings → Environment Variables**, thêm (Production + Preview):

```
NEXT_PUBLIC_PUBLIC_SITE_V2=true
NEXT_PUBLIC_STUDENT_EXPERIENCE_V2=true
```

(Các biến Supabase/R2/Redis khác nếu muốn tắt Demo Mode — xem `.env.example`, không nằm trong phạm vi thay đổi của 4.14.)

## 18. Preview URL

**Chưa có** — project Vercel `h2obook-app` hiện **không kết nối với GitHub** (được tạo/deploy bằng CLI cục bộ, không qua Git integration), nên việc push branch `feature/h2obook-4.14-student-public` lên GitHub **không** tự động tạo Preview Deployment. Hai lựa chọn:
- Kết nối repo `tuanaihp/H2OBOOK` với project `h2obook-app` qua Vercel dashboard (Settings → Git) để có Preview tự động cho mọi branch/PR sau này.
- Hoặc yêu cầu tôi chạy `vercel deploy` (không `--prod`) thủ công để tạo 1 bản Preview cho riêng branch này.

Không có bước nào trong hai lựa chọn trên được tôi tự thực hiện, theo đúng yêu cầu không tự deploy.

## 19. Hướng rollback

- **Tức thời (không cần rollback code):** set `NEXT_PUBLIC_PUBLIC_SITE_V2=false` và `NEXT_PUBLIC_STUDENT_EXPERIENCE_V2=false` trên Vercel rồi redeploy — `/` quay về redirect `/dashboard`, `/student` redirect về `/learn`. Không xoá route/DB.
- **Rollback code:** `git checkout h2obook-before-4.14-upgrade` (tag) hoặc `git reset --hard b4ef687` trên nhánh riêng — không đụng `main` vì `main` chưa merge nhánh 4.14.
- Không có migration Supabase mới trong 4.14 nên không cần rollback DB.

## 20. Kết luận

**READY_FOR_VERCEL_PREVIEW** — với điều kiện: cần kết nối Git integration (mục 18) hoặc chạy Preview deploy thủ công trước khi review. Toàn bộ `pnpm build`/`pnpm typecheck`/`pnpm test`/hầu hết validator đã pass thật (không phải claim suông), Business workspace không bị đụng, hai feature flag có đường rollback rõ ràng. Không có gì trong mục 16 chặn việc tạo Preview để review — nhưng mục 16.2 (input-orchestrator SSRF-adjacent) nên được đội Input Engine xem lại **trước khi** merge vào `main`, độc lập với việc tích hợp 4.14 này.
