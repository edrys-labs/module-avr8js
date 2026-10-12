import { Board } from './board'
import { Slider } from './controllers'

/**
 * Sliders below the circuit for the sensor values of the parts. Every part in
 * parts.ts reads its values from attributes while the simulation runs, so a
 * slider only sets the attribute.
 *
 * Each sensor gets the sliders listed in SENSORS. The attribute
 * controls='temperature, distance:2:200' picks them (with an optional range),
 * also for attributes that are not listed, and controls='none' hides them.
 */

interface Control {
  attr: string
  label: string
  min: number
  max: number
  value: number // the part's default, used if the attribute is not set
  step?: number
  unit?: string
}

interface Sensor {
  /** the pin that names the sliders, e.g. "Temperature D2"; else the part name */
  pin?: string
  /** analog input: plain 0-5 means A0-A5 */
  analog?: boolean
  name?: string
  controls: Control[]
  /** shown without a controls attribute; default: all */
  shown?: string[]
}

const SENSORS: { [tag: string]: Sensor } = {
  'wokwi-ntc-temperature-sensor': {
    pin: 'pin',
    analog: true,
    controls: [{ attr: 'temperature', label: 'Temperature', min: -40, max: 125, value: 24, step: 0.1, unit: '°C' }],
  },
  'wokwi-dht22': {
    pin: 'pin',
    controls: [
      { attr: 'temperature', label: 'Temperature', min: -40, max: 80, value: 24, step: 0.1, unit: '°C' },
      { attr: 'humidity', label: 'Humidity', min: 0, max: 100, value: 40, step: 0.1, unit: '%' },
    ],
  },
  'wokwi-hc-sr04': {
    pin: 'pin-echo',
    controls: [{ attr: 'distance', label: 'Distance', min: 2, max: 400, value: 400, step: 1, unit: 'cm' }],
  },
  'wokwi-photoresistor-sensor': {
    pin: 'pin',
    analog: true,
    controls: [{ attr: 'lux', label: 'Light', min: 1, max: 10000, value: 500, step: 1, unit: 'lux' }],
  },
  'wokwi-gas-sensor': {
    pin: 'pin',
    analog: true,
    controls: [{ attr: 'ppm', label: 'Gas', min: 0, max: 10000, value: 400, step: 1, unit: 'ppm' }],
  },
  'wokwi-flame-sensor': {
    pin: 'pin',
    analog: true,
    controls: [{ attr: 'level', label: 'Flame', min: 0, max: 1023, value: 0, step: 1 }],
  },
  'wokwi-small-sound-sensor': {
    pin: 'pin',
    analog: true,
    controls: [{ attr: 'level', label: 'Sound', min: 0, max: 1023, value: 0, step: 1 }],
  },
  'wokwi-big-sound-sensor': {
    pin: 'pin',
    analog: true,
    controls: [{ attr: 'level', label: 'Sound', min: 0, max: 1023, value: 0, step: 1 }],
  },
  'wokwi-heart-beat-sensor': {
    pin: 'pin',
    analog: true,
    controls: [{ attr: 'bpm', label: 'Heart rate', min: 40, max: 180, value: 70, step: 1, unit: 'bpm' }],
  },
  'wokwi-hx711': {
    pin: 'pin-dt',
    controls: [{ attr: 'load', label: 'Load', min: 0, max: 50, value: 0, unit: 'kg' }],
  },
  'wokwi-mpu6050': {
    name: 'MPU6050',
    controls: [
      { attr: 'accelX', label: 'Acceleration X', min: -2, max: 2, value: 0, step: 0.01, unit: 'g' },
      { attr: 'accelY', label: 'Acceleration Y', min: -2, max: 2, value: 0, step: 0.01, unit: 'g' },
      { attr: 'accelZ', label: 'Acceleration Z', min: -2, max: 2, value: 1, step: 0.01, unit: 'g' },
      { attr: 'rotationX', label: 'Rotation X', min: -250, max: 250, value: 0, step: 1, unit: '°/s' },
      { attr: 'rotationY', label: 'Rotation Y', min: -250, max: 250, value: 0, step: 1, unit: '°/s' },
      { attr: 'rotationZ', label: 'Rotation Z', min: -250, max: 250, value: 0, step: 1, unit: '°/s' },
      { attr: 'temperature', label: 'Temperature', min: -40, max: 85, value: 24, step: 0.1, unit: '°C' },
    ],
    shown: ['accelX', 'accelY', 'accelZ', 'rotationZ', 'temperature'],
  },
  // slow motion, only with controls='speed:0.0005:0.05'
  'avr-chart': {
    name: 'chart',
    controls: [{ attr: 'speed', label: 'Speed', min: 0.0001, max: 1, value: 1, step: 0.0001 }],
    shown: [],
  },
}

export const SENSOR_TAGS = Object.keys(SENSORS)

/** "D2" or "A0" for the pin in attribute attr */
function pinName(el: Element, attr: string, analog: boolean, board: Board) {
  const p = analog ? board.analogPin(el, attr) : board.pin(el, attr)
  if (!p) return ''
  if (p.adc !== undefined) return 'A' + p.adc
  const port = p.port === board.runner.port.get('B') ? 8 : 0
  return 'D' + (port + p.bit)
}

/** parses controls='temperature, distance:2:200' */
function requested(el: Element, sensor: Sensor): Control[] {
  const spec = el.getAttribute('controls')
  if (spec === null) {
    return sensor.controls.filter((c) => !sensor.shown || sensor.shown.includes(c.attr))
  }

  const controls: Control[] = []
  for (const entry of spec.split(',')) {
    const [attr, min, max] = entry.split(':').map((s) => s.trim())
    if (!attr || attr === 'none') continue
    const known = sensor.controls.find((c) => c.attr.toLowerCase() === attr.toLowerCase())
    const range = min !== undefined && max !== undefined ? { min: Number(min), max: Number(max) } : null
    if (range && (isNaN(range.min) || isNaN(range.max) || range.min >= range.max)) {
      console.warn(`AVR8js: invalid range in controls="${entry.trim()}"`)
      continue
    }
    if (known) {
      controls.push({ ...known, ...range })
    } else if (range) {
      controls.push({ attr, label: attr, value: range.min, ...range })
    } else {
      console.warn(`AVR8js: controls="${attr}" needs a range, e.g. ${attr}:0:100`)
    }
  }
  return controls
}

/** adds the sliders of one sensor to #sensors, they are removed when the run stops */
export function attachControls(el: Element, board: Board) {
  const sensor = SENSORS[el.tagName.toLowerCase()]
  if (!sensor) return

  const where = sensor.pin ? pinName(el, sensor.pin, !!sensor.analog, board) : sensor.name || ''
  const parent = document.getElementById('sensors') || document.body

  for (const control of requested(el, sensor)) {
    const span = control.max - control.min
    const value = Math.min(control.max, Math.max(control.min, board.num(el, control.attr, control.value)))
    // the part reads the attribute, so it has to match what the slider shows
    if (value !== board.num(el, control.attr, NaN)) el.setAttribute(control.attr, String(value))
    const slider = new Slider(
      {
        min: control.min,
        max: control.max,
        value,
        step: control.step ?? (span > 100 ? 1 : 0.1),
        unit: control.unit || '',
        label: `${control.label} ${where}`.trim(),
      },
      { onValueChange: (v) => el.setAttribute(control.attr, String(v)) }
    )
    slider.appendTo(parent)
    board.runner.onStop.push(() => slider.remove())
  }
}
