# Render deployment

The root `render.yaml` Blueprint initially creates only the free web application
and API services. Supabase remains the database and authentication system of
record; the Blueprint deliberately does not create Render Postgres.

The paid IoT worker is intentionally deferred. Its preserved service definition
is in `infra/render/paid-worker.yaml.example` and must not be added to the root
Blueprint until the owner approves the current Render price and production MQTT
credentials are available.

## Before the first deploy

1. In Supabase, copy a pooled PostgreSQL connection string for long-running
   services. Use transaction mode only when compatible with Prisma's prepared
   statement behavior; otherwise use the session pooler.
2. Create the Render Blueprint from this GitHub repository.
3. Fill every environment variable marked `sync: false` in the Render dashboard.
4. Set `NEXT_PUBLIC_API_URL` to the public HTTPS URL of `smart-home-api` and
   `WEB_ORIGIN` to the public HTTPS URL of `smart-home-web`.
5. Add the web URL and `/auth/callback` equivalent to the Supabase Auth redirect
   allow list before enabling production sign-in.

## Required dashboard values

| Service | Variable | Source |
| --- | --- | --- |
| Web | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| Web | `NEXT_PUBLIC_API_URL` | Render API URL |
| API | `DATABASE_URL` | Supabase session pooler connection string |
| API | `WEB_ORIGIN` | Render web URL |
Never put secret values in Git, `render.yaml`, browser environment variables,
or build logs.

## Adding the paid IoT worker later

1. Create a managed MQTT cluster and worker credentials with TLS enabled.
2. Review and explicitly approve the current Render background-worker price.
3. Copy the worker service from `infra/render/paid-worker.yaml.example` into the
   root `render.yaml` `services` list.
4. Commit and push the Blueprint change.
5. Add `DATABASE_URL`, `SUPABASE_SECRET_KEY`, `MQTT_URL`, `MQTT_USERNAME`, and
   `MQTT_PASSWORD` in Render before starting the worker.
6. Verify MQTT connectivity, command acknowledgements, and worker logs.

## Deployment gates

- GitHub Actions must pass type-check, unit tests, and production builds.
- Supabase migration history must match the files in `supabase/migrations`.
- Supabase security advisor must have no unresolved application findings.
- API `/health` and `/ready` must return 200 after deployment.
- After the paid worker is added, its logs must show one MQTT connection and no
  credential details.
- After the paid worker is added, a simulator command must progress from
  `PENDING` to `SENT` and then `ACKNOWLEDGED`; the UI must only show the relay as
  confirmed after the ack.

The deferred worker uses a paid Render `starter` instance because background
workers do not offer a free plan. Review the current price before adding it.
