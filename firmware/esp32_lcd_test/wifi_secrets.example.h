#pragma once
// Copy to wifi_secrets.h and enter your 2.4 GHz network details locally.
#define WIFI_SSID "YOUR_WIFI_NAME"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
// Generate a separate control token with: openssl rand -hex 16
#define RELAY_CONTROL_TOKEN ""
// Optional RUAN AI telemetry. The MQTT username is the registered Device ID.
#define RUAN_MQTT_URL ""
#define RUAN_DEVICE_ID ""
#define RUAN_MQTT_PASSWORD ""
// Paste the broker's CA PEM as a C++ string with \n between lines.
#define RUAN_MQTT_CA ""
// Keep at 0 until the single-device cloud relay pilot is ready.
#define RUAN_ENABLE_CLOUD_RELAY 0
