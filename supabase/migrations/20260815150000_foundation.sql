create extension if not exists pgcrypto with schema extensions;

create type public.app_locale as enum ('th', 'en');
create type public.home_member_role as enum ('OWNER', 'MEMBER');
create type public.device_lifecycle_status as enum (
  'UNPAIRED', 'ACTIVE', 'DISABLED', 'REVOKED'
);
create type public.device_connection_status as enum (
  'ONLINE', 'OFFLINE', 'CONNECTING', 'ERROR'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name varchar(120),
  locale public.app_locale not null default 'th',
  timezone varchar(80) not null default 'Asia/Bangkok',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.homes (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null check (length(btrim(name)) between 1 and 120),
  timezone varchar(80) not null default 'Asia/Bangkok',
  currency char(3) not null default 'THB',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.home_members (
  home_id uuid not null references public.homes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.home_member_role not null default 'MEMBER',
  created_at timestamptz not null default now(),
  primary key (home_id, user_id)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  name varchar(120) not null check (length(btrim(name)) between 1 and 120),
  icon varchar(60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (home_id, name),
  unique (id, home_id)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  hardware_id varchar(120) not null unique,
  home_id uuid not null references public.homes(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  name varchar(120) not null check (length(btrim(name)) between 1 and 120),
  type varchar(40) not null default 'SMART_PLUG',
  icon varchar(60),
  firmware_version varchar(40),
  rated_current_a numeric(6, 2) not null default 16
    check (rated_current_a > 0 and rated_current_a <= 100),
  lifecycle_status public.device_lifecycle_status not null default 'UNPAIRED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_room_home_consistency
    foreign key (room_id, home_id)
    references public.rooms(id, home_id)
);

create table public.device_states (
  device_id uuid primary key references public.devices(id) on delete cascade,
  connection_status public.device_connection_status not null default 'OFFLINE',
  relay_state boolean not null default false,
  voltage_v numeric(7, 2),
  current_a numeric(9, 3),
  power_w numeric(10, 2),
  energy_kwh numeric(14, 6),
  sequence bigint,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  check (voltage_v is null or voltage_v between 0 and 300),
  check (current_a is null or current_a between 0 and 100),
  check (power_w is null or power_w between 0 and 25000),
  check (energy_kwh is null or energy_kwh >= 0),
  check (sequence is null or sequence >= 0)
);

create index homes_created_by_idx on public.homes(created_by);
create index home_members_user_home_idx on public.home_members(user_id, home_id);
create index rooms_home_sort_idx on public.rooms(home_id, sort_order);
create index devices_home_room_idx on public.devices(home_id, room_id);
create index devices_home_lifecycle_idx
  on public.devices(home_id, lifecycle_status);
create index device_states_connection_seen_idx
  on public.device_states(connection_status, last_seen_at);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger homes_set_updated_at
before update on public.homes
for each row execute function public.set_updated_at();
create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();
create trigger devices_set_updated_at
before update on public.devices
for each row execute function public.set_updated_at();
create trigger device_states_set_updated_at
before update on public.device_states
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.handle_new_home()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.home_members (home_id, user_id, role)
  values (new.id, new.created_by, 'OWNER');
  return new;
end;
$$;

create trigger on_home_created
after insert on public.homes
for each row execute function public.handle_new_home();

create function public.is_home_member(target_home_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.home_members membership
    where membership.home_id = target_home_id
      and membership.user_id = target_user_id
  );
$$;

create function public.is_home_owner(target_home_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.home_members membership
    where membership.home_id = target_home_id
      and membership.user_id = target_user_id
      and membership.role = 'OWNER'
  );
$$;

revoke all on function public.is_home_member(uuid, uuid) from public;
revoke all on function public.is_home_owner(uuid, uuid) from public;
grant execute on function public.is_home_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_home_owner(uuid, uuid) to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.homes enable row level security;
alter table public.home_members enable row level security;
alter table public.rooms enable row level security;
alter table public.devices enable row level security;
alter table public.device_states enable row level security;

create policy profiles_select_self on public.profiles
for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy homes_select_member on public.homes
for select to authenticated using (public.is_home_member(id));
create policy homes_insert_creator on public.homes
for insert to authenticated with check (created_by = auth.uid());
create policy homes_update_owner on public.homes
for update to authenticated using (public.is_home_owner(id))
with check (public.is_home_owner(id));
create policy homes_delete_owner on public.homes
for delete to authenticated using (public.is_home_owner(id));

create policy home_members_select_member on public.home_members
for select to authenticated using (public.is_home_member(home_id));
create policy home_members_insert_owner on public.home_members
for insert to authenticated with check (public.is_home_owner(home_id));
create policy home_members_update_owner on public.home_members
for update to authenticated using (public.is_home_owner(home_id))
with check (public.is_home_owner(home_id));
create policy home_members_delete_owner on public.home_members
for delete to authenticated using (public.is_home_owner(home_id));

create policy rooms_select_member on public.rooms
for select to authenticated using (public.is_home_member(home_id));
create policy rooms_insert_owner on public.rooms
for insert to authenticated with check (public.is_home_owner(home_id));
create policy rooms_update_owner on public.rooms
for update to authenticated using (public.is_home_owner(home_id))
with check (public.is_home_owner(home_id));
create policy rooms_delete_owner on public.rooms
for delete to authenticated using (public.is_home_owner(home_id));

create policy devices_select_member on public.devices
for select to authenticated using (public.is_home_member(home_id));
create policy devices_insert_owner on public.devices
for insert to authenticated with check (public.is_home_owner(home_id));
create policy devices_update_owner on public.devices
for update to authenticated using (public.is_home_owner(home_id))
with check (public.is_home_owner(home_id));
create policy devices_delete_owner on public.devices
for delete to authenticated using (public.is_home_owner(home_id));

create policy device_states_select_member on public.device_states
for select to authenticated using (
  exists (
    select 1 from public.devices device
    where device.id = device_id
      and public.is_home_member(device.home_id)
  )
);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.homes to authenticated;
grant select, insert, update, delete on public.home_members to authenticated;
grant select, insert, update, delete on public.rooms to authenticated;
grant select, insert, update, delete on public.devices to authenticated;
grant select on public.device_states to authenticated;
grant all on public.profiles, public.homes, public.home_members,
  public.rooms, public.devices, public.device_states to service_role;

create policy home_members_receive_broadcasts
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and case
    when (select realtime.topic()) ~
      '^home:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then public.is_home_member(
      split_part((select realtime.topic()), ':', 2)::uuid
    )
    else false
  end
);
