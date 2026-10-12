export interface SliderConfig {
  min: number;
  max: number;
  value: number;
  step: number;
  unit: string;
  label: string;
}

export interface SliderCallbacks {
  onValueChange: (value: number) => void;
}

// A labelled range input in the page flow; colours come from water.css, so
// it reads in light and dark mode. Styled by .slider in index.html.
export class Slider {
  private container: HTMLLabelElement;
  private slider: HTMLInputElement;
  private display: HTMLOutputElement;

  constructor(
    private config: SliderConfig,
    private callbacks: SliderCallbacks
  ) {
    this.container = this.createSliderElement();
  }

  private createSliderElement(): HTMLLabelElement {
    const container = document.createElement('label');
    container.className = 'slider';

    const label = document.createElement('span');
    label.textContent = this.config.label;

    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.min = this.config.min.toString();
    this.slider.max = this.config.max.toString();
    this.slider.value = this.config.value.toString();
    this.slider.step = this.config.step.toString();

    this.display = document.createElement('output');
    this.updateDisplay(this.config.value);

    container.append(label, this.slider, this.display);

    this.slider.addEventListener('input', () => {
      const value = parseFloat(this.slider.value);
      this.updateDisplay(value);
      this.callbacks.onValueChange(value);
    });

    return container;
  }

  private updateDisplay(value: number): void {
    this.display.textContent = `${value.toFixed(1)} ${this.config.unit}`;
  }

  public setValue(value: number): void {
    value = Math.max(this.config.min, Math.min(this.config.max, value));
    this.slider.value = value.toString();
    this.updateDisplay(value);
  }

  public getValue(): number {
    return parseFloat(this.slider.value);
  }

  public appendTo(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  public remove(): void {
    this.container.remove();
  }

  public getElement(): HTMLLabelElement {
    return this.container;
  }
}
