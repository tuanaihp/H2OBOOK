# H2OBOOK Makeup Design Library — Product & Design Analysis

## 1. Mục tiêu

Tạo một self-service design portal chỉ phục vụ ngành Makeup. Người dùng không bắt đầu từ canvas trắng mà bắt đầu từ mục đích kinh doanh: xây thương hiệu cá nhân, tuyển sinh, mời học viên, cấp bằng và tạo chương trình khuyến mãi.

## 2. Logic điều hướng

- Cover Fanpage: Layout Makeup / Thông báo khóa học.
- Profile Makeup Artist: Clean Luxe / Soft Glow / Future Beauty / Burgundy Expert.
- Thiệp mời: Khóa chuyên nghiệp / nâng cao / cá nhân.
- Bằng tốt nghiệp: Professional / Advanced / Personal / hoạt động thực tế.
- Khuyến mãi: Cô dâu / tiệc / flash sale / combo.

## 3. Công thức trải nghiệm

1. Chọn mục tiêu.
2. Chọn phong cách.
3. Chọn Brand Profile.
4. Điền Smart Fields.
5. Chọn kích thước.
6. Tạo một bản hoặc tạo hàng loạt.
7. Mở trong H2OBOOK Editor để chỉnh sâu.
8. Duyệt trước khi phát hành nếu là bằng hoặc tài liệu thương hiệu quan trọng.

## 4. Phong cách thiết kế

### Future Luxe
Midnight, cyan, violet, AI orbit, đường sáng mảnh. Dùng cho tuyển sinh, profile tương lai và sự kiện.

### Clean Editorial
Khoảng trắng lớn, serif cao cấp, ảnh chân dung lớn, typography ít nhưng mạnh. Dùng cho Bridal và thương hiệu cá nhân.

### Soft Beauty Glow
Rose, lavender, ánh sáng mềm, gradient glow. Dùng cho profile trẻ, makeup tiệc và khóa cá nhân.

### Burgundy Signature
Burgundy, ivory, gold. Dùng cho nhận diện ThuyH2O, Bridal và tài liệu chính thức.

### Monochrome Fashion
Đen trắng, acid accent, chữ condensed mạnh. Dùng cho khóa nâng cao và phong cách runway.

### Academy Prestige
Ivory, burgundy, gold line, frame trang trọng. Dùng cho thiệp và bằng.

### Flash Sale Energy
Dark violet, pink neon, yellow accent. Dùng cho ưu đãi ngắn hạn.

## 5. Logic dữ liệu

Template là master. Design Project là bản phát sinh. Smart Fields chứa nội dung thay đổi. Brand Binding chứa logo/màu/font. Certificate Issue là bản ghi pháp lý độc lập có mã và QR xác minh. Không dùng tên file hoặc text trên canvas làm nguồn dữ liệu chính cho bằng tốt nghiệp.

## 6. Quyền khóa

- Background/logo/legal text: khóa hoàn toàn.
- Text Smart Field: khóa vị trí và style, chỉ cho sửa nội dung.
- Image frame: khóa vị trí/style, cho thay ảnh và crop.
- Decorative element: khóa hoàn toàn.
- Admin template master: quyền sửa toàn bộ.

## 7. Smart Resize

Bản code có scaling foundation. Khi production nên thêm art direction theo từng tỷ lệ để Story không chỉ là cover bị kéo dài. Mỗi template quan trọng nên có variant layout riêng cho cover, portrait và story.

## 8. Bulk generation

Ưu tiên cho bằng và thiệp. CSV map theo field key. Production cần preview 3 bản đầu, validate duplicate certificate number, tạo audit event và không phát hành trước approval.
