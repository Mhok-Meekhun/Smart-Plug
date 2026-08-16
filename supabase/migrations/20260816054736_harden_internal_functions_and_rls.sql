-- Keep internal database functions outside the exposed Data API schema.
create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.set_updated_at() set schema private;
alter function public.handle_new_user() set schema private;
alter function public.handle_new_home() set schema private;
alter function public.is_home_member(uuid, uuid) set schema private;
alter function public.is_home_owner(uuid, uuid) set schema private;

revoke all on function private.set_updated_at() from public, anon,
  authenticated, service_role;
revoke all on function private.handle_new_user() from public, anon,
  authenticated, service_role;
revoke all on function private.handle_new_home() from public, anon,
  authenticated, service_role;

revoke all on function private.is_home_member(uuid, uuid) from public, anon;
revoke all on function private.is_home_owner(uuid, uuid) from public, anon;
grant execute on function private.is_home_member(uuid, uuid)
  to authenticated, service_role;
grant execute on function private.is_home_owner(uuid, uuid)
  to authenticated, service_role;

-- New functions should be private by default unless a migration explicitly
-- grants API access to a deliberate RPC endpoint.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

drop policy profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
for select to authenticated using (id = (select auth.uid()));

drop policy profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy homes_insert_creator on public.homes;
create policy homes_insert_creator on public.homes
for insert to authenticated
with check (created_by = (select auth.uid()));

create index devices_room_home_fk_idx
  on public.devices(room_id, home_id);

-- This platform-managed event-trigger function is not an application RPC.
revoke all on function public.rls_auto_enable() from public, anon,
  authenticated, service_role;
