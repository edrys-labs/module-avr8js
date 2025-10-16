import { BuzzerElement } from '@wokwi/elements'

declare const window: any

// Audio context for buzzer sound generation
export class BuzzerAudio {
  private audioContext: AudioContext | null = null
  private oscillators: Map<BuzzerElement, { oscillator: OscillatorNode; gainNode: GainNode }> = new Map()
  private isInitialized = false

  constructor() {
    // Add click listener to enable audio on first user interaction
    const enableAudio = () => {
      this.initializeAudio()
      document.removeEventListener('click', enableAudio)
      document.removeEventListener('touchstart', enableAudio)
    }
    document.addEventListener('click', enableAudio)
    document.addEventListener('touchstart', enableAudio)
  }

  private async initializeAudio() {
    if (this.isInitialized) return
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.isInitialized = true
    } catch (error) {
      console.warn('Web Audio API not supported:', error)
    }
  }

  async startTone(buzzer: BuzzerElement, frequency: number = 1000) {
    await this.initializeAudio()
    if (!this.audioContext) return

    // Resume audio context if it's suspended (required by browser policies)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    // Stop any existing tone for this buzzer
    this.stopTone(buzzer)

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime)
    oscillator.type = 'square' // Square wave for buzzer-like sound
    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime) // Low volume

    oscillator.start()

    this.oscillators.set(buzzer, { oscillator, gainNode })
  }

  stopTone(buzzer: BuzzerElement) {
    const existing = this.oscillators.get(buzzer)
    if (existing) {
      existing.oscillator.stop()
      this.oscillators.delete(buzzer)
    }
  }

  stopAllTones() {
    for (const [buzzer] of this.oscillators) {
      this.stopTone(buzzer)
    }
  }
}
