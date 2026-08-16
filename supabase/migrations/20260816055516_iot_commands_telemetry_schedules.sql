-- Durable telemetry, command, schedule, and tariff domain tables.
create type public.energy_bucket_size as enum ('MINUTE', 'HOUR', 'DAY');
create type public.device_command_status as enum (
  'PENDING', 'SENT', 'ACKNOWLEDGED', 'FAILED', 'TIMED_OUT', 'CANCELLED'
);
create type public.schedule_kind as enum ('ONCE', 'REPEATING');
create type public.schedule_execution_status as enum (
  'PENDING', 'COMMAND_CREATED', 'FAILED', 'SKIPPED'
);

create table public.telemetry_readings (
  id bigint generated always as identity,
  message_id uuid not null,
  device_id uuid not null references public.devices(id) on delete cascade,
  sequence bigint not null check (sequence >= 0),
  device_timestamp timestamptz not null,
  server_received_at timestamptz not null default now(),
  voltage_v numeric(7, 2) not null check (voltage_v between 0 and 300),
  current_a numeric(9, 3) not null check (current_a between 0 and 100),
  power_w numeric(10, 2) not null check (power_w between 0 and 25000),
  energy_kwh numeric(14, 6) not null check (energy_kwh >= 0),
  frequency_hz numeric(6, 2),
  power_factor numeric(5, 4),
  signal_strength_dbm smallint,
  primary key (id, server_received_at),
  unique (device_id, message_id),
  check (frequency_hz is null or frequency_hz between 40 and 70),
  check (power_factor is null or power_factor between 0 and 1),
  check (signal_strength_dbm is null or signal_strength_dbm between -120 and 0)
);

create table public.energy_aggregates (
  device_id uuid not null references public.devices(id) on delete cascade,
  bucket_size public.energy_bucket_size not null,
  bucket_start timestamptz not null,
  sample_count integer not null check (sample_count >= 0),
  energy_kwh numeric(14, 6) not null check (energy_kwh >= 0),
  average_power_w numeric(10, 2) not null check (average_power_w >= 0),
  peak_power_w numeric(10, 2) not null check (peak_power_w >= 0),
  minimum_voltage_v numeric(7, 2),
  maximum_voltage_v numeric(7, 2),
  calculated_at timestamptz not null default now(),
  primary key (device_id, bucket_size, bucket_start)
);

create table public.device_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  desired_relay_state boolean not null,
  status public.device_command_status not null default 'PENDING',
  idempotency_key varchar(120) not null,
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  acknowledged_at timestamptz,
  expires_at timestamptz not null,
  attempt_count smallint not null default 0 check (attempt_count between 0 and 10),
  failure_code varchar(80),
  failure_message varchar(300),
  acknowledgement_payload jsonb,
  updated_at timestamptz not null default now(),
  unique (device_id, idempotency_key),
  check (expires_at > requested_at)
);

create table public.device_command_outbox (
  command_id uuid primary key references public.device_commands(id) on delete cascade,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by varchar(120),
  published_at timestamptz,
  last_error varchar(300),
  created_at timestamptz not null default now()
);

create table public.device_schedules (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name varchar(120) not null check (length(btrim(name)) between 1 and 120),
  kind public.schedule_kind not null,
  desired_relay_state boolean not null,
  timezone varchar(80) not null default 'Asia/Bangkok',
  execute_at timestamptz,
  local_time time,
  weekdays smallint[],
  enabled boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'ONCE' and execute_at is not null and local_time is null and weekdays is null)
    or
    (kind = 'REPEATING' and execute_at is null and local_time is not null
      and weekdays is not null and cardinality(weekdays) between 1 and 7)
  ),
  check (weekdays is null or weekdays <@ array[0,1,2,3,4,5,6]::smallint[])
);

create table public.schedule_executions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.device_schedules(id) on delete cascade,
  scheduled_for timestamptz not null,
  status public.schedule_execution_status not null default 'PENDING',
  command_id uuid references public.device_commands(id) on delete set null,
  failure_message varchar(300),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (schedule_id, scheduled_for)
);

create table public.electricity_tariffs (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  name varchar(120) not null,
  currency char(3) not null default 'THB',
  flat_rate_per_kwh numeric(12, 4) not null check (flat_rate_per_kwh >= 0),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  unique (home_id, effective_from)
);

create index telemetry_device_received_idx
  on public.telemetry_readings(device_id, server_received_at desc);
create index telemetry_received_brin_idx
  on public.telemetry_readings using brin(server_received_at);
create index energy_aggregates_range_idx
  on public.energy_aggregates(bucket_size, bucket_start desc, device_id);
create index commands_device_requested_idx
  on public.device_commands(device_id, requested_at desc);
create index commands_pending_idx
  on public.device_commands(status, expires_at)
  where status in ('PENDING', 'SENT');
create index command_outbox_available_idx
  on public.device_command_outbox(available_at)
  where published_at is null;
create index schedules_due_idx
  on public.device_schedules(next_run_at)
  where enabled = true;
create index schedules_device_idx
  on public.device_schedules(device_id, created_at desc);
create index schedule_executions_schedule_idx
  on public.schedule_executions(schedule_id, scheduled_for desc);
create index tariffs_home_effective_idx
  on public.electricity_tariffs(home_id, effective_from desc);

create trigger device_commands_set_updated_at
before update on public.device_commands
for each row execute function private.set_updated_at();
create trigger device_schedules_set_updated_at
before update on public.device_schedules
for each row execute function private.set_updated_at();
create trigger electricity_tariffs_set_updated_at
before update on public.electricity_tariffs
for each row execute function private.set_updated_at();

alter table public.telemetry_readings enable row level security;
alter table public.energy_aggregates enable row level security;
alter table public.device_commands enable row level security;
alter table public.device_command_outbox enable row level security;
alter table public.device_schedules enable row level security;
alter table public.schedule_executions enable row level security;
alter table public.electricity_tariffs enable row level security;

create policy telemetry_select_member on public.telemetry_readings
for select to authenticated using (
  exists (
    select 1 from public.devices device
    where device.id = device_id
      and private.is_home_member(device.home_id)
  )
);

create policy energy_aggregates_select_member on public.energy_aggregates
for select to authenticated using (
  exists (
    select 1 from public.devices device
    where device.id = device_id
      and private.is_home_member(device.home_id)
  )
);

create policy commands_select_member on public.device_commands
for select to authenticated using (
  exists (
    select 1 from public.devices device
    where device.id = device_id
      and private.is_home_member(device.home_id)
  )
);

create policy schedules_select_member on public.device_schedules
for select to authenticated using (
  exists (
    select 1 from public.devices device
    where device.id = device_id
      and private.is_home_member(device.home_id)
  )
);

create policy schedule_executions_select_member on public.schedule_executions
for select to authenticated using (
  exists (
    select 1
    from public.device_schedules schedule
    join public.devices device on device.id = schedule.device_id
    where schedule.id = schedule_id
      and private.is_home_member(device.home_id)
  )
);

create policy tariffs_select_member on public.electricity_tariffs
for select to authenticated using (private.is_home_member(home_id));

grant select on public.telemetry_readings, public.energy_aggregates,
  public.device_commands, public.device_schedules, public.schedule_executions,
  public.electricity_tariffs to authenticated;
grant all on public.telemetry_readings, public.energy_aggregates,
  public.device_commands, public.device_command_outbox, public.device_schedules,
  public.schedule_executions, public.electricity_tariffs to service_role;
grant usage, select on sequence public.telemetry_readings_id_seq to service_role;
