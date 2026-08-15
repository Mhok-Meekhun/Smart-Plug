# ADR 0005: SoftAP plus expiring pairing token

- Status: Accepted
- Date: 2026-08-15

## Decision

Use ESP32 SoftAP for local Wi-Fi credential entry and a QR/short-lived token for cloud ownership claim. Wi-Fi credentials remain on the device and are never persisted in Supabase or application logs.

## Consequences

- The onboarding UI must explain temporary network switching.
- Tokens are single-use and stored only as hashes.
- Bluetooth provisioning remains a future native-app enhancement.
