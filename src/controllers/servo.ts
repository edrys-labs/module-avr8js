import { ServoElement } from '@wokwi/elements'

export class ServoController {
  private servos: Map<ServoElement, { 
    lastPinState: boolean; 
    pulseStartTime: number; 
    angle: number;
  }> = new Map()

  constructor() {}

  updateServo(servo: ServoElement, pinHigh: boolean, currentTime: number) {
    let servoData = this.servos.get(servo)
    
    if (!servoData) {
      servoData = {
        lastPinState: false,
        pulseStartTime: 0,
        angle: 90 // Default to center position
      }
      this.servos.set(servo, servoData)
    }

    // Detect rising edge (start of PWM pulse)
    if (pinHigh && !servoData.lastPinState) {
      servoData.pulseStartTime = currentTime
    }
    
    // Detect falling edge (end of PWM pulse)
    if (!pinHigh && servoData.lastPinState) {
      const pulseWidth = currentTime - servoData.pulseStartTime
      
      // Convert pulse width to servo angle
      // Standard servo: 1ms = 0°, 1.5ms = 90°, 2ms = 180°
      // Pulse width is in microseconds (µs)
      if (pulseWidth >= 500 && pulseWidth <= 2500) {
        const angle = ((pulseWidth - 1000) / 1000) * 180
        servoData.angle = Math.max(0, Math.min(180, angle))
        servo.angle = servoData.angle
      }
    }

    servoData.lastPinState = pinHigh
  }

  resetAllServos() {
    for (const [servo, data] of this.servos) {
      servo.angle = 90 // Reset to center position
      data.angle = 90
      data.lastPinState = false
    }
  }
}
