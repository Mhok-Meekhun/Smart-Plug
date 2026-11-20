#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <PZEM004Tv30.h>
#include <math.h>
#include <WiFi.h>
#include <WebServer.h>
#if __has_include("wifi_secrets.h")
#include "wifi_secrets.h"
#else
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#endif

// Confirm actual wiring and safe interface levels before connecting hardware.
constexpr int I2C_SDA_PIN = 21, I2C_SCL_PIN = 22;
constexpr uint8_t LCD_ADDRESS = 0x27;
constexpr int PZEM_RX_PIN = 16, PZEM_TX_PIN = 17;
constexpr unsigned long SAMPLE_INTERVAL_MS = 2000, PAGE_INTERVAL_MS = 4000;

LiquidCrystal_I2C lcd(LCD_ADDRESS, 16, 2);
PZEM004Tv30 pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);
bool lcdReady = false, readingValid = false;
float voltage, current, power, energy, powerFactor;
unsigned long lastSample = 0, lastPageChange = 0;
uint8_t page = 0;
WebServer server(80);
unsigned long lastWifiAttempt = 0, lastValidSample = 0;
bool hasSample = false;

const char PAGE_HTML[] PROGMEM = R"HTML(<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Smart Plug - Wi-Fi Test</title><style>body{font:16px system-ui;background:#f4f8f5;color:#173526;margin:0;padding:24px}main{max-width:700px;margin:auto}h1{font-size:1.5rem}.card{background:white;padding:20px;border-radius:18px;margin:12px 0;box-shadow:0 4px 18px #183d2610}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}.value{font-size:1.4rem;font-weight:700;color:#238442}small{color:#52675a}</style></head><body><main><h1>ทดสอบการเชื่อมต่อ Smart Plug</h1><div class="card"><strong id="status">กำลังเชื่อมต่อ...</strong><p><small>ข้อมูลจาก ESP32 บนเครือข่ายภายใน · ไม่ใช่อุปกรณ์จำลอง</small></p></div><div class="grid" id="metrics"></div><p><small id="updated">ยังไม่ได้รับข้อมูล</small></p><p><small>หน้านี้เป็นการทดสอบภายใน ยังไม่ได้บันทึกข้อมูลลงเว็บแอปหลัก</small></p></main><script>const m=document.getElementById('metrics'),s=document.getElementById('status'),u=document.getElementById('updated');function field(n,v,unit){const d=document.createElement('div');d.className='card';const l=document.createElement('small');l.textContent=n;const p=document.createElement('div');p.className='value';p.textContent=v+' '+unit;d.append(l,p);return d}async function refresh(){try{const r=await fetch('/api/readings',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error();const d=await r.json();m.replaceChildren();if(!d.valid){s.textContent='เชื่อมต่อ ESP32 แล้ว · อ่าน PZEM ไม่สำเร็จ';u.textContent='ไม่มีค่าที่ใช้งานได้';return}s.textContent=d.ageMs>10000?'เชื่อมต่อแล้ว · ข้อมูลเก่า':'เชื่อมต่อ ESP32 แล้ว';for(const [n,k,unit,digits] of [['แรงดัน','voltage','V',1],['กระแส','current','A',3],['กำลัง','power','W',1],['พลังงานสะสม','energy','kWh',3],['Power factor','powerFactor','',2]])m.append(field(n,d[k].toFixed(digits),unit));u.textContent='อายุข้อมูล '+(d.ageMs/1000).toFixed(1)+' วินาที'}catch{s.textContent='ขาดการเชื่อมต่อ ESP32';u.textContent='ตรวจสอบ Wi-Fi และที่อยู่หน้าเว็บ';m.replaceChildren()}}refresh();setInterval(refresh,3000)</script></body></html>)HTML";

void configureWebServer() {
  server.on("/", HTTP_GET, []() { server.send_P(200, "text/html; charset=utf-8", PAGE_HTML); });
  server.on("/api/readings", HTTP_GET, []() {
    server.sendHeader("Cache-Control", "no-store");
    const unsigned long age = millis() - lastValidSample;
    if (!readingValid || !hasSample || age > 10000) {
      server.send(200, "application/json", "{\"valid\":false}");
      return;
    }
    char json[256];
    snprintf(json, sizeof(json), "{\"valid\":true,\"ageMs\":%lu,\"voltage\":%.1f,\"current\":%.3f,\"power\":%.1f,\"energy\":%.3f,\"powerFactor\":%.2f}", age, voltage, current, power, energy, powerFactor);
    server.send(200, "application/json", json);
  });
  server.begin();
}

void showReading() {
  if (!lcdReady) return;
  lcd.clear();
  if (!readingValid) {
    lcd.setCursor(0, 0); lcd.print("PZEM read error");
    lcd.setCursor(0, 1); lcd.print("Check sensor");
    return;
  }
  lcd.setCursor(0, 0);
  if (page == 0) {
    lcd.print("V:"); lcd.print(voltage, 1); lcd.print(" V");
    lcd.setCursor(0, 1); lcd.print("I:"); lcd.print(current, 3); lcd.print(" A");
  } else if (page == 1) {
    lcd.print("P:"); lcd.print(power, 1); lcd.print(" W");
    lcd.setCursor(0, 1); lcd.print("PF:"); lcd.print(powerFactor, 2);
  } else {
    lcd.print("Energy:");
    lcd.setCursor(0, 1); lcd.print(energy, 3); lcd.print(" kWh");
  }
}

void sampleMeter() {
  voltage = pzem.voltage(); current = pzem.current(); power = pzem.power();
  energy = pzem.energy(); powerFactor = pzem.pf();
  readingValid = isfinite(voltage) && isfinite(current) && isfinite(power) &&
                 isfinite(energy) && isfinite(powerFactor);
  if (!readingValid) {
    Serial.println("PZEM read error: measurement unavailable");
  } else {
    hasSample = true;
    lastValidSample = millis();
    Serial.printf("V=%.1f V | I=%.3f A | P=%.1f W | E=%.3f kWh | PF=%.2f\n",
                  voltage, current, power, energy, powerFactor);
  }
  showReading();
}

void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Serial.println("\nScanning I2C bus...");
  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) {
      Serial.printf("I2C device found: 0x%02X\n", address);
      if (address == LCD_ADDRESS) lcdReady = true;
    }
  }
  if (lcdReady) {
    lcd.init(); lcd.backlight();
    lcd.setCursor(0, 0); lcd.print("Smart Plug Test");
    lcd.setCursor(0, 1); lcd.print("Starting...");
  } else {
    Serial.println("LCD address not found; use Serial Monitor.");
  }
  Serial.println("PZEM read-only test; energy counter will not be reset.");
  if (WIFI_SSID[0] != '\0') {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    configureWebServer();
    Serial.println("Connecting to Wi-Fi...");
  } else {
    Serial.println("Wi-Fi not configured: create wifi_secrets.h from the example.");
  }
  sampleMeter();
  lastSample = millis(); lastPageChange = millis();
}

void loop() {
  server.handleClient();
  const unsigned long now = millis();
  static bool wasConnected = false;
  const bool connected = WiFi.status() == WL_CONNECTED;
  if (connected && !wasConnected) {
    Serial.print("Wi-Fi connected. Open http://"); Serial.println(WiFi.localIP());
  }
  if (!connected && wasConnected) Serial.println("Wi-Fi disconnected.");
  wasConnected = connected;
  if (!connected && WIFI_SSID[0] != '\0' && now - lastWifiAttempt >= 30000) {
    lastWifiAttempt = now; WiFi.reconnect();
  }
  if (now - lastSample >= SAMPLE_INTERVAL_MS) {
    lastSample = now; sampleMeter();
  }
  if (now - lastPageChange >= PAGE_INTERVAL_MS) {
    lastPageChange = now; page = (page + 1) % 3; showReading();
  }
}
