// USB-only bring-up test for DOIT ESP32 DEVKIT V1.
// No relay outputs, mains interfaces, Wi-Fi credentials, or meter resets.

constexpr unsigned long REPORT_INTERVAL_MS = 2000;
unsigned long lastReportMs = 0;
unsigned long reportNumber = 0;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("Smart Plug - ESP32 USB test");
  Serial.println("USB serial is working. No relay or meter is controlled.");
}

void loop() {
  const unsigned long now = millis();
  if (now - lastReportMs >= REPORT_INTERVAL_MS) {
    lastReportMs = now;
    Serial.printf("ESP32 running | message=%lu | uptime_ms=%lu\n", ++reportNumber, now);
  }
}
