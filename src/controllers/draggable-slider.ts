export interface SliderConfig {
  min: number;
  max: number;
  value: number;
  step: number;
  unit: string;
  label: string;
  width?: number;
}

export interface SliderCallbacks {
  onValueChange: (value: number) => void;
}

export class DraggableSlider {
  private container: HTMLDivElement;
  private slider: HTMLInputElement;
  private display: HTMLSpanElement;
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private initialLeft = 0;
  private initialTop = 0;

  constructor(
    private config: SliderConfig,
    private callbacks: SliderCallbacks
  ) {
    this.container = this.createSliderElement();
    this.setupDragFunctionality();
  }

  private createSliderElement(): HTMLDivElement {
    // Create container
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      display: flex;
      align-items: center;
      gap: 8px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 4px 8px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 1000;
      cursor: move;
      user-select: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    // Create slider input
    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.min = this.config.min.toString();
    this.slider.max = this.config.max.toString();
    this.slider.value = this.config.value.toString();
    this.slider.step = this.config.step.toString();
    this.slider.style.cssText = `
      width: ${this.config.width || 120}px;
      height: 20px;
      cursor: pointer;
    `;

    // Create display span
    this.display = document.createElement('span');
    this.display.style.cssText = `
      min-width: 50px;
      text-align: center;
      font-weight: bold;
      color: #0066cc;
    `;
    this.updateDisplay(this.config.value);

    // Add elements to container
    container.appendChild(this.slider);
    container.appendChild(this.display);

    // Setup slider event listener
    this.slider.addEventListener('input', () => {
      const value = parseFloat(this.slider.value);
      this.updateDisplay(value);
      this.callbacks.onValueChange(value);
    });

    return container;
  }

  private updateDisplay(value: number): void {
    this.display.textContent = `${value.toFixed(1)}${this.config.unit}`;
  }

  private setupDragFunctionality(): void {
    // Mouse events
    this.container.addEventListener('mousedown', (e: MouseEvent) => {
      // Don't start dragging if clicking on the slider itself
      if ((e.target as HTMLElement).tagName === 'INPUT') {
        return;
      }

      this.startDrag(e.clientX, e.clientY);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging) return;
      this.updatePosition(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch events for mobile support
    this.container.addEventListener('touchstart', (e: TouchEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') {
        return;
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.startDrag(touch.clientX, touch.clientY);
        e.preventDefault();
      }
    });

    document.addEventListener('touchmove', (e: TouchEvent) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      
      const touch = e.touches[0];
      this.updatePosition(touch.clientX, touch.clientY);
      e.preventDefault();
    });

    document.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  private startDrag(clientX: number, clientY: number): void {
    this.isDragging = true;
    this.startX = clientX;
    this.startY = clientY;
    
    const rect = this.container.getBoundingClientRect();
    const parentRect = this.container.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
    this.initialLeft = rect.left - parentRect.left;
    this.initialTop = rect.top - parentRect.top;
  }

  private updatePosition(clientX: number, clientY: number): void {
    const deltaX = clientX - this.startX;
    const deltaY = clientY - this.startY;

    this.container.style.left = `${this.initialLeft + deltaX}px`;
    this.container.style.top = `${this.initialTop + deltaY}px`;
  }

  public setValue(value: number): void {
    value = Math.max(this.config.min, Math.min(this.config.max, value));
    this.slider.value = value.toString();
    this.updateDisplay(value);
  }

  public getValue(): number {
    return parseFloat(this.slider.value);
  }

  public setPosition(left: number, top: number): void {
    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;
  }

  public appendTo(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  public remove(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  public getElement(): HTMLDivElement {
    return this.container;
  }
}
