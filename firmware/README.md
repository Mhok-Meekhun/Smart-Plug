# ESP32 firmware bring-up

Start with `esp32_usb_test/esp32_usb_test.ino` in Arduino IDE. Select
**DOIT ESP32 DEVKIT V1**, the detected USB serial port, and upload. Open Serial
Monitor at **115200 baud**. A running message should appear about every two
seconds. If upload cannot connect, follow the IDE prompt for the board's BOOT
button; do not press or reconnect hardware while a mains-powered circuit is
attached.

Use the ESP32 by itself with USB for the initial test. Wi-Fi, MQTT,
provisioning, offline buffering, and relay control are not yet
implemented. GPIO assignments, interface voltage compatibility, and safe
isolation must be checked for the actual hardware before integration. Have a
qualified electrical reviewer approve the setup before any mains connection.

## Combined PZEM, LCD, and relay firmware

`esp32_lcd_test/esp32_lcd_test.ino` is the combined Arduino sketch. Install
**LiquidCrystal I2C by Frank de Brabander** in Arduino IDE Library Manager.
For PZEM readings, also install **PZEM-004T-v30 by mandulaj**.
The sketch uses GPIO 21 (SDA), GPIO 22 (SCL), and address `0x27` as configurable
development defaults, not verified wiring. It scans the I2C bus and prints
detected addresses to Serial Monitor at 115200 baud. If the LCD address differs,
change `LCD_ADDRESS` to the detected address. Adjust contrast on the backpack
if the screen is illuminated but the characters are not visible.

Check the specific backpack's supply and I2C pull-up voltages against the
ESP32's 3.3 V GPIO limits; a 5 V-powered backpack can pull the bus to 5 V.
Have the interface reviewed and use appropriate level translation when needed.
Do not connect a computer to a mains-connected prototype until the complete
isolation arrangement has been reviewed by a qualified person.

The sketch uses RX2/GPIO16 and TX2/GPIO17 as provisional UART pins. Verify the
actual pins and electrical interface with the reviewer. The 16×2 LCD cycles
every four seconds through V/I, P/S, estimated |Q|/phase status, PF/angle, energy/relay
command, and the dashboard IP. Serial logs a sample every two seconds. A
failed read clears the live values. The sketch preserves the meter's
cumulative energy counter.

P and PF come from the meter. S is V × I. The firmware uses √(S² − P²) for
estimated |Q| and acos(PF) in degrees for the equivalent angle. With distorted
waveforms, the |Q| estimate includes nonactive effects beyond reactive power
and the angle can differ from the displacement angle. The PZEM's unsigned PF
cannot distinguish leading from lagging. The default display reports
“No lead/lag data”. For a known load with approximately sinusoidal waveforms,
`ASSUMED_LOAD_PHASE` can be set to `LoadPhase::Inductive` or
`LoadPhase::Capacitive` to label the assumed direction. PF, |Q|, and phase are unavailable
below the 100 A variant's nominal starting values (0.020 A or 0.4 W).

## Local relay test

Before using relay control, have a qualified reviewer verify the actual
relay supply, 3.3 V logic compatibility at IN, and hardware default-off
behavior during reset or loss of ESP32
power. This prototype's reported relay is a Songle SRD-05VDC-SL-C module
with active-low IN on D5/GPIO5. The 5 V marking specifies the coil voltage.
Confirm the specific module's input levels separately. GPIO5 is a strapping
pin, so check the module's effect on D5 and the relay state during power-up
and reset, before firmware configures the pin.

`RELAY_PIN` defaults to 5 and `RELAY_ACTIVE_LOW` defaults to true.
`RELAY_BUTTON_PIN` is unset on the buttonless prototype. The optional button
mode uses `ENABLE_LOCAL_RELAY_TEST` with a configured momentary input.

In the enabled build, the output starts with an OFF request. Release the
button after boot before pressing it. A press can request ON only with a fresh
meter reading. A second press requests OFF. The relay task requests OFF when
the meter fails or the 30-second test window expires. Check these behaviors
with the qualified reviewer on a low-voltage bench before connecting a load.
The software timeout is a test aid. Hardware protection and a safe default
state must work independently of the ESP32. LCD and web status report the
GPIO request. Verification of the relay contacts requires separate feedback.

### Serial bench test without a button

First confirm the label on the power header. `VN` is GPIO39, an analog input.
`VIN` is a power rail on the development board. Verify its voltage and
available current with the actual board and power source, and verify the
relay module's IN levels and default-off behavior with the reviewer.

For an isolated low-voltage bench with the ESP32 and relay module only,
disconnect the AC supply, load, and mains-connected assembly. Build with
`ENABLE_RELAY_SERIAL_BENCH_TEST = true` and keep
`ENABLE_LOCAL_RELAY_TEST = false`. Open Serial Monitor at 115200 baud,
choose a line ending, and send `RELAY TEST`. The firmware requests ON for
one second, then OFF. Repeated commands during the pulse are ignored.
Wi-Fi, the dashboard, and PZEM polling are skipped in this build. Restore
the default build after the bench check and before returning to meter tests.

## Local Wi-Fi dashboard and relay control

Copy `esp32_lcd_test/wifi_secrets.example.h` to `wifi_secrets.h` in the same
folder and enter the 2.4 GHz Wi-Fi name and password there. The file is ignored
by Git; never commit or share it. Find the local IP on the LCD's
`Dashboard IP` page. Open `http://` followed by that IP on a device on the
same network. The page shows current readings, estimates, meter failures,
and the last GPIO command state.

To enable web control, use `openssl rand -hex 16` to generate a separate
32-character token and put it in `RELAY_CONTROL_TOKEN` in the local
`wifi_secrets.h`. Keep both button and serial bench modes disabled. Enter
the token in the dashboard to use the ON and OFF buttons. The firmware
requests OFF at boot. ON is accepted only with a fresh PZEM reading.
The PZEM must be able to report valid measurements with the outlet OFF
for this configuration to accept ON. While ON, a meter failure, Wi-Fi
disconnect, or 30-second limit triggers an OFF request. Repeating ON does
not extend the active timer.

The dashboard displays the requested relay state and the sampled GPIO level.
With the active-low module, OFF should read HIGH at D5. The GPIO reading
does not verify the relay contacts or outlet state.

The local dashboard uses unencrypted HTTP. Keep it on a trusted private
network, avoid shared networks, and keep the port closed to the internet.
The ESP32 dashboard is separate from the deployed Render app.

## RUAN AI live readings pilot

1. Run the web app in connected mode (`NEXT_PUBLIC_DEMO_MODE=false`) and
   sign in as a home owner. In **Add device → ESP32 smart plug**, register
   the plug in a room and copy its Device ID from the device page.
2. In EMQX Cloud, use the Device ID as this plug's MQTT username. Create a
   unique password and allow it to publish only to
   `v1/devices/<device-id>/telemetry` and
   `v1/devices/<device-id>/availability`. Use a separate worker identity.
   Apply deny-by-default authorization after the allowed rules.
3. In the ignored `wifi_secrets.h`, add `RUAN_DEVICE_ID`,
   `RUAN_MQTT_URL` (the `mqtts://` broker URL), `RUAN_MQTT_PASSWORD`,
   and `RUAN_MQTT_CA` (broker CA PEM, with escaped newlines). Use the
   current Wi-Fi settings. The firmware uses NTP for TLS and sample
   timestamps. Keep database and Supabase keys on the server.
4. Set up the IoT worker with the database and Supabase settings from
   `apps/iot-worker/.env.example`, and separate MQTT credentials. It can
   run on a computer for the pilot with `TELEMETRY_ONLY=true`. Give this
   identity subscribe access to telemetry and availability only. Set
   `MQTT_CA_PEM` if its broker uses a
   CA outside the Node.js trust store.
5. Compile and upload the sketch with the ESP32 separated from the mains
   assembly. After reconnecting the reviewed setup, check that the RUAN
   AI device page shows a recent reading and that V, A, W, kWh and PF match
   the LCD. Check that readings resume after reboot and Wi-Fi interruption.
   A meter read fault stays distinct from a valid zero-watt reading.

The default firmware sends readings and availability over MQTT. The web API
keeps these devices in monitoring mode by default.

### Opt-in cloud relay pilot

The sketch also includes an opt-in MQTT receiver for one reviewed device.
Keep `RUAN_ENABLE_CLOUD_RELAY` at its default `0` during telemetry tests.

1. Verify that the relay stays off at ESP32 power-up and reset on an
   isolated low-voltage bench with AC and loads disconnected. Use the
   existing serial bench test to verify relay polarity and the output
   independently of the cloud. Have the assembled mains hardware reviewed
   before running a live-load pilot.
2. Extend the existing deny-by-default MQTT rules for this exact device ID.
   The plug may subscribe to `v1/devices/<device-id>/commands` and publish
   `v1/devices/<device-id>/state` and `v1/devices/<device-id>/acks` in
   addition to its existing telemetry and availability topics. The worker
   may publish `commands` and subscribe to `state` and `acks` for that
   same ID. Use TLS and distinct credentials. Commands use QoS 1 and are
   never retained.
3. For the reviewed test only, set `#define RUAN_ENABLE_CLOUD_RELAY 1` in
   the ignored `wifi_secrets.h`. Build and upload while the ESP32 is
   separated from mains and powered by USB only. Configure the scoped
   worker as documented in [Render deployment](../docs/deployment/render.md#opt-in-relay-pilot).
4. Check that an unpowered PZEM causes an ON command to fail and that OFF
   stays inactive. Verify the command status and independently reported
   GPIO state. The app identifies the GPIO signal as its source. Verify
   physical relay operation separately on the reviewed hardware setup.

The ESP32 requires a fresh meter sample to turn on. It requests OFF on
startup, when it detects loss of Wi-Fi or MQTT, when the meter sample
becomes stale, and after 30 seconds of continuous ON. It rejects expired
or retained commands and ON requests issued before its current MQTT
subscription. The cloud mode takes exclusive ownership of the output,
disabling the LAN relay controls while it is selected. A successful
acknowledgement verifies GPIO level only. The circuit has no relay-contact
feedback in this configuration.

The LCD and telemetry can show voltage, current, power and energy when
an otherwise valid meter response has an invalid power factor. Such a
sample still blocks relay ON. The cloud command reports `METER_PF_INVALID`
so this case can be distinguished from a missing reading.
