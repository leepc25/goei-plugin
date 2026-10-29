// 「내가 출동」 판정과 사건 기간 (docs/설계안_기록_보고서.md 2-3절). 이름 매칭이 아니라 이미 있는 구조를 근거로 한다:
// (a) 상태창 목표 칸이 그 사건이었던 턴 (엔진 touched) ∨ (b) 출동 지시문(SCENE_CARD)의 목표 ∨ (c) 상태창 투입 칸 ON + 목표 일치
// ∨ (d) 상태창 동행 칸에 그 사건 투입 요원 ∨ (e) 필드 작전 기록(enter/exit_anomaly)의 이름. 본부 방문 대화는 근거로 쓰지 않는다.
import { readScene } from '../dispatch';
import { fieldRecord } from '../field';
import { anchorPositions } from '../people/store';
import type { Chat, ChatMessage } from '../types';
import { findStatusTags, statusMinute } from '../world/status';

export interface MineSubject {
  name: string;
  /** 괴이 프리셋 이름 (name 과 다를 수 있다) */
  presetName?: string;
  /** 투입 요원 이름 (codesToNames 뒤) */
  agentNames: string[];
  touched?: boolean;
}

export type MineReason = 'touched' | 'scene' | 'deployed' | 'companion' | 'field';

const msgs = (chat: Chat): ChatMessage[] => (Array.isArray(chat.message) ? chat.message : []);
const text = (m: ChatMessage | undefined) => (typeof m?.data === 'string' ? m.data : '');
const same = (a: string, b: string) => !!a && !!b && a.trim() === b.trim();

/** 기간 [from, to] 안에서 출동 근거를 찾는다. 근거가 없으면 빈 목록 */
export function mineReasons(chat: Chat, from: number, to: number, s: MineSubject): MineReason[] {
  const out = new Set<MineReason>();
  if (s.touched) out.add('touched');
  const names = [s.name, s.presetName ?? ''].filter(Boolean);
  const hit = (t: string) => names.some((n) => same(t, n));
  const list = msgs(chat);
  const lo = Math.max(0, Math.min(from, to));
  const hi = Math.min(list.length - 1, Math.max(from, to));
  // 출동 지시문은 활성이 된 응답 바로 앞 유저 메시지에 있을 수 있다 (커스텀 임무 → 다음 응답에서 등록)
  for (let i = Math.max(0, lo - 1); i <= hi; i++) {
    const m = list[i];
    if (!m) continue;
    const t = text(m);
    if (m.role === 'user') {
      const scene = readScene(t);
      if (scene && hit(scene.target)) out.add('scene');
      continue;
    }
    if (m.role !== 'char' || i < lo) continue;
    for (const tag of findStatusTags(t)) {
      if (tag.deployed === true && hit(tag.target)) out.add('deployed');
      if (s.agentNames.length && tag.companions.some((c) => s.agentNames.some((a) => same(c, a)))) out.add('companion');
    }
  }
  const events = fieldRecord(chat).events;
  if (events.length) {
    const at = anchorPositions(chat);
    for (const ev of events) {
      if (ev.kind !== 'enter_anomaly' && ev.kind !== 'exit_anomaly') continue;
      const pos = at.get(ev.anchor);
      if (pos === undefined || pos < lo || pos > hi) continue;
      if (names.some((n) => ev.text.includes(n) || (ev.scene ?? '').includes(n))) out.add('field');
    }
  }
  return [...out];
}

export const isMine = (chat: Chat, from: number, to: number, s: MineSubject): boolean => mineReasons(chat, from, to, s).length > 0;

/**
 * 사건 기간의 시작 메시지 번호: 활성 시작 열쇠(startKey)가 가리키는 메시지 → 없으면 since 분 이상인 첫 상태창 응답 → 그것도 없으면 종료 메시지.
 * 끝은 늘 종료 메시지(index).
 */
export function periodOf(chat: Chat, index: number, e: { startKey?: string; since: number | null }): { from: number; to: number } {
  const list = msgs(chat);
  const to = Math.max(0, Math.min(index, list.length - 1));
  let from: number | undefined = e.startKey ? anchorPositions(chat).get(e.startKey) : undefined;
  if (from === undefined && e.since !== null) {
    for (let i = 0; i <= to; i++) {
      const m = list[i];
      if (m?.role !== 'char') continue;
      const tag = findStatusTags(text(m))[0];
      const min = tag ? statusMinute(tag.date, tag.time) : null;
      if (min !== null && min >= e.since) {
        from = i;
        break;
      }
    }
  }
  return { from: Math.min(from ?? to, to), to };
}
