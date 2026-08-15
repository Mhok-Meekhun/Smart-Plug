# ADR 0001: Platform service boundaries

- Status: Accepted
- Date: 2026-08-15

## Decision

Use a TypeScript monorepo with independently deployable Next.js web, NestJS API, and long-running IoT worker applications. Supabase provides PostgreSQL and human authentication. Device transport remains isolated behind MQTT and the worker.

The browser may use Supabase directly only for authentication and authorized private Realtime subscriptions. Business reads and writes go through the API.

## Consequences

- UI code cannot access MQTT or privileged Supabase credentials.
- The API owns human authorization and durable command creation.
- The worker owns device transport, telemetry ingestion, acknowledgements, offline detection, schedules, and aggregation until scale requires splitting it.
