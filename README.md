# Edrys AVR8js Module

An AVR8js-based Arduino simulator for [edrys-Lite](https://github.com/edrys-labs/edrys-Lite). It emulates an ATmega328P (Arduino Uno) in the browser using [avr8js](https://github.com/wokwi/avr8js), with interactive Wokwi circuit components and no hardware required.

Import the module via:

```
https://edrys-labs.github.io/module-avr8js/index.html
```

---

## Configuration

The module accepts three configuration properties:

| Property      | Type    | Description                                                                 | Default     |
|---------------|---------|-----------------------------------------------------------------------------|-------------|
| `modules`     | String  | HTML string of Wokwi circuit elements to display                            | `""`        |
| `execute`     | String  | Edrys message topic the module listens on for code/hex                      | `"execute"` |
| `synchronize` | Boolean | Run code sent by any peer in the room on every peer in that room            | `false`     |

By default, each peer runs only the code it sent itself: a student's upload starts only that student's
simulator. With `synchronize: true`, an upload from anyone in the room starts on every peer in the room
(each peer still runs its own simulation, so button presses and knob turns stay local). Combine it with an
editor's own sync setting, e.g. [module-monaco-editor](https://github.com/edrys-labs/module-monaco-editor)'s
`synchronize`, to choose between a shared program and individual work.

With `synchronize: true`, the last upload is also kept in the room state under `avr8js:<execute>` (e.g.
`avr8js:execute`). Peers who join the room later, or whose module reloads, compile and start it
automatically; their simulation starts from the beginning, not in step with the others. Stop is shared
the same way: pressing it stops the simulation on every peer in the room and removes the stored upload, so
nobody restarts it on reload or join. Without `synchronize`, Stop only stops your own simulation.

**YAML example:**

```yaml
modules: |
  <wokwi-led color='red'   pin='13' label='13'></wokwi-led>
  <wokwi-led color='green' pin='12' label='12'></wokwi-led>
  <wokwi-led color='blue'  pin='11' label='11'></wokwi-led>
  <span id='simulation-time'></span>

execute: execute
synchronize: false
```

**JSON example:**

```json
{
  "modules": "<wokwi-led color='red' pin='13' label='13'></wokwi-led>\n<wokwi-led color='green' pin='12' label='12'></wokwi-led>\n<span id='simulation-time'></span>",
  "execute": "execute",
  "synchronize": false
}
```

---

## Available Circuit Elements

All elements are standard Wokwi web components placed in the `modules` HTML string.

### Utility

| Element | Description |
|---|---|
| `<span id='simulation-time'></span>` | Displays elapsed simulation time and CPU performance (e.g. `Simulation time: 00:05.123 (98%)`) |

### Digital Output

#### `wokwi-led` — LED

```html
<wokwi-led color='red' pin='13' label='LED'></wokwi-led>
```

| Attribute | Description |
|---|---|
| `color` | Any CSS color or name: `red`, `green`, `blue`, `yellow`, `orange`, etc. |
| `pin` | Arduino digital pin number (0–13) |
| `label` | Optional text label displayed on the component |

### Digital Input

#### `wokwi-pushbutton` — Push Button

```html
<wokwi-pushbutton pin='2'></wokwi-pushbutton>
```

| Attribute | Description |
|---|---|
| `pin` | Arduino digital pin to drive HIGH when pressed |

### Analog Input

#### `wokwi-potentiometer` — Potentiometer

```html
<wokwi-potentiometer pin='A0'></wokwi-potentiometer>
```

| Attribute | Description |
|---|---|
| `pin` | Analog pin (`A0`–`A5`) — returns ADC values 0–1023 |

#### `wokwi-ntc-temperature-sensor` — NTC Temperature Sensor

```html
<wokwi-ntc-temperature-sensor pin='A2'></wokwi-ntc-temperature-sensor>
```

| Attribute | Description |
|---|---|
| `pin` | Analog pin (`A0`–`A5`) |

Interactive slider lets you set temperature from −40 °C to +125 °C. The module simulates the corresponding NTC thermistor resistance and updates the ADC value accordingly.

### Displays

#### `wokwi-lcd1602` — 16×2 Character LCD (I2C)

```html
<wokwi-lcd1602></wokwi-lcd1602>
```

I2C address: `0x27`. Use the `LiquidCrystal_I2C` library in your sketch.

#### `wokwi-ssd1306` — 128×64 OLED Display (I2C)

```html
<wokwi-ssd1306></wokwi-ssd1306>
```

I2C address: `0x3D`. Use the `Adafruit_SSD1306` library in your sketch.

#### `wokwi-7segment` — 7-Segment Display

```html
<wokwi-7segment pin='0'></wokwi-7segment>
```

| Attribute | Description |
|---|---|
| `pin` | Selects the whole port: `0`–`7` → PORTD, `8`–`13` → PORTB |

Port bits 0–7 drive segments A, B, C, D, E, F, G and DP. On PORTD, pins 0 and 1 are also the serial
pins, so don't use `Serial` in the same sketch.

```cpp
void setup() { DDRD = 0xFF; }
void loop() {
  PORTD = 0b01111111; // "8": segments A–G
}
```

### PWM / Actuators

#### `wokwi-servo` — Servo Motor

```html
<wokwi-servo pin='9'></wokwi-servo>
```

| Attribute | Description |
|---|---|
| `pin` | PWM-capable pin. Pulse width 1000–2000 µs maps to 0–180°. Default: 90°. |

Use the `Servo` library in your sketch.

#### `wokwi-buzzer` — Buzzer

```html
<wokwi-buzzer pin='8' frequency='1000'></wokwi-buzzer>
```

| Attribute | Description |
|---|---|
| `pin` | Digital pin driven HIGH to activate audio |
| `frequency` | Tone frequency in Hz (default: `1000`) |

Audio is generated via the Web Audio API. A user interaction (click) is required to unlock audio in the browser.

### Addressable LEDs

#### `wokwi-neopixel-matrix` — NeoPixel RGB Matrix

```html
<wokwi-neopixel-matrix cols='8' rows='8' pin='5'></wokwi-neopixel-matrix>
```

| Attribute | Description |
|---|---|
| `pin` | Data pin (WS2812B protocol) |
| `cols` | Number of columns |
| `rows` | Number of rows |

Use the `Adafruit_NeoPixel` library in your sketch.

### Real-Time Clock

#### `wokwi-ds1307` — DS1307 RTC (I2C)

```html
<wokwi-ds1307></wokwi-ds1307>
```

I2C address: `0x68`. Initializes to the current system time. Use the `DS1307RTC` library in your sketch.

---

## Pin Mapping

| Arduino Pin | AVR Port |
|---|---|
| D0–D7 | PORTD (PD0–PD7) |
| D8–D13 | PORTB (PB0–PB5) |
| A0–A5 | PORTC (PC0–PC5) |

---

## Example Configurations

### Blink (single LED)

```yaml
modules: |
  <wokwi-led color='red' pin='13' label='LED'></wokwi-led>
  <span id='simulation-time'></span>
```

### Button + LED

```yaml
modules: |
  <wokwi-pushbutton pin='2'></wokwi-pushbutton>
  <wokwi-led color='green' pin='13'></wokwi-led>
  <span id='simulation-time'></span>
```

### Potentiometer + LCD

```yaml
modules: |
  <wokwi-potentiometer pin='A0'></wokwi-potentiometer>
  <wokwi-lcd1602></wokwi-lcd1602>
  <span id='simulation-time'></span>
```

Arduino sketch (requires `LiquidCrystal_I2C`):
```cpp
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() { lcd.init(); lcd.backlight(); }

void loop() {
  lcd.setCursor(0, 0);
  lcd.print("ADC: ");
  lcd.print(analogRead(A0));
  delay(100);
}
```

### OLED Display

```yaml
modules: |
  <wokwi-ssd1306></wokwi-ssd1306>
  <span id='simulation-time'></span>
```

Arduino sketch (requires `Adafruit_SSD1306`):
```cpp
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);

void setup() {
  display.begin(SSD1306_SWITCHCAPVCC, 0x3D);
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Hello!");
  display.display();
}
void loop() {}
```

### Servo Motor

```yaml
modules: |
  <wokwi-servo pin='9'></wokwi-servo>
  <span id='simulation-time'></span>
```

Arduino sketch:
```cpp
#include <Servo.h>
Servo s;
void setup() { s.attach(9); }
void loop() {
  for (int a = 0; a <= 180; a++) { s.write(a); delay(15); }
  for (int a = 180; a >= 0; a--) { s.write(a); delay(15); }
}
```

### NeoPixel Matrix

```yaml
modules: |
  <wokwi-neopixel-matrix cols='8' rows='8' pin='5'></wokwi-neopixel-matrix>
  <span id='simulation-time'></span>
```

Arduino sketch (requires `Adafruit_NeoPixel`):
```cpp
#include <Adafruit_NeoPixel.h>
Adafruit_NeoPixel pixels(64, 5, NEO_GRB + NEO_KHZ800);
void setup() { pixels.begin(); }
void loop() {
  pixels.fill(pixels.Color(255, 0, 0));
  pixels.show();
  delay(500);
  pixels.clear();
  pixels.show();
  delay(500);
}
```

### Temperature Sensor

```yaml
modules: |
  <wokwi-ntc-temperature-sensor pin='A2'></wokwi-ntc-temperature-sensor>
  <span id='simulation-time'></span>
```

### Buzzer

```yaml
modules: |
  <wokwi-buzzer pin='8' frequency='440'></wokwi-buzzer>
  <wokwi-pushbutton pin='2'></wokwi-pushbutton>
  <span id='simulation-time'></span>
```

Arduino sketch:
```cpp
void setup() { pinMode(8, OUTPUT); pinMode(2, INPUT); }
void loop() {
  if (digitalRead(2) == HIGH) tone(8, 440);
  else noTone(8);
}
```

### Real-Time Clock + LCD

```yaml
modules: |
  <wokwi-ds1307></wokwi-ds1307>
  <wokwi-lcd1602></wokwi-lcd1602>
  <span id='simulation-time'></span>
```

---

## How It Works

1. An external editor module compiles Arduino code and publishes the hex on the `execute` topic (configurable).
2. This module receives the hex, loads it into the AVR8js emulator, and starts a 16 MHz simulation loop.
3. Wokwi components react to AVR pin state changes in real time (GPIO, PWM, I2C, SPI).
4. Serial output (`Serial.print`) is displayed in the built-in terminal.
5. Interactive components (button, potentiometer, temperature slider) inject input back into the simulation.
