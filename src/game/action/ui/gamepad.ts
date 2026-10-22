// 게임패드: 표준 배치를 매 프레임 읽어 InputHub 에 키로 넣는다. 왼쪽 스틱은 방향키 + 아날로그 값.
import type { InputHub } from './input';
import { PAD_BUTTON } from './keys';

const DEAD = 0.3;

export class PadReader {
  connected = '';
  private prev = new Map<string, boolean>();
  private rumbleOn = true;
  private index: number | null = null;
  constructor(private hub: InputHub) {}
  setRumble(on: boolean) {
    this.rumbleOn = on;
  }
  private pad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    for (const p of navigator.getGamepads()) if (p && p.connected) return p;
    return null;
  }
  poll() {
    const p = this.pad();
    if (!p) {
      this.connected = '';
      this.index = null;
      this.hub.releaseSource('pad');
      this.prev.clear();
      return;
    }
    if (this.index !== p.index || this.connected !== p.id) {
      this.hub.releaseSource('pad');
      this.prev.clear();
    }
    this.index = p.index;
    this.connected = p.id;
    const want = new Map<string, boolean>();
    const set = (code: string, on: boolean) => want.set(code, (want.get(code) ?? false) || on);
    p.buttons.forEach((b, i) => {
      const code = PAD_BUTTON[i];
      if (code) set(code, b.pressed || b.value > 0.5);
    });
    let x = p.axes[0] ?? 0,
      y = p.axes[1] ?? 0;
    if (Math.hypot(x, y) < DEAD) x = y = 0;
    this.hub.setAnalog('pad', x, y);
    set('ArrowLeft', x < -0.45);
    set('ArrowRight', x > 0.45);
    set('ArrowUp', y < -0.45);
    set('ArrowDown', y > 0.45);
    // A replacement pad (or a changed button array) may omit previously held buttons.
    for (const code of this.prev.keys()) if (!want.has(code)) want.set(code, false);
    for (const [code, on] of want) {
      if (on && !this.prev.get(code)) this.hub.press(code, 'pad');
      else if (!on && this.prev.get(code)) this.hub.release(code, 'pad');
      this.prev.set(code, on);
    }
  }
  /** 진동 0~1, ms */
  rumble(strength: number, ms: number) {
    if (!this.rumbleOn) return;
    const p = this.pad() as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } }) | null;
    p?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: Math.min(1, strength * 1.4) })?.catch?.(() => {});
  }
}
