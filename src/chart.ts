import { Board } from './board'
import { Recorder, Trace } from './probe'

/**
 * <avr-chart signals="TCNT0, OCR0A, OC0A" window="2ms" mode="roll|scope"
 *            trigger="TOV0" speed="0.001"></avr-chart>
 *
 * Plots signals from inside the ATmega328p (see probe.ts). In roll mode the
 * chart shows the last window of simulation time, in scope mode the window
 * after each trigger event as a still picture. Recording and attributes are
 * those of LiaTemplates/AVR8js; the drawing is a canvas of our own, since
 * edrys has no <lia-chart>.
 */

// the slow motion factor of every chart, the slowest one wins
const speeds = new WeakMap<Board, Map<Element, number>>()

const LANE = 26 // px per digital lane
const PLOT = 150 // px per analog plot
const GAP = 24 // px above each plot, for its unit
const LEFT = 110 // px for the y-axis and lane labels
const RIGHT = 16
const AXIS = 32 // px for the time axis

/** "2ms", "500us", "1s" → seconds */
function duration(value: string | null, fallback: number) {
  const m = (value || '').trim().match(/^([\d.]+)\s*(us|µs|ms|s)?$/i)
  if (!m) return fallback
  const scale: { [unit: string]: number } = { us: 1e-6, 'µs': 1e-6, ms: 1e-3, s: 1 }
  return parseFloat(m[1]) * scale[(m[2] || 's').toLowerCase()]
}

// fixed ends of the y-axes; open ends follow the data. % only starts at 0, a
// load of a few percent would be a flat line on a 0-100 axis
const RANGES: { [group: string]: { min?: number; max?: number } } = {
  V: { min: 0, max: 5 },
  '%': { min: 0 },
  count: { min: 0 },
}

/** thin lines are sharp only in the middle of a pixel */
const crisp = (v: number) => Math.round(v - 0.5) + 0.5

/** about count round steps between min and max */
function ticks(min: number, max: number, count: number) {
  const raw = (max - min) / count
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = magnitude * ([1, 2, 5, 10].find((f) => f * magnitude >= raw) || 10)
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  const result: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    result.push(Number(v.toFixed(decimals)))
  }
  return result
}

/** the points inside the window, lines and steps start at its left edge */
function clip(t: Trace, from: number, to: number) {
  const points: Array<[number, number]> = []
  let before: [number, number] | undefined
  for (const p of t.data) {
    if (p[0] < from) before = p
    else if (p[0] <= to) points.push(p)
  }
  if (before && (t.style === 'step' || t.style === 'line')) points.unshift([from, before[1]])
  if (t.style === 'step' && points.length) points.push([to, points[points.length - 1][1]])
  return points
}

const VIEW = `<style>
  :host { display: block; }
  .title { margin: 0 0 0.25rem; font-weight: bold; text-align: center; }
  .title:empty { display: none; }
  .legend { display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; margin-bottom: 0.25rem; font-size: small; }
  .legend:empty { display: none; }
  .legend span::before {
    content: ''; display: inline-block; width: 0.8em; height: 0.8em; margin-right: 0.3em;
    border-radius: 2px; background: var(--color); vertical-align: -0.05em;
  }
  canvas { display: block; width: 100%; }
</style><div class="title"></div><div class="legend"></div><canvas role="img"></canvas>`

export function avrChart(el: any, board: Board) {
  const FREQ = board.runner.FREQ
  const seconds = duration(el.getAttribute('window'), 0.002)
  const windowCycles = Math.max(16, Math.round(seconds * FREQ))
  const samples = Math.min(5000, Math.max(10, board.num(el, 'samples', 400)))
  // a frame may run far past the window (500k cycles), keep enough history
  const recorder = new Recorder(
    board,
    Math.max(1, Math.round(windowCycles / samples)),
    2 * windowCycles + board.runner.workUnitCycles
  )
  const signals = (el.getAttribute('signals') || 'TCNT0').split(/[\s,;]+/).filter(Boolean)
  for (const signal of signals) {
    if (!recorder.add(signal)) console.warn(`avr-chart: unknown signal "${signal}"`)
  }

  const scope = el.getAttribute('mode') === 'scope'
  const trigger = scope && el.getAttribute('trigger')
  let triggered = -1
  let armed = 0 // wall time when the next trigger is accepted
  if (trigger) {
    const accepted = recorder.trigger(trigger, () => {
      if (triggered < 0 && performance.now() >= armed) triggered = board.cycles
    })
    if (!accepted) console.warn(`avr-chart: unknown trigger "${trigger}"`)
  }
  recorder.start()
  Object.defineProperty(el, 'traces', { get: () => recorder.traces, configurable: true })

  // the view lives in a shadow root, so the circuit's styles don't reach it
  const root: ShadowRoot = el.shadowRoot || el.attachShadow({ mode: 'open' })
  root.innerHTML = VIEW
  const titleBox = root.querySelector('.title') as HTMLElement
  const legendBox = root.querySelector('.legend') as HTMLElement
  const canvas = root.querySelector('canvas') as HTMLCanvasElement
  titleBox.textContent = el.getAttribute('title') || ''
  canvas.setAttribute('aria-label', `Chart of ${signals.join(', ')}`)
  let legend = ''

  // draw only while the chart is on screen
  let visible = true
  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting
    })
    observer.observe(el)
    board.signal.addEventListener('abort', () => observer.disconnect())
  }

  const unit: [string, number] = seconds < 2e-3 ? ['µs', 1e6] : seconds < 2 ? ['ms', 1e3] : ['s', 1]

  const render = (ref: number, from: number, to: number) => {
    const width = canvas.clientWidth
    if (!width) return

    const style = getComputedStyle(el)
    const color = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
    const text = color('--chart-text', '#888')
    const grid = color('--chart-grid', 'rgba(128,128,128,0.2)')
    const axis = color('--chart-axis', '#888')
    const palette = color('--chart-series', '#2f6fdf, #d9622b, #1f9e6e, #a33fb5')
      .split(',')
      .map((c) => c.trim())

    const traces = recorder.traces
    const colorOf = (t: Trace) => palette[traces.indexOf(t) % palette.length]
    const groups = [...new Set(traces.map((t) => t.group).filter((g) => g !== 'logic'))]
    const lanes = traces.filter((t) => t.group === 'logic')

    // legend of the plotted lines, the lanes are labelled on the canvas
    const entries = traces.filter((t) => t.group !== 'logic').map((t) => `${t.name}\u0000${colorOf(t)}`)
    if (entries.join('|') !== legend) {
      legend = entries.join('|')
      legendBox.replaceChildren(
        ...entries.map((entry) => {
          const [name, c] = entry.split('\u0000')
          const span = document.createElement('span')
          span.textContent = name
          span.style.setProperty('--color', c)
          return span
        })
      )
    }

    // layout: the plots, then the lanes, then the time axis
    const wanted = board.num(el, 'height', 0)
    const logicHeight = lanes.length * LANE
    const plot = wanted
      ? Math.max(60, (wanted - AXIS - logicHeight - GAP * groups.length) / Math.max(1, groups.length))
      : PLOT
    const height = groups.length * (GAP + plot) + (lanes.length ? 8 + logicHeight : 0) + AXIS

    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.height = `${height}px`
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.font = `11px ${style.fontFamily}`
    ctx.lineJoin = 'round'

    const right = width - RIGHT
    const xOf = (cycles: number) => LEFT + ((cycles - from) / (to - from)) * (right - LEFT)
    const bottom = height - AXIS

    // time axis and its vertical grid, in µs/ms/s relative to ref
    const t = (cycles: number) => ((cycles - ref) / FREQ) * unit[1]
    const tMin = t(from)
    const tMax = t(to)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (const v of ticks(tMin, tMax, Math.max(2, Math.floor((right - LEFT) / 80)))) {
      const x = crisp(LEFT + ((v - tMin) / (tMax - tMin)) * (right - LEFT))
      ctx.strokeStyle = grid
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, bottom)
      ctx.stroke()
      ctx.fillStyle = text
      ctx.fillText(String(v), x, bottom + 6)
    }
    ctx.textAlign = 'right'
    ctx.fillText(unit[0], right, bottom + 18)
    ctx.strokeStyle = axis
    ctx.beginPath()
    ctx.moveTo(LEFT, bottom)
    ctx.lineTo(right, bottom)
    ctx.stroke()

    // one plot per unit
    groups.forEach((group, i) => {
      const top = i * (GAP + plot) + GAP
      const members = traces.filter((tr) => tr.group === group)
      const visiblePoints = members.map((tr) => clip(tr, from, to))

      let min = RANGES[group]?.min
      let max = RANGES[group]?.max
      const values = visiblePoints.flat().map((p) => p[1])
      if (min === undefined) min = values.length ? Math.min(...values) : 0
      if (max === undefined) {
        max = values.length ? Math.max(...values) : 1
        max += (max - min) * 0.05 // headroom above the highest value
        if (group === '%') max = Math.min(100, Math.max(max, 1))
      }
      if (max - min < 1e-9) max = min + 1
      const yOf = (v: number) => top + plot - ((v - min!) / (max! - min!)) * plot

      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (const v of ticks(min, max, 4)) {
        const y = crisp(yOf(v))
        ctx.strokeStyle = grid
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(LEFT, y)
        ctx.lineTo(right, y)
        ctx.stroke()
        ctx.fillStyle = text
        ctx.fillText(String(v), LEFT - 6, y)
      }
      ctx.textBaseline = 'bottom'
      ctx.fillText(group, LEFT - 6, top - 6)
      ctx.strokeStyle = axis
      ctx.beginPath()
      ctx.moveTo(LEFT, top)
      ctx.lineTo(LEFT, top + plot)
      ctx.stroke()

      ctx.save()
      ctx.beginPath()
      ctx.rect(LEFT, top - 2, right - LEFT, plot + 4)
      ctx.clip()
      members.forEach((tr, j) => {
        const points = visiblePoints[j]
        ctx.strokeStyle = ctx.fillStyle = colorOf(tr)
        ctx.lineWidth = 1.5
        if (tr.style === 'points') {
          for (const [c, v] of points) {
            ctx.beginPath()
            ctx.arc(xOf(c), yOf(v), 2.5, 0, 2 * Math.PI)
            ctx.fill()
          }
          return
        }
        ctx.beginPath()
        points.forEach(([c, v], k) => {
          const x = xOf(c)
          const y = yOf(v)
          if (k === 0) ctx.moveTo(x, y)
          else {
            if (tr.style === 'step') ctx.lineTo(x, yOf(points[k - 1][1]))
            ctx.lineTo(x, y)
          }
        })
        ctx.stroke()
      })
      ctx.restore()
    })

    // the digital lanes: levels as steps, interrupt flags as marks
    const lanesTop = groups.length * (GAP + plot) + 8
    lanes.forEach((tr, i) => {
      const base = lanesTop + (i + 1) * LANE - 5
      const high = base - LANE * 0.6
      ctx.fillStyle = text
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(tr.name, LEFT - 6, base - LANE * 0.3)
      ctx.strokeStyle = grid
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(LEFT, base + 2.5)
      ctx.lineTo(right, base + 2.5)
      ctx.stroke()

      const points = clip(tr, from, to)
      ctx.strokeStyle = ctx.fillStyle = colorOf(tr)
      if (tr.style === 'marks') {
        for (const [c] of points) ctx.fillRect(xOf(c) - 1, high, 2, base - high)
        return
      }
      ctx.lineWidth = 1.5
      ctx.beginPath()
      points.forEach(([c, v], k) => {
        const x = xOf(c)
        const y = v ? high : base
        if (k === 0) ctx.moveTo(x, y)
        else {
          ctx.lineTo(x, points[k - 1][1] ? high : base)
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()
    })
  }

  let rendered = 0
  return () => {
    let charts = speeds.get(board)
    if (!charts) speeds.set(board, (charts = new Map()))
    charts.set(el, board.num(el, 'speed', 1))
    board.runner.speed = Math.min(...charts.values())

    const now = board.cycles
    if (trigger) {
      // a still picture of the window after the trigger
      if (triggered < 0 || now < triggered + windowCycles) return
      if (visible) render(triggered, triggered - windowCycles / 10, triggered + windowCycles)
      triggered = -1
      armed = performance.now() + 300
    } else {
      if (!visible || performance.now() - rendered < 100) return
      rendered = performance.now()
      render(now, now - windowCycles, now)
    }
  }
}
