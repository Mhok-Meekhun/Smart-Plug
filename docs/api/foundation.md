# API foundation

The API trusts Supabase for human authentication and independently enforces home membership in every database query. The browser sends its Supabase access token as `Authorization: Bearer <token>`.

## Public endpoints

- `GET /health` - process liveness.
- `GET /ready` - database readiness.
- `GET /docs` - OpenAPI UI.

## Authenticated endpoints

- `GET /v1/me` - verified Supabase identity.
- `GET /v1/homes` - homes containing the current user as a member.
- `GET /v1/homes/:homeId/rooms` - rooms, scoped through membership.
- `GET /v1/devices` - devices, optionally filtered by `homeId`, `roomId`, or `connectionStatus`.

## Security boundary

- Authentication verifies the JWT issuer, audience, expiry, signature, and UUID subject against the Supabase JWKS endpoint.
- Database queries include the authenticated user ID even though the API uses a privileged connection.
- Supabase RLS is a second boundary for authenticated direct reads and private Realtime channel joins.
- Clients may join only `home:{homeId}` Broadcast channels for homes where they are members.
- A new home automatically creates its owner membership in a security-definer trigger, preventing orphaned homes.

Production Supabase must use asymmetric JWT signing keys so the API can verify cached JWKS keys locally. Legacy shared-secret projects require key migration before deployment.
