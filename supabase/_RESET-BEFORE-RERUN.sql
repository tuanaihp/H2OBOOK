-- Chạy file này TRƯỚC, trong 1 query riêng, rồi mới chạy lại _RUN-ONCE-COMBINED-MIGRATIONS.sql.
-- An toàn vì project đang trống (chưa có dữ liệu thật) — chỉ xóa sạch schema "public"
-- (bảng/kiểu dữ liệu do H2OBOOK tạo), không đụng tới auth/storage nội bộ của Supabase.

drop trigger if exists on_auth_user_created on auth.users;
drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant create on schema public to postgres;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
