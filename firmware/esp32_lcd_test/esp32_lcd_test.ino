#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <PZEM004Tv30.h>
#include <WiFi.h>
#include <WebServer.h>
#include <atomic>
#include <cJSON.h>
#include <driver/gpio.h>
#include <esp_random.h>
#include <math.h>
#include <mqtt_client.h>
#include <string.h>
#include <sys/time.h>

#if __has_include("wifi_secrets.h")
#include "wifi_secrets.h"
#else
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#endif
#ifndef RELAY_CONTROL_TOKEN
#define RELAY_CONTROL_TOKEN ""
#endif
#ifndef RUAN_MQTT_URL
#define RUAN_MQTT_URL ""
#define RUAN_DEVICE_ID ""
#define RUAN_MQTT_PASSWORD ""
#define RUAN_MQTT_CA ""
#endif
#ifndef RUAN_ENABLE_CLOUD_RELAY
#define RUAN_ENABLE_CLOUD_RELAY 1
#endif
#ifndef RUAN_RELAY_ACTIVE_LOW
#define RUAN_RELAY_ACTIVE_LOW 1
#endif

constexpr int I2C_SDA_PIN = 21, I2C_SCL_PIN = 22;
constexpr uint8_t LCD_ADDRESS = 0x27;
constexpr int PZEM_RX_PIN = 16, PZEM_TX_PIN = 17;
constexpr unsigned long SAMPLE_INTERVAL_MS = 2000, PAGE_INTERVAL_MS = 4000;
constexpr unsigned long MAX_SAMPLE_AGE_MS = 10000;
constexpr float START_CURRENT_A = 0.020f; // PZEM-004T 100 A variant
constexpr float START_POWER_W = 0.4f;

enum class LoadPhase { Unspecified, Inductive, Capacitive };
// Specify a direction only for a known load with approximately sinusoidal waveforms.
constexpr LoadPhase ASSUMED_LOAD_PHASE = LoadPhase::Unspecified;

struct PhaseStatus {
  const char* code;
  const char* lcdLabel;
};

// Disabled until the sensor, hardware OFF bias, GPIOs, and polarity are
// verified on an approved bench. The button is a local momentary input.
constexpr bool ENABLE_LOCAL_RELAY_TEST = false;
// For ESP32 + relay on an isolated low-voltage bench with AC disconnected.
constexpr bool ENABLE_RELAY_SERIAL_BENCH_TEST = false;
constexpr bool CLOUD_RELAY_ENABLED = RUAN_ENABLE_CLOUD_RELAY == 1;
constexpr bool WEB_RELAY_ENABLED = !CLOUD_RELAY_ENABLED && !ENABLE_RELAY_SERIAL_BENCH_TEST && !ENABLE_LOCAL_RELAY_TEST &&
                                   WIFI_SSID[0] != '\0' && sizeof(RELAY_CONTROL_TOKEN) == 33;
constexpr int RELAY_PIN = 5; // D5 on the DOIT ESP32; verify relay stays OFF through reset.
constexpr int RELAY_BUTTON_PIN = -1; // Button GPIO has not been confirmed.
static_assert(RUAN_RELAY_ACTIVE_LOW == 0 || RUAN_RELAY_ACTIVE_LOW == 1,
              "RUAN_RELAY_ACTIVE_LOW must be 0 or 1.");
constexpr bool RELAY_ACTIVE_LOW = RUAN_RELAY_ACTIVE_LOW == 1;
constexpr unsigned long BUTTON_DEBOUNCE_MS = 40, RELAY_LIMIT_MS = 30000;

constexpr bool isAvailableControlPin(int pin) {
  return pin == 4 || pin == 13 || pin == 14 || pin == 18 || pin == 19 ||
         pin == 23 || pin == 25 || pin == 26 || pin == 27 || pin == 32 || pin == 33;
}

static_assert(!(ENABLE_LOCAL_RELAY_TEST && ENABLE_RELAY_SERIAL_BENCH_TEST),
              "Choose one relay test mode.");
static_assert(!CLOUD_RELAY_ENABLED || (!ENABLE_LOCAL_RELAY_TEST && !ENABLE_RELAY_SERIAL_BENCH_TEST),
              "Cloud relay must have exclusive control of the output.");
static_assert(!(ENABLE_LOCAL_RELAY_TEST || ENABLE_RELAY_SERIAL_BENCH_TEST || WEB_RELAY_ENABLED || CLOUD_RELAY_ENABLED) ||
              RELAY_PIN == 5 || isAvailableControlPin(RELAY_PIN),
              "Set an available relay GPIO for the DOIT ESP32.");
static_assert(!ENABLE_LOCAL_RELAY_TEST ||
              (isAvailableControlPin(RELAY_BUTTON_PIN) && RELAY_PIN != RELAY_BUTTON_PIN),
              "Set a separate GPIO for the local relay button.");

LiquidCrystal_I2C lcd(LCD_ADDRESS, 16, 2);
PZEM004Tv30 pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);
WebServer server(80);

bool lcdReady = false;
std::atomic<bool> readingValid{false};
std::atomic<bool> relayMeterValid{false};
const char* meterReadError = "No live data";
float voltage, current, power, energy, powerFactor, apparentPower;
float reactiveMagnitude = NAN, phaseAngle = NAN;
bool powerFactorAvailable = false;
std::atomic<unsigned long> lastValidSample{0};
unsigned long lastSample = 0, lastPageChange = 0, lastWifiAttempt = 0;
uint8_t page = 0;

bool relayTaskStarted = false;
bool serialBenchReady = false;
std::atomic<bool> relayRequestedOn{false};
enum class RelayCommand { None, TurnOn, TurnOff };
std::atomic<RelayCommand> pendingWebCommand{RelayCommand::None};
unsigned long relayOnSince = 0;

esp_mqtt_client_handle_t cloudMqtt = nullptr;
std::atomic<bool> cloudConnected{false};
std::atomic<bool> cloudRelayReady{false};
std::atomic<uint32_t> cloudSession{0};
char telemetryTopic[80], availabilityTopic[80], commandTopic[80], stateTopic[80], ackTopic[80], lastWill[288];

struct CloudRelayRequest {
  char id[37];
  uint64_t issuedMs;
  uint64_t expiresMs;
  uint32_t session;
  bool turnOn;
};

struct CloudRelayResult {
  char id[37];
  uint32_t session;
  bool outputOn;
  const char* error;
};

QueueHandle_t cloudRequests = nullptr, cloudResults = nullptr;
int cloudSubscription = -1; // Accessed only by the MQTT event task.
uint64_t cloudSubscribedAt = 0;

const char PAGE_HTML[] PROGMEM = R"HTML(<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Smart Plug · PZEM Live</title>
  <style>
    body{font:16px system-ui;background:#f4f8f5;color:#173526;margin:0;padding:24px}
    main{max-width:760px;margin:auto}h1{font-size:1.5rem}
    .card{background:white;padding:16px;border-radius:16px;box-shadow:0 4px 18px #183d2610}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px;margin:16px 0}
    .value{font-size:1.35rem;font-weight:700;color:#236d43;font-variant-numeric:tabular-nums}
    small{color:#465d50}
    .controls{margin-top:12px}
    .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
    input,button{font:inherit;padding:8px 12px;border:1px solid #849789;border-radius:8px}
    input{box-sizing:border-box;width:min(100%,22rem)}
    button{background:#236d43;color:white;cursor:pointer}
    button:disabled{opacity:.55;cursor:default}
    .actions button:last-child{background:#fff;color:#173526}
  </style>
</head>
<body><main>
  <h1>Smart Plug · ค่าจาก PZEM</h1>
  <div class="card"><strong id="status" role="status">กำลังเชื่อมต่อ ESP32…</strong>
    <div><small id="relay"></small></div>
    <div><small id="relay-gpio"></small></div>
    <div id="controls" class="controls" hidden>
      <label for="relay-token">รหัสควบคุมรีเลย์</label><br>
      <input id="relay-token" type="password" maxlength="32" autocomplete="off" spellcheck="false">
      <div class="actions">
        <button id="relay-on" type="button" disabled>เปิดรีเลย์</button>
        <button id="relay-off" type="button" disabled>ปิดรีเลย์</button>
      </div>
      <p><small id="relay-limit"></small></p>
      <p id="relay-feedback" role="status"></p>
    </div></div>
  <div class="grid" id="metrics"></div>
  <p><small id="updated"></small></p>
  <p><small>ขนาดมุมเทียบเท่าคำนวณจาก PF ส่วน |Q| ประมาณจาก V, I และ P
    ทั้งสองค่าใช้แทนขนาดมุมเฟสและกำลังรีแอกทีฟได้เมื่อรูปคลื่นใกล้ไซน์
    ข้อมูลนี้อ่านจาก ESP32 ผ่าน Wi-Fi ภายในบ้าน</small></p>
</main><script>
const metrics = document.getElementById('metrics');
const readingStatus = document.getElementById('status');
const relay = document.getElementById('relay');
const relayGpio = document.getElementById('relay-gpio');
const updated = document.getElementById('updated');
const controls = document.getElementById('controls');
const relayToken = document.getElementById('relay-token');
const relayOn = document.getElementById('relay-on');
const relayOff = document.getElementById('relay-off');
const relayLimit = document.getElementById('relay-limit');
const relayFeedback = document.getElementById('relay-feedback');
let latest = null;
let sending = false;
const labels = [
  ['แรงดัน', 'voltage', 'V', 1], ['กระแส', 'current', 'A', 3],
  ['กำลังจริง (P)', 'power', 'W', 1], ['กำลังปรากฏ (S)', 'apparentPower', 'VA', 1],
  ['ขนาดกำลังรีแอกทีฟ (|Q|) โดยประมาณ', 'reactiveMagnitude', 'var', 1],
  ['ตัวประกอบกำลัง (PF)', 'powerFactor', '', 2],
  ['ขนาดมุมเทียบเท่าจาก PF', 'phaseAngle', '°', 1], ['พลังงานสะสม', 'energy', 'kWh', 3]
];
const phaseLabels = {
  unavailable: 'ข้อมูลไม่พอสำหรับประมาณทิศเฟส',
  undetermined: 'PZEM ไม่มีข้อมูลทิศนำหรือหน่วง',
  near_unity: 'PF ใกล้ 1',
  lagging_assumed: 'Lagging ตามชนิดโหลดเหนี่ยวนำที่ตั้งไว้',
  leading_assumed: 'Leading ตามชนิดโหลดเชิงเก็บประจุที่ตั้งไว้'
};
const relayLabels = {
  disabled: 'ยังไม่ได้ตั้งรหัสควบคุมรีเลย์',
  unavailable: 'เริ่มระบบควบคุมรีเลย์ไม่ได้',
  off_requested: 'ส่งสัญญาณ OFF ไปยังรีเลย์ · ไม่มีข้อมูลยืนยันหน้าสัมผัส',
  on_requested: 'ส่งสัญญาณ ON ไปยังรีเลย์ · ไม่มีข้อมูลยืนยันหน้าสัมผัส'
};
function updateControls() {
  const enabled = Boolean(latest?.webControl);
  controls.hidden = !enabled;
  const canSend = enabled && !sending && /^[0-9a-f]{32}$/.test(relayToken.value);
  relayOn.disabled = !canSend || !latest?.valid || latest.relay === 'on_requested';
  relayOff.disabled = !canSend;
  if (enabled) relayLimit.textContent = 'คำสั่งปิดทำงานทันที ส่วนการเปิดจะตัดอัตโนมัติเมื่อครบ ' +
    latest.relayLimitSeconds + ' วินาที หรือเมื่อขาดข้อมูล PZEM หรือ Wi-Fi';
}
async function sendRelay(action) {
  sending = true;
  updateControls();
  relayFeedback.textContent = 'กำลังส่งคำสั่ง…';
  try {
    const response = await fetch('/api/relay', {
      method:'POST', cache:'no-store',
      headers:{'Content-Type':'text/plain', 'X-Relay-Token':relayToken.value},
      body:action, signal:AbortSignal.timeout(4000)
    });
    const feedback = {
      202:'ESP32 รับคำสั่งแล้ว ดูสัญญาณที่ส่งออกด้านบน',
      403:'ตรวจสอบรหัสควบคุมรีเลย์',
      409:'รอให้ PZEM อ่านค่าได้ก่อนเปิดรีเลย์',
      503:'ระบบควบคุมรีเลย์ยังไม่พร้อม'
    };
    relayFeedback.textContent = feedback[response.status] || 'ส่งคำสั่งไม่สำเร็จ';
  } catch {
    relayFeedback.textContent = 'การเชื่อมต่อขาดหาย ตรวจสอบสถานะก่อนส่งคำสั่งอีกครั้ง';
  } finally {
    sending = false;
    updateControls();
  }
}
relayToken.addEventListener('input', updateControls);
relayOn.addEventListener('click', () => sendRelay('on'));
relayOff.addEventListener('click', () => sendRelay('off'));
function field(label, value) {
  const card = document.createElement('div');
  card.className = 'card';
  const name = document.createElement('small');
  name.textContent = label;
  const reading = document.createElement('div');
  reading.className = 'value';
  reading.textContent = value;
  card.append(name, reading);
  return card;
}
async function refresh() {
  try {
    const response = await fetch('/api/readings', {cache:'no-store', signal:AbortSignal.timeout(4000)});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    latest = data;
    updateControls();
    relay.textContent = relayLabels[data.relay];
    relayGpio.textContent = [0, 1].includes(data.relayGpioLevel)
      ? 'อ่านที่ขา D5 ได้ ' + (data.relayGpioLevel === 1 ? 'HIGH' : 'LOW')
      : '';
    if (!data.valid) {
      readingStatus.textContent = 'เชื่อมต่อ ESP32 แล้ว · ยังไม่มีค่าล่าสุดจาก PZEM';
      metrics.replaceChildren();
      updated.textContent = '';
      return;
    }
    readingStatus.textContent = 'ได้รับค่าล่าสุดจาก PZEM';
    const cards = labels.map(([label, key, unit, digits]) =>
      field(label, Number.isFinite(data[key]) ? (data[key].toFixed(digits) + ' ' + unit).trim() : '—')
    );
    metrics.replaceChildren(...cards, field('ทิศเฟส', phaseLabels[data.phaseRelation]));
    updated.textContent = 'อายุข้อมูล ' + (data.ageMs / 1000).toFixed(1) + ' วินาที';
  } catch {
    latest = null;
    updateControls();
    readingStatus.textContent = 'ขาดการเชื่อมต่อ ESP32';
    relay.textContent = '';
    relayGpio.textContent = '';
    metrics.replaceChildren();
    updated.textContent = 'ตรวจสอบ Wi-Fi และที่อยู่หน้าเว็บ';
  } finally {
    setTimeout(refresh, 3000);
  }
}
refresh();
</script></body></html>)HTML";

bool hasFreshReading() {
  if (!readingValid.load()) return false;
  const unsigned long sampledAt = lastValidSample.load();
  return millis() - sampledAt <= MAX_SAMPLE_AGE_MS;
}

bool hasFreshRelayReading() {
  return relayMeterValid.load() && hasFreshReading();
}

const char* relayStatus() {
  if (!ENABLE_LOCAL_RELAY_TEST && !WEB_RELAY_ENABLED && !CLOUD_RELAY_ENABLED) return "disabled";
  if (!relayTaskStarted) return "unavailable";
  return relayRequestedOn ? "on_requested" : "off_requested";
}

void requestRelay(bool on) {
  const uint8_t level = (on == RELAY_ACTIVE_LOW) ? LOW : HIGH;
  gpio_set_level(static_cast<gpio_num_t>(RELAY_PIN), level);
  relayRequestedOn = on;
  if (on) relayOnSince = millis();
}

bool relayOutputOn() {
  return gpio_get_level(static_cast<gpio_num_t>(RELAY_PIN)) == (RELAY_ACTIVE_LOW ? LOW : HIGH);
}

void serviceSerialBenchRelay() {
  static char command[sizeof("RELAY OFF")];
  static size_t length = 0;
  static bool tooLong = false;
  for (int i = 0; i < 32 && Serial.available(); ++i) {
    const int byte = Serial.read();
    if (byte == '\r' || byte == '\n') {
      command[length] = '\0';
      const bool turnOn = length == sizeof("RELAY ON") - 1 && strcmp(command, "RELAY ON") == 0;
      const bool turnOff = length == sizeof("RELAY OFF") - 1 && strcmp(command, "RELAY OFF") == 0;
      if (!tooLong && (turnOn || turnOff)) {
        requestRelay(turnOn);
        if (relayOutputOn() == turnOn) {
          Serial.printf("Relay GPIO%d %s (%s)\n", RELAY_PIN,
                        gpio_get_level(static_cast<gpio_num_t>(RELAY_PIN)) == HIGH ? "HIGH" : "LOW",
                        turnOn ? "ON" : "OFF");
        } else {
          requestRelay(false);
          Serial.println("Relay GPIO readback mismatch; requested OFF.");
        }
      }
      length = 0;
      tooLong = false;
    } else if (length < sizeof(command) - 1) {
      command[length++] = static_cast<char>(byte);
    } else {
      tooLong = true;
    }
  }
}

void serviceLocalButton(unsigned long now) {
  // Require a stable release before accepting a press, including after boot.
  static bool previousPressed = false, released = false;
  static unsigned long changedAt = now;
  const bool pressed = digitalRead(RELAY_BUTTON_PIN) == LOW;
  if (pressed != previousPressed) {
    previousPressed = pressed;
    changedAt = now;
  }
  if (relayRequestedOn && (!hasFreshRelayReading() || now - relayOnSince >= RELAY_LIMIT_MS)) {
    requestRelay(false);
    released = false;
    return;
  }
  if (now - changedAt < BUTTON_DEBOUNCE_MS) return;
  if (!pressed) {
    released = true;
  } else if (released) {
    released = false;
    if (relayRequestedOn) {
      requestRelay(false);
    } else if (hasFreshRelayReading()) {
      requestRelay(true);
    }
  }
}

void serviceWebRelay(unsigned long now) {
  const RelayCommand command = pendingWebCommand.exchange(RelayCommand::None);
  const bool canEnergize = WiFi.status() == WL_CONNECTED && hasFreshRelayReading();
  const bool expired = relayRequestedOn && now - relayOnSince >= RELAY_LIMIT_MS;
  if (command == RelayCommand::TurnOff) {
    // Reapply the inactive level even if the previous GPIO request was OFF.
    requestRelay(false);
  } else if (!canEnergize || expired) {
    if (relayRequestedOn) requestRelay(false);
  } else if (command == RelayCommand::TurnOn && !relayRequestedOn) {
    requestRelay(true);
  }
}

uint64_t cloudEpochMs() {
  timeval clock{};
  gettimeofday(&clock, nullptr);
  if (clock.tv_sec < 1735689600) return 0;
  return static_cast<uint64_t>(clock.tv_sec) * 1000ULL + clock.tv_usec / 1000;
}

void serviceCloudRelay() {
  static uint64_t lastIssuedMs = 0;
  static char lastId[37] = "";
  const bool connected = cloudRelayReady && WiFi.status() == WL_CONNECTED;

  CloudRelayRequest command{};
  if (xQueueReceive(cloudRequests, &command, 0) != pdTRUE ||
      !connected || command.session != cloudSession.load() ||
      strcmp(command.id, lastId) == 0) return;

  CloudRelayResult result{};
  memcpy(result.id, command.id, sizeof(result.id));
  result.session = command.session;
  const uint64_t time = cloudEpochMs();

  if (!time || command.expiresMs <= time || command.issuedMs > time + 2000) {
    result.error = "COMMAND_EXPIRED";
  } else if (command.issuedMs < lastIssuedMs || (command.turnOn && command.issuedMs == lastIssuedMs)) {
    result.error = "COMMAND_OUT_OF_ORDER";
  } else {
    lastIssuedMs = command.issuedMs;
    memcpy(lastId, command.id, sizeof(lastId));
    if (command.turnOn && !hasFreshRelayReading()) {
      result.error = hasFreshReading() ? "METER_PF_INVALID" : "METER_READING_STALE";
    } else {
      if (!command.turnOn || !relayRequestedOn) requestRelay(command.turnOn);
      if (relayOutputOn() != command.turnOn) {
        requestRelay(false);
        result.error = "GPIO_READBACK_MISMATCH";
      }
    }
  }
  result.outputOn = relayOutputOn();
  xQueueSend(cloudResults, &result, 0);
}

void runRelayTask(void*) {
  // Keep relay control independent of HTTP and UART wait times.
  while (true) {
    const unsigned long now = millis();
    if (ENABLE_LOCAL_RELAY_TEST) serviceLocalButton(now);
    if (WEB_RELAY_ENABLED) serviceWebRelay(now);
    if (CLOUD_RELAY_ENABLED) serviceCloudRelay();
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

void calculatePower(bool validPf) {
  apparentPower = voltage * current;
  const bool enoughLoad = current >= START_CURRENT_A && power >= START_POWER_W;
  powerFactorAvailable = validPf && enoughLoad;
  reactiveMagnitude = NAN;
  phaseAngle = NAN;
  if (!enoughLoad || apparentPower <= 0.0f) return;

  // Treat small rounding disagreements as unity. Larger discrepancies leave
  // the estimate unavailable while preserving the separate meter readings.
  const float roundingTolerance = fmaxf(0.2f, apparentPower * 0.01f);
  if (power > apparentPower + roundingTolerance) return;
  const float activeRatio = fminf(power / apparentPower, 1.0f);
  reactiveMagnitude = apparentPower * sqrtf((1.0f - activeRatio) * (1.0f + activeRatio));
  if (powerFactorAvailable) phaseAngle = acosf(powerFactor) * (180.0f / PI);
}

PhaseStatus phaseStatus() {
  if (!isfinite(phaseAngle)) return {"unavailable", "No phase data"};
  if (powerFactor >= 0.995f) return {"near_unity", "PF near unity"};
  switch (ASSUMED_LOAD_PHASE) {
    case LoadPhase::Inductive: return {"lagging_assumed", "Lagging assumed"};
    case LoadPhase::Capacitive: return {"leading_assumed", "Leading assumed"};
    default: return {"undetermined", "No lead/lag data"};
  }
}

void formatJsonNumber(char* buffer, size_t size, float value, int decimals) {
  if (isfinite(value)) snprintf(buffer, size, "%.*f", decimals, value);
  else snprintf(buffer, size, "null");
}

bool hasValidRelayToken(const String& token) {
  if (token.length() != sizeof(RELAY_CONTROL_TOKEN) - 1) return false;
  unsigned int difference = 0;
  for (size_t i = 0; i < token.length(); ++i) {
    difference |= token[i] ^ RELAY_CONTROL_TOKEN[i];
  }
  return difference == 0;
}

void handleRelayCommand() {
  if (!WEB_RELAY_ENABLED || !relayTaskStarted || WiFi.status() != WL_CONNECTED) {
    server.send(503);
    return;
  }
  // Accept only requests addressed to this ESP32's own LAN IP. The custom
  // token header and lack of CORS also block cross-site browser submissions.
  const String address = WiFi.localIP().toString();
  const String host = server.hostHeader();
  const String origin = server.header("Origin");
  if ((host != address && host != address + ":80") ||
      (origin.length() && origin != String("http://") + host) ||
      !hasValidRelayToken(server.header("X-Relay-Token"))) {
    server.send(403);
    return;
  }
  const String action = server.arg("plain");
  if (action == "on") {
    if (!hasFreshRelayReading()) {
      server.send(409);
      return;
    }
    pendingWebCommand.store(RelayCommand::TurnOn);
  } else if (action == "off") {
    pendingWebCommand.store(RelayCommand::TurnOff);
  } else {
    server.send(400);
    return;
  }
  server.send(202);
}

void configureWebServer() {
  const char* headers[] = { "X-Relay-Token", "Origin" };
  server.collectHeaders(headers, 2);
  server.on("/", HTTP_GET, []() {
    server.sendHeader("Cache-Control", "no-store");
    server.sendHeader("X-Frame-Options", "DENY");
    server.send_P(200, "text/html; charset=utf-8", PAGE_HTML);
  });
  server.on("/api/relay", HTTP_POST, handleRelayCommand);
  server.on("/api/readings", HTTP_GET, []() {
    server.sendHeader("Cache-Control", "no-store");
    const unsigned long now = millis();
    const char* webControl = WEB_RELAY_ENABLED && relayTaskStarted ? "true" : "false";
    const char* gpioLevel = relayTaskStarted
      ? (gpio_get_level(static_cast<gpio_num_t>(RELAY_PIN)) == HIGH ? "1" : "0")
      : "null";
    char json[520];
    if (hasFreshReading()) {
      char pf[16], q[16], angle[16];
      formatJsonNumber(pf, sizeof(pf), powerFactorAvailable ? powerFactor : NAN, 2);
      formatJsonNumber(q, sizeof(q), reactiveMagnitude, 1);
      formatJsonNumber(angle, sizeof(angle), phaseAngle, 1);
      snprintf(json, sizeof(json),
               "{\"valid\":true,\"ageMs\":%lu,\"voltage\":%.1f,\"current\":%.3f,"
               "\"power\":%.1f,\"energy\":%.3f,\"powerFactor\":%s,\"apparentPower\":%.1f,"
               "\"reactiveMagnitude\":%s,\"phaseAngle\":%s,\"phaseRelation\":\"%s\","
               "\"relay\":\"%s\",\"relayGpioLevel\":%s,\"webControl\":%s,\"relayLimitSeconds\":%lu}",
               now - lastValidSample.load(), voltage, current, power, energy, pf, apparentPower,
               q, angle, phaseStatus().code, relayStatus(), gpioLevel, webControl, RELAY_LIMIT_MS / 1000);
    } else {
      snprintf(json, sizeof(json), "{\"valid\":false,\"relay\":\"%s\",\"relayGpioLevel\":%s,"
               "\"webControl\":%s,\"relayLimitSeconds\":%lu}",
               relayStatus(), gpioLevel, webControl, RELAY_LIMIT_MS / 1000);
    }
    server.send(200, "application/json", json);
  });
  server.begin();
}

void writeLine(uint8_t row, const char* text) {
  char padded[17];
  snprintf(padded, sizeof(padded), "%-16.16s", text);
  lcd.setCursor(0, row);
  lcd.print(padded);
}

void showReading() {
  if (!lcdReady) return;
  if (page == 5) {
    writeLine(0, "Dashboard IP");
    if (WiFi.status() == WL_CONNECTED) {
      const String ip = WiFi.localIP().toString();
      writeLine(1, ip.c_str());
    } else {
      writeLine(1, WIFI_SSID[0] == '\0' ? "Wi-Fi not set" : "Wi-Fi offline");
    }
    return;
  }
  if (!hasFreshReading()) {
    writeLine(0, "PZEM read error");
    writeLine(1, meterReadError);
    return;
  }
  char top[32], bottom[32];
  switch (page) {
    case 0:
      snprintf(top, sizeof(top), "V:%.1f V", voltage);
      snprintf(bottom, sizeof(bottom), "I:%.3f A", current);
      break;
    case 1:
      snprintf(top, sizeof(top), "P:%.1f W", power);
      snprintf(bottom, sizeof(bottom), "S:%.1f VA", apparentPower);
      break;
    case 2:
      if (isfinite(reactiveMagnitude)) {
        snprintf(top, sizeof(top), "|Q|~%.1f var", reactiveMagnitude);
      } else {
        snprintf(top, sizeof(top), "|Q|~ -- var");
      }
      snprintf(bottom, sizeof(bottom), "%s", phaseStatus().lcdLabel);
      break;
    case 3:
      if (powerFactorAvailable) snprintf(top, sizeof(top), "PF:%.2f", powerFactor);
      else snprintf(top, sizeof(top), "PF: --");
      if (isfinite(phaseAngle)) snprintf(bottom, sizeof(bottom), "Angle~%.1f deg", phaseAngle);
      else snprintf(bottom, sizeof(bottom), "Angle~ --");
      break;
    default:
      snprintf(top, sizeof(top), "E:%.3f kWh", energy);
      snprintf(bottom, sizeof(bottom), "%s", !ENABLE_LOCAL_RELAY_TEST && !WEB_RELAY_ENABLED && !CLOUD_RELAY_ENABLED ? "Relay disabled" :
               (!relayTaskStarted ? "Relay test error" : (relayRequestedOn ? "Relay ON cmd" : "Relay OFF cmd")));
      break;
  }
  writeLine(0, top);
  writeLine(1, bottom);
}

void sampleMeter() {
  voltage = pzem.voltage(); // This accessor triggers a read of all meter registers.
  const char* issue = nullptr;
  if (!isfinite(voltage)) {
    issue = "No valid frame";
  } else {
    current = pzem.current();
    power = pzem.power();
    energy = pzem.energy();
    powerFactor = pzem.pf();
    if (voltage <= 0.0f) {
      issue = "Invalid voltage";
    } else if (!isfinite(current) || current < 0.0f || !isfinite(power) || power < 0.0f ||
               !isfinite(energy) || energy < 0.0f) {
      issue = "Invalid I/P/E";
    }
  }
  if (!issue) {
    const bool validPf = isfinite(powerFactor) && powerFactor >= 0.0f && powerFactor <= 1.0f;
    if (!validPf) relayMeterValid = false;
    calculatePower(validPf);
    meterReadError = "No live data";
    lastValidSample = millis();
    readingValid = true;
    if (validPf) relayMeterValid = true;
    char pf[16], q[16], angle[16];
    formatJsonNumber(pf, sizeof(pf), powerFactorAvailable ? powerFactor : NAN, 2);
    formatJsonNumber(q, sizeof(q), reactiveMagnitude, 1);
    formatJsonNumber(angle, sizeof(angle), phaseAngle, 1);
    Serial.printf("V=%.1f V | I=%.3f A | P=%.1f W | S=%.1f VA | |Q|~%s var | PF=%s | angle~%s deg | %s | E=%.3f kWh | relay=%s\n",
                  voltage, current, power, apparentPower, q, pf, angle, phaseStatus().code, energy, relayStatus());
  } else {
    relayMeterValid = false;
    readingValid = false;
    meterReadError = issue;
    Serial.printf("PZEM read error: %s\n", meterReadError);
  }
  showReading();
}

bool cloudTimestamp(char (&timestamp)[25], unsigned long long& sequence) {
  timeval clock{};
  gettimeofday(&clock, nullptr);
  if (clock.tv_sec < 1735689600) return false;
  tm utc{};
  gmtime_r(&clock.tv_sec, &utc);
  if (!strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%S", &utc)) return false;
  const auto milliseconds = static_cast<unsigned>(clock.tv_usec / 1000);
  snprintf(timestamp + 19, 6, ".%03uZ", milliseconds);
  sequence = static_cast<unsigned long long>(clock.tv_sec) * 1000ULL + milliseconds;
  return true;
}

uint64_t parseCloudTime(const char* value) {
  if (!value || strlen(value) != 24 || value[19] != '.' || value[23] != 'Z') return 0;
  unsigned milliseconds = 0;
  for (size_t offset = 20; offset < 23; ++offset) {
    if (value[offset] < '0' || value[offset] > '9') return 0;
    milliseconds = milliseconds * 10 + value[offset] - '0';
  }
  tm date{};
  if (strptime(value, "%Y-%m-%dT%H:%M:%S", &date) != value + 19) return 0;
  // configTime(0, 0, ...) sets the ESP32 runtime timezone to UTC before MQTT starts.
  const time_t seconds = mktime(&date);
  char normalized[20];
  if (seconds < 1735689600 || !strftime(normalized, sizeof(normalized), "%Y-%m-%dT%H:%M:%S", &date) ||
      memcmp(value, normalized, 19) != 0) return 0;
  return static_cast<uint64_t>(seconds) * 1000ULL + milliseconds;
}

bool validCommandId(const char* id) {
  if (!id || strlen(id) != 36) return false;
  for (size_t i = 0; i < 36; ++i) {
    const char value = id[i];
    if (i == 8 || i == 13 || i == 18 || i == 23) {
      if (value != '-') return false;
    } else if (!((value >= '0' && value <= '9') || (value >= 'a' && value <= 'f'))) {
      return false;
    }
  }
  return true;
}

void receiveCloudRelayCommand(esp_mqtt_event_handle_t event) {
  if (!cloudRelayReady || event->retain || event->qos != 1 ||
      event->current_data_offset != 0 || event->data_len != event->total_data_len ||
      event->data_len <= 0 || event->data_len > 512 ||
      event->topic_len != static_cast<int>(strlen(commandTopic)) ||
      memcmp(event->topic, commandTopic, event->topic_len) != 0 ||
      memchr(event->data, '\0', event->data_len)) return;

  char json[513]{};
  memcpy(json, event->data, event->data_len);
  cJSON* value = cJSON_ParseWithLengthOpts(json, event->data_len + 1, nullptr, true);
  if (!value) return;

  const cJSON* version = cJSON_GetObjectItemCaseSensitive(value, "schemaVersion");
  const cJSON* state = cJSON_GetObjectItemCaseSensitive(value, "requestedState");
  const char* kind = cJSON_GetStringValue(cJSON_GetObjectItemCaseSensitive(value, "type"));
  const char* id = cJSON_GetStringValue(cJSON_GetObjectItemCaseSensitive(value, "commandId"));
  const char* device = cJSON_GetStringValue(cJSON_GetObjectItemCaseSensitive(value, "deviceId"));
  const uint64_t issued = parseCloudTime(cJSON_GetStringValue(cJSON_GetObjectItemCaseSensitive(value, "issuedAt")));
  const uint64_t expires = parseCloudTime(cJSON_GetStringValue(cJSON_GetObjectItemCaseSensitive(value, "expiresAt")));
  const bool turnOn = cJSON_IsTrue(state);
  if (cJSON_IsNumber(version) && version->valuedouble == 1 && cJSON_IsBool(state) &&
      kind && strcmp(kind, "SET_RELAY") == 0 && device && strcmp(device, RUAN_DEVICE_ID) == 0 &&
      validCommandId(id) && issued && expires > issued && expires - issued <= 30'000 &&
      (!turnOn || issued >= cloudSubscribedAt)) {
    CloudRelayRequest command{};
    memcpy(command.id, id, sizeof(command.id));
    command.issuedMs = issued;
    command.expiresMs = expires;
    command.session = cloudSession.load();
    command.turnOn = turnOn;
    xQueueSend(cloudRequests, &command, 0);
  }
  cJSON_Delete(value);
}

void cloudMqttEvent(void*, esp_event_base_t, int32_t eventId, void* eventData) {
  const auto event = static_cast<esp_mqtt_event_handle_t>(eventData);
  if (eventId == MQTT_EVENT_CONNECTED) {
    cloudRelayReady = false;
    ++cloudSession;
    cloudConnected = true;
    if (CLOUD_RELAY_ENABLED && relayTaskStarted) {
      cloudSubscription = esp_mqtt_client_subscribe(event->client, commandTopic, 1);
      if (cloudSubscription <= 0) Serial.println("RUAN relay command subscription could not start.");
    }
    Serial.println("RUAN MQTT connected.");
  } else if (CLOUD_RELAY_ENABLED && eventId == MQTT_EVENT_SUBSCRIBED) {
    if (cloudSubscription <= 0 || event->msg_id != cloudSubscription) return;
    if (event->data && event->data_len == 1 && static_cast<uint8_t>(event->data[0]) == 1) {
      cloudSubscribedAt = cloudEpochMs();
      cloudRelayReady = cloudSubscribedAt > 0;
      if (cloudRelayReady) Serial.println("RUAN relay command subscription ready.");
    } else {
      Serial.println("RUAN relay command subscription denied or QoS 1 unavailable.");
    }
  } else if (CLOUD_RELAY_ENABLED && eventId == MQTT_EVENT_DATA) {
    receiveCloudRelayCommand(event);
  } else if (eventId == MQTT_EVENT_DISCONNECTED) {
    cloudRelayReady = false;
    cloudConnected = false;
    Serial.println("RUAN MQTT disconnected.");
  } else if (eventId == MQTT_EVENT_ERROR) {
    Serial.println("RUAN MQTT connection error; check broker, CA and credentials.");
  }
}

bool startCloudMqtt(const char* timestamp) {
  snprintf(telemetryTopic, sizeof(telemetryTopic), "v1/devices/%s/telemetry", RUAN_DEVICE_ID);
  snprintf(availabilityTopic, sizeof(availabilityTopic), "v1/devices/%s/availability", RUAN_DEVICE_ID);
  snprintf(commandTopic, sizeof(commandTopic), "v1/devices/%s/commands", RUAN_DEVICE_ID);
  snprintf(stateTopic, sizeof(stateTopic), "v1/devices/%s/state", RUAN_DEVICE_ID);
  snprintf(ackTopic, sizeof(ackTopic), "v1/devices/%s/acks", RUAN_DEVICE_ID);
  snprintf(lastWill, sizeof(lastWill),
           "{\"schemaVersion\":1,\"messageId\":\"will-%08lx%08lx\",\"deviceId\":\"%s\","
           "\"deviceTimestamp\":\"%s\",\"online\":false,\"reason\":\"LWT\"}",
           static_cast<unsigned long>(esp_random()), static_cast<unsigned long>(esp_random()),
           RUAN_DEVICE_ID, timestamp);
  esp_mqtt_client_config_t config{};
  config.broker.address.uri = RUAN_MQTT_URL;
  config.broker.verification.certificate = RUAN_MQTT_CA;
  config.credentials.client_id = RUAN_DEVICE_ID;
  config.credentials.username = RUAN_DEVICE_ID;
  config.credentials.authentication.password = RUAN_MQTT_PASSWORD;
  config.session.keepalive = 20;
  config.session.last_will.topic = availabilityTopic;
  config.session.last_will.msg = lastWill;
  config.session.last_will.qos = 1;
  config.session.last_will.retain = true;
  config.outbox.limit = 8192;
  cloudMqtt = esp_mqtt_client_init(&config);
  if (!cloudMqtt) return false;
  if (esp_mqtt_client_register_event(cloudMqtt, MQTT_EVENT_ANY, cloudMqttEvent, nullptr) == ESP_OK &&
      esp_mqtt_client_start(cloudMqtt) == ESP_OK) return true;
  esp_mqtt_client_destroy(cloudMqtt);
  cloudMqtt = nullptr;
  return false;
}

bool publishCloudRelay(const char* timestamp, unsigned long long sequence) {
  static int publishedState = -1;
  static uint32_t publishedSession = 0;
  static unsigned long publishedAt = 0;
  const uint32_t session = cloudSession.load();
  if (!cloudRelayReady) {
    publishedState = -1;
    return false;
  }
  if (session != publishedSession) publishedState = -1;

  char json[416];
  const int output = relayOutputOn();
  if (output != publishedState || millis() - publishedAt >= 5'000) {
    snprintf(json, sizeof(json),
             "{\"schemaVersion\":1,\"messageId\":\"state-%llu\",\"deviceId\":\"%s\","
             "\"deviceTimestamp\":\"%s\",\"sequence\":%llu,\"relayState\":%s}",
             sequence, RUAN_DEVICE_ID, timestamp, sequence, output ? "true" : "false");
    if (esp_mqtt_client_enqueue(cloudMqtt, stateTopic, json, 0, 1, 0, false) >= 0) {
      publishedState = output;
      publishedSession = session;
      publishedAt = millis();
    }
  }

  CloudRelayResult result{};
  while (xQueuePeek(cloudResults, &result, 0) == pdTRUE) {
    if (result.session == session) {
      char error[64] = "";
      if (result.error) snprintf(error, sizeof(error), ",\"errorCode\":\"%s\"", result.error);
      snprintf(json, sizeof(json),
               "{\"schemaVersion\":1,\"messageId\":\"ack-%s\",\"deviceId\":\"%s\","
               "\"deviceTimestamp\":\"%s\",\"commandId\":\"%s\",\"status\":\"%s\",\"confirmedRelayState\":%s%s}",
               result.id, RUAN_DEVICE_ID, timestamp, result.id, result.error ? "FAILED" : "ACKNOWLEDGED",
               result.outputOn ? "true" : "false", error);
      if (esp_mqtt_client_enqueue(cloudMqtt, ackTopic, json, 0, 1, 0, false) < 0) break;
    }
    xQueueReceive(cloudResults, &result, 0);
  }
  return publishedState >= 0;
}

void serviceCloudMqtt(bool wifiConnected) {
  if (!wifiConnected || strncmp(RUAN_MQTT_URL, "mqtts://", 8) != 0 ||
      strlen(RUAN_DEVICE_ID) != 36 || !RUAN_MQTT_PASSWORD[0] || !RUAN_MQTT_CA[0]) return;

  static unsigned long lastStart = 0, lastSent = 0, lastAvailability = 0;
  static bool attemptedStart = false, wasConnected = false, announcedRelay = false;
  const unsigned long now = millis();
  char timestamp[25];
  unsigned long long sequence;
  if (!cloudTimestamp(timestamp, sequence)) return;
  if (!cloudMqtt) {
    if (!attemptedStart || now - lastStart >= 10000) {
      attemptedStart = true;
      lastStart = now;
      if (!startCloudMqtt(timestamp)) Serial.println("Could not start RUAN MQTT client.");
    }
    return;
  }
  if (!cloudConnected) {
    wasConnected = false;
    return;
  }
  const bool relayReady = CLOUD_RELAY_ENABLED && publishCloudRelay(timestamp, sequence);
  if (relayReady != announcedRelay) wasConnected = false;
  if (wasConnected && now - lastSent < 5000) return;
  lastSent = now;
  char json[416];
  if (!wasConnected || now - lastAvailability >= 30000) {
    snprintf(json, sizeof(json),
             "{\"schemaVersion\":1,\"messageId\":\"online-%llu\",\"deviceId\":\"%s\","
             "\"deviceTimestamp\":\"%s\",\"online\":true,\"reason\":\"%s\","
             "\"firmwareVersion\":\"%s\"}",
             sequence, RUAN_DEVICE_ID, timestamp, wasConnected ? "HEARTBEAT" : "CONNECTED",
             relayReady ? "esp32-relay-pilot-1" : "esp32-telemetry-1");
    if (esp_mqtt_client_enqueue(cloudMqtt, availabilityTopic, json, 0, 1, 1, false) >= 0) {
      wasConnected = true;
      announcedRelay = relayReady;
      lastAvailability = now;
    }
  }
  if (!hasFreshReading()) return;
  char pf[16], pfField[40] = "";
  if (powerFactorAvailable) {
    formatJsonNumber(pf, sizeof(pf), powerFactor, 2);
    snprintf(pfField, sizeof(pfField), ",\"powerFactor\":%s", pf);
  }
  snprintf(json, sizeof(json),
           "{\"schemaVersion\":1,\"messageId\":\"sample-%llu\",\"deviceId\":\"%s\","
           "\"deviceTimestamp\":\"%s\",\"sequence\":%llu,\"voltageV\":%.1f,"
           "\"currentA\":%.3f,\"powerW\":%.1f,\"energyKwh\":%.3f%s}",
           sequence, RUAN_DEVICE_ID, timestamp, sequence, voltage, current, power, energy, pfField);
  if (esp_mqtt_client_enqueue(cloudMqtt, telemetryTopic, json, 0, 1, 0, false) < 0)
    Serial.println("RUAN MQTT telemetry queue full or unavailable.");
}

void setup() {
  Serial.begin(115200);
  if (ENABLE_LOCAL_RELAY_TEST || ENABLE_RELAY_SERIAL_BENCH_TEST || WEB_RELAY_ENABLED || CLOUD_RELAY_ENABLED) {
    // Cloud control starts ON; the other control modes start OFF.
    requestRelay(CLOUD_RELAY_ENABLED);
    pinMode(RELAY_PIN, OUTPUT);
  }
  if (ENABLE_RELAY_SERIAL_BENCH_TEST) {
    Serial.println("Isolated low-voltage bench only. Keep mains and AC load disconnected.");
    serialBenchReady = gpio_input_enable(static_cast<gpio_num_t>(RELAY_PIN)) == ESP_OK;
    if (serialBenchReady) {
      Serial.println("Send RELAY ON or RELAY OFF with a line ending. Leave the relay OFF after testing.");
    } else {
      Serial.println("Relay GPIO readback could not start; requested OFF.");
    }
    return;
  }
  Serial.printf("PZEM UART2: RX GPIO%d, TX GPIO%d, %d baud, address 0x%02X\n",
                PZEM_RX_PIN, PZEM_TX_PIN, PZEM_BAUD_RATE, PZEM_DEFAULT_ADDR);
  if (ENABLE_LOCAL_RELAY_TEST) {
    pinMode(RELAY_BUTTON_PIN, INPUT_PULLUP);
  }
  if (CLOUD_RELAY_ENABLED) {
    cloudRequests = xQueueCreate(4, sizeof(CloudRelayRequest));
    cloudResults = xQueueCreate(8, sizeof(CloudRelayResult));
  }
  if (ENABLE_LOCAL_RELAY_TEST || WEB_RELAY_ENABLED || CLOUD_RELAY_ENABLED) {
    // Read the signal at the pad while it remains configured as an output.
    const bool readbackReady = gpio_input_enable(static_cast<gpio_num_t>(RELAY_PIN)) == ESP_OK;
    const bool queuesReady = !CLOUD_RELAY_ENABLED || (cloudRequests && cloudResults);
    relayTaskStarted = readbackReady && queuesReady &&
                       xTaskCreate(runRelayTask, "relay-control", 3072, nullptr, 2, nullptr) == pdPASS;
    if (!relayTaskStarted) Serial.println("Relay task could not start; output requested OFF.");
  } else {
    Serial.println("Relay test disabled; firmware does not drive the relay GPIO.");
  }
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
    lcd.init();
    lcd.backlight();
    writeLine(0, "Smart Plug");
    writeLine(1, "Starting...");
  } else {
    Serial.println("LCD address not found; use Serial Monitor.");
  }
  if (WIFI_SSID[0] != '\0') {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    if (RUAN_MQTT_URL[0]) configTime(0, 0, "pool.ntp.org", "time.google.com");
    configureWebServer();
    Serial.println("Connecting to Wi-Fi...");
  } else {
    Serial.println("Wi-Fi not configured: create wifi_secrets.h from the example.");
  }
  sampleMeter();
  lastSample = millis();
  lastPageChange = lastSample;
}

void loop() {
  if (ENABLE_RELAY_SERIAL_BENCH_TEST) {
    if (serialBenchReady) serviceSerialBenchRelay();
    delay(1);
    return;
  }
  const unsigned long now = millis();
  server.handleClient();
  static bool wasConnected = false;
  const bool connected = WiFi.status() == WL_CONNECTED;
  if (connected && !wasConnected) {
    Serial.print("Wi-Fi connected. Open http://");
    Serial.println(WiFi.localIP());
  }
  if (!connected && wasConnected) Serial.println("Wi-Fi disconnected.");
  wasConnected = connected;
  if (!connected && WIFI_SSID[0] != '\0' && now - lastWifiAttempt >= 30000) {
    lastWifiAttempt = now;
    WiFi.reconnect();
  }
  if (now - lastSample >= SAMPLE_INTERVAL_MS) {
    lastSample = now;
    sampleMeter();
  }
  serviceCloudMqtt(connected);
  if (now - lastPageChange >= PAGE_INTERVAL_MS) {
    lastPageChange = now;
    page = (page + 1) % 6;
    showReading();
  }
}
