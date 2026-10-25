// 입력: 키보드 code → 행동. 터치·패드는 ui/가 같은 code의 가짜 KeyboardEvent를 쏘므로 여기 하나로 받는다.
// 틱(30Hz)마다 sample()로 「눌림 / 누르고 있음 / 뗌」을 읽는다. 선입력은 player.ts가 버퍼로 받는다.

export type Btn =
  | 'left' | 'right' | 'up' | 'down'
  | 'attack' | 'shoot' | 'skill' | 'guard' | 'super' | 'interact' | 'jump' | 'shift' | 'reload'
  | 'chain' | 'wall' | 'ally' | 'item1' | 'item2' | 'item3' | 'item4' | 'map' | 'auto' | 'pause' | 'hitbox'
  // 에일린(테스트룸 조작)
  | 'light' | 'heavy' | 'dodge' | 'block' | 'charge' | 'weapon' | 'combat' | 'sit' | 'crouch' | 'flee' | 'back';

export const KEYMAP: Record<string, Btn> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'attack', KeyS: 'shoot', KeyD: 'skill', KeyQ: 'guard', KeyW: 'super', KeyE: 'interact',
  KeyF: 'chain', KeyG: 'wall', KeyC: 'ally',
  Space: 'jump', ShiftLeft: 'shift', ShiftRight: 'shift', KeyR: 'reload',
  Digit1: 'item1', Digit2: 'item2', Digit3: 'item3', Digit4: 'item4',
  KeyZ: 'map', Tab: 'map', KeyX: 'auto', Escape: 'pause', KeyH: 'hitbox',
};

/** 에일린 테스트룸 키 배치 (사용자 2026-10-25: 테스트룸 전투 그대로).
 * 사용자 2026-10-25 다시 정함: Q 약 · W 강 · C 방어 · A 원거리 · S 충전 · D 기술 · F 필살기 · Tab 무기 꺼내기/넣기 · R 전투 자세 · Z 주저앉기 · X 웅크리기 · V 도망(누른 채) · B 뒷걸음질(누른 채, Ctrl은 Ctrl+W 탭 닫기와 겹쳐서 뺐다) · Space 점프 · Shift 짧게 회피·길게 달리기 · E 조사 · 1~4 아이템 · M 지도 · Esc 메뉴 */
export function useEileenKeys() {
  for (const k of ['KeyQ', 'KeyW', 'KeyG', 'KeyR', 'KeyF', 'KeyC', 'KeyZ', 'KeyX', 'KeyV', 'KeyA', 'KeyS', 'KeyD', 'Tab', 'KeyR']) delete KEYMAP[k];
  Object.assign(KEYMAP, { KeyQ: 'light', KeyW: 'heavy', KeyC: 'block', KeyA: 'shoot', KeyS: 'charge', KeyD: 'skill', KeyF: 'super', Tab: 'weapon', KeyR: 'combat', KeyZ: 'sit', KeyX: 'crouch', KeyV: 'flee', KeyB: 'back', KeyM: 'map', KeyO: 'auto' } as Record<string, Btn>);
}

/** Shift를 이 틱 수 안에 떼면 회피, 넘게 누르면 달리기 (0.15초) */
export const SHIFT_TAP = 5;
/** 같은 방향 두 번 = 달리기 (틱) */
const DOUBLE_TAP = 8;

export interface Pad {
  held: Set<Btn>;
  pressed: Set<Btn>;
  released: Set<Btn>;
  /** 좌우 -1/0/1, 위아래 -1/0/1 */
  mx: number;
  my: number;
  /** 이 틱에 Shift 짧게 누름이 끝남 (회피) */
  evade: boolean;
  /** 달리기 중 (Shift 길게 또는 방향 두 번) */
  run: boolean;
  /** ↓ 두 번 */
  downDouble: boolean;
}

export class Input {
  private down = new Set<Btn>();
  private edgesDown = new Set<Btn>();
  private edgesUp = new Set<Btn>();
  private shiftTicks = -1;
  private lastTap: Partial<Record<Btn, number>> = {};
  private dashDir = 0;
  private tick = 0;
  private off: (() => void)[] = [];
  /** 자동 진행 등 코드가 누르는 것 */
  virtual = new Set<Btn>();

  attach(target: Window = window) {
    const kd = (e: KeyboardEvent) => {
      const b = KEYMAP[e.code];
      if (!b) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      if (e.repeat) return;
      this.press(b);
    };
    const ku = (e: KeyboardEvent) => {
      const b = KEYMAP[e.code];
      if (b) this.release(b);
    };
    const blur = () => this.clear();
    target.addEventListener('keydown', kd);
    target.addEventListener('keyup', ku);
    target.addEventListener('blur', blur);
    this.off.push(() => target.removeEventListener('keydown', kd), () => target.removeEventListener('keyup', ku), () => target.removeEventListener('blur', blur));
  }

  detach() {
    this.off.forEach((f) => f());
    this.off = [];
  }

  press(b: Btn) {
    if (this.down.has(b)) return;
    this.down.add(b);
    this.edgesDown.add(b);
  }

  release(b: Btn) {
    if (!this.down.has(b)) return;
    this.down.delete(b);
    this.edgesUp.add(b);
  }

  clear() {
    // Cancellation is not a tap/release: discard unsampled actions and double-tap history.
    this.edgesDown.clear();
    this.edgesUp.clear();
    this.lastTap = {};
    this.down.clear();
    this.dashDir = 0;
    this.shiftTicks = -1;
  }

  /** 틱마다 한 번 */
  sample(): Pad {
    this.tick++;
    const held = new Set([...this.down, ...this.virtual]);
    const pressed = new Set(this.edgesDown);
    const released = new Set(this.edgesUp);
    this.edgesDown.clear();
    this.edgesUp.clear();
    const mx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    const my = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);

    let evade = false;
    if (pressed.has('shift')) this.shiftTicks = 0;
    else if (this.shiftTicks >= 0 && held.has('shift')) this.shiftTicks++;
    if (released.has('shift')) {
      if (this.shiftTicks >= 0 && this.shiftTicks < SHIFT_TAP) evade = true;
      this.shiftTicks = -1;
    }
    // 같은 방향 두 번
    for (const d of ['left', 'right'] as const) {
      if (pressed.has(d)) {
        const dir = d === 'right' ? 1 : -1;
        if (this.tick - (this.lastTap[d] ?? -99) <= DOUBLE_TAP) this.dashDir = dir;
        this.lastTap[d] = this.tick;
      }
    }
    if (mx === 0 || mx !== this.dashDir) this.dashDir = mx !== 0 && mx === this.dashDir ? this.dashDir : 0;
    let downDouble = false;
    if (pressed.has('down')) {
      downDouble = this.tick - (this.lastTap.down ?? -99) <= DOUBLE_TAP;
      this.lastTap.down = this.tick;
    }
    const run = (held.has('shift') && this.shiftTicks >= SHIFT_TAP && mx !== 0) || (this.dashDir !== 0 && mx === this.dashDir);
    return { held, pressed, released, mx, my, evade, run, downDouble };
  }
}
