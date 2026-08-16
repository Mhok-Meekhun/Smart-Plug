-- Match the versioned MQTT identifier contract used by firmware and simulator.
alter table public.telemetry_readings
  alter column message_id type varchar(80)
  using message_id::text;

alter table public.telemetry_readings
  add constraint telemetry_message_id_format
  check (message_id ~ '^[A-Za-z0-9_-]{3,80}$');
