-- H2OBOOK — chạy 1 lần, gộp migration 0047 + 0048 (bản vá từ audit V2)
--
-- Dán toàn bộ file này vào Supabase → SQL Editor → Run.
-- An toàn chạy lại nhiều lần: mọi lệnh đều idempotent (drop ... if exists / create or replace /
-- create index if not exists). Không xóa và không sửa một dòng dữ liệu nào.
--
-- 0047 — bịt lỗ đọc công khai giáo trình trả phí.
--   Policy cũ chỉ lọc `status`, không xét `access`, nên bất kỳ ai dùng anon key (khóa có sẵn trong
--   mọi trình duyệt) đều đọc được tiêu đề + tóm tắt của toàn bộ 102 tài liệu qua REST API, kể cả
--   khi bạn đã khóa nội dung lại trong giao diện. Sau migration này: khách vãng lai chỉ đọc được
--   tài liệu free_preview; người đã đăng nhập vẫn đọc như cũ (phân quyền chi tiết do app quyết định).
--
-- 0048 — chuyển 2 phép tính tổng từ Node về Postgres.
--   Trước: mỗi lần upload kéo TOÀN BỘ asset của user về để cộng dung lượng; mỗi lần mở cây thư mục
--   kéo TOÀN BỘ asset của tổ chức về để đếm. Sau: Postgres trả về đúng 1 con số.
--   Sửa kèm 1 lỗi thật: bản cũ không loại asset đã xóa, nên user xóa file rồi vẫn bị tính quota.

begin;

-- ============================ 0047 ============================

drop policy if exists "career stage resources public read" on public.career_stage_resources;

create policy "career stage resources anon free preview" on public.career_stage_resources
  for select to anon
  using (status <> 'archived' and access = 'free_preview');

create policy "career stage resources member read" on public.career_stage_resources
  for select to authenticated
  using (status <> 'archived');

-- ============================ 0048 ============================

create or replace function public.asset_storage_used_bytes(p_organization_id uuid, p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(size_bytes), 0)::bigint
  from public.assets
  where organization_id = p_organization_id
    and uploaded_by = p_user_id
    and deleted_at is null;
$$;

create or replace function public.asset_folder_counts(p_organization_id uuid)
returns table (folder_id uuid, asset_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select a.folder_id, count(*)::bigint
  from public.assets a
  where a.organization_id = p_organization_id
    and a.deleted_at is null
    and a.folder_id is not null
  group by a.folder_id;
$$;

revoke all on function public.asset_storage_used_bytes(uuid, uuid) from public, anon;
revoke all on function public.asset_folder_counts(uuid) from public, anon;
grant execute on function public.asset_storage_used_bytes(uuid, uuid) to authenticated, service_role;
grant execute on function public.asset_folder_counts(uuid) to authenticated, service_role;

create index if not exists assets_org_folder_live_idx
  on public.assets(organization_id, folder_id) where deleted_at is null;

commit;

-- Kiểm tra nhanh sau khi chạy (nên trả về 2 dòng policy mới và 2 function):
--   select polname from pg_policy where polrelid = 'public.career_stage_resources'::regclass;
--   select proname from pg_proc where proname in ('asset_storage_used_bytes','asset_folder_counts');
