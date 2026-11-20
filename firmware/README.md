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

## LCD test

`esp32_lcd_test/esp32_lcd_test.ino` is a separate LCD bring-up sketch. Install
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

The sketch uses ESP32 RX2/GPIO16 and TX2/GPIO17 as provisional UART pins and
displays voltage, current, power, energy, and power factor on rotating pages.
Verify actual pins and safe electrical interface before connecting the meter.
It reports read failures instead of substituting zero, and does not reset the
meter's cumulative energy counter. Readings and hardware remain unvalidated.

## Local Wi-Fi test page

Copy `esp32_lcd_test/wifi_secrets.example.h` to `wifi_secrets.h` in the same
folder and enter the 2.4 GHz Wi-Fi name and password there. The file is ignored
by Git; never commit or share it. Upload the sketch and open Serial Monitor at
115200 baud to find the local `http://` address. Open that address on a device
on the same network. The page shows current readings and meter failures. This
is a local, unauthenticated HTTP test page: use a trusted private network, do
not port-forward it, and do not use it for production or sensitive data. It is
not connected to the deployed dashboard, Supabase, or the IoT worker.
