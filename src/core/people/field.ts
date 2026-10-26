// 필드 사건 → 인물 기록 (모델 없음). 선물·구함·폭력 같은 행동을 계기로, 부상·동행을 상태 항목으로 옮긴다.
import type { FieldEvent } from '../field';
import { changeId, entryId, liveEntries, liveness, putChange, putEntry } from './store';
import type { Chat } from '../types';
import { factionWho, type Cue, type PeopleStore } from './types';
import { ORG_NAMES } from './identity';

/** 사건 종류 → 호감 계기 (대상 인물 기준). 없으면 계기 없음 */
const CUE_OF: Partial<Record<FieldEvent['kind'], Cue>> = { gift: '작은친절', quest: '도움', provoke: '무시', hurt: '파탄', down: '파탄', kill: '중대위반' };

/** 사건의 대상 인물들: who 에서 기록에 있는 사람 (유저·주인공 제외) */
function targets(store: PeopleStore, ev: FieldEvent, player: string): string[] {
  return (ev.who ?? []).filter((w) => w !== player && w !== '@user' && store.people[w]);
}

/** 사건 하나를 기록에 반영. 반영한 변경 수 */
export function applyFieldEvent(store: PeopleStore, chat: Chat, ev: FieldEvent, player = '주인공', o: { mobWeight?: 'half' | 'full' | 'off'; factionNames?: Record<string, string> } = {}): number {
  let n = 0;
  const cue = CUE_OF[ev.kind];
  // 세력 평판: 목격한 소속의 장부에 계기. 몹 목격은 절반(소수점 버림, 0 이면 없음), 설정으로 같음·안 씀
  if (cue && ev.witness?.faction && (ev.witness.named || (o.mobWeight ?? 'half') !== 'off')) {
    const code = ev.witness.faction;
    const scale = ev.witness.named || o.mobWeight === 'full' ? 1 : 0.5;
    const fw = factionWho(code);
    if (!store.factions[code]) store.factions[code] = { code, name: o.factionNames?.[code] || ORG_NAMES[code] || code, seeded: { at: new Date(ev.at || Date.now()).toISOString() } };
    const seq = store.log.filter((c) => c.anchor === ev.anchor).length;
    if (putChange(store, { id: changeId(fw, 'cue', ev.anchor, 0, `${ev.kind}:${ev.id}`), anchor: ev.anchor, seq, src: 'field', who: fw, kind: 'cue', cue, ...(scale !== 1 ? { scale } : {}), reason: `필드(${ev.witness.named ? '명단 인물' : '몹'} 목격): ${ev.text}`.slice(0, 80) })) n++;
  }
  const who = targets(store, ev, player);
  if (!who.length) return n;
  const live = liveness(chat);
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
