// 대사 대본 형식(글로 쓰고, 읽을 때 해석)과 실행기.
//
// 대본은 사람이 고치기 쉬운 줄 단위 글이다.
//   === 대본id              대본 시작
//   -- 표지                 건너뛰기 목표
//   잼트리 말: jaemtri: 어머, 후배, 왔어?      (who(mood): 글 로 표정 지정)
//   ~ who: 글               연달아 쓴 ~ 줄 중 하나만 무작위로
//   * 선택지 -> 표지 [if 조건] [set a=1; b+=2]
//   > set 이름 = 식 / += / -=
//   > goto 표지 [if 조건]     (표지 end는 대본 끝)
//   > emit 사건 인자          엔진·화면에 알림 (fade, sfx, mission 등)
//   > call 대본id             다른 대본을 끝까지 돌고 돌아옴
//   > agent 태그 [who]        요원 대사표(lines/agents.ts)에서 그 태그 한 줄
//   > line 묶음:키 [who]      다른 대사표 한 줄 (el: 승강기 방송 등, lines/index.ts)
//   > end
//   // 주석
// 글 안의 {name}은 지금 요원 이름, {아무키}는 상태 값으로 바뀐다.
import type { AgentId, ChoiceOption, Flags, Mood, SayNode, Script, ScriptNode, SpeakerId, StoryStep, Value } from './types';

const MOODS = new Set<Mood>(['base', 'smile', 'serious', 'hurt', 'surprise']);

export class ScriptError extends Error {}

function parseSay(body: string, line: number, where: string): SayNode {
  const m = /^([a-z]+)(?:\((\w+)\))?\s*:\s*(.+)$/.exec(body);
  if (!m) throw new ScriptError(`${where}:${line} 말 줄 형식이 아니에요: ${body}`);
  const mood = (m[2] ?? 'base') as Mood;
  if (!MOODS.has(mood)) throw new ScriptError(`${where}:${line} 모르는 표정: ${m[2]}`);
  return { t: 'say', who: m[1] as SpeakerId, mood, text: m[3].trim(), line };
}

/** 대본 글 하나(여러 대본이 들어 있을 수 있음)를 읽는다. */
export function parseScripts(src: string, where = 'script'): Script[] {
  const out: Script[] = [];
  let cur: Script | null = null;
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('//')) continue;
    if (raw.startsWith('===')) {
      cur = { id: raw.slice(3).trim(), nodes: [], labels: {} };
      if (!cur.id) throw new ScriptError(`${where}:${n} 대본 id가 비었어요`);
      out.push(cur);
      continue;
    }
    if (!cur) throw new ScriptError(`${where}:${n} === 대본id 앞에 내용이 있어요`);
    const nodes: ScriptNode[] = cur.nodes;
    const prev = nodes[nodes.length - 1];
    if (raw.startsWith('--')) {
      const label = raw.slice(2).trim();
      if (cur.labels[label] !== undefined) throw new ScriptError(`${where}:${n} 표지 중복: ${label}`);
      cur.labels[label] = nodes.length;
      continue;
    }
    if (raw.startsWith('~')) {
      const say = parseSay(raw.slice(1).trim(), n, where);
      // 표지 바로 뒤의 ~ 는 새 묶음이다
      const labelHere = Object.values(cur.labels).includes(nodes.length);
      if (prev?.t === 'pick' && !labelHere) prev.lines.push(say);
      else nodes.push({ t: 'pick', lines: [say], line: n });
      continue;
    }
    if (raw.startsWith('*')) {
      const m = /^\*\s*(.+?)\s*->\s*([\w.]+)\s*(.*)$/.exec(raw);
      if (!m) throw new ScriptError(`${where}:${n} 선택지 형식: * 글 -> 표지 [if 조건] [set ...]`);
      const opt: ChoiceOption = { text: m[1], to: m[2] };
      for (const b of m[3].matchAll(/\[(if|set)\s+([^\]]+)\]/g)) opt[b[1] as 'if' | 'set'] = b[2].trim();
      const labelHere = Object.values(cur.labels).includes(nodes.length);
      if (prev?.t === 'choice' && !labelHere) prev.options.push(opt);
      else nodes.push({ t: 'choice', options: [opt], line: n });
      continue;
    }
    if (raw.startsWith('>')) {
      const cmd = raw.slice(1).trim();
      const [head, ...rest] = cmd.split(/\s+/);
      const tail = cmd.slice(head.length).trim();
      if (head === 'set') {
        const m = /^([\w.]+)\s*(\+=|-=|=)\s*(.+)$/.exec(tail);
        if (!m) throw new ScriptError(`${where}:${n} set 형식: > set 이름 = 식`);
        nodes.push({ t: 'set', key: m[1], op: m[2] as '=' | '+=' | '-=', expr: m[3], line: n });
      } else if (head === 'goto') {
        const m = /^([\w.]+)(?:\s+if\s+(.+))?$/.exec(tail);
        if (!m) throw new ScriptError(`${where}:${n} goto 형식: > goto 표지 [if 조건]`);
        nodes.push({ t: 'goto', to: m[1], if: m[2], line: n });
      } else if (head === 'emit') {
        nodes.push({ t: 'emit', event: rest[0] ?? '', arg: rest.slice(1).join(' '), line: n });
      } else if (head === 'call') {
        nodes.push({ t: 'call', script: tail, line: n });
      } else if (head === 'agent' || head === 'line') {
        nodes.push({ t: 'agentline', tag: rest[0] ?? '', who: (rest[1] as SpeakerId) ?? 'agent', line: n });
      } else if (head === 'end') {
        nodes.push({ t: 'end', line: n });
      } else throw new ScriptError(`${where}:${n} 모르는 명령: ${head}`);
      continue;
    }
    nodes.push(parseSay(raw, n, where));
  }
  return out;
}

// ── 조건식 ─────────────────────────────────────────────
// 이름(점 포함)·숫자·'글'·true/false, == != >= <= > < + - ! && || ( )
type Tok = { k: 'num' | 'str' | 'id' | 'op'; v: string };
function lex(src: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|'([^']*)'|"([^"]*)"|([A-Za-z_가-힣][\w.가-힣]*)|(==|!=|>=|<=|&&|\|\||[<>!+\-()]))/y;
  let i = 0;
  while (i < src.length) {
    if (/^\s*$/.test(src.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new ScriptError(`조건식을 읽을 수 없어요: ${src}`);
    i = re.lastIndex;
    if (m[1] !== undefined) out.push({ k: 'num', v: m[1] });
    else if (m[2] !== undefined || m[3] !== undefined) out.push({ k: 'str', v: m[2] ?? m[3] });
    else if (m[4] !== undefined) out.push({ k: 'id', v: m[4] });
    else out.push({ k: 'op', v: m[5] });
  }
  return out;
}

export function evaluate(src: string, flags: Flags): Value {
  const t = lex(src);
  let p = 0;
  const peek = () => t[p]?.v;
  const eat = (v: string) => {
    if (t[p]?.v !== v) throw new ScriptError(`조건식에 ${v}가 필요해요: ${src}`);
    p++;
  };
  const num = (v: Value) => (typeof v === 'number' ? v : typeof v === 'boolean' ? +v : Number(v) || 0);
  const truthy = (v: Value) => (typeof v === 'string' ? v !== '' && v !== '0' : !!v);
  const prim = (): Value => {
    const k = t[p++];
    if (!k) throw new ScriptError(`조건식이 끝났어요: ${src}`);
    if (k.k === 'num') return Number(k.v);
    if (k.k === 'str') return k.v;
    if (k.k === 'id') return k.v === 'true' ? true : k.v === 'false' ? false : (flags[k.v] ?? 0);
    if (k.v === '(') {
      const v = or();
      eat(')');
      return v;
    }
    if (k.v === '-') return -num(prim());
    if (k.v === '!') return !truthy(prim());
    throw new ScriptError(`조건식에서 ${k.v}를 예상하지 못했어요: ${src}`);
  };
  const add = (): Value => {
    let v = prim();
    while (peek() === '+' || peek() === '-') v = t[p++].v === '+' ? num(v) + num(prim()) : num(v) - num(prim());
    return v;
  };
  const cmp = (): Value => {
    const a = add();
    const op = peek();
    if (op && ['==', '!=', '>=', '<=', '>', '<'].includes(op)) {
      p++;
      const b = add();
      if (op === '==') return typeof a === typeof b ? a === b : String(a) === String(b);
      if (op === '!=') return typeof a === typeof b ? a !== b : String(a) !== String(b);
      const x = num(a),
        y = num(b);
      return op === '>=' ? x >= y : op === '<=' ? x <= y : op === '>' ? x > y : x < y;
    }
    return a;
  };
  const not = (): Value => (peek() === '!' ? (p++, !truthy(not())) : cmp());
  const and = (): Value => {
    let v = not();
    while (peek() === '&&') {
      p++;
      const r = not();
      v = truthy(v) && truthy(r);
    }
    return v;
  };
  const or = (): Value => {
    let v = and();
    while (peek() === '||') {
      p++;
      const r = and();
      v = truthy(v) || truthy(r);
    }
    return v;
  };
  const v = or();
  if (p < t.length) throw new ScriptError(`조건식 뒤에 남은 것이 있어요: ${src}`);
  return v;
}
export const test = (src: string | undefined, flags: Flags) => !src || (() => {
  const v = evaluate(src, flags);
  return typeof v === 'string' ? v !== '' && v !== '0' : !!v;
})();

/** 범위가 정해진 값 (승강기 총애 -3..+3) */
export const CLAMPS: Record<string, [number, number]> = { favor: [-3, 3] };

export function applySet(key: string, op: '=' | '+=' | '-=', expr: string, flags: Flags) {
  const v = evaluate(expr, flags);
  if (op === '=') flags[key] = v;
  else {
    const cur = Number(flags[key] ?? 0) || 0;
    flags[key] = op === '+=' ? cur + (Number(v) || 0) : cur - (Number(v) || 0);
  }
  const c = CLAMPS[key];
  if (c && typeof flags[key] === 'number') flags[key] = Math.max(c[0], Math.min(c[1], flags[key] as number));
}

/** [set a=1; b+=2] 묶음 */
export function applySets(src: string | undefined, flags: Flags) {
  if (!src) return;
  for (const part of src.split(';')) {
    const m = /^\s*([\w.]+)\s*(\+=|-=|=)\s*(.+?)\s*$/.exec(part);
    if (m) applySet(m[1], m[2] as '=' | '+=' | '-=', m[3], flags);
  }
}

// ── 실행기 ─────────────────────────────────────────────
export interface RunnerContext {
  flags: Flags;
  agent: AgentId;
  rng: () => number;
  /** 화면에 보일 이름 */
  speakerName(who: SpeakerId): string;
  /** 요원 대사표에서 한 줄 (없으면 undefined) */
  agentLine(agent: AgentId, tag: string, rng: () => number): string | undefined;
  emit?(event: string, arg: string): void;
}

export class ScriptLibrary {
  readonly scripts = new Map<string, Script>();
  add(src: string, where?: string) {
    for (const s of parseScripts(src, where)) {
      if (this.scripts.has(s.id)) throw new ScriptError(`대본 id 중복: ${s.id}`);
      this.scripts.set(s.id, s);
    }
    return this;
  }
  get(id: string): Script {
    const s = this.scripts.get(id);
    if (!s) throw new ScriptError(`없는 대본: ${id}`);
    return s;
  }
  /** 모든 goto·선택지·call이 실제로 있는 곳을 가리키는지 */
  validate(): string[] {
    const errs: string[] = [];
    for (const s of this.scripts.values())
      for (const n of s.nodes) {
        const target = (to: string) => to === 'end' || s.labels[to] !== undefined || errs.push(`${s.id}:${n.line} 없는 표지 ${to}`);
        if (n.t === 'goto') target(n.to);
        if (n.t === 'choice') n.options.forEach((o) => target(o.to));
        if (n.t === 'call' && !this.scripts.has(n.script)) errs.push(`${s.id}:${n.line} 없는 대본 ${n.script}`);
        try {
          if (n.t === 'goto' && n.if) evaluate(n.if, {});
          if (n.t === 'set') evaluate(n.expr, {});
          if (n.t === 'choice') n.options.forEach((o) => o.if && evaluate(o.if, {}));
        } catch (e) {
          errs.push(`${s.id}:${n.line} ${(e as Error).message}`);
        }
      }
    return errs;
  }
}

interface Frame {
  script: Script;
  pc: number;
}

export class StoryRunner {
  private stack: Frame[] = [];
  private pending: ChoiceOption[] | null = null;
  /** 지금 보이는 걸음 */
  current: StoryStep = { kind: 'end' };
  constructor(
    readonly lib: ScriptLibrary,
    readonly ctx: RunnerContext,
  ) {}

  get done() {
    return this.current.kind === 'end';
  }

  start(id: string): StoryStep {
    this.stack = [{ script: this.lib.get(id), pc: 0 }];
    this.pending = null;
    this.ctx.flags.agent = this.ctx.agent;
    this.ctx.flags[`seen.${id}`] = (Number(this.ctx.flags[`seen.${id}`]) || 0) + 1;
    return (this.current = this.run());
  }

  next(): StoryStep {
    if (this.pending) return this.current;
    return (this.current = this.run());
  }

  choose(index: number): StoryStep {
    const opts = this.pending;
    if (!opts) return this.current;
    const opt = opts[index];
    if (!opt) return this.current;
    this.pending = null;
    applySets(opt.set, this.ctx.flags);
    this.jump(opt.to);
    return (this.current = this.run());
  }

  /** 바로 끝까지 넘김. 선택지가 나오면 거기서 멈춘다. */
  skip(): StoryStep {
    let s = this.current;
    for (let i = 0; i < 500 && s.kind === 'say'; i++) s = this.next();
    return s;
  }

  fill(text: string): string {
    const f = this.ctx.flags;
    return text.replace(/\{([\w.가-힣]+)\}/g, (_, k: string) => (k === 'name' ? this.ctx.speakerName('agent') : String(f[k] ?? '')));
  }

  private jump(to: string) {
    const top = this.stack[this.stack.length - 1];
    if (!top) return;
    if (to === 'end') top.pc = top.script.nodes.length;
    else top.pc = top.script.labels[to] ?? top.script.nodes.length;
  }

  private say(n: SayNode): StoryStep {
    const who = n.who === 'agent' ? this.ctx.agent : n.who;
    return { kind: 'say', who, name: this.ctx.speakerName(who), text: this.fill(n.text), mood: n.mood ?? 'base' };
  }

  private run(): StoryStep {
    const { flags, rng } = this.ctx;
    for (let guard = 0; guard < 2000; guard++) {
      const top = this.stack[this.stack.length - 1];
      if (!top) {
        delete flags.d100;
        return { kind: 'end' };
      }
      // 조건식에서 쓰는 주사위 (0~99). 대본이 끝나면 지운다.
      flags.d100 = Math.floor(rng() * 100);
      const n = top.script.nodes[top.pc];
      if (!n) {
        this.stack.pop();
        continue;
      }
      top.pc++;
      switch (n.t) {
        case 'say':
          return this.say(n);
        case 'pick':
          return this.say(n.lines[Math.floor(rng() * n.lines.length) % n.lines.length]);
        case 'agentline': {
          const text = this.ctx.agentLine(this.ctx.agent, n.tag, rng);
          if (!text) break;
          const who = n.who === 'agent' ? this.ctx.agent : n.who;
          return { kind: 'say', who, name: this.ctx.speakerName(who), text: this.fill(text), mood: 'base' };
        }
        case 'choice': {
          const visible = n.options.map((o, index) => ({ o, index })).filter(({ o }) => test(o.if, flags));
          if (!visible.length) break;
          this.pending = n.options;
          return { kind: 'choice', options: visible.map(({ o, index }) => ({ text: this.fill(o.text), index })) };
        }
        case 'set':
          applySet(n.key, n.op, n.expr, flags);
          break;
        case 'goto':
          if (test(n.if, flags)) this.jump(n.to);
          break;
        case 'emit':
          this.ctx.emit?.(n.event, this.fill(n.arg));
          break;
        case 'call':
          this.stack.push({ script: this.lib.get(n.script), pc: 0 });
          break;
        case 'end':
          this.stack = [];
          delete flags.d100;
          return { kind: 'end' };
      }
    }
    throw new ScriptError('대본이 끝없이 돌아요');
  }
}
