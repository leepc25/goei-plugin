// 필드 장부 기록 (플러그인 쪽). 사건을 게임을 연 채팅에만 쌓는다: 채팅이 바뀌면 기록하지 않는다.
import { uid } from './uid';
import type { GameField, GameFieldEvent } from '../../game/bridge';
import { anchorOf } from '../../core/visit';
import { withFieldEvent, type FieldKind } from '../../core/field';
import { loadContext, updateChat } from '../risu';
import { cardSnapshot } from '../../core/gamelink';
import { lastStatusFields } from '../../core/world/tags';
import { statusClockMinute } from '../../core/world/status';
import { entryDecision, presence } from '../../core/fieldgate';
import { siteFor } from '../../core/fieldsites';
import { peopleStore, withPeople } from '../../core/people/store';
import { peopleSettings } from '../../core/people/settings';
import { applyFieldEvent } from '../../core/people/field';
import { factionNamesOf } from '../people';
import { playerAgent } from '../../core/player';
import { buildFieldReport, emitReport, fieldSummary, journalSettings, lastReportNotice, recordVars } from '../../core/journal';
import { parseCatalog } from '../../core/world/catalog';
import { userInfo } from '../user';

const KINDS: FieldKind[] = ['move', 'act', 'hurt', 'down', 'kill', 'flee', 'provoke', 'gift', 'trade', 'quest', 'follow', 'unfollow', 'enter_anomaly', 'exit_anomaly', 'enter_site', 'detected', 'appoint', 'call'];

/** 쌓는 중인 필드 사건이 다 들어갈 때까지 (응답 보내기 직전에 기다린다) */
const tails = new Set<() => Promise<unknown>>();
export const fieldIdle = (): Promise<unknown> => Promise.all([...tails].map((t) => t()));

export function createField(): GameField {
  const opening = loadContext();
  let chain: Promise<unknown> = Promise.resolve();
  tails.add(() => chain);
  let forced: 'inside' | 'outside' | null = null;
  return {
    override(v) { forced = v; },
    async entry() {
      const c = await loadContext();
      if (!c) return { allow: true, presence: 'unknown', site: 'hq', minute: null };
      const snap = cardSnapshot(c.char, c.chat);
      const st = lastStatusFields(((c.chat.message ?? []) as { role?: string; data?: string }[]).filter(m => m.role === 'char').slice(-6).map(m => String(m.data ?? '')));
      const me = snap.agents.find(a => a.id === snap.player);
      const p = presence({ player: !!me, state: me?.state, target: st?.target, deployed: st?.deployed ?? null, override: forced });
      const minute = snap.minute ?? statusClockMinute(st);
      return { ...entryDecision(p), site: siteFor(snap.faction).site.id, minute };
    },
    record(ev: GameFieldEvent) {
      // 사건 순서가 뒤바뀌지 않게 하나씩 쌓는다
      const run = async () => {
        const origin = await opening;
        if (!origin) return;
        const c = await loadContext();
        if (!c || c.charIndex !== origin.charIndex || c.chatIndex !== origin.chatIndex || c.char.chaId !== origin.char.chaId || c.chat.id !== origin.chat.id) return;
        if (!KINDS.includes(ev.kind as FieldKind)) return;
        const event = { id: uid(), at: Date.now(), anchor: anchorOf(c.chat), kind: ev.kind as FieldKind, text: ev.text, scene: ev.scene, who: ev.who, weight: ev.weight, fact: ev.fact, ...(ev.witness && typeof ev.witness.faction === 'string' ? { witness: { faction: ev.witness.faction, named: !!ev.witness.named } } : {}), ...(typeof ev.visit === 'string' && ev.visit ? { visit: ev.visit } : {}) };
        let made: { id: string; title: string; summary: string } | null = null;
        await updateChat(c.charIndex, c.chatIndex, (chat) => {
          if (chat.id !== c.chat.id) return null;
          let next = withFieldEvent(chat, event);
          // 인물 기록에도 (모델 없음): 계기·상태·행적. 기능이 꺼져 있으면 건너뜀
          if (peopleSettings(next.scriptstate).on) {
            const store = peopleStore(next);
            if (applyFieldEvent(store, next, event, playerAgent(c.char.globalLore, next.scriptstate)?.name ?? '주인공', { mobWeight: peopleSettings(next.scriptstate).mobWeight, factionNames: factionNamesOf(c.char.globalLore) }) > 0) next = withPeople(next, store);
          }
          // 출동 종료: 같은 저장에 일지 줄·보고서 (core/journal/field). 모델 호출 없음
          if (event.kind === 'exit_anomaly') {
            const snap = cardSnapshot(c.char, next);
            let catalog = null;
            try {
              catalog = parseCatalog(c.char.globalLore);
            } catch {
              /* 명부 로어북이 없는 카드 */
            }
            const st = lastStatusFields(((next.message ?? []) as { role?: string; data?: string }[]).filter((m) => m.role === 'char').slice(-6).map((m) => String(m.data ?? '')));
            const built = buildFieldReport({
              chat: next, exit: event, player: playerAgent(c.char.globalLore, next.scriptstate)?.name || userInfo().name || '주인공', site: siteFor(snap.faction).site.name,
              catalog, baseMinute: snap.minute ?? statusClockMinute(st), settings: journalSettings(next.scriptstate),
            });
            if (built?.added) {
              next = { ...next, scriptstate: { ...(next.scriptstate ?? {}), ...recordVars(built.journal, built.reports) } };
              made = { id: built.report.id, title: built.report.head.name, summary: fieldSummary(built.report) };
            }
          }
          return next;
        });
        const m = made as { id: string; title: string; summary: string } | null;
        if (m) emitReport({ id: m.id, title: m.title, summary: m.summary, cause: 'field' });
      };
      const next = chain.then(run, run);
      chain = next.catch(() => {});
      return next;
    },
    async lastReport() {
      // 장부 쓰기가 끝난 뒤 (exit_anomaly 바로 다음에 불려도 보고서가 있게)
      await chain.catch(() => {});
      const n = lastReportNotice();
      return n && n.cause === 'field' ? { id: n.id, title: n.title, summary: n.summary } : null;
    },
  };
}
