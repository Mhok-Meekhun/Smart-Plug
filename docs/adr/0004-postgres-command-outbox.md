# ADR 0004: PostgreSQL transactional command outbox

- Status: Accepted
- Date: 2026-08-15

## Decision

Create the device command and its outbox item in one PostgreSQL transaction. The worker claims pending records with a lease and `FOR UPDATE SKIP LOCKED`, then publishes to MQTT.

Do not add Redis to the MVP solely for commands or schedules.

## Consequences

- API acceptance does not imply physical relay success.
- Worker restarts cannot silently lose accepted commands.
- Desired state, command status, and confirmed state remain separate data.
