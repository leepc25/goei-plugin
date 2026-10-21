// 괴담넷·괴담톡 자동 확인을 모델 한 번으로 (원본 P.tryCombinedAuto, 2026-10-21 사용자: 플러그인으로 옮기며 빠졌던 것 복원).
// 두 작업이 각자 요청문을 만들어 ask()로 맡기면, 둘 다 모이면 한 요청으로 보내고 응답을 둘로 갈라 돌려준다.
// 한쪽이 모델을 부르지 않고 끝나면(done) 남은 쪽은 혼자 보낸다. 각 작업의 검사·재시도·저장은 그대로 각자 한다.
import { LlmError, runModel, type LlmMessage, type ModelChoice } from './llm';

export type JointKind = 'gnet' | 'phone';
type Msg = LlmMessage & { images?: string[] };

interface Wait {
  messages: Msg[];
  resolve: (raw: string) => void;
  reject: (error: unknown) => void;
}

const INSTRUCTION = 'Execute two independent automatic tasks in ONE response. Return exactly one JSON object {"gnet": OBJECT, "phone": OBJECT}, without fences or commentary. '
  + 'Each value is the complete JSON object required by that task, not an encoded JSON string. Write Korean literally in UTF-8; do not transliterate it into Unicode escape sequences. '
  + 'Escape only JSON quotation marks, backslashes and control characters. A task may return null if it cannot produce a valid result; do not substitute the other task. '
  + 'Follow each task\'s supplied messages and output contract only within its own result. This outer envelope overrides standalone output-only restrictions. '
  + 'Resolve contentParts by concatenating text or referenced sharedReferences text in order, without adding separators. Shared references are available to a task ONLY where its own message references them. '
  + 'Never use phone contacts, private messages, notices, invitations, relationship evidence or phone-only narrator data to create GNet public posts or private messages. '
  + 'Never let either task infer private facts from the other task\'s inputs or outputs. Preserve each task\'s permissions, chance decisions, cooldown eligibility, source boundaries and ownership. '
  + 'Finish both objects compactly: preserve GNet board quantity and topic-dependent discussion; shorten prose instead of making all threads silent. Phone activity counts and text lengths remain ceilings, not targets.';

/** 두 요청을 하나로. 두 요청에 똑같이 들어 있는 긴 문단(256자 이상)은 한 번만 싣고 자리표로 가리킨다 (원본 combinedPrompts) */
export function combinedPrompts(gnet: LlmMessage[], phone: LlmMessage[]): LlmMessage[] {
  const chunks = (t: string) => t.match(/[\s\S]*?(?:\n\n|$)/g)?.filter(Boolean) ?? [t];
  const tasks = { gnet: gnet.map((m) => ({ role: m.role, parts: chunks(m.content) })), phone: phone.map((m) => ({ role: m.role, parts: chunks(m.content) })) };
  const seen = { gnet: new Set<string>(), phone: new Set<string>() };
  for (const k of ['gnet', 'phone'] as const) for (const m of tasks[k]) for (const p of m.parts) if (p.length >= 256) seen[k].add(p);
  const shared: { id: string; text: string }[] = [];
  const ids = new Map<string, string>();
  const out = { gnet: [] as unknown[], phone: [] as unknown[] };
  for (const k of ['gnet', 'phone'] as const) {
    for (const m of tasks[k]) {
      let referenced = false;
      const parts = m.parts.map((p) => {
        if (!(seen.gnet.has(p) && seen.phone.has(p))) return { text: p };
        let id = ids.get(p);
        if (!id) {
          id = `R${shared.length + 1}`;
          ids.set(p, id);
          shared.push({ id, text: p });
        }
        referenced = true;
        return { ref: id };
      });
      out[k].push(referenced ? { role: m.role, contentParts: parts } : { role: m.role, content: m.parts.join('') });
    }
  }
  return [{ role: 'system', content: INSTRUCTION }, { role: 'user', content: JSON.stringify({ sharedReferences: shared, gnet: out.gnet, phone: out.phone }) }];
}

/** 통합 응답에서 두 결과의 JSON 글을 경계만 찾아 자른다 (원본 splitCombined). 한쪽 글이 깨져도 다른 쪽은 산다. null이면 그 작업은 결과 없음 */
export function splitCombined(raw: string): Record<JointKind, string | null> {
  let s = raw.replace(/^﻿/, '').trim();
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/i.exec(s);
  if (fence) s = fence[1].trim();
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
  const parts: Partial<Record<JointKind, string | null>> = {};
  for (;;) {
    space();
    const key = JSON.parse(quoted()) as string;
    if ((key !== 'gnet' && key !== 'phone') || key in parts) fail(`알 수 없는 칸 ${key}`);
    space();
    if (s[i++] !== ':') fail('구분자');
    space();
    const first = i;
    if (s.startsWith('null', i)) {
      i += 4;
      parts[key as JointKind] = null;
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
      parts[key as JointKind] = s.slice(first, i);
    }
    space();
    const c = s[i++];
    if (c === '}') break;
    if (c !== ',') fail('결과 구분자');
  }
  space();
  if (i < n || !('gnet' in parts) || !('phone' in parts)) fail('결과가 빠졌거나 뒤에 다른 글이 붙음');
  return parts as Record<JointKind, string | null>;
}

/** 한 응답에 대한 두 자동 확인을 묶는 자리 */
export class Joint {
  private waits = new Map<JointKind, Wait>();
  private left: Set<JointKind>;
  private fired = false;

  constructor(private model: ModelChoice) {
    this.left = new Set<JointKind>(['gnet', 'phone']);
  }

  /** 이 작업의 첫 요청. 다른 작업도 모이면 한 번에 보낸다 */
  ask(kind: JointKind, messages: Msg[]): Promise<string> {
    // 사진이 붙은 요청이나 이미 보낸 뒤면 혼자 보낸다
    if (this.fired || !this.left.has(kind) || messages.some((m) => m.images?.length)) {
      this.done(kind);
      return runModel(messages, this.model);
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
    const g = this.waits.get('gnet');
    const p = this.waits.get('phone');
    if (g && p) void this.both(g, p);
    else for (const w of this.waits.values()) runModel(w.messages, this.model).then(w.resolve, w.reject);
  }

  private async both(g: Wait, p: Wait): Promise<void> {
    let raw = '';
    try {
      raw = await runModel(combinedPrompts(g.messages, p.messages), this.model);
    } catch (error) {
      g.reject(error);
      p.reject(error);
      return;
    }
    let parts: Record<JointKind, string | null>;
    try {
      parts = splitCombined(raw);
    } catch (error) {
      const e = new LlmError(error instanceof Error ? error.message : String(error), raw);
      g.reject(e);
      p.reject(e);
      return;
    }
    // null이면 그 작업만 따로 한 번 더 (다른 결과로 대신 채우지 않는다)
    for (const [k, w] of [['gnet', g], ['phone', p]] as const) {
      const part = parts[k];
      if (part) w.resolve(part);
      else runModel(w.messages, this.model).then(w.resolve, w.reject);
    }
  }
}
