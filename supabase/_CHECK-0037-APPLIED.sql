-- H2OBOOK — kiểm tra migration 0037 đã vào đủ chưa.
-- Chỉ đọc, không thay đổi gì. Dán vào Supabase SQL Editor và Run.
--
-- Cột "thieu" phải bằng 0 ở cả 3 dòng. Nếu có dòng nào khác 0, chạy lại
-- supabase/_RUN-0037-ONLY.sql (nay đã chạy lại được nhiều lần không lỗi).

select
  '1. bang moi'                                   as hang_muc,
  4                                               as can_co,
  count(*)                                        as dang_co,
  4 - count(*)                                    as thieu
from information_schema.tables
where table_schema = 'public'
  and table_name in ('asset_folders','asset_tags','asset_tag_links','asset_saved_views')

union all

select
  '2. cot moi tren bang assets',
  15,
  count(*),
  15 - count(*)
from information_schema.columns
where table_schema = 'public' and table_name = 'assets'
  and column_name in (
    'title','description','asset_subtype','folder_id','owner_user_id','reviewer_user_id',
    'classification_status','review_status','lifecycle_status','language_code',
    'rights_status','rights_expires_at','source_origin','page_count','duration_seconds')

union all

select
  '3. policy bao ve',
  8,
  count(*),
  8 - count(*)
from pg_policies
where schemaname = 'public'
  and tablename in ('asset_folders','asset_tags','asset_tag_links','asset_saved_views');
