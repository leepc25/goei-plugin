import { hasSceneCard, stripSceneCard, withUserInput } from './dispatch';
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
export function unwrapScenes<M extends PromptMessage>(messages: M[]): { messages: M[]; changed: boolean } {
  if (!messages.some((m) => m?.role === 'user' && hasSceneCard(m.content))) return { messages, changed: false };
  const out: M[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m?.role !== 'user' || !hasSceneCard(m.content)) {
      out.push(m);
      continue;
    }
    let content = stripSceneCard(m.content);
    const next = messages[i + 1];
    if (next?.role === 'user' && typeof next.content === 'string' && !hasSceneCard(next.content)) {
      content = withUserInput(null, content, next.content.trim());
      i++;
    }
    out.push({ ...m, content });
  }
  return { messages: out, changed: true };
}

/**
 * 전화 기록(PHONE_CALL)을 모델 요청용으로 푼다: 표식을 지우고 "… places a phone call to …" 본문만 남긴다.
 * 바로 뒤에 유저가 덧붙여 보낸 글이 있으면 통화 내용으로 이어 붙인다 (원본 submitCall과 같은 결과).
 */
export function unwrapCalls<M extends PromptMessage>(messages: M[]): { messages: M[]; changed: boolean } {
  if (!messages.some((m) => m?.role === 'user' && hasCall(m.content))) return { messages, changed: false };
  const out: M[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m?.role !== 'user' || !hasCall(m.content)) {
      out.push(m);
      continue;
    }
    let content = stripCall(m.content);
    const next = messages[i + 1];
    if (next?.role === 'user' && typeof next.content === 'string' && !hasCall(next.content) && !hasSceneCard(next.content) && next.content.trim()) {
      content = `${content}\n\n${next.content.trim()}`;
      i++;
    }
    out.push({ ...m, content });
  }
  return { messages: out, changed: true };
}
