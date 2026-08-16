# Render deployment

The repository includes a `render.yaml` Blueprint for the web application, API,
and long-running IoT worker. Supabase remains the database and authentication
system of record; the Blueprint deliberately does not create Render Postgres.

## Before the first deploy

1. Create a managed MQTT cluster and worker credentials with TLS enabled.
2. In Supabase, copy a pooled PostgreSQL connection string for long-running
   services. Use transaction mode only when compatible with Prisma's prepared
   statement behavior; otherwise use the session pooler.
3. Create the Render Blueprint from this GitHub repository.
4. Fill every environment variable marked `sync: false` in the Render dashboard.
5. Set `NEXT_PUBLIC_API_URL` to the public HTTPS URL of `smart-home-api` and
   `WEB_ORIGIN` to the public HTTPS URL of `smart-home-web`.
6. Add the web URL and `/auth/callback` equivalent to the Supabase Auth redirect
   allow list before enabling production sign-in.

## Required dashboard values

| Service | Variable | Source |
| --- | --- | --- |
| Web | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| Web | `NEXT_PUBLIC_API_URL` | Render API URL |
| API | `DATABASE_URL` | Supabase session pooler connection string |
| API | `WEB_ORIGIN` | Render web URL |
| Worker | `DATABASE_URL` | Supabase session pooler connection string |
| Worker | `SUPABASE_SECRET_KEY` | Supabase secret key; worker only |
| Worker | `MQTT_URL` | Managed broker `mqtts://` endpoint |
| Worker | `MQTT_USERNAME` | Worker broker credential |
| Worker | `MQTT_PASSWORD` | Worker broker credential |

Never put secret values in Git, `render.yaml`, browser environment variables,
or build logs.

## Deployment gates

- GitHub Actions must pass type-check, unit tests, and production builds.
- Supabase migration history must match the files in `supabase/migrations`.
- Supabase security advisor must have no unresolved application findings.
- API `/health` and `/ready` must return 200 after deployment.
- Worker logs must show one MQTT connection and no credential details.
- A simulator command must progress from `PENDING` to `SENT` and then
  `ACKNOWLEDGED`; the UI must only show the relay as confirmed after the ack.

The worker uses a paid Render `starter` instance because background workers do
not offer a free plan. Review the current Render price before creating it.
