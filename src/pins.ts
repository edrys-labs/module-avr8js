import { PORT } from './execute'

/** Arduino Uno pin ('13', 'A0', '14') → [bit, port, arduino pin]. */
export function pinPort(e: Element): [number | null, PORT | null, number | null] {
  const attr = (e.getAttribute('pin') || '').trim().toUpperCase()
  const n = /^A[0-5]$/.test(attr) ? 14 + Number(attr[1]) : parseInt(attr, 10)

  if (Number.isNaN(n)) return [null, null, null]
  if (n < 8) return [n, 'D', n]
  if (n < 14) return [n - 8, 'B', n]
  if (n < 20) return [n - 14, 'C', n]
  return [null, null, null]
}

/** ADC channel (0–5) of an analog part on A0–A5, or null for any other pin. */
export function adcChannel(e: Element): number | null {
  const [, , n] = pinPort(e)
  return n !== null && n >= 14 ? n - 14 : null
}
