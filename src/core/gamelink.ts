// 게임 ↔ 본편 연동의 순수 부분 (기본기획서 22장). 읽기는 자동: 카드 명부·상황판에서 게임에 넘길 스냅숏을 만든다.
// 쓰기는 사용자가 누를 때만: 출동 보고서 글(채팅에 「전송 대기」로 놓음)과, 켜면 쓰는 「관리국 훈련 기록」 로어북 한 칸.
// 게임 결과로 본편 요원 상태(부상 등)를 바꾸지 않는다 (22.3).
import type { CardAgent, CardEvent, CardSnapshot, GameReport } from '../game/bridge';
import { peopleStore } from './people/store';
import { playerId } from './player';
import type { Chat, LoreEntry } from './types';
import { activeEvents, agentLocked, parseCatalog, readDirectory, readWorld } from './world';

export interface SnapshotPics {
  /** 대표 사진 에셋 이름 */
  main(row: { photo?: string; english?: string; shared?: string[] }): string;
  /** 얼굴 사진 「이름#가로,세로,크기」 */
  face(row: { face?: string; photo?: string; english?: string; crop?: string; shared?: string[] }): string;
}

export function cardSnapshot(char: { name?: string; globalLore?: LoreEntry[] }, chat: Chat, pics?: SnapshotPics): CardSnapshot {
  const lore = char.globalLore ?? [];
  const dir = readDirectory(lore);
  const world = readWorld(chat);
  let people: { id: string; name: string; english: string; affiliation: string; rank: string }[] = [];
  try {
    people = parseCatalog(lore).people;
  } catch {
    people = dir.agents;
  }
  const rows = new Map(dir.agents.map((a) => [a.id, a]));
  const agents: CardAgent[] = people.map((p) => {
    const rec = world.agents[p.id];
    const row = rows.get(p.id);
    return {
      id: p.id,
      name: p.name,
      english: p.english,
      affiliation: p.affiliation,
      rank: p.rank,
      state: rec?.st ?? '미정',
      situation: rec?.situation ?? '',
      locked: agentLocked(rec) || world.retired.includes(p.id),
      photo: row && pics ? pics.main(row) : (row?.photo ?? ''),
      face: row && pics ? pics.face(row) : (row?.face ?? ''),
    };
  });
  const events: CardEvent[] = activeEvents(world).map((e) => ({
    kind: e.kind,
    name: e.name,
    loc: e.loc,
    grade: e.grade,
    state: e.kind === 'an' ? '활성' : e.kind === 'in' ? '진행' : '출현',
    situation: e.report,
  }));
  const place = (r: { lore: string; label: string; english: string }) => ({ lore: r.lore, label: r.label, english: r.english });
  const identity = peopleStore(chat).identity;
  return {
    card: String(char.name ?? ''),
    faction: String(chat.scriptstate?.['$st_faction'] ?? ''),
    player: playerId(chat.scriptstate),
    agents,
    anomalies: dir.anomalies.map(place),
    sites: dir.sites.map(place),
    events,
    minute: world.minute,
    ...(identity ? { identity: { faction: identity.faction, rank: identity.rank, level: identity.level } } : {}),
  };
}

// ── 쓰기 ──

// 사망 처리 옵션(docs/설계_출동루프_3판.md 2-8): 영구 사망 = 「사망」, 패퇴 = 「부상·후송」. 태그는 모델이 바꾼다
const OUTCOME: Record<GameReport['outcome'], string> = { return: '귀환', evac: '부상·후송', withdraw: '자발 철수', death: '사망' };

const clean = (s: unknown, max = 200) =>
  String(s ?? '')
    .replace(/%%/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** 들어온 결과를 믿지 않고 모양을 맞춘다 (게임 코드는 따로 받은 코드다) */
export function normReport(r: Partial<GameReport> | null | undefined): GameReport | null {
  if (!r || typeof r !== 'object') return null;
  const outcome = r.outcome === 'evac' || r.outcome === 'withdraw' || r.outcome === 'death' ? r.outcome : 'return';
  const list = (v: unknown, n: number) => (Array.isArray(v) ? v.map((x) => clean(x, 120)).filter(Boolean).slice(0, n) : []);
  const agents = Array.isArray(r.agents)
    ? r.agents.slice(0, 8).map((a) => ({ id: clean(a?.id, 40), name: clean(a?.name, 40), ...(typeof a?.hp === 'number' ? { hp: a.hp } : {}), ...(a?.injured ? { injured: true } : {}) }))
    : [];
  const mission = clean(r.mission, 80);
  if (!mission) return null;
  return { ...(r.id ? { id: clean(r.id, 60) } : {}), mission, outcome, depth: clean(r.depth, 20), agents, rules: list(r.rules, 12), loot: list(r.loot, 12), summary: clean(r.summary, 400) };
}

/** 채팅에 놓을 출동 보고서 (유저가 보낼지 정한다) */
export function reportText(r: GameReport): string {
  const who = r.agents.map((a) => a.name).filter(Boolean).join(', ') || '요원';
  const lines = [`[관리국 출동 보고서] ${r.mission} · ${OUTCOME[r.outcome]}${r.depth ? ` · 최저 ${r.depth}` : ''}`, `출동: ${who}`];
  if (r.summary) lines.push(r.summary);
  if (r.rules.length) lines.push(`찾은 규칙: ${r.rules.join(' / ')}`);
  if (r.loot.length) lines.push(`회수: ${r.loot.join(', ')}`);
  return lines.join('\n');
}

export const RECORD_COMMENT = '관리국 훈련 기록';
const RECORD_KEEP = 5;
const RECORD_HEAD = '# 관리국 훈련 기록\n관리국 요원들이 겪은 출동 기록(유저가 남긴 게임 기록). 요원은 이 경험을 기억한다. 최근 것부터.';

/** 이 채팅 로어북의 「관리국 훈련 기록」 한 칸에 결과를 더한다 (최근 다섯 개만) */
export function withRecord(chat: Chat, r: GameReport, at: Date = new Date()): Chat {
  const local = Array.isArray(chat.localLore) ? (chat.localLore as LoreEntry[]).slice() : [];
  const i = local.findIndex((e) => e.comment === RECORD_COMMENT);
  const old = i >= 0 ? String(local[i].content ?? '') : '';
  const prev = old.split('\n').filter((l) => l.startsWith('- '));
  const who = r.agents.map((a) => a.name).filter(Boolean).join(', ');
  const date = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  const line = `- ${date} ${r.mission} · ${OUTCOME[r.outcome]}${r.depth ? ` · 최저 ${r.depth}` : ''}${who ? ` · ${who}` : ''}${r.rules.length ? ` · 규칙: ${r.rules.slice(0, 4).join(' / ')}` : ''}${r.summary ? ` · ${r.summary.slice(0, 160)}` : ''}`;
  const content = [RECORD_HEAD, line, ...prev].slice(0, RECORD_KEEP + 1).join('\n');
  const entry: LoreEntry = { key: '', secondkey: '', comment: RECORD_COMMENT, content, mode: 'normal', insertorder: 90, alwaysActive: true, selective: false, useRegex: false };
  if (i >= 0) local[i] = { ...local[i], ...entry };
  else local.push(entry);
  return { ...chat, localLore: local };
}

export function withoutRecord(chat: Chat): Chat | null {
  const local = Array.isArray(chat.localLore) ? (chat.localLore as LoreEntry[]) : [];
  if (!local.some((e) => e.comment === RECORD_COMMENT)) return null;
  return { ...chat, localLore: local.filter((e) => e.comment !== RECORD_COMMENT) };
}

export const recordLines = (chat: Chat): number =>
  String((Array.isArray(chat.localLore) ? (chat.localLore as LoreEntry[]) : []).find((e) => e.comment === RECORD_COMMENT)?.content ?? '')
    .split('\n')
    .filter((l) => l.startsWith('- ')).length;
