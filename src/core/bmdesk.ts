// 백일몽 포인트몰 1:1 상담 (2026-11-09 사용자): 기능 없이 상담사와 대화하는 재미. 상담을 열 때마다 다른 백일몽 직원(페르소나)이 붙는다.
// 앵무새 막기 (사용자): 지침에 예시 대사·소재 목록을 넣지 않는다. 사람을 먼저 「진짜로」 만든다 — 코드가 주사위 칸을 굴리고(설정에서 고침),
// 모델이 그 값으로 상담사 카드를 한 번 짓는다(저장). 대화는 매 턴 그 카드를 같이 보낸다. 최근 상담사 요약을 넘겨 겹치지 않게 한다.
// 지침 글: 플러그인 내장 지침 「BmDesk」(src/data/guides/bmdesk.txt, 설정 → 지침 → 포인트몰 1:1 상담에서 고침).
import { fillGuide, guideSections } from './guides';
import type { CraftMessage } from './craft';

type Vars = Record<string, unknown> | undefined;

export const DESK_VAR = '$bm_desk';
export const DESK_KEY = { on: '$bm_desk_on', axes: '$bm_desk_axes', again: '$bm_desk_again', avoid: '$bm_desk_avoid' } as const;
export const DESK_AVOID_RANGE: [number, number] = [0, 12];
export const DESK_AVOID_DEFAULT = 6;
/** 저장해 두는 지난 상담사 수 (다시 만나기·겹치지 않기용) */
const PAST_KEEP = 20;

/** 주사위 칸 기본 (설정에서 통째로 고친다. 한 줄에 「칸 이름: 값, 값, …」 — 같은 값을 여러 번 적으면 그만큼 잘 뽑힌다).
 *  직급은 위키 백일몽 문서의 직급표(사원~차장) 안에서. 나머지는 사람 됨됨이 축이지 소재가 아니다 */
export const DESK_AXES_DEFAULT = [
  '직급: 사원, 사원, 사원, 주임, 주임, 대리, 과장, 차장',
  '근속: 입사 석 달 차, 1년 차, 2년 차, 4년 차, 7년 차, 10년이 넘음',
  '이력: 처음부터 내근, 현장에서 다쳐 내근으로 옮김, 지금도 현장을 겸함, 다른 부서에서 밀려옴, 곧 다른 부서로 옮김',
  '회사를 대하는 태도: 진심으로 회사를 믿음, 월급만큼만 일함, 승진에 목맴, 속으로 회사를 싫어함, 회사를 두려워함, 별생각 없음',
  '오늘 기분: 지나치게 밝음, 지쳐 있음, 짜증을 참는 중, 들떠 있음, 멍함, 불안함, 차분함',
  '매뉴얼 준수도: 토씨 하나까지 지킴, 대충 지킴, 자주 어김, 몰래 흘림',
  '성격: 수다스러움, 무뚝뚝함, 소심함, 능글맞음, 깐깐함, 덤벙댐, 다정함, 냉소적임',
].join('\n');

export interface DeskAxis { name: string; values: string[] }
export function parseAxes(text: string): DeskAxis[] {
  const out: DeskAxis[] = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const name = line.slice(0, i).trim().slice(0, 20);
    const values = line.slice(i + 1).split(/[,，]/).map((x) => x.trim().slice(0, 60)).filter(Boolean);
    if (name && values.length) out.push({ name, values });
  }
  return out;
}

export interface DeskSettings {
  on: boolean;
  /** 비어 있으면 기본 */
  axesText: string;
  axes: DeskAxis[];
  /** 지난 상담사가 다시 걸릴 수 있음 (기본 꺼짐 — 11-09 사용자: 매번 다른 페르소나가 재미) */
  again: boolean;
  /** 겹치지 말라고 넘길 최근 상담사 수 */
  avoid: number;
}
export function deskSettings(vars: Vars): DeskSettings {
  const axesText = String(vars?.[DESK_KEY.axes] ?? '');
  const parsed = parseAxes(axesText);
  const n = Math.floor(Number(vars?.[DESK_KEY.avoid] ?? ''));
  return {
    on: String(vars?.[DESK_KEY.on] ?? '') !== '0',
    axesText,
    axes: parsed.length ? parsed : parseAxes(DESK_AXES_DEFAULT),
    again: String(vars?.[DESK_KEY.again] ?? '') === '1',
    avoid: String(vars?.[DESK_KEY.avoid] ?? '') !== '' && Number.isFinite(n) ? Math.max(DESK_AVOID_RANGE[0], Math.min(DESK_AVOID_RANGE[1], n)) : DESK_AVOID_DEFAULT,
  };
}

/** 굴린 주사위 (칸 이름 → 값) */
export type DeskDice = [string, string][];
export const rollDice = (axes: DeskAxis[], rnd: () => number = Math.random): DeskDice => axes.map((a) => [a.name, a.values[Math.floor(rnd() * a.values.length)]]);

export interface DeskAgent {
  id: string;
  /** 손님에게 보이는 상담원 번호 (11-09 사용자: 실명·직급·부서는 드러나면 안 된다 — 화면·대화엔 「상담원 0427」만) */
  no?: string;
  name: string;
  rank: string;
  dept: string;
  intro: string;
  voice: string;
  dice: DeskDice;
}
export interface DeskLine { who: 'me' | 'op' | 'sys'; text: string }
export interface DeskState {
  agent: DeskAgent | null;
  talk: DeskLine[];
  /** 이 상담이 시작된 본편 응답 (본편이 넘어가면 다음에 열 때 새 상담) */
  anchor: string;
  past: DeskAgent[];
}
export const emptyDesk = (): DeskState => ({ agent: null, talk: [], anchor: '', past: [] });
export function readDesk(vars: Vars): DeskState {
  try {
    const o = JSON.parse(String(vars?.[DESK_VAR] ?? ''));
    if (!o || typeof o !== 'object') return emptyDesk();
    return { agent: o.agent && typeof o.agent.name === 'string' ? o.agent : null, talk: Array.isArray(o.talk) ? o.talk : [], anchor: String(o.anchor ?? ''), past: Array.isArray(o.past) ? o.past : [] };
  } catch {
    return emptyDesk();
  }
}
export const deskVars = (st: DeskState): Record<string, string> => ({ [DESK_VAR]: JSON.stringify(st) });

/** 상담을 끝낸다: 상담사를 지난 목록에 넣고 대화를 비운다 */
export function endDesk(st: DeskState): DeskState {
  if (!st.agent) return { ...st, talk: [] };
  const past = [st.agent, ...st.past.filter((p) => p.id !== st.agent!.id)].slice(0, PAST_KEEP);
  return { agent: null, talk: [], anchor: '', past };
}

/** 새 상담사를 만들지, 지난 상담사를 다시 부를지 (다시 만나기 켬일 때 1/4) */
export function pickAgain(st: DeskState, s: DeskSettings, rnd: () => number = Math.random): DeskAgent | null {
  if (!s.again || !st.past.length || rnd() >= 0.25) return null;
  return st.past[Math.floor(rnd() * st.past.length)];
}

const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
function block(raw: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}\\s*>`, 'i').exec(raw);
  return m ? m[1].trim() : '';
}
export class DeskError extends Error {
  raw = '';
}
const fail = (msg: string, raw: string) => Object.assign(new DeskError(msg), { raw });
/** 말풍선 (빈 줄로 나눔, 최대 3) */
function bubbles(text: string): string[] {
  return text.replace(/\r/g, '').split(/\n\s*\n/).map((x) => x.split('\n').map((l) => l.trim()).filter(Boolean).join('\n').slice(0, 600)).filter(Boolean).slice(0, 3);
}

/** 상담원 번호 (코드가 정한다) */
export const newDeskNo = (rnd: () => number = Math.random): string => String(1000 + Math.floor(rnd() * 9000));
/** 손님에게 보이는 호칭 (번호 없는 옛 카드는 id 로 만든다) */
export const deskTag = (a: DeskAgent): string => `상담원 ${a.no ?? String(1000 + (parseInt(a.id.slice(-4), 36) % 9000))}`;

export function parseCard(raw: string, dice: DeskDice, no: string): { agent: DeskAgent; say: string[] } {
  const card = block(raw, 'card');
  if (!card) throw fail('응답에 <card> 블록(상담사 카드)이 없어요.', raw);
  const get = (k: string) => clean(new RegExp(`^\\s*${k}\\s*[:：]\\s*(.+)$`, 'm').exec(card)?.[1], k === '소개' || k === '말투' ? 200 : 30);
  const name = get('이름');
  if (!name) throw fail('상담사 카드에 이름이 없어요.', raw);
  const say = bubbles(block(raw, 'say'));
  if (!say.length) throw fail('응답에 <say> 블록(첫 인사)이 없어요.', raw);
  const rank = get('직급') || (dice.find(([k]) => k === '직급')?.[1] ?? '');
  return { agent: { id: `a${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, no, name, rank, dept: get('부서'), intro: get('소개'), voice: get('말투'), dice }, say };
}
export function parseSay(raw: string): string[] {
  const say = bubbles(block(raw, 'say'));
  if (!say.length) throw fail('응답에 <say> 블록(상담사 답)이 없어요.', raw);
  return say;
}

export interface DeskSource {
  /** 참고 자료 (백일몽 로어북·위키 문서 등) */
  refs: string;
  /** 지금 진열된 상품 (이름|값|설명) */
  shelf: string;
  /** 손님 남은 포인트 */
  points: number;
  /** 손님 사내 계정 이름 */
  nick: string;
  language: string | null;
}

const G = () => guideSections('BmDesk');
const diceText = (d: DeskDice) => d.map(([k, v]) => `${k}: ${v}`).join('\n');
const cardText = (a: DeskAgent) => `손님에게 보이는 호칭: ${deskTag(a)}\n이름: ${a.name}\n직급: ${a.rank}\n부서: ${a.dept}\n소개: ${a.intro}\n말투: ${a.voice}\n${diceText(a.dice)}`;
const material = (src: DeskSource) => [
  src.refs ? `[참고 자료 — 백일몽에 대해 이 상담사가 알 수 있는 것]\n${src.refs}` : '',
  `[지금 진열된 상품]\n${src.shelf || '(없음)'}`,
  `[손님]\n사내 계정: ${src.nick || '-'}\n남은 포인트: ${Math.trunc(src.points).toLocaleString('en-US')}p`,
].filter(Boolean).join('\n\n');

/** 상담사 만들기 + 첫 인사 */
export function makePrompt(src: DeskSource, dice: DeskDice, recent: DeskAgent[], no: string): { messages: CraftMessage[]; thoughts: string } {
  const g = G();
  const system = [fillGuide(g.COMMON, {}), fillGuide(g.MAKE, {}), fillGuide(g.MANUAL, {}), fillGuide(g.MAKE_OUTPUT, {}), src.language ?? ''].filter(Boolean).join('\n\n');
  const past = recent.length ? recent.map((a) => `- ${a.name} (${a.rank}, ${a.dept}): ${a.intro} / 말투: ${a.voice}`).join('\n') : '(없음)';
  return { messages: [{ role: 'system', content: system }, { role: 'user', content: `${material(src)}\n\n[손님에게 보이는 호칭]\n상담원 ${no}\n\n[이번 상담사 주사위]\n${diceText(dice)}\n\n[최근 상담사 — 겹치지 말 것]\n${past}\n\n[현재 작업]\n상담사 카드와 첫 메시지` }], thoughts: fillGuide(g.THOUGHTS_MAKE, {}) };
}

/** 대화: 카드 + 이번 상담 대화 전부 */
export function talkPrompt(src: DeskSource, st: DeskState): { messages: CraftMessage[]; thoughts: string } {
  const g = G();
  const a = st.agent!;
  const system = [fillGuide(g.COMMON, {}), fillGuide(g.MANUAL, {}), fillGuide(g.TALK, {}), fillGuide(g.TALK_OUTPUT, {}), src.language ?? ''].filter(Boolean).join('\n\n');
  const talk = st.talk.filter((l) => l.who !== 'sys').map((l) => `${l.who === 'me' ? '[손님]' : '[상담사]'} ${l.text}`).join('\n');
  return { messages: [{ role: 'system', content: system }, { role: 'user', content: `${material(src)}\n\n[상담사 카드]\n${cardText(a)}\n\n[이번 상담 대화 — 마지막 줄이 손님이 방금 한 말]\n${talk}` }], thoughts: fillGuide(g.THOUGHTS_TALK, {}) };
}
