import { hasSceneCard, parseDirective, stripSceneCard, withUserInput, type Directive } from './dispatch';
import { hasCall, stripCall } from './phone';
import { applySeedLifetime, SEED_OPEN } from './seed';
import type { Chat } from './types';

export interface PromptMessage {
  role: string;
  content: string;
}

/** 유저 전송 횟수. 이어 붙은 유저 메시지(이동 지시문 + 덧붙인 글)는 한 번으로 센다 */
export function userTurns(chat: Chat): number {
  let n = 0;
  let prev = '';
  for (const m of chat.message ?? []) {
    if (m.role === 'user' && prev !== 'user') n++;
    prev = m.role;
  }
  return n;
}

/** 첫 유저 전송과 그 리롤에는 시드를 남기고, 두 번째 전송부터는 지운다. */
export function shouldKeepSeed(chat: Chat): boolean {
  return userTurns(chat) < 2;
}

export function processRequest<M extends PromptMessage>(messages: M[], chat: Chat): { messages: M[]; changed: boolean } {
  const keep = shouldKeepSeed(chat);
  let changed = false;
  const out = messages.map((m) => {
    if (typeof m.content !== 'string' || !m.content.includes(SEED_OPEN)) return m;
    changed = true;
    return { ...m, content: applySeedLifetime(m.content, keep) };
  });
  return { messages: out, changed };
}

/**
 * 이동·커스텀 임무 지시문(SCENE_CARD)을 모델 요청용으로 푼다: 표식을 지우고,
 * 바로 뒤에 유저가 덧붙여 보낸 글이 있으면 "Situation:"으로 합친다 (원본 M.submit과 같은 결과).
 */
export function unwrapScenes<M extends PromptMessage>(messages: M[], o?: { cardIsLast?: boolean; cardFresh?: boolean }): { messages: M[]; changed: boolean } {
  if (!messages.some((m) => m?.role === 'user' && hasSceneCard(m.content))) return { messages, changed: false };
  // 카드가 채팅의 마지막 메시지면 요청에서 그 뒤 user 글은 프리셋 글이다: 마지막 카드는 다음 글을 합치지 않는다 (전수검사 11-13)
  const lastCard = o?.cardIsLast ? messages.map((m) => m?.role === 'user' && hasSceneCard(m.content)).lastIndexOf(true) : -1;
  // 아직 답이 없는 새 지시문(채팅 끝의 user 글 묶음 안의 카드)은 요청 끝에 프리셋의 assistant 글(프리필)이 붙어도 지난 지시문이 아니다 (11-14 재검토 ①-5)
  const freshCard = o?.cardIsLast || o?.cardFresh ? messages.map((m) => m?.role === 'user' && hasSceneCard(m.content)).lastIndexOf(true) : -1;
  // Situation 틀은 지침 「Directive」 FORMAT.user_input. 못 읽으면 기본 글 (전수검사 11-13)
  let directive: Pick<Directive, 'format'> | null | undefined;
  const readDirective = () => {
    if (directive === undefined) {
      try {
        directive = parseDirective();
      } catch {
        directive = null;
      }
    }
    return directive;
  };
  const out: M[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m?.role !== 'user' || !hasSceneCard(m.content)) {
      out.push(m);
      continue;
    }
    // 창의 「추가 요청」은 같은 메시지의 카드 뒤에 붙어 온다 (v0.16.7). 덧붙여 보낸 다음 글과 같이 Situation으로
    const END = '%%/SCENE_CARD%%';
    const end = m.content.lastIndexOf(END);
    const tail = end >= 0 ? m.content.slice(end + END.length).trim() : '';
    let card = end >= 0 ? m.content.slice(0, end + END.length) : m.content;
    // 이미 답이 붙은 지난 지시문은 지시 문장(COMMON·OPENING·CONTINUATION)을 빼고 맥락(맨 끝 CONTEXT 절)만 남긴다 (전수검사 11-13 나-12)
    if (i !== freshCard && messages.slice(i + 1).some((n) => n?.role === 'assistant')) {
      card = card.replace(/(%%SCENE_CARD:[0-9a-f]+%%\r?\n)([\s\S]*?)(\r?\n%%\/SCENE_CARD%%)/g, (_, a: string, body: string, b: string) => a + (body.split(/\r?\n\r?\n/).at(-1) ?? body) + b);
    }
    let content = stripSceneCard(card);
    const extra = tail ? [tail] : [];
    const next = i === lastCard ? undefined : messages[i + 1];
    if (next?.role === 'user' && typeof next.content === 'string' && !hasSceneCard(next.content)) {
      if (next.content.trim()) extra.push(next.content.trim());
      i++;
    }
    if (extra.length) content = withUserInput(readDirective(), content, extra.join('\n\n'));
    out.push({ ...m, content });
  }
  return { messages: out, changed: true };
}

/**
 * 전화 기록(PHONE_CALL)을 모델 요청용으로 푼다: 표식을 지우고 "… places a phone call to …" 본문만 남긴다.
 * 바로 뒤에 유저가 덧붙여 보낸 글이 있으면 통화 내용으로 이어 붙인다 (원본 submitCall과 같은 결과).
 */
export function unwrapCalls<M extends PromptMessage>(messages: M[], o?: { callIsLast?: boolean }): { messages: M[]; changed: boolean } {
  if (!messages.some((m) => m?.role === 'user' && hasCall(m.content))) return { messages, changed: false };
  // 전화 기록이 채팅의 마지막 메시지면 뒤의 user 글(프리셋)을 통화 내용으로 합치지 않는다 (전수검사 11-13)
  const lastCall = o?.callIsLast ? messages.map((m) => m?.role === 'user' && hasCall(m.content)).lastIndexOf(true) : -1;
  const out: M[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m?.role !== 'user' || !hasCall(m.content)) {
      out.push(m);
      continue;
    }
    let content = stripCall(m.content);
    const next = i === lastCall ? undefined : messages[i + 1];
    if (next?.role === 'user' && typeof next.content === 'string' && !hasCall(next.content) && !hasSceneCard(next.content) && next.content.trim()) {
      content = `${content}\n\n${next.content.trim()}`;
      i++;
    }
    out.push({ ...m, content });
  }
  return { messages: out, changed: true };
}

/**
 * 조립이 「새로 끼운」 system 글만 (자동 재시도 판정용, body.ts lastAdded).
 * 원래 있던 system 글을 고친 결과는 넣지 않는다: 고친 글(자리 로어북 보정 등)은 다음 새 요청에 Risu 가 똑같이 넣을 수 있어,
 * 그것까지 기억하면 새 요청을 재시도로 잘못 본다 (11-14 재검토 ①-2).
 * 앞뒤 순서를 맞춰(LCS) 그대로인 메시지 사이 구간마다 본다. 구간에서 없어진 system 글 수만큼, 가장 닮은 새 system 글을 「고친 글」로 보고 뺀다.
 */
export function insertedSystemTexts(before: PromptMessage[], after: PromptMessage[]): string[] {
  const key = (m: PromptMessage) => `${String(m?.role)}\u0000${typeof m?.content === 'string' ? m.content : ''}`;
  const isSys = (m: PromptMessage) => m?.role === 'system' && typeof m.content === 'string';
  const a = before.map(key);
  const b = after.map(key);
  // 같은 앞·뒤는 미리 떼고 가운데만 맞춘다
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const n = a.length - head - tail;
  const m = b.length - head - tail;
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = a[head + i] === b[head + j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  const had = new Set(before.filter(isSys).map((x) => x.content));
  const out: string[] = [];
  let gone: string[] = [];
  let fresh: string[] = [];
  /** 구간 닫기: 없어진 글마다 가장 닮은(앞뒤 같은 글자 수) 새 글 하나를 고친 글로 보고 뺀다. 남은 새 글이 끼운 글 */
  const flush = () => {
    const edited = new Set<number>();
    for (const o of gone) {
      let best = -1;
      let score = -1;
      fresh.forEach((t, i) => {
        if (edited.has(i)) return;
        const lim = Math.min(o.length, t.length);
        let p = 0;
        while (p < lim && o[p] === t[p]) p++;
        let q = 0;
        while (q < lim - p && o[o.length - 1 - q] === t[t.length - 1 - q]) q++;
        // 점수가 같을 때: 닮은 데가 없으면(0) 앞의 새 글, 닮은 데가 있으면 뒤의 새 글.
        // 같은 머리(`### Character - `)로 시작하는 끼운 글은 주인공 요원 글(applyPlayer)이고, 첫 system 글 바로 뒤 = 로어 글보다 앞에 끼워진다
        if (p + q > score || (p + q === score && score > 0)) {
          best = i;
          score = p + q;
        }
      });
      if (best >= 0) edited.add(best);
    }
    fresh.forEach((t, i) => {
      if (!edited.has(i) && !had.has(t)) out.push(t);
    });
    gone = [];
    fresh = [];
  };
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[head + i] === b[head + j]) {
      flush();
      i++;
      j++;
    } else if (j < m && (i >= n || dp[i * w + j + 1] >= dp[(i + 1) * w + j])) {
      if (isSys(after[head + j])) fresh.push(after[head + j].content);
      j++;
    } else {
      if (isSys(before[head + i])) gone.push(before[head + i].content);
      i++;
    }
  }
  flush();
  return out;
}
