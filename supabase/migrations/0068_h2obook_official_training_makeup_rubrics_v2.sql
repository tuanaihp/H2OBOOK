-- Official Training and Professional Makeup rubrics, version 2.
-- Rubrics are immutable snapshots: this migration appends a new rubric for every organization
-- instead of editing a rubric that may already be referenced by class_evaluations.

do $$
declare
  org record;
  training_rubric_id uuid;
  makeup_rubric_id uuid;
begin
  for org in select id from public.organizations loop
    if not exists (
      select 1 from public.rubrics
      where organization_id = org.id and category = 'training'
        and title = 'Bảng đánh giá buổi Training Makeup & Tóc · V2'
    ) then
      insert into public.rubrics (organization_id, title, description, category)
      values (
        org.id,
        'Bảng đánh giá buổi Training Makeup & Tóc · V2',
        '{"quickIssues":["Đi muộn","Thiếu thẻ","Mất tập trung","Thiếu ghi chép","Dùng điện thoại sai mục đích"]}',
        'training'
      ) returning id into training_rubric_id;

      insert into public.rubric_criteria (organization_id, rubric_id, title, description, max_score, position, required, skill_key) values
        (org.id, training_rubric_id, 'Kỷ luật & đúng giờ', '10: đúng giờ, đủ buổi, tuân thủ tuyệt đối · 8: trễ/vắng có phép · 5: cần nhắc nhở · 2: vi phạm rõ rệt · 0: nghỉ không phép.', 10, 1, true, 'training_discipline'),
        (org.id, training_rubric_id, 'Đeo thẻ & tác phong học viên', 'Đeo thẻ đầy đủ, trang phục gọn gàng, thái độ tôn trọng lớp học.', 10, 2, false, 'training_discipline'),
        (org.id, training_rubric_id, 'Chuẩn bị dụng cụ học tập', 'Vở, bút, giáo trình/tài liệu và dụng cụ theo yêu cầu bài học.', 10, 3, false, 'training_discipline'),
        (org.id, training_rubric_id, 'Ý thức tập trung nghe giảng', 'Theo dõi bài giảng, không nói chuyện riêng hoặc làm việc cá nhân.', 10, 4, false, 'training_discipline'),
        (org.id, training_rubric_id, 'Quan sát kỹ thuật Demo', 'Theo dõi trình tự thao tác, cách dùng dụng cụ/sản phẩm và nguyên lý kỹ thuật.', 10, 5, true, 'training_discipline'),
        (org.id, training_rubric_id, 'Ghi chép kiến thức', 'Có đủ quy trình, kỹ thuật, lỗi thường gặp và điều cần nhớ.', 10, 6, true, 'study_record'),
        (org.id, training_rubric_id, 'Không sử dụng điện thoại sai mục đích', 'Chỉ dùng để quay/chụp, tra cứu hoặc theo yêu cầu của giảng viên.', 10, 7, false, 'training_discipline'),
        (org.id, training_rubric_id, 'Tương tác & đặt câu hỏi', 'Phản hồi, đặt câu hỏi đúng trọng tâm và tham gia trao đổi.', 10, 8, false, 'training_discipline'),
        (org.id, training_rubric_id, 'Khả năng tiếp thu & nhắc lại kiến thức', 'Trình bày lại được nội dung chính và biết áp dụng theo hướng dẫn.', 10, 9, true, 'training_discipline'),
        (org.id, training_rubric_id, 'Hoàn thiện hồ sơ buổi học', 'Ghi chép, tài liệu, ảnh/video được phép và nội dung cần ôn được lưu đúng nơi.', 10, 10, false, 'study_record');
    end if;

    if not exists (
      select 1 from public.rubrics
      where organization_id = org.id and category = 'makeup'
        and title = 'Bảng đánh giá năng lực thực hành Makeup chuyên nghiệp · V2'
    ) then
      insert into public.rubrics (organization_id, title, description, category)
      values (
        org.id,
        'Bảng đánh giá năng lực thực hành Makeup chuyên nghiệp · V2',
        '{"quickIssues":["Nền chưa sạch","Mắt chưa cân","Khối đậm","Sai layout","Quá thời gian"]}',
        'makeup'
      ) returning id into makeup_rubric_id;

      insert into public.rubric_criteria (organization_id, rubric_id, title, description, max_score, position, required, skill_key) values
        (org.id, makeup_rubric_id, 'Nền da & xử lý khuyết điểm', '15 điểm = xử lý da & khuyết điểm 5 + chất lượng lớp nền 5 + màu sắc/độ hoàn thiện 5.', 15, 1, true, 'foundation'),
        (org.id, makeup_rubric_id, 'Chân mày', '10 điểm = form & tỷ lệ 5 + kỹ thuật hoàn thiện 5.', 10, 2, false, 'brows'),
        (org.id, makeup_rubric_id, 'Mắt', '10 điểm = bố cục/tán màu 5 + điều chỉnh dáng mắt & thần thái 5.', 10, 3, true, 'eyes'),
        (org.id, makeup_rubric_id, 'Mi', 'Dáng mi, độ dày, độ bám, cân đối và khả năng hỗ trợ chỉnh mắt.', 5, 4, false, 'lashes'),
        (org.id, makeup_rubric_id, 'Khối & cấu trúc gương mặt', '10 điểm = phân tích cấu trúc 5 + tạo khối & highlight 5.', 10, 5, false, 'contour'),
        (org.id, makeup_rubric_id, 'Má', 'Vị trí, sắc độ, chuyển màu và liên kết tổng thể.', 5, 6, false, 'cheeks'),
        (org.id, makeup_rubric_id, 'Môi', '10 điểm = form & xử lý môi 5 + màu sắc/hoàn thiện 5.', 10, 7, false, 'lips'),
        (org.id, makeup_rubric_id, 'Tư duy Layout & thẩm mỹ', '10 điểm = phân tích/lựa chọn 5 + thẩm mỹ & ứng dụng 5.', 10, 8, true, 'layout'),
        (org.id, makeup_rubric_id, 'Quy trình làm khách thực tế', 'Setup, vệ sinh, tác phong, giao tiếp và kiểm tra hoàn thiện.', 5, 9, false, 'process'),
        (org.id, makeup_rubric_id, 'Thời gian hoàn thành', '10 điểm = thời lượng tự tính 5 (≤60:5 · 61–65:4 · 66–70:3 · 71–75:2 · 76–80:1 · >80/chưa xong:0) + kiểm soát tiến độ 5.', 10, 10, true, 'speed'),
        (org.id, makeup_rubric_id, 'Tư duy học nghề & khả năng sửa lỗi', 'Nhận diện lỗi, tiếp thu feedback và sửa tốt hơn qua từng bài.', 5, 11, false, 'process'),
        (org.id, makeup_rubric_id, 'Kỷ luật & hồ sơ học tập', '5 mục × 1 điểm: đúng giờ, đeo thẻ, hoàn thành bài tập, ghi chép, ảnh/video sản phẩm.', 5, 12, true, 'study_record');
    end if;
  end loop;
end $$;
