// 컷신 시퀀서. 단계 목록을 시간 순서대로 돌린다. 화면 그리기는 CutsceneIO(엔진 또는 시연판)가 맡는다.
// 대화가 끼어 있으면 대화창이 닫힐 때까지 기다린다. 건너뛰기는 남은 단계의 끝 상태만 적용한다.
import type { Mood, SpeakerId } from './types';

export type CutStep =
  | { k: 'bg'; scene: string }
  | { k: 'fade'; to: 'black' | 'clear'; ms: number }
  | { k: 'wait'; ms: number }
  | { k: 'caption'; text: string; ms: number }
  | { k: 'say'; script: string }
  | { k: 'line'; who: SpeakerId; text: string; mood?: Mood }
  | { k: 'agentline'; tag: string }
  | { k: 'bark'; who: SpeakerId; text: string; ms?: number }
  | { k: 'sfx'; name: string }
  | { k: 'shake'; ms: number; amp?: number }
  | { k: 'actor'; id: string; x?: number; y?: number; face?: 1 | -1; anim?: string; ms?: number; show?: boolean }
  | { k: 'camera'; x?: number; y?: number; zoom?: number; ms?: number }
  | { k: 'panel'; text: string; ms?: number }
  | { k: 'emit'; event: string; arg?: string }
  | { k: 'par'; steps: CutStep[] };

export interface CutsceneDef {
  id: string;
  title: string;
  /** 기본 기획서 19.1 형식 */
  form: '도트' | '한 장 그림 + 도트' | '한 장 그림';
  steps: CutStep[];
}

/** 컷신이 화면에 시키는 일. 없는 기능은 건너뛴다. */
export interface CutsceneIO {
  bg?(scene: string): void;
  fade?(to: 'black' | 'clear', ms: number): void;
  caption?(text: string, ms: number): void;
  sfx?(name: string): void;
  shake?(ms: number, amp: number): void;
  actor?(id: string, to: { x?: number; y?: number; face?: 1 | -1; anim?: string; show?: boolean }, ms: number): void;
  camera?(to: { x?: number; y?: number; zoom?: number }, ms: number): void;
  panel?(text: string, ms: number): void;
  bark?(who: SpeakerId, text: string, ms: number): void;
  emit?(event: string, arg: string): void;
  /** 대본 하나를 대화창으로 시작 */
  dialogue(script: string): void;
  /** 한 줄짜리 대화 (대본 없이) */
  line(who: SpeakerId, text: string, mood: Mood): void;
  /** 지금 요원의 대사표 한 줄 */
  agentLine(tag: string): void;
  /** 대화창이 열려 있는가 */
  talking(): boolean;
  /** 건너뛰기: 대화창을 닫는다 */
  closeDialogue(): void;
}

const durationOf = (s: CutStep): number => {
  switch (s.k) {
    case 'fade':
    case 'wait':
    case 'caption':
    case 'shake':
      return s.ms;
    case 'actor':
    case 'camera':
    case 'panel':
      return s.ms ?? 0;
    default:
      return 0;
  }
};

interface Running {
  step: CutStep;
  left: number;
  talk: boolean;
  children?: Running[];
}

export class Cutscene {
  private i = 0;
  private cur: Running | null = null;
  done = false;
  elapsed = 0;
  constructor(
    readonly def: CutsceneDef,
    private io: CutsceneIO,
  ) {}

  private begin(step: CutStep): Running {
    const io = this.io;
    let talk = false;
    switch (step.k) {
      case 'bg':
        io.bg?.(step.scene);
        break;
      case 'fade':
        io.fade?.(step.to, step.ms);
        break;
      case 'caption':
        io.caption?.(step.text, step.ms);
        break;
      case 'say':
        io.dialogue(step.script);
        talk = true;
        break;
      case 'line':
        io.line(step.who, step.text, step.mood ?? 'base');
        talk = true;
        break;
      case 'agentline':
        io.agentLine(step.tag);
        talk = true;
        break;
      case 'bark':
        io.bark?.(step.who, step.text, step.ms ?? 2200);
        break;
      case 'sfx':
        io.sfx?.(step.name);
        break;
      case 'shake':
        io.shake?.(step.ms, step.amp ?? 4);
        break;
      case 'actor':
        io.actor?.(step.id, { x: step.x, y: step.y, face: step.face, anim: step.anim, show: step.show }, step.ms ?? 0);
        break;
      case 'camera':
        io.camera?.({ x: step.x, y: step.y, zoom: step.zoom }, step.ms ?? 0);
        break;
      case 'panel':
        io.panel?.(step.text, step.ms ?? 0);
        break;
      case 'emit':
        io.emit?.(step.event, step.arg ?? '');
        break;
      case 'par':
        return { step, left: 0, talk: false, children: step.steps.map((s) => this.begin(s)) };
    }
    return { step, left: durationOf(step), talk };
  }

  private tick(r: Running, ms: number): boolean {
    if (r.children) return r.children.map((c) => this.tick(c, ms)).every(Boolean);
    r.left -= ms;
    if (r.talk && this.io.talking()) return false;
    return r.left <= 0;
  }

  /** dt: 초 */
  update(dt: number) {
    if (this.done) return;
    const ms = dt * 1000;
    this.elapsed += ms;
    for (let guard = 0; guard < 64; guard++) {
      if (!this.cur) {
        const s = this.def.steps[this.i++];
        if (!s) {
          this.done = true;
          return;
        }
        this.cur = this.begin(s);
      }
      // 이번 프레임 시간은 처음 시작한 단계에만 준다. 0초 단계는 이어서 바로 처리.
      if (!this.tick(this.cur, guard === 0 ? ms : 0)) return;
      this.cur = null;
    }
  }

  /** 끝까지 넘긴다. 배경·화면·인물은 마지막 상태로 맞추고, 대화·소리·효과는 건너뛴다. */
  skip() {
    if (this.done) return;
    this.io.closeDialogue();
    const rest = this.def.steps.slice(this.i);
    const flat = (list: CutStep[]): CutStep[] => list.flatMap((s) => (s.k === 'par' ? flat(s.steps) : [s]));
    for (const s of flat(rest)) {
      if (s.k === 'bg') this.io.bg?.(s.scene);
      else if (s.k === 'fade') this.io.fade?.(s.to, 0);
      else if (s.k === 'actor') this.io.actor?.(s.id, { x: s.x, y: s.y, face: s.face, anim: s.anim, show: s.show }, 0);
      else if (s.k === 'camera') this.io.camera?.({ x: s.x, y: s.y, zoom: s.zoom }, 0);
      else if (s.k === 'panel') this.io.panel?.(s.text, 0);
      else if (s.k === 'emit') this.io.emit?.(s.event, s.arg ?? '');
    }
    this.i = this.def.steps.length;
    this.cur = null;
    this.done = true;
  }
}
