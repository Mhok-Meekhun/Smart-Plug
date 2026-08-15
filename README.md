# Smart Home Energy Management Platform

A Thai/English smart-plug platform for live electrical telemetry, confirmed remote relay control, historical energy analytics, and schedules.

The current foundation includes versioned IoT contracts, a deterministic virtual smart plug, a Supabase schema with tenant-aware RLS, and an authenticated NestJS read API.

## Workspace

- `packages/contracts` - MQTT topics and Zod payload contracts.
- `tools/device-simulator` - Deterministic in-memory smart-plug behavior.
- `apps/api` - NestJS REST API with Supabase JWT verification and Prisma.
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

Copy `apps/api/.env.example` to `apps/api/.env` only for local development and replace placeholder values with the local Supabase connection details. Business endpoints require a Supabase access token. `/health` is public; `/ready` also verifies the database connection.

No real electrical load or mains wiring is required for this software slice. Hardware integration requires qualified electrical-safety review.
