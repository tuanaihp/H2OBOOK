-- A separate, versioned rubric for reviewing the visible finished Makeup product in learner
-- photos. Training/practice rubrics continue to measure class behavior and hands-on process.

alter table public.rubrics drop constraint if exists rubrics_category_check;
alter table public.rubrics add constraint rubrics_category_check
  check (category is null or category in ('training', 'makeup', 'hair', 'makeup_product'));

do $$
declare
  org record;
  product_rubric_id uuid;
begin
  for org in select id from public.organizations loop
    if not exists (
      select 1 from public.rubrics
      where organization_id = org.id
        and category = 'makeup_product'
        and title = 'Bộ tiêu chí ảnh sản phẩm Makeup chuyên nghiệp · V1'
    ) then
      insert into public.rubrics (organization_id, title, description, category)
      values (
        org.id,
        'Bộ tiêu chí ảnh sản phẩm Makeup chuyên nghiệp · V1',
        '{"quickIssues":["Nền chưa sạch","Mày chưa cân","Màu mắt chưa mượt","Mi hở keo","Má chưa chuyển tone","Viền môi chưa gọn","Layout chưa hòa sắc"]}',
        'makeup_product'
      ) returning id into product_rubric_id;

      insert into public.rubric_criteria
        (organization_id, rubric_id, title, description, max_score, position, required, skill_key)
      values
        (org.id, product_rubric_id, 'Lớp nền & xử lý khuyết điểm', 'Nền mỏng, đều màu, đúng sắc độ da; che phủ vừa đủ, không mốc/cakey và sạch vùng cánh mũi, khóe miệng.', 18, 1, true, 'foundation'),
        (org.id, product_rubric_id, 'Lông mày & độ cân đối', 'Dáng mày phù hợp cấu trúc gương mặt, hai bên cân đối; đầu mày mềm, thân và đuôi gọn, màu hài hòa.', 10, 2, true, 'brows'),
        (org.id, product_rubric_id, 'Mắt & chuyển màu', 'Bố cục màu mắt đúng layout, chuyển màu sạch và có chiều sâu; hai mắt cân đối, không lem hoặc đọng phấn.', 14, 3, true, 'eyes'),
        (org.id, product_rubric_id, 'Mi, eyeliner & độ gọn chân mi', 'Mi ôm sát chân mi thật, cân hai bên, không hở keo; eyeliner sạch, đúng hướng và phù hợp dáng mắt.', 10, 4, true, 'lashes'),
        (org.id, product_rubric_id, 'Khối, bắt sáng & cấu trúc gương mặt', 'Khối và bắt sáng đúng cấu trúc, ranh giới được tán mềm; tạo chiều sâu mà không bẩn, xám hoặc nặng mặt.', 10, 5, true, 'contour'),
        (org.id, product_rubric_id, 'Má & độ chuyển tone', 'Vị trí má nâng gương mặt, chuyển màu mượt, sắc độ vừa phải và kết nối tự nhiên với mắt, môi và nền.', 8, 6, true, 'cheeks'),
        (org.id, product_rubric_id, 'Son môi & viền môi', 'Viền môi gọn và cân, màu son đều, xử lý khóe môi sạch; dáng và màu môi phù hợp tổng thể layout.', 10, 7, true, 'lips'),
        (org.id, product_rubric_id, 'Layout, tỷ lệ & hòa sắc tổng thể', 'Đúng chủ đề và tone yêu cầu; tỷ lệ các chi tiết hài hòa, có điểm nhấn, phù hợp mẫu và thể hiện tư duy thẩm mỹ.', 15, 8, true, 'layout'),
        (org.id, product_rubric_id, 'Độ hoàn thiện & sạch nghề', 'Tổng thể sạch, tinh gọn, không lem/rơi phấn/keo thừa; sản phẩm sẵn sàng chụp cận cảnh và bàn giao khách.', 5, 9, true, 'process');
    end if;
  end loop;
end $$;
