import { I2CDevice } from '../i2c-bus'

export const DS1307_ADDR = 0x68

// DS1307 Register addresses
const DS1307_REG_SECONDS = 0x00
const DS1307_REG_MINUTES = 0x01
const DS1307_REG_HOURS = 0x02
const DS1307_REG_WEEKDAY = 0x03
const DS1307_REG_DATE = 0x04
const DS1307_REG_MONTH = 0x05
const DS1307_REG_YEAR = 0x06
const DS1307_REG_CONTROL = 0x07
const DS1307_REG_RAM_START = 0x08
const DS1307_REG_RAM_END = 0x3F

// Clock halt bit in seconds register
const DS1307_CH_BIT = 0x80

// 12/24 hour mode bit in hours register
const DS1307_12_24_BIT = 0x40
const DS1307_AM_PM_BIT = 0x20

// Convert decimal to BCD (Binary Coded Decimal)
function decToBcd(dec: number): number {
  return ((Math.floor(dec / 10) & 0x0F) << 4) | (dec % 10)
}

// Convert BCD to decimal
function bcdToDec(bcd: number): number {
  return ((bcd >> 4) & 0x0F) * 10 + (bcd & 0x0F)
}

export class DS1307Controller implements I2CDevice {
  private registers = new Uint8Array(64) // 64 bytes total (8 clock + 56 RAM)
  private currentRegister = 0
  private registerSet = false
  private startTime: number
  private clockHalted = false
  private is24HourMode = true

  constructor(private cpuMillis: () => number) {
    this.startTime = Date.now()
    this.initializeRTC()
  }

  private initializeRTC() {
    // Initialize with current system time
    const now = new Date()
    
    this.registers[DS1307_REG_SECONDS] = decToBcd(now.getSeconds())
    this.registers[DS1307_REG_MINUTES] = decToBcd(now.getMinutes())
    
    if (this.is24HourMode) {
      this.registers[DS1307_REG_HOURS] = decToBcd(now.getHours())
    } else {
      let hours = now.getHours()
      const isPM = hours >= 12
      if (hours === 0) hours = 12
      else if (hours > 12) hours -= 12
      
      this.registers[DS1307_REG_HOURS] = decToBcd(hours) | DS1307_12_24_BIT
      if (isPM) this.registers[DS1307_REG_HOURS] |= DS1307_AM_PM_BIT
    }
    
    this.registers[DS1307_REG_WEEKDAY] = now.getDay() + 1 // DS1307 uses 1-7
    this.registers[DS1307_REG_DATE] = decToBcd(now.getDate())
    this.registers[DS1307_REG_MONTH] = decToBcd(now.getMonth() + 1)
    this.registers[DS1307_REG_YEAR] = decToBcd(now.getFullYear() % 100)
    
    // Control register (default: no square wave output)
    this.registers[DS1307_REG_CONTROL] = 0x00
  }

  private updateClock() {
    if (this.clockHalted) return

    // Calculate elapsed time since start in seconds
    const elapsedMs = Date.now() - this.startTime
    const totalSeconds = Math.floor(elapsedMs / 1000)

    // Get initial time from when RTC was started
    const initialTime = new Date(this.startTime)
    const currentTime = new Date(this.startTime + elapsedMs)

    // Update registers with current time
    this.registers[DS1307_REG_SECONDS] = decToBcd(currentTime.getSeconds())
    this.registers[DS1307_REG_MINUTES] = decToBcd(currentTime.getMinutes())
    
    if (this.is24HourMode) {
      this.registers[DS1307_REG_HOURS] = decToBcd(currentTime.getHours())
    } else {
      let hours = currentTime.getHours()
      const isPM = hours >= 12
      if (hours === 0) hours = 12
      else if (hours > 12) hours -= 12
      
      this.registers[DS1307_REG_HOURS] = decToBcd(hours) | DS1307_12_24_BIT
      if (isPM) this.registers[DS1307_REG_HOURS] |= DS1307_AM_PM_BIT
    }
    
    this.registers[DS1307_REG_WEEKDAY] = currentTime.getDay() + 1
    this.registers[DS1307_REG_DATE] = decToBcd(currentTime.getDate())
    this.registers[DS1307_REG_MONTH] = decToBcd(currentTime.getMonth() + 1)
    this.registers[DS1307_REG_YEAR] = decToBcd(currentTime.getFullYear() % 100)
  }

  i2cConnect(addr: number, write: boolean): boolean {
    return addr === DS1307_ADDR
  }

  i2cWriteByte(value: number): boolean {
    if (!this.registerSet) {
      // First byte is register address
      this.currentRegister = value & 0x3F // DS1307 has 64 registers
      this.registerSet = true
    } else {
      // Subsequent bytes are data
      if (this.currentRegister <= DS1307_REG_RAM_END) {
        this.registers[this.currentRegister] = value

        // Handle special cases for clock registers
        if (this.currentRegister === DS1307_REG_SECONDS) {
          this.clockHalted = (value & DS1307_CH_BIT) !== 0
          if (!this.clockHalted) {
            // If clock is being started, reset our reference time
            this.startTime = Date.now()
          }
        } else if (this.currentRegister === DS1307_REG_HOURS) {
          this.is24HourMode = (value & DS1307_12_24_BIT) === 0
        }

        this.currentRegister = (this.currentRegister + 1) & 0x3F
      }
    }
    return true
  }

  i2cReadByte(acked: boolean): number {
    this.updateClock()
    
    const value = this.registers[this.currentRegister] || 0
    
    if (acked) {
      this.currentRegister = (this.currentRegister + 1) & 0x3F
    }
    
    return value
  }

  i2cDisconnect(): void {
    this.registerSet = false
  }

  // Utility methods for external access
  getCurrentTime(): Date {
    this.updateClock()
    
    const seconds = bcdToDec(this.registers[DS1307_REG_SECONDS] & 0x7F)
    const minutes = bcdToDec(this.registers[DS1307_REG_MINUTES] & 0x7F)
    
    let hours: number
    if (this.is24HourMode) {
      hours = bcdToDec(this.registers[DS1307_REG_HOURS] & 0x3F)
    } else {
      hours = bcdToDec(this.registers[DS1307_REG_HOURS] & 0x1F)
      if (this.registers[DS1307_REG_HOURS] & DS1307_AM_PM_BIT) {
        if (hours !== 12) hours += 12
      } else {
        if (hours === 12) hours = 0
      }
    }
    
    const date = bcdToDec(this.registers[DS1307_REG_DATE] & 0x3F)
    const month = bcdToDec(this.registers[DS1307_REG_MONTH] & 0x1F) - 1
    const year = 2000 + bcdToDec(this.registers[DS1307_REG_YEAR])
    
    return new Date(year, month, date, hours, minutes, seconds)
  }

  isClockHalted(): boolean {
    return this.clockHalted
  }

  setTime(date: Date): void {
    this.startTime = date.getTime()
    this.updateClock()
  }
}
