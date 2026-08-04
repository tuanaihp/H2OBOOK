# H2OBOOK — Khắc phục độ trễ 3–4 giây khi chuyển tab trong Student Experience

Ngày: 2026-08-04
Nhánh: `perf/student-navigation-latency`

## 1. Hiện tượng được báo cáo

Sau khi tài khoản học viên đăng nhập thành công (Google Sign-In, vai trò `student`), mỗi lần click
chuyển tab trong sidebar `/student/*` mất khoảng **3–4 giây** mới hiển thị nội dung.

## 2. Nguyên nhân — đo trên chính mã nguồn

Điểm quan trọng đầu tiên: **trang không hề chậm vì dữ liệu**. `app/student/assignments/page.tsx`
(trang trong ảnh chụp màn hình được báo lỗi) là một client component thuần, đọc từ Zustand store,
**không có một truy vấn database nào**. Độ trễ nằm hoàn toàn ở tầng xác thực chạy trước khi trang
được render.

### 2.1 Nguyên nhân chi phối: sai vùng địa lý (chiếm phần lớn độ trễ)

| Thành phần | Vùng | Nguồn |
|---|---|---|
| Supabase | `ap-southeast-1` (Singapore) | `.env.local` — project `oamczuibcgjqmjxqntsn` |
| Vercel Serverless Functions | `iad1` (Washington DC, Hoa Kỳ) — **mặc định** | `vercel.json` không khai báo `regions` |

Mọi lần render server-side đều phải đi vòng **Việt Nam → Hoa Kỳ → Singapore → Hoa Kỳ → Việt Nam**.
Mỗi lượt gọi Supabase từ `iad1` sang Singapore tốn ~250ms, chưa kể chặng HTTP của chính request RSC
từ Việt Nam sang Hoa Kỳ.

### 2.2 Nguyên nhân cộng hưởng: các lượt gọi mạng nối tiếp, lặp lại

Mỗi lần click 1 tab `/student/*`, hệ thống thực hiện tuần tự:

| # | Nơi thực hiện | Lượt gọi mạng | Có được dùng không? |
|---|---|---|---|
| 1 | `middleware.ts` | `supabase.auth.getUser()` | Có |
| 2 | `middleware.ts` | truy vấn `organization_members` | **Không** — xem §2.3 |
| 3 | `app/student/layout.tsx` → `requireCurrentUser()` | `getUser()` | Có |
| 4 | cùng lượt trên | `profiles` + `organization_members` (song song) | Có |
| 5 | trang con (roadmap/learn/courses/create/spaces) | **lặp lại toàn bộ bước 3–4** | **Không** — trùng lặp |

### 2.3 Truy vấn `organization_members` trong middleware là thừa đối với `/student/*`

`memberRole` chỉ được đọc bởi đúng 3 quy tắc: chuyển hướng học viên, chặn route admin, và chuyển
hướng khi đã đăng nhập mà vào `/login`|`/signup`. Quy tắc chuyển hướng học viên **loại trừ tường
minh** các đường dẫn đã nằm dưới `/student`. Vì vậy với mọi request `/student/*`, truy vấn này được
thực hiện rồi **không bao giờ được dùng đến** — một lượt round trip xuyên Thái Bình Dương lãng phí
hoàn toàn trên đúng đường đi nóng nhất của sản phẩm.

### 2.4 Tài nguyên tĩnh cũng phải trả phí xác thực

Matcher cũ chỉ loại trừ `_next/static`, `_next/image`, `favicon.ico`. Mọi file trong `/public`
(font, icon, ảnh, manifest) vẫn chạy hết middleware — 2 lượt gọi Supabase mỗi file — rồi bị phân
loại là public bởi phép thử `pathname.includes(".")` và trả về nguyên trạng.

## 3. Thay đổi đã thực hiện

### 3.1 `vercel.json` — đặt vùng chạy về Singapore

```json
{ "framework": "nextjs", "regions": ["sin1"] }
```

Đưa Serverless Functions về cùng vùng với Supabase. Mỗi lượt gọi database giảm từ ~250ms xuống
~5–20ms, và request của người dùng Việt Nam không còn phải vòng qua Hoa Kỳ.

### 3.2 `middleware.ts` — chỉ truy vấn vai trò khi thực sự cần

Thêm `needsRole = mayRedirectStudent || isAdminOnlyRoute || isAuthEntryRoute`, và chỉ chạy truy vấn
`organization_members` khi cờ này bật. Ba quy tắc phía dưới giữ **nguyên điều kiện gốc** — mỗi điều
kiện đều kéo theo `needsRole`, nên hành vi bảo mật không đổi, chỉ bỏ đi lượt truy vấn không dùng
đến. Với `/student/*` điều này loại bỏ trọn một round trip mỗi lần click.

### 3.3 `middleware.ts` — loại tài nguyên tĩnh khỏi matcher

Bổ sung loại trừ theo phần mở rộng file (`svg|png|jpg|…|woff2|css|js|…`).

**Đây không phải lỗ hổng bảo mật mới:** mọi đường dẫn có dấu chấm vốn đã được `pathname.includes(".")`
xếp là public và bỏ qua toàn bộ quy tắc chuyển hướng xác thực. Tập bị loại trừ là **tập con thực sự**
của những gì vốn đã đi qua. Các route thật (không có phần mở rộng, bao gồm mọi điều hướng RSC) không
bị ảnh hưởng và vẫn được bảo vệ đầy đủ.

### 3.4 `lib/auth/current-user.ts` — khử trùng lặp bằng React `cache()`

`getCurrentUser` được bọc trong `cache()`, khử trùng lặp theo từng request. Layout và trang con giờ
dùng chung một kết quả thay vì lặp lại ~3 lượt gọi mạng. Không đổi chữ ký hàm, không đổi kiểu trả về,
mọi nơi gọi hiện tại (kể cả API route) giữ nguyên.

## 4. Ước tính hiệu quả trên mỗi lần click tab `/student/*`

| | Trước | Sau |
|---|---|---|
| Lượt gọi Supabase (nối tiếp) | 5 | 2 |
| Độ trễ mỗi lượt | ~250ms (Mỹ ↔ Singapore) | ~5–20ms (Singapore ↔ Singapore) |
| Chặng HTTP của request | Việt Nam ↔ Hoa Kỳ | Việt Nam ↔ Singapore |

## 5. Kiểm chứng đã chạy

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | Qua, không lỗi |
| `pnpm lint` | 0 lỗi, 51 cảnh báo (đúng bằng mức nền có sẵn, không phát sinh mới) |
| `pnpm build` | Thành công; middleware biên dịch được (92.2 kB) — xác nhận regex matcher hợp lệ |
| `pnpm test` | 22 test file / 72 test — qua toàn bộ |

## 6. Chưa xác minh

Con số cải thiện thực tế tính bằng giây **chưa được đo trên production** sau khi deploy. Cần người
dùng xác nhận lại bằng cảm nhận thực tế và/hoặc tab Network của trình duyệt. Việc đổi region chỉ có
hiệu lực **sau lần deploy kế tiếp**, và chỉ áp dụng cho Serverless Functions — Edge Middleware vốn
đã chạy gần người dùng nên không bị ảnh hưởng bởi thiết lập này.

## 7. Không đụng tới

- Không thay đổi schema, không migration, không chạm dữ liệu.
- Không thay đổi bất kỳ quy tắc phân quyền nào — ba quy tắc trong middleware giữ nguyên điều kiện gốc.
- Không thay đổi giao diện, không thay đổi nội dung trang.
