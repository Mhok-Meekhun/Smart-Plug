-- Explicitly deny client outbox access and cover remaining foreign keys.
create policy command_outbox_no_client_access
on public.device_command_outbox
for all
to anon, authenticated
using (false)
with check (false);

create index commands_requested_by_idx
  on public.device_commands(requested_by);
create index schedules_created_by_idx
  on public.device_schedules(created_by);
create index schedule_executions_command_idx
  on public.schedule_executions(command_id)
  where command_id is not null;
