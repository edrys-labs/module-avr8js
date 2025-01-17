import '@wokwi/elements'
import { AVRRunner, PORT } from './execute'
import { formatTime } from './format-time'
//import { WS2812Controller } from "./ws2812";
import { CPUPerformance } from './cpu-performance'
import { PinState } from 'avr8js'
import { WS2812Controller } from './ws2812'
import { I2CBus } from './i2c-bus'
import { SSD1306Controller } from './ssd1306'
import { LCD1602Controller, LCD1602_ADDR } from './lcd1602'

import {
  BuzzerElement,
  LEDElement,
  NeopixelMatrixElement,
  PushbuttonElement,
  SevenSegmentElement,
  SSD1306Element,
  LCD1602Element,
  PotentiometerElement,
} from '@wokwi/elements'

declare const window: any

function pinPort(e: any): [number | null, string | null, number | null] {
  let port: PORT | null
  let pin = e.getAttribute('pin')
  pin = pin ? parseInt(pin, 10) : null

  if (pin == null) {
    port = null
  } else if (pin < 8) {
    port = 'D'
  } else if (pin < 16) {
    port = 'B'
  } else if (pin < 24) {
    port = 'C'
  } else {
    port = null
  }

  return [pin % 8, port, pin]
}

const AVR8js = {
  build: async function (
    sketch: string,
    files: { name: string; content: string }[] = []
  ) {
    if (!window.__AVR8jsCache) {
      window.__AVR8jsCache = {}
    }

    let body = JSON.stringify({
      sketch,
      files,
    })

    if (window.__AVR8jsCache[body]) {
      return window.__AVR8jsCache[body]
    } else {
      const resp = await fetch('https://hexi.wokwi.com/build', {
        method: 'POST',
        mode: 'cors',
        cache: 'force-cache',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body,
      })
      const rslt = await resp.json()

      window.__AVR8jsCache[body] = rslt

      return rslt
    }
  },

  buildASM: async function asmToHex(source: string) {
    if (!window.__AVR8jsCache) {
      window.__AVR8jsCache = {}
    }

    let body = JSON.stringify({ files: [{ name: 'main.S', content: source }] })

    if (window.__AVR8jsCache[body]) {
      return window.__AVR8jsCache[body]
    } else {
      const resp = await fetch('https://hexi.wokwi.com/asm', {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body,
      })

      const rslt = await resp.json()

      window.__AVR8jsCache[body] = rslt

      return rslt
    }
  },

  execute: function (hex: string, log: any, id: string, MHZ: any) {
    const PORTS: Array<PORT> = ['B', 'C', 'D']

    MHZ = MHZ || 16000000
    const cpuNanos = () => Math.round((runner.cpu.cycles / MHZ) * 1000000000)

    const container = document.getElementById(id) || document

    const LEDs: Array<LEDElement & HTMLElement> = Array.from(
      container?.querySelectorAll('wokwi-led') || []
    )
    const SEG7: Array<SevenSegmentElement & HTMLElement> = Array.from(
      container?.querySelectorAll<SevenSegmentElement & HTMLElement>(
        'wokwi-7segment'
      ) || []
    )
    const BUZZER: Array<BuzzerElement & HTMLElement> = Array.from(
      container?.querySelectorAll<BuzzerElement & HTMLElement>(
        'wokwi-buzzer'
      ) || []
    )

    const PushButton: Array<PushbuttonElement & HTMLElement> = Array.from(
      container?.querySelectorAll<PushbuttonElement & HTMLElement>(
        'wokwi-pushbutton'
      ) || []
    )

    const PotentiometerElement: Array<PotentiometerElement & HTMLElement> =
      Array.from(
        container?.querySelectorAll<PotentiometerElement & HTMLElement>(
          'wokwi-potentiometer'
        ) || []
      )

    const NeoMatrix: Array<NeopixelMatrixElement & HTMLElement> = Array.from(
      container?.querySelectorAll<NeopixelMatrixElement & HTMLElement>(
        'wokwi-neopixel-matrix'
      ) || []
    )

    const NeoMatrixController: WS2812Controller[] = []
    NeoMatrix.forEach((matrix) => {
      NeoMatrixController.push(new WS2812Controller(matrix.cols * matrix.rows))
    })

    // Set up the SSD1306
    const SSD1306 =
      container?.querySelector<SSD1306Element & HTMLElement>('wokwi-ssd1306') ||
      null

    const lcd1602 =
      container?.querySelector<LCD1602Element>('wokwi-lcd1602') || null

    const runner = new AVRRunner(hex)

    for (const PORT of PORTS) {
      // Hook to PORTB register
      const port = runner.port.get(PORT)

      if (port) {
        PushButton.forEach((button) => {
          const [pin, p] = pinPort(button)

          if (typeof pin === 'number' && p === PORT) {
            port.setPin(pin, false)

            button.addEventListener('button-press', () => {
              if (runner) {
                port.setPin(pin, true)
              }
            })

            button.addEventListener('button-release', () => {
              if (runner) {
                port.setPin(pin, false)
              }
            })
          }
        })

        PotentiometerElement.forEach((e) => {
          const [pin, prt, originalPin] = pinPort(e)
          if (typeof pin === 'number' && prt === PORT && originalPin !== null) {
            console.warn('Potentiometer found', e, pin, prt, PORT)
            e.oninput = (event) => {
              runner.adc.channelValues[originalPin] = (event.detail * 5) / 1023
            }

            runner.adc.channelValues[originalPin] = (e.value * 5) / 1023
          }
        })

        port.addListener((value) => {
          LEDs.forEach((e) => {
            let [pin, p] = pinPort(e)

            if (typeof pin === 'number' && p === PORT) {
              e.value = runner.port.get(p)?.pinState(pin) === PinState.High
            }
          })

          BUZZER.forEach((e) => {
            let [pin, p] = pinPort(e)

            if (typeof pin === 'number' && p === PORT) {
              e.hasSignal = runner.port.get(p)?.pinState(pin) || false
            }
          })

          SEG7.forEach((e) => {
            let [pin, p] = pinPort(e)

            if (typeof pin === 'number' && p === PORT) {
              e.values = [
                value & 1,
                value & 2,
                value & 4,
                value & 16,
                value & 32,
                value & 64,
                value & 128,
                value & 256,
              ]
            }
          })

          for (let i = 0; i < NeoMatrix.length; i++) {
            let [pin, p] = pinPort(NeoMatrix[i])

            if (typeof pin === 'number' && p === PORT) {
              NeoMatrixController[i]?.feedValue(
                // @ts-ignore
                runner.port.get(p)?.pinState(pin),
                cpuNanos()
              )
            }
          }
        })
      }
    }

    // Serial port output support
    runner.usart.onByteTransmit = (value) => {
      log(String.fromCharCode(value))
    }

    let ssd1306Controller: SSD1306Controller | null = null
    let lcd1602Controller: LCD1602Controller | null = null

    if (SSD1306 && !lcd1602) {
      const cpuMillis = () =>
        Math.round((runner.cpu.cycles / runner.FREQ) * 1000)
      const i2cBus = new I2CBus(runner.twi)
      ssd1306Controller = new SSD1306Controller(cpuMillis)
      i2cBus.registerDevice(0x3d, ssd1306Controller)
    } else if (lcd1602) {
      const cpuMillis = () =>
        Math.round((runner.cpu.cycles / runner.FREQ) * 1000)

      const i2cBus = new I2CBus(runner.twi)
      lcd1602Controller = new LCD1602Controller(cpuMillis)
      i2cBus.registerDevice(LCD1602_ADDR, lcd1602Controller)
    }

    const timeSpan = container?.querySelector('#simulation-time')

    const cpuPerf = new CPUPerformance(runner.cpu, MHZ)

    runner.execute((cpu) => {
      const time = formatTime(cpu.cycles / MHZ)
      const speed = (cpuPerf.update() * 100).toFixed(0)
      if (timeSpan)
        timeSpan.textContent = `Simulation time: ${time} (${speed}%)`

      if (SSD1306 && ssd1306Controller) {
        const frame = ssd1306Controller.update()
        if (frame) {
          ssd1306Controller.toImageData(SSD1306.imageData)
          SSD1306.redraw()
        }
      }

      if (lcd1602 && lcd1602Controller) {
        const lcd = lcd1602Controller.update()
        // Check component
        if (lcd) {
          // Update LCD1602
          lcd1602.blink = lcd.blink
          lcd1602.cursor = lcd.cursor
          lcd1602.cursorX = lcd.cursorX
          lcd1602.cursorY = lcd.cursorY
          lcd1602.characters = lcd.characters
          lcd1602.backlight = lcd.backlight

          // Check custom character
          if (lcd.cgramUpdated) {
            const font = lcd1602.font.slice(0)
            const cgramChars = lcd.cgram.slice(0, 0x40)

            // Set character
            font.set(cgramChars, 0)
            font.set(cgramChars, 0x40)

            // Get character
            lcd1602.font = font
          }
        }
      }

      for (let i = 0; i < NeoMatrix.length; i++) {
        let pixels = NeoMatrixController[i]?.update(cpuNanos())

        if (pixels) {
          for (let row = 0; row < NeoMatrix[i].rows; row++) {
            for (let col = 0; col < NeoMatrix[i].cols; col++) {
              const value = pixels[row * NeoMatrix[i].cols + col]
              NeoMatrix[i].setPixel(row, col, {
                b: (value & 0xff) / 255,
                r: ((value >> 8) & 0xff) / 255,
                g: ((value >> 16) & 0xff) / 255,
              })
            }
          }
        }
      }
    })

    return runner
  },
}

window['AVR8js'] = AVR8js

export { AVR8js }
