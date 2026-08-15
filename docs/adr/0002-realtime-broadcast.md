# ADR 0002: Supabase private Broadcast for browser realtime

- Status: Accepted
- Date: 2026-08-15

## Decision

Publish compact domain events to authorized `home:{homeId}` Supabase Realtime channels. Do not expose raw MQTT to browsers and do not stream every telemetry row through Postgres Changes.

REST remains authoritative. After a disconnect, clients invalidate relevant queries before trusting subsequent events.

## Consequences

- Realtime loss affects freshness, not correctness.
- Channel authorization must prove home membership with RLS.
- Payloads contain only display-safe fields and stable event versions.
