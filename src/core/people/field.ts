// 필드 사건 → 인물 기록 (모델 없음). 선물·구함·폭력 같은 행동을 계기로, 부상·동행을 상태 항목으로 옮긴다.
import type { FieldEvent } from '../field';
import { changeId, entryId, liveEntries, liveness, putChange, putEntry } from './store';
import type { Chat } from '../types';
import type { Cue, PeopleStore } from './types';

/** 사건 종류 → 호감 계기 (대상 인물 기준). 없으면 계기 없음 */
const CUE_OF: Partial<Record<FieldEvent['kind'], Cue>> = { gift: '작은친절', quest: '도움', provoke: '무시', hurt: '파탄', down: '파탄', kill: '중대위반' };

/** 사건의 대상 인물들: who 에서 기록에 있는 사람 (유저·주인공 제외) */
function targets(store: PeopleStore, ev: FieldEvent, player: string): string[] {
  return (ev.who ?? []).filter((w) => w !== player && w !== '@user' && store.people[w]);
}

/** 사건 하나를 기록에 반영. 반영한 변경 수 */
export function applyFieldEvent(store: PeopleStore, chat: Chat, ev: FieldEvent, player = '주인공'): number {
  let n = 0;
  const who = targets(store, ev, player);
  if (!who.length) return 0;
  const live = liveness(chat);
  const cue = CUE_OF[ev.kind];
  for (const name of who) {
    const seq = store.log.filter((c) => c.anchor === ev.anchor).length + (store.people[name].slots.state?.length ?? 0);
    if (cue) {
      if (putChange(store, { id: changeId(name, 'cue', ev.anchor, 0, `${ev.kind}:${ev.id}`), anchor: ev.anchor, seq, src: 'field', who: name, kind: 'cue', cue, reason: `필드: ${ev.text}`.slice(0, 80) })) n++;
    }
    const state = liveEntries(store.people[name].slots.state, live);
    const put = (text: string, replaces?: string) => {
      if (putEntry(store, name, 'state', { id: entryId(name, 'state', ev.anchor, 0, `${ev.kind}:${ev.id}`), text, src: 'field', anchor: ev.anchor, seq, ...(replaces ? { replaces } : {}) })) n++;
    };
    if (ev.kind === 'hurt' || ev.kind === 'down') put(`${ev.kind === 'down' ? '중상' : '부상'} (필드${ev.scene ? ` · ${ev.scene}` : ''})`);
    if (ev.kind === 'kill') put('사망 (필드)');
    if (ev.kind === 'follow') put('유저와 동행 중');
    if (ev.kind === 'unfollow') {
      const f = state.find((e) => e.text.startsWith('유저와 동행 중'));
      if (f) put('(해소) 유저와 동행 중', f.id);
    }
    if (ev.kind === 'appoint' && putEntry(store, name, 'threads', { id: entryId(name, 'threads', ev.anchor, 0, `${ev.kind}:${ev.id}`), text: `약속: ${ev.text}`.slice(0, 200), src: 'field', anchor: ev.anchor, seq, target: '@user' })) n++;
    if (['gift', 'quest', 'hurt', 'down', 'kill', 'follow', 'appoint', 'call'].includes(ev.kind)) {
      if (putEntry(store, name, 'history', { id: entryId(name, 'history', ev.anchor, 0, `${ev.kind}:${ev.id}`), text: `(필드) ${ev.text}`.slice(0, 200), src: 'field', anchor: ev.anchor, seq })) n++;
    }
  }
  return n;
}
