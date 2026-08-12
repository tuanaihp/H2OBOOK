# Stage 1 — Tiêu chí đạt sẵn sàng áp dụng

Tất cả 14 Mission thật đang publish (Stage "Nền tảng nghề Makeup", v1) có `success_criteria = []` — học viên đang thấy "Chưa có tiêu chí thành công cho mission này." Đây là nội dung thật, viết theo đúng `expected_result` hiện có của từng Mission, **chưa áp dụng vào production** (xem lý do ở cuối file).

## Cách áp dụng
1. Mở `/academy-admin/journey`, chọn Stage "Nền tảng nghề Makeup", version `v1 — Đang áp dụng`.
2. Bấm **Nhân bản phiên bản này** (đã build và test ở folder 33/35) → ra `v2 — Bản nháp`.
3. Ở `v2`, chọn từng Mission bên dưới → tab **1. Tổng quan** → điền đúng các dòng Tiêu chí đạt.
4. Sau khi điền đủ 14 Mission: bấm **Kiểm tra** (Preflight) để xác nhận hết cảnh báo → **Xem như học viên** để soát lại → tự quyết định khi nào **Áp dụng cho học viên**.

## Nội dung theo từng Mission

**Outcome 01 — Hiểu nghề & chọn hướng**

- **Xác định hướng nghề Makeup**: Nêu được 1 hướng đi chính (vd bridal, editorial, beauty thương mại…) và lý do chọn · Xác định được ít nhất 1 nhóm khách hàng mục tiêu ban đầu · Nêu được 2-3 điểm mạnh cá nhân liên quan tới hướng đã chọn.
- **Hoàn thành Career Map**: Career Map có đủ mục tiêu ngắn hạn (90 ngày) và dài hạn (1 năm) · Có bảng chi phí khởi nghiệp với ít nhất 5 khoản mục thực tế · Có ít nhất 1 mốc thu nhập mục tiêu cụ thể.
- **Xác định mục tiêu 90 ngày**: Có mục tiêu học tập cụ thể, đo được cho 90 ngày · Có lịch thực hành hằng tuần rõ ràng · Bắt đầu ghi Nhật ký thực hành đều đặn (ít nhất 1 lần/tuần).

**Outcome 02 — Thiết lập nền tảng nghề**

- **Chuẩn hóa túi đồ nghề**: Có đủ nhóm dụng cụ bắt buộc (cọ, mút, dụng cụ vệ sinh) theo checklist · Dụng cụ được phân loại theo từng nhóm công việc (nền/mắt/môi…) · Không thiếu nhóm dụng cụ bắt buộc nào trong checklist.
- **Hoàn thành tiêu chuẩn vệ sinh**: Hoàn thành checklist vệ sinh trước/trong/sau buổi làm · Phân biệt rõ khu vực dụng cụ sạch và đã dùng · Giải thích được nguyên tắc tránh lây nhiễm chéo giữa khách hàng.
- **Setup hồ sơ nghề Makeup**: Có ảnh đại diện nghề nghiệp chuyên nghiệp · Có phần giới thiệu (bio) nêu rõ dịch vụ và tệp khách hàng mục tiêu · Có đầy đủ thông tin liên hệ thật.

**Outcome 03 — Xây kỹ thuật nền**

- **Chuẩn bị da đúng**: Phân tích đúng loại da và tình trạng da của khách/mẫu · Chọn đúng sản phẩm dưỡng/prep phù hợp loại da · Lớp nền sau prep không vón/cakey trong ít nhất 2 giờ.
- **Hoàn thiện lớp nền**: Tone nền hài hòa với vùng cổ, không lệch tông · Độ che phủ phù hợp khuyết điểm da, không dày quá mức cần · Lớp nền giữ form ít nhất 4 giờ ở điều kiện thường.
- **Màu sắc cơ bản**: Xác định đúng tone màu tổng thể phù hợp trang phục/dịp · Phối màu mắt – má – môi hài hòa, không xung đột tông · Giải thích được lý do chọn bảng màu đã dùng.
- **Tóc nền tảng**: Tạo được form sóng/phồng cơ bản đúng kỹ thuật · Không lộ kẹp/ghim trên tóc thành phẩm · Có bước bảo vệ tóc (dùng nhiệt bảo vệ) trước khi tạo kiểu.

**Outcome 04 — Tạo bằng chứng nghề**

- **Before/After #1**: Ảnh Before/After chụp cùng điều kiện ánh sáng, cùng góc · Có ghi chú tự đánh giá điểm đạt/chưa đạt · Ảnh đủ nét để nhìn rõ chi tiết kỹ thuật.
- **Before/After #2**: Đáp ứng đủ tiêu chuẩn như bộ #1 · Có ít nhất 1 điểm cải thiện rõ rệt so với bộ #1 (nêu cụ thể) · Tự nhận xét được điểm đã khắc phục từ lần trước.
- **Before/After #3**: Đáp ứng đủ tiêu chuẩn kỹ thuật như bộ #1 và #2 · Đạt chất lượng đủ để đưa vào hồ sơ/portfolio · Không còn lỗi kỹ thuật cơ bản đã ghi nhận ở 2 bộ trước.
- **Hoàn thiện hồ sơ Stage 1**: Hồ sơ nghề Makeup đã hoàn chỉnh và cập nhật · Career Map và mục tiêu 90 ngày đã được rà soát lại · Đủ 3 bộ ảnh Before/After đạt chuẩn nộp portfolio.

## Vì sao chưa áp dụng trực tiếp

Đã cân nhắc tự chạy `duplicateVersion()` qua Supabase REST (mirror thủ công, giống cách đã kiểm chứng nhiều lần trong phiên làm việc này) để tự điền và giữ lại bản nháp cho bạn. Quyết định **không làm** vì: bản nháp thật sẽ tồn tại lâu dài trong production (khác test data dọn sạch ngay), và việc mirror tay toàn bộ graph (outcomes/milestones/missions/resource bindings/tool bindings/assignment bindings/action templates/workspace configs) cho 14 Mission thật qua REST có rủi ro sai sót cao hơn hẳn so với dùng đúng `duplicateVersion()` đã test kỹ qua UI. An toàn hơn là bạn tự bấm 1 nút "Nhân bản phiên bản này" (đã hoạt động đúng) rồi dán nội dung đã soạn sẵn ở trên.
