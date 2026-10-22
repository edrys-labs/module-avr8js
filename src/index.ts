import '@wokwi/elements'
import { AVRRunner } from './execute'
import { Board } from './board'
import { parts } from './parts'
import { SENSOR_TAGS, attachControls } from './controls'
import { formatTime } from './format-time'
import { CPUPerformance } from './cpu-performance'

declare const window: any

// Arduino libraries that hexi.wokwi.com only installs when libraries.txt lists them
const LIBRARIES: { [header: string]: string } = {
  'Adafruit_SSD1306.h': 'Adafruit SSD1306',
  'Adafruit_ILI9341.h': 'Adafruit ILI9341',
  'Adafruit_MPU6050.h': 'Adafruit MPU6050',
  'IRremote.h': 'IRremote',
  'IRremote.hpp': 'IRremote',
  'Stepper.h': 'Stepper',
  'AccelStepper.h': 'AccelStepper',
  'HX711.h': 'HX711',
  'SD.h': 'SD',
  'NewPing.h': 'NewPing',
}

// Arduino libraries that hexi.wokwi.com installs by default, but only while no libraries.txt is sent
const DEFAULT_LIBRARIES: { [header: string]: string } = {
  'Servo.h': 'Servo',
  'LiquidCrystal_I2C.h': 'LiquidCrystal I2C',
  'Adafruit_NeoPixel.h': 'Adafruit NeoPixel',
  'FastLED.h': 'FastLED',
  'RTClib.h': 'RTClib',
  'DHT.h': 'DHT sensor library',
  'Keypad.h': 'Keypad',
}

/** Adds the libraries the code includes to libraries.txt (merged with a given one). */
function withLibraries(sketch: string, files: { name: string; content: string }[]) {
  const libraries = new Set<string>()
  for (const file of files.filter((f) => f.name === 'libraries.txt')) {
    file.content.split('\n').forEach((lib) => lib.trim() && libraries.add(lib.trim()))
  }
  const headers = new Set<string>()
  for (const code of [sketch, ...files.map((f) => f.content)]) {
    for (const [, header] of (code || '').matchAll(/#include\s*[<"]([\w.]+)[>"]/g)) {
      headers.add(header)
      if (LIBRARIES[header]) libraries.add(LIBRARIES[header])
    }
  }
  // with a libraries.txt the server installs only what it lists, so keep the default ones in use
  if (libraries.size) {
    headers.forEach((header) => DEFAULT_LIBRARIES[header] && libraries.add(DEFAULT_LIBRARIES[header]))
  }

  files = files.filter((f) => f.name !== 'libraries.txt')
  if (libraries.size) {
    files.push({ name: 'libraries.txt', content: [...libraries].join('\n') })
  }
  return files
}

const AVR8js = {
  build: async function (
    sketch: string,
    files: { name: string; content: string }[] = []
  ) {
    if (!window.__AVR8jsCache) {
      window.__AVR8jsCache = {}
    }

    files = withLibraries(sketch, files)

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: body,
      })
      // throw before caching, so a retry asks the server again
      if (!resp.ok) {
        throw new Error(`it answered with HTTP ${resp.status}`)
      }
      const rslt = await resp.json()

      window.__AVR8jsCache[body] = rslt

      return rslt
    }
  },

  execute: function (hex: string, log: (text: string) => void, id?: string) {
    const container = (id && document.getElementById(id)) || document

    const runner = new AVRRunner(hex)

    // every part of the circuit wires itself to the board, see parts.ts
    const board = new Board(runner)
    const frames: Array<() => void> = []
    for (const [tag, attach] of Object.entries(parts)) {
      container.querySelectorAll(tag).forEach((el) => {
        const frame = attach(el, board)
        if (frame) frames.push(frame)
      })
    }

    // sliders for the sensor values, in the order of the circuit
    container
      .querySelectorAll(SENSOR_TAGS.join(','))
      .forEach((el) => attachControls(el, board))

    runner.usart.onByteTransmit = (value) => {
      board.serialActivity = true
      log(String.fromCharCode(value))
    }

    const timeSpan = container.querySelector('#simulation-time')
    const cpuPerf = new CPUPerformance(runner.cpu, runner.FREQ)

    runner.execute((cpu) => {
      board.frame()
      frames.forEach((frame) => frame())
      board.serialActivity = false

      if (timeSpan) {
        const time = formatTime(cpu.cycles / runner.FREQ)
        const speed = (cpuPerf.update() * 100).toFixed(0)
        timeSpan.textContent = `Simulation time: ${time} (${speed}%)`
      }
    })

    return runner
  },
}

window['AVR8js'] = AVR8js

export { AVR8js }
