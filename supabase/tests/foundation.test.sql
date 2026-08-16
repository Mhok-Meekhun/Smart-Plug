begin;

select plan(21);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'homes', 'homes table exists');
select has_table('public', 'home_members', 'home_members table exists');
select has_table('public', 'rooms', 'rooms table exists');
select has_table('public', 'devices', 'devices table exists');
select has_table('public', 'device_states', 'device_states table exists');
select has_table('public', 'telemetry_readings', 'telemetry table exists');
select has_table('public', 'energy_aggregates', 'energy aggregates table exists');
select has_table('public', 'device_commands', 'device commands table exists');
select has_table('public', 'device_command_outbox', 'command outbox table exists');
select has_table('public', 'device_schedules', 'device schedules table exists');
select has_table('public', 'schedule_executions', 'schedule executions table exists');
select has_table('public', 'electricity_tariffs', 'electricity tariffs table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.homes'::regclass),
  'homes has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.rooms'::regclass),
  'rooms has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.devices'::regclass),
  'devices has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.device_states'::regclass),
  'device states has RLS enabled'
);

select ok(
  exists(select 1 from pg_policies where policyname = 'homes_select_member'),
  'home membership read policy exists'
);
select ok(
  exists(select 1 from pg_policies where policyname = 'devices_select_member'),
  'device membership read policy exists'
);
select has_function(
  'private',
  'handle_new_home',
  array[]::text[],
  'private trigger function creates owner membership for new homes'
);
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'realtime'
      and policyname = 'home_members_receive_broadcasts'
  ),
  'private broadcast membership policy exists'
);

select * from finish();
rollback;
