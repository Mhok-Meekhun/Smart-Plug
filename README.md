# Smart Home Energy Management Platform

A Thai/English smart-plug platform for live electrical telemetry, confirmed remote relay control, historical energy analytics, and schedules.

The current implementation includes a responsive bilingual Next.js dashboard,
Supabase Auth and tenant-aware RLS, a NestJS API, durable MQTT commands,
telemetry and energy aggregates, schedules, a long-running IoT worker, and a
networked virtual smart plug.

The free hosted slice includes authenticated home and room creation plus an
explicit software-only smart-plug simulator, allowing the complete onboarding
and confirmed test-control flow to be exercised before enabling paid IoT
infrastructure.

The connected energy screen reads daily aggregates from the API and calculates
an explicitly labelled estimated cost from the owner-configurable flat tariff.

The Add Device screen now implements the software pairing milestone: expiring
single-use codes, transactional ownership claim, staged per-device credentials,
rotation and revocation APIs, sanitized audit events, and a virtual pairing path
that exercises the same controls without hardware or paid services. Physical
SoftAP guidance is present, while firmware bootstrap exchange and managed MQTT
credential registration remain intentionally deferred.

## Workspace

- `packages/contracts` - MQTT topics and Zod payload contracts.
- `tools/device-simulator` - Deterministic in-memory smart-plug behavior.
- `apps/api` - NestJS REST API with Supabase JWT verification and Prisma.
- `apps/web` - Thai/English Next.js application and responsive dashboard.
- `apps/iot-worker` - MQTT ingestion, command outbox, schedules, and aggregates.
- `packages/domain` - Shared schedule and electricity-cost calculations.
- `packages/database-types` - Types generated from the deployed Supabase schema.
- `supabase` - Local configuration, SQL migrations, and pgTAP checks.
- `docs/adr` - Accepted architecture decisions.

## Local checks

Use Node.js 24 LTS and pnpm 10.

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Start the web interface with `pnpm --filter @smart-home/web dev`. For the local
MQTT broker, run `docker compose up mqtt`, then configure the worker and device
simulator from their `.env.example` files.

Copy `apps/api/.env.example` to `apps/api/.env` only for local development and replace placeholder values with the local Supabase connection details. Business endpoints require a Supabase access token. `/health` is public; `/ready` also verifies the database connection.

No real electrical load or mains wiring is required for this software slice. Hardware integration requires qualified electrical-safety review.

Render deployment configuration and required environment values are documented
in `docs/deployment/render.md`.
