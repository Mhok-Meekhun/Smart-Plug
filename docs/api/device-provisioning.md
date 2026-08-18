# Device provisioning and pairing

The MVP uses ESP32 SoftAP for local Wi-Fi delivery and a separate, short-lived
cloud pairing code for ownership claim. Wi-Fi credentials never enter the
application API, Supabase, or application logs.

## Authenticated human API

- `POST /v1/provisioning/virtual` creates a software-only device identity and a
  10-minute pairing code. The clear code is returned once; only its SHA-256 hash
  is stored.
- `POST /v1/provisioning/claim` atomically consumes a code, validates owner
  access to the selected home and room, creates the device, stages a unique
  credential, and appends a sanitized audit event.
- `GET /v1/devices/{deviceId}/credentials` returns credential metadata only.
  Secret hashes are never returned.
- `POST /v1/devices/{deviceId}/credentials/rotate` revokes the current
  credential and returns a staged replacement secret once.
- `DELETE /v1/devices/{deviceId}/credentials/{credentialId}` revokes one
  credential idempotently.
- `GET /v1/devices/{deviceId}/provisioning-events` returns up to 50 sanitized
  audit events to a verified home owner.

Pairing codes are normalized by removing hyphens and converting to uppercase.
Invalid, expired, and previously used codes return the same public error so the
endpoint does not disclose device ownership or lifecycle details.

## Credential boundary

Credentials are `STAGED` until the future broker-registration operation
installs the matching identity and topic ACL in EMQX. The browser never receives
credential hashes. In the virtual flow, the one-time secret exists only in the
claim response and is deliberately not rendered, logged, or stored by the web
application.

The internal pairing, credential, and audit tables have RLS enabled, explicit
restrictive browser policies, and no grants for `anon` or `authenticated`.
Business operations go through the authenticated NestJS API.

## Hardware boundary

The physical-device option documents the intended flow but does not claim that
a normal website can scan Wi-Fi networks or access BLE everywhere. Production
firmware still needs a bootstrap-authenticated endpoint to request a code and a
secure device-side channel to receive the one-time permanent credential.
