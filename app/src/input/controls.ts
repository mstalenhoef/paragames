import { clamp } from '../sim/math.ts';
import type { Controls } from '../sim/glider.ts';

/** Brake travel per second while a pull or release key is held. */
const KEY_BRAKE_RATE = 0.8;

type Side = 'left' | 'right';

/** Physical key positions (KeyboardEvent.code): upper key releases, lower key pulls. */
const KEY_BINDINGS: Record<Side, { pull: string; release: string }> = {
  left: { pull: 'KeyZ', release: 'KeyA' },
  right: { pull: 'KeyM', release: 'KeyK' },
};

/** Moves a keyboard brake; it stays where it is when no key is held, like holding a real brake toggle. */
export function moveKeyBrake(position: number, pull: boolean, release: boolean, dt: number): number {
  const direction = (pull ? 1 : 0) - (release ? 1 : 0);
  return clamp(position + direction * KEY_BRAKE_RATE * dt, 0, 1);
}

/**
 * Combines touch brake sliders and keyboard into brake positions.
 * Touch sliders set the brake directly and spring back on release;
 * keys move the brake while held and leave it in place.
 */
export class ControlInput {
  private readonly touch: Record<Side, number | null> = { left: null, right: null };
  private readonly keyBrake: Record<Side, number> = { left: 0, right: 0 };
  private readonly keysDown = new Set<string>();
  private readonly cleanup: (() => void)[] = [];
  private readonly handles: Partial<Record<Side, HTMLElement>> = {};

  constructor(sliders: Record<Side, HTMLElement>) {
    for (const side of ['left', 'right'] as const) this.bindSlider(side, sliders[side]);
    const onKeyDown = (e: KeyboardEvent) => this.keysDown.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => this.keysDown.delete(e.code);
    const onBlur = () => this.keysDown.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.cleanup.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    });
  }

  private bindSlider(side: Side, track: HTMLElement): void {
    const handle = track.querySelector<HTMLElement>('.brake-handle');
    if (handle) this.handles[side] = handle;
    let pointerId: number | null = null;

    const setFromPointer = (e: PointerEvent) => {
      const rect = track.getBoundingClientRect();
      // Touching the top of the track is a light touch; drag down to pull more brake.
      this.touch[side] = clamp((e.clientY - rect.top) / rect.height, 0, 1) * 1.1 - 0.05;
      this.touch[side] = clamp(this.touch[side]!, 0, 1);
    };
    const onDown = (e: PointerEvent) => {
      if (pointerId !== null) return;
      pointerId = e.pointerId;
      track.setPointerCapture(e.pointerId);
      setFromPointer(e);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId === pointerId) setFromPointer(e);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      this.touch[side] = null;
    };
    track.addEventListener('pointerdown', onDown);
    track.addEventListener('pointermove', onMove);
    track.addEventListener('pointerup', onUp);
    track.addEventListener('pointercancel', onUp);
    this.cleanup.push(() => {
      track.removeEventListener('pointerdown', onDown);
      track.removeEventListener('pointermove', onMove);
      track.removeEventListener('pointerup', onUp);
      track.removeEventListener('pointercancel', onUp);
    });
  }

  /** Advances keyboard brakes and returns the current brake positions. */
  update(dt: number): Controls {
    const result = { left: 0, right: 0 };
    for (const side of ['left', 'right'] as const) {
      const keys = KEY_BINDINGS[side];
      this.keyBrake[side] = moveKeyBrake(this.keyBrake[side], this.keysDown.has(keys.pull), this.keysDown.has(keys.release), dt);
      result[side] = Math.max(this.touch[side] ?? 0, this.keyBrake[side]);
      const handle = this.handles[side];
      if (handle) handle.style.setProperty('--brake', result[side].toFixed(3));
    }
    return result;
  }

  reset(): void {
    this.keyBrake.left = this.keyBrake.right = 0;
    this.touch.left = this.touch.right = null;
    this.keysDown.clear();
  }

  destroy(): void {
    this.cleanup.forEach((fn) => fn());
  }
}
