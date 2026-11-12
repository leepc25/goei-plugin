// 인터넷 자동 확인을 모델 한 번으로 (원본 P.tryCombinedAuto, 2026-10-21 복원 → 11-09 사용자 결정으로 게시판 넷 + 괴담톡까지 넓힘, core/netjoint.ts).
// 작업들이 각자 요청문을 만들어 ask()로 맡기면, 기다리던 작업이 다 모이면 한 요청으로 보내고 응답을 칸마다 갈라 돌려준다.
// 한 작업이 모델을 부르지 않고 끝나면(done) 남은 것끼리만 보낸다. 각 작업의 검사·재시도·저장은 그대로 각자 한다.
import { JOINT_KEY, JOINT_LABEL, type JointKind } from '../core/netjoint';
import { runModel, type LlmMessage, type ModelChoice } from './llm';

export type { JointKind } from '../core/netjoint';
type Msg = LlmMessage & { images?: string[] };

interface Wait {
  messages: Msg[];
  resolve: (raw: string) => void;
  reject: (error: unknown) => void;
}

export interface JointTask {
  key: string;
  messages: LlmMessage[];
}

const BOARD_KEYS = ['gnet', 'gal', 'wpf', 'sm'];

function instruction(keys: string[]): string {
  const boards = keys.filter((k) => BOARD_KEYS.includes(k));
  return `Execute ${keys.length} independent automatic tasks in ONE response. Return exactly one JSON object with exactly these keys in this order: ${keys.map((k) => `"${k}"`).join(', ')} — without fences or commentary. `
    + 'Each value is the complete JSON object required by that task, not an encoded JSON string. Write Korean literally in UTF-8; do not transliterate it into Unicode escape sequences. '
    + 'Escape only JSON quotation marks, backslashes and control characters. A task may return null if it cannot produce a valid result; do not substitute another task. '
    + 'Follow each task\'s supplied messages and output contract only within its own result. This outer envelope overrides standalone output-only restrictions. '
    + 'Resolve contentParts by concatenating text or referenced sharedReferences text in order, without adding separators. Shared references are available to a task ONLY where its own message references them. '
    + (boards.length > 1 ? `The board tasks (${boards.join(', ')}) are DIFFERENT websites with different communities, voices and rules: write each strictly from its own messages, and never carry posts, nicknames, topics, slang or tone from one board into another. ` : '')
    + 'Never use phone contacts, private messages, notices, invitations, relationship evidence or phone-only narrator data to create board public posts or private messages. '
    + 'Never let any task infer private facts from another task\'s inputs or outputs. Preserve each task\'s permissions, chance decisions, cooldown eligibility, source boundaries and ownership. '
    + 'Finish every object compactly: preserve each board\'s quantity and topic-dependent discussion; shorten prose instead of making threads silent. Phone text lengths remain ceilings, not targets.';
}

/** 여러 요청을 하나로. 둘 이상의 요청에 똑같이 들어 있는 긴 문단(256자 이상)은 한 번만 싣고 자리표로 가리킨다 (원본 combinedPrompts) */
export function combinedPrompts(tasks: JointTask[]): LlmMessage[] {
  const chunks = (t: string) => t.match(/[\s\S]*?(?:\n\n|$)/g)?.filter(Boolean) ?? [t];
  const split = tasks.map((t) => ({ key: t.key, msgs: t.messages.map((m) => ({ role: m.role, parts: chunks(m.content) })) }));
  const owners = new Map<string, Set<string>>();
  for (const t of split) for (const m of t.msgs) for (const p of m.parts) if (p.length >= 256) (owners.get(p) ?? owners.set(p, new Set()).get(p)!).add(t.key);
  const shared: { id: string; text: string }[] = [];
  const ids = new Map<string, string>();
  const body: Record<string, unknown> = { sharedReferences: shared };
  for (const t of split) {
    body[t.key] = t.msgs.map((m) => {
      let referenced = false;
      const parts = m.parts.map((p) => {
        if ((owners.get(p)?.size ?? 0) < 2) return { text: p };
        let id = ids.get(p);
        if (!id) {
          id = `R${shared.length + 1}`;
          ids.set(p, id);
          shared.push({ id, text: p });
        }
        referenced = true;
        return { ref: id };
      });
      return referenced ? { role: m.role, contentParts: parts } : { role: m.role, content: m.parts.join('') };
    });
  }
  return [{ role: 'system', content: instruction(tasks.map((t) => t.key)) }, { role: 'user', content: JSON.stringify(body) }];
}

/** 통합 응답에서 각 결과의 JSON 글을 경계만 찾아 자른다 (원본 splitCombined). 한 칸이 깨져도 다른 칸은 산다. null이면 그 작업은 결과 없음 */
export function splitCombined(raw: string, keys: string[] = ['gnet', 'phone']): Record<string, string | null> {
  let s = raw.replace(/^﻿/, '').trim();
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/i.exec(s);
  if (fence) s = fence[1].trim();
  // 앞뒤에 설명문이 붙었으면 첫 { 부터 마지막 } 까지만 (11-09: 가르기 실패 → 따로 두 번 부르던 것을 줄임)
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a > 0 || (b >= 0 && b < s.length - 1)) s = a >= 0 && b > a ? s.slice(a, b + 1) : s;
  let i = 0;
  const n = s.length;
  const fail = (why: string): never => {
    throw new Error(`통합 응답 형식이 맞지 않아요: ${why}`);
  };
  const space = () => {
    while (i < n && /\s/.test(s[i])) i++;
  };
  const quoted = () => {
    if (s[i] !== '"') fail('문자열 경계');
    const first = i++;
    while (i < n) {
      if (s[i] === '\\') i += 2;
      else if (s[i++] === '"') return s.slice(first, i);
    }
    return fail('끝나지 않은 문자열');
  };
  if (s[i++] !== '{') fail('JSON 객체가 없음');
  const parts: Record<string, string | null> = {};
  for (;;) {
    space();
    const key = JSON.parse(quoted()) as string;
    if (!keys.includes(key) || key in parts) fail(`알 수 없는 칸 ${key}`);
    space();
    if (s[i++] !== ':') fail('구분자');
    space();
    const first = i;
    if (s.startsWith('null', i)) {
      i += 4;
      parts[key] = null;
    } else {
      if (s[i] !== '{') fail('결과가 객체가 아님');
      const stack = ['}'];
      i++;
      while (i < n && stack.length) {
        const c = s[i];
        if (c === '"') quoted();
        else if (c === '{' || c === '[') (stack.push(c === '{' ? '}' : ']'), i++);
        else if (c === '}' || c === ']') {
          if (c !== stack.pop()) fail('괄호');
          i++;
        } else i++;
      }
      if (stack.length) fail('중간에 잘림');
      parts[key] = s.slice(first, i);
    }
    space();
    const c = s[i++];
    if (c === '}') break;
    if (c !== ',') fail('결과 구분자');
  }
  space();
  if (i < n || keys.some((k) => !(k in parts))) fail('결과가 빠졌거나 뒤에 다른 글이 붙음');
  return parts;
}

/** 한 응답에 대한 자동 확인들을 묶는 자리 */
export class Joint {
  private waits = new Map<JointKind, Wait>();
  private left: Set<JointKind>;
  private fired = false;

  constructor(private model: ModelChoice, private staticModel?: string, kinds: JointKind[] = ['gn', 'phone']) {
    this.left = new Set<JointKind>(kinds);
  }

  /** 이 작업의 첫 요청. 다른 작업도 모이면 한 번에 보낸다 */
  ask(kind: JointKind, messages: Msg[]): Promise<string> {
    // 사진이 붙은 요청이나 이미 보낸 뒤면 혼자 보낸다
    if (this.fired || !this.left.has(kind) || messages.some((m) => m.images?.length)) {
      this.done(kind);
      return runModel(messages, this.model, this.staticModel, JOINT_LABEL[kind]);
    }
    return new Promise<string>((resolve, reject) => {
      this.waits.set(kind, { messages, resolve, reject });
      this.flush();
    });
  }

  /** 이 작업은 더 묻지 않는다 (모델을 안 부르고 끝났거나 이미 받음) */
  done(kind: JointKind): void {
    this.left.delete(kind);
    this.flush();
  }

  private flush(): void {
    if (this.fired || [...this.left].some((k) => !this.waits.has(k))) return;
    this.fired = true;
    if (this.waits.size >= 2) void this.all();
    else for (const [k, w] of this.waits) runModel(w.messages, this.model, this.staticModel, JOINT_LABEL[k]).then(w.resolve, w.reject);
  }

  private async all(): Promise<void> {
    const kinds = [...this.waits.keys()];
    const keys = kinds.map((k) => JOINT_KEY[k]);
    const label = `${kinds.map((k) => JOINT_LABEL[k]).join('+')} 통합`;
    const prompt = combinedPrompts(kinds.map((k) => ({ key: JOINT_KEY[k], messages: this.waits.get(k)!.messages })));
    let raw = '';
    try {
      raw = await runModel(prompt, this.model, this.staticModel, label);
    } catch (error) {
      for (const w of this.waits.values()) w.reject(error);
      return;
    }
    let parts: Record<string, string | null>;
    try {
      parts = splitCombined(raw, keys);
    } catch (error) {
      // 통합 응답을 못 가르면 (울타리·설명문·중간 잘림) 겉 모양만 고쳐 달라고 한 번 더 묻고, 그래도 안 되면 각 작업을 따로 한 번씩 보낸다
      // (11-09 사용자: 따로 도는 것처럼 보였다). 모델 연결 오류(LlmError)는 형식 재시도가 없어서 여기서 버리면 그 턴의 자동 확인이 통째로 사라졌다 (QC 2026-10-28)
      console.log(`[goei] 통합 자동 확인 응답을 가르지 못해 겉 모양을 다시 묻어요: ${error instanceof Error ? error.message : String(error)}`);
      try {
        const fix = await runModel([...prompt, { role: 'assistant', content: raw }, { role: 'user', content: `Your previous output could not be parsed as the required envelope. Return the SAME content again as exactly one JSON object with exactly these keys: ${keys.map((k) => `"${k}"`).join(', ')}. No code fences, no commentary, nothing before or after the object; a task that failed is null.` }], this.model, this.staticModel, `${label} 다시 묻기`);
        parts = splitCombined(fix, keys);
      } catch (again) {
        console.log(`[goei] 통합 자동 확인 응답을 끝내 가르지 못해 따로 보내요: ${again instanceof Error ? again.message : String(again)}`);
        parts = {};
      }
    }
    // null이면 그 작업만 따로 한 번 더 (다른 결과로 대신 채우지 않는다)
    for (const k of kinds) {
      const w = this.waits.get(k)!;
      const part = parts[JOINT_KEY[k]];
      if (part) w.resolve(part);
      else runModel(w.messages, this.model, this.staticModel, `${JOINT_LABEL[k]} (통합 뒤 따로)`).then(w.resolve, w.reject);
    }
  }
}
