# API foundation

The API trusts Supabase for human authentication and independently enforces home membership in every database query. The browser sends its Supabase access token as `Authorization: Bearer <token>`.

## Public endpoints

- `GET /health` - process liveness.
- `GET /ready` - database readiness.
- `GET /docs` - OpenAPI UI.

## Authenticated endpoints

- `GET /v1/me` - verified Supabase identity.
- `GET /v1/homes` - homes containing the current user as a member.
- `POST /v1/homes` - create a home with the current user as owner.
- `GET /v1/homes/:homeId/rooms` - rooms, scoped through membership.
- `POST /v1/homes/:homeId/rooms` - create a room; owner membership required.
- `GET /v1/homes/:homeId/tariff` - read the current estimated flat tariff.
- `PUT /v1/homes/:homeId/tariff` - create or update the estimated flat tariff; owner membership required.
- `GET /v1/devices` - devices, optionally filtered by `homeId`, `roomId`, or `connectionStatus`.
- `POST /v1/devices/simulated` - create an explicitly labelled software-only test plug in an owned home and room.
- `POST /v1/devices/:deviceId/commands/relay` - create a durable relay command. Simulated plugs acknowledge through the software simulator path; physical plugs remain pending until the IoT worker receives a device acknowledgement.

## Onboarding slice

The free deployment supports a safe end-to-end onboarding path without mains
hardware or the paid IoT worker:

1. Create a home.
2. Create a room inside that home.
3. Create a `SIMULATED_SMART_PLUG`.
4. Test confirmed ON/OFF commands from the device list.

Simulated devices are permanently marked by type and firmware version. They do
not represent provisioned ESP32 hardware and must not be presented as physical
relay confirmation.

New simulated devices receive seven completed days of deterministic daily
aggregate data so the energy UI can be tested without fake raw telemetry. New
homes receive a default 4.2 THB/kWh flat estimate that an owner can edit. Cost
results remain explicitly labelled as estimates.

## Security boundary

- Authentication verifies the JWT issuer, audience, expiry, signature, and UUID subject against the Supabase JWKS endpoint.
- Database queries include the authenticated user ID even though the API uses a privileged connection.
- Supabase RLS is a second boundary for authenticated direct reads and private Realtime channel joins.
- Clients may join only `home:{homeId}` Broadcast channels for homes where they are members.
- A new home automatically creates its owner membership in a security-definer trigger, preventing orphaned homes.

Production Supabase must use asymmetric JWT signing keys so the API can verify cached JWKS keys locally. Legacy shared-secret projects require key migration before deployment.
