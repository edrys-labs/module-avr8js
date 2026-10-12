import { NTCTemperatureSensorElement } from '@wokwi/elements'
import { Slider, SliderConfig, SliderCallbacks } from './slider'
import { adcChannel } from '../pins'

export class NTCTemperatureSensorController {
  private sensors: Map<NTCTemperatureSensorElement, {
    temperature: number;
    slider: Slider;
  }> = new Map()

  constructor() {}

  initializeSensor(sensor: NTCTemperatureSensorElement, runner: any) {
    if (this.sensors.has(sensor)) {
      return // Already initialized
    }

    // Create slider configuration
    const sliderConfig: SliderConfig = {
      min: -40,
      max: 125,
      value: 25,
      step: 0.1,
      unit: '°C',
      label: `Temperature ${sensor.getAttribute('pin')}`
    }

    // Create slider callbacks
    const sliderCallbacks: SliderCallbacks = {
      onValueChange: (temperature: number) => {
        const sensorData = this.sensors.get(sensor)
        if (sensorData) {
          sensorData.temperature = temperature
          this.updateSensorADC(sensor, temperature, runner)
        }
      }
    }

    const slider = new Slider(sliderConfig, sliderCallbacks)
    slider.appendTo(document.getElementById('sensors') || document.body)

    // Store sensor data
    const sensorData = {
      temperature: 25.0,
      slider
    }
    this.sensors.set(sensor, sensorData)

    // Initial ADC setup
    this.updateSensorADC(sensor, 25.0, runner)
  }

  private calculateNTCResistance(temperature: number): number {
    // Standard NTC thermistor calculation using Steinhart-Hart equation
    // Using typical 10kΩ NTC thermistor parameters
    const R0 = 10000  // Resistance at 25°C (10kΩ)
    const T0 = 298.15 // 25°C in Kelvin
    const B = 3950    // B parameter (typical value)
    
    const T = temperature + 273.15 // Convert to Kelvin
    const resistance = R0 * Math.exp(B * (1/T - 1/T0))
    
    return resistance
  }

  private updateSensorADC(sensor: NTCTemperatureSensorElement, temperature: number, runner: any) {
    const channel = adcChannel(sensor as unknown as Element)
    if (channel === null) return

    // Calculate voltage divider output
    // Assuming a 10kΩ pull-up resistor to 5V
    const VCC = 5.0
    const R_PULLUP = 10000
    const R_NTC = this.calculateNTCResistance(temperature)
    
    // Voltage divider: V_out = VCC * R_NTC / (R_PULLUP + R_NTC)
    const voltage = VCC * R_NTC / (R_PULLUP + R_NTC)
    
    // Convert to ADC value (0-1023 for 10-bit ADC)
    const adcValue = (voltage / VCC) * 1023
    
    // Set the ADC channel value
    if (runner.adc && runner.adc.channelValues) {
      runner.adc.channelValues[channel] = voltage
    }
  }

  getTemperature(sensor: NTCTemperatureSensorElement): number {
    const sensorData = this.sensors.get(sensor)
    return sensorData ? sensorData.temperature : 25.0
  }

  setTemperature(sensor: NTCTemperatureSensorElement, temperature: number) {
    const sensorData = this.sensors.get(sensor)
    if (sensorData) {
      temperature = Math.max(-40, Math.min(125, temperature)) // Clamp to valid range
      sensorData.temperature = temperature
      sensorData.slider.setValue(temperature)
    }
  }

  cleanup() {
    for (const [sensor, data] of this.sensors) {
      data.slider.remove()
    }
    this.sensors.clear()
  }

  // Utility method to convert resistance to temperature (for reading actual NTC sensors)
  resistanceToTemperature(resistance: number): number {
    const R0 = 10000  // 10kΩ at 25°C
    const T0 = 298.15 // 25°C in Kelvin
    const B = 3950    // B parameter
    
    const T = 1 / (Math.log(resistance / R0) / B + 1 / T0)
    return T - 273.15 // Convert back to Celsius
  }

  // Utility method to get resistance from ADC reading
  adcToResistance(adcValue: number, vcc: number = 5.0, pullupResistor: number = 10000): number {
    const voltage = (adcValue / 1023) * vcc
    if (voltage >= vcc) return 0 // Short circuit
    if (voltage <= 0) return Infinity // Open circuit
    
    // From voltage divider: R_NTC = R_PULLUP * voltage / (VCC - voltage)
    return pullupResistor * voltage / (vcc - voltage)
  }
}
