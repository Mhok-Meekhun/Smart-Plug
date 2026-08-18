-- Prisma represents PostgreSQL scalar lists as non-null arrays. Normalize the
-- one-time schedule representation so API writes and database constraints agree.
alter table public.device_schedules
  drop constraint device_schedules_check,
  drop constraint device_schedules_weekdays_check;

update public.device_schedules
set weekdays = '{}'::smallint[]
where weekdays is null;

alter table public.device_schedules
  alter column weekdays set default '{}'::smallint[],
  alter column weekdays set not null,
  add constraint device_schedules_kind_fields_check check (
    (kind = 'ONCE' and execute_at is not null and local_time is null
      and cardinality(weekdays) = 0)
    or
    (kind = 'REPEATING' and execute_at is null and local_time is not null
      and cardinality(weekdays) between 1 and 7)
  ),
  add constraint device_schedules_weekdays_range_check check (
    weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  );
