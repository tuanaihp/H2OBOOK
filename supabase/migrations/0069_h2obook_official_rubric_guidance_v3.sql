-- V3 exposes the complete observation guidance supplied by ThuyH2O. It creates another immutable
-- rubric snapshot, so evaluations already made with V1/V2 retain their original interpretation.

do $$
declare
  org record;
  training_rubric_id uuid;
  makeup_rubric_id uuid;
begin
  for org in select id from public.organizations loop
    if not exists (select 1 from public.rubrics where organization_id = org.id and category = 'training' and title = 'Bảng đánh giá buổi Training Makeup & Tóc · V3') then
      insert into public.rubrics (organization_id, title, description, category)
      values (org.id, 'Bảng đánh giá buổi Training Makeup & Tóc · V3',
        '{"quickIssues":["Đi muộn","Thiếu thẻ","Mất tập trung","Thiếu ghi chép","Dùng điện thoại sai mục đích"]}', 'training')
      returning id into training_rubric_id;

      insert into public.rubric_criteria (organization_id, rubric_id, title, description, max_score, position, required, skill_key) values
        (org.id, training_rubric_id, 'Kỷ luật & đúng giờ', '10: đúng giờ, học đủ buổi · 8: đi muộn dưới 10 phút · 5: muộn 10–20 phút · 2: muộn trên 20 phút hoặc về sớm · 0: vắng không phép.', 10, 1, true, 'training_discipline'),
        (org.id, training_rubric_id, 'Đeo thẻ & tác phong học viên', 'Đeo thẻ đúng quy định; ngồi học nghiêm túc; tôn trọng giảng viên; không ảnh hưởng người khác; giữ trật tự lớp.', 10, 2, false, 'training_discipline'),
        (org.id, training_rubric_id, 'Chuẩn bị dụng cụ học tập', 'Có vở ghi, bút, tài liệu/giáo trình khi được yêu cầu; chủ động chuẩn bị trước giờ; không thường xuyên mượn dụng cụ.', 10, 3, false, 'training_discipline'),
        (org.id, training_rubric_id, 'Ý thức tập trung nghe giảng', 'Theo dõi bài liên tục; không ngủ gật, nói chuyện riêng, ra ngoài không cần thiết hoặc bị phân tâm bởi việc cá nhân.', 10, 4, false, 'training_discipline'),
        (org.id, training_rubric_id, 'Quan sát kỹ thuật Demo', 'Quan sát đúng bước trước–sau, cách cầm/sử dụng dụng cụ, lượng và vị trí sản phẩm, góc tay/hướng thao tác, lý do chọn kỹ thuật và lỗi giảng viên chủ động tránh. Makeup: nền, khối, hướng tán mắt, đặt mi. Hair: chia tóc, hướng kéo, góc nâng, ghim, kiểm soát độ phồng.', 10, 5, true, 'training_discipline'),
        (org.id, training_rubric_id, 'Ghi chép kiến thức', 'Mỗi bài tối thiểu có: mục tiêu bài học; quy trình thực hiện; kỹ thuật quan trọng; lỗi cần tránh; điều cần luyện tập lại.', 10, 6, true, 'study_record'),
        (org.id, training_rubric_id, 'Không sử dụng điện thoại sai mục đích', 'Được dùng để quay/chụp Demo khi cho phép, chụp bảng/tài liệu, tra cứu và ghi chú bài học. Không dùng Facebook/TikTok cá nhân, nhắn tin riêng, gọi không cần thiết hoặc làm việc khác.', 10, 7, false, 'training_discipline'),
        (org.id, training_rubric_id, 'Tương tác & đặt câu hỏi', 'Có phản hồi khi được hỏi; đặt câu hỏi khi chưa hiểu; câu hỏi đúng nội dung; tham gia phân tích tình huống; chủ động trao đổi điều chưa nắm chắc.', 10, 8, false, 'training_discipline'),
        (org.id, training_rubric_id, 'Khả năng tiếp thu & nhắc lại kiến thức', 'Hiểu nội dung chính, trình bày lại quy trình/điểm quan trọng/lỗi cần tránh và giải thích được lý do chọn kỹ thuật.', 10, 9, true, 'training_discipline'),
        (org.id, training_rubric_id, 'Hoàn thiện hồ sơ buổi học', 'Có tên bài Training, ngày học, ghi chép, 3–5 kiến thức quan trọng, lỗi cần tránh, ảnh/video Demo được phép, điều chưa hiểu và nội dung cần luyện ở buổi thực hành sau.', 10, 10, false, 'study_record');
    end if;

    if not exists (select 1 from public.rubrics where organization_id = org.id and category = 'makeup' and title = 'Bảng đánh giá năng lực thực hành Makeup chuyên nghiệp · V3') then
      insert into public.rubrics (organization_id, title, description, category)
      values (org.id, 'Bảng đánh giá năng lực thực hành Makeup chuyên nghiệp · V3',
        '{"quickIssues":["Nền chưa sạch","Mắt chưa cân","Khối đậm","Sai layout","Quá thời gian"]}', 'makeup')
      returning id into makeup_rubric_id;

      insert into public.rubric_criteria (organization_id, rubric_id, title, description, max_score, position, required, skill_key) values
        (org.id, makeup_rubric_id, 'Nền da & xử lý khuyết điểm', '15 = xử lý da/khuyết điểm 5: nhận diện da, dưỡng phù hợp, xử lý mụn-thâm-quầng/không đều màu, không dày cục bộ/lộ texture; chất lượng nền 5: mỏng, mịn, đều, không mốc/cakey/đọng rãnh, giữ tự nhiên; màu sắc-hoàn thiện 5: hợp da thật, không lệch cổ, kiểm soát dầu/bóng, highlight mượt và tổng thể có chiều sâu.', 15, 1, true, 'foundation'),
        (org.id, makeup_rubric_id, 'Chân mày', '10 = form/tỷ lệ 5: hai bên cân đối, đầu-đỉnh-đuôi chuẩn, hợp khuôn mặt, điều chỉnh khuyết điểm, không quá dài/ngắn/cứng; hoàn thiện 5: đầu mềm, sợi tự nhiên, màu hợp tóc/layout, không đóng khung, mép sạch và đồng nhất.', 10, 2, false, 'brows'),
        (org.id, makeup_rubric_id, 'Mắt', '10 = bố cục/kỹ thuật màu 5: vùng sáng-tối đúng, tán mượt, nhũ phù hợp, không bết/nặng, phối màu hợp layout; điều chỉnh dáng/thần thái 5: kích mí và eyeliner hợp lý, hai mắt tương đối đồng đều, có chiều sâu và thần thái.', 10, 3, true, 'eyes'),
        (org.id, makeup_rubric_id, 'Mi', 'Chọn dáng mi hợp mắt; độ dài/dày hợp lý; cắt-ghép chính xác; gắn sát chân, không hở keo/cộm; hai bên cân đối; hỗ trợ chỉnh dáng mắt thay vì làm mắt nặng.', 5, 4, false, 'lashes'),
        (org.id, makeup_rubric_id, 'Khối & cấu trúc gương mặt', '10 = phân tích/điều chỉnh 5: nhận ra ưu nhược, đúng vùng thu-mở, khối hàm-gò má-mũi phù hợp, cải thiện tỷ lệ; tạo khối 5: sạch, không bết/đậm, chuyển mượt, highlight đúng vị trí và hài hòa nền/tổng thể.', 10, 5, false, 'contour'),
        (org.id, makeup_rubric_id, 'Má', 'Chọn màu hợp; vị trí hợp dáng mặt; biết dùng má để nâng/thu/trẻ hóa; tán mềm, không thành mảng/quá đậm; liên kết tốt với màu mắt và môi.', 5, 6, false, 'cheeks'),
        (org.id, makeup_rubric_id, 'Môi', '10 = form/xử lý 5: xử lý môi thâm-khô/lệch, định hình form, viền sạch, không lem/trượt nền, tỷ lệ hợp mặt; màu sắc/hoàn thiện 5: màu hợp layout, chuyển đẹp, ombre/full môi đúng kỹ thuật, không bết/loang và hoàn thiện tổng thể.', 10, 7, false, 'lips'),
        (org.id, makeup_rubric_id, 'Tư duy Layout & thẩm mỹ', '10 = phân tích/lựa chọn 5: đọc khuôn mặt, xác định phong cách khách, tone hợp da/độ tuổi/trang phục/bối cảnh, không áp một công thức; thẩm mỹ tổng thể 5: có điểm nhấn, màu đồng nhất, sạch-sang, ứng dụng được và có dấu ấn.', 10, 8, true, 'layout'),
        (org.id, makeup_rubric_id, 'Quy trình làm khách thực tế', 'Dụng cụ đủ, setup khoa học, cọ/dụng cụ sạch, giữ vệ sinh khi makeup, thao tác có trình tự, không làm khách khó chịu, trao đổi/tiếp nhận yêu cầu và kiểm tra sản phẩm trước khi kết thúc.', 5, 9, false, 'process'),
        (org.id, makeup_rubric_id, 'Thời gian hoàn thành', '10 = thời lượng 5: ≤60 phút 5; 61–65 phút 4; 66–70 phút 3; 71–75 phút 2; 76–80 phút 1; >80 phút hoặc chưa xong 0. Chỉ tính đạt khi hoàn thiện đủ sản phẩm. Kiểm soát tiến độ 5: ưu tiên đúng bước, không sửa nhiều/tìm đồ, thao tác dứt khoát, phân bổ nền-mắt-mày-môi và còn thời gian kiểm tra.', 10, 10, true, 'speed'),
        (org.id, makeup_rubric_id, 'Tư duy học nghề & khả năng sửa lỗi', 'Tự nhìn sản phẩm, nhận lỗi, hỏi đúng vấn đề, tiếp thu feedback, không lặp lỗi cũ, sửa ngay sau hướng dẫn, chủ động luyện tập và tiến bộ qua từng bài.', 5, 11, false, 'process'),
        (org.id, makeup_rubric_id, 'Kỷ luật & hồ sơ học tập', '5 mục × 1 điểm: đúng giờ; đeo thẻ; hoàn thành bài tập; ghi chép; lưu ảnh/video sản phẩm. Đủ 5 mục = 5 điểm.', 5, 12, true, 'study_record');
    end if;
  end loop;
end $$;
