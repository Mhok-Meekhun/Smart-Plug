# ADR 0003: Managed MQTT and distinct device identity

- Status: Accepted
- Date: 2026-08-15

## Decision

Use Mosquitto locally and EMQX Cloud Serverless for the MVP pilot. Require MQTT over TLS, unique device credentials, and per-device topic ACLs. Human Supabase credentials must never be installed on an ESP32.

Upgrade to an EMQX tier with per-device mTLS before wider production when hardware secure storage and certificate operations are ready.

## Consequences

- Browser clients never connect to MQTT.
- Device provisioning must support bootstrap credential rotation and revocation.
- QoS 1 delivery still requires application-level message and command idempotency.
