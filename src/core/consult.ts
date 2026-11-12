// 설정 창 「AI 상담」의 셈 (화면은 src/ui/editor/consult.ts).
// 사용자 2026-11-11: 설정이 방대하니 모델에게 설정을 묻고, 설정값도 바꿔 주는 채팅 창. 메인 채팅 기록과 분리, 메인 요청에 안 들어가게.
// - 모델에 넘기는 것: 관제 화면의 줄(이름·지금 값·고를 수 있는 값·호출 글·설명)과 이 창의 대화뿐. 채팅 글·로어북·인물 기록은 넘기지 않는다.
// - 모델이 돌려주는 것: 답 <say>, 바꾸자는 것 <set>(id=값), 동의 확인 <apply>.
// - 바꾸는 순서는 코드가 지킨다: <set> 은 「바꾸자고 한 것」으로 적어만 두고, 다음 턴에 <apply> 가 와야 그 적어 둔 것만 적용한다 (ui 쪽).
// - 목록에 없는 id, 고를 수 없는 값, 범위 밖 수는 여기서 걸러 적용될 길이 없다.
// 지침 글: 플러그인 내장 지침 「Consult」(src/data/guides/consult.txt, 설정 → 지침 → AI 상담에서 고침).
import { fillGuide, guideSections } from './guides';

export interface ConsultItem {
  id: string;
  /** 묶음 (관제 화면의 흐름 · 표 제목) */
  group: string;
  /** 줄 이름 (조작 이름이 따로 있으면 「줄 · 조작」) */
  name: string;
  kind: 'pick' | 'step';
  cur: string;
  /** [값, 보이는 이름] */
  opts?: [string, string][];
  lo?: number;
  hi?: number;
  unit?: string;
  zero?: string;
  /** 그 줄의 호출 글·설명 */
  calls?: string;
  help?: string;
}
export interface ConsultChange { id: string; value: string }
export interface ConsultReply { say: string; set: { id: string; raw: string }[]; apply: boolean }
export interface ConsultTalk { who: 'me' | 'op'; text: string }

/** 한 번에 바꾸는 줄 수 한도 (설계 4-5) */
export const CONSULT_MAX = 10;

const onOff = (l: string) => (l === 'ON' ? '켬' : l === 'OFF' ? '끔' : l);
/** 값의 보이는 이름 */
export function consultLabel(item: ConsultItem, value: string): string {
  if (item.kind === 'step') {
    const n = Number(value) || 0;
    return n === 0 && item.zero ? item.zero : `${n}${item.unit ?? ''}`;
  }
  const o = item.opts?.find(([v]) => v === value);
  return o ? onOff(o[1]) : value;
}

const choices = (i: ConsultItem) => (i.kind === 'step' ? `${i.lo ?? 0}~${i.hi ?? 0}${i.unit ?? ''} (정수)` : (i.opts ?? []).map(([, l]) => onOff(l)).join(' / '));
const itemLine = (i: ConsultItem) => `[${i.id}] ${i.group} · ${i.name} | 지금: ${consultLabel(i, i.cur)} | 고를 수 있는 값: ${choices(i)}${i.calls ? ` | 호출: ${i.calls}` : ''}${i.help ? ` | 설명: ${i.help}` : ''}`;

export interface ConsultSource { items: ConsultItem[]; summary: string; pending: ConsultChange[]; talk: ConsultTalk[] }

export function consultPrompt(src: ConsultSource): { role: 'system' | 'user'; content: string }[] {
  const g = guideSections('Consult');
  const system = [fillGuide(g.COMMON, {}), fillGuide(g.CHANGE, {}), fillGuide(g.OUTPUT, { max: String(CONSULT_MAX) })].filter(Boolean).join('\n\n');
  const byId = new Map(src.items.map((i) => [i.id, i]));
  const pending = src.pending.map((c) => { const i = byId.get(c.id); return i ? `${c.id}=${consultLabel(i, c.value)} (${i.group} · ${i.name}, 지금 ${consultLabel(i, i.cur)})` : ''; }).filter(Boolean).join('\n');
  const talk = src.talk.map((l) => `${l.who === 'me' ? '[사용자]' : '[상담]'} ${l.text}`).join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: `[지금 상태]\n${src.summary}\n\n[설정 목록]\n${src.items.map(itemLine).join('\n')}\n\n[바꾸자고 한 것]\n${pending || '(없음)'}\n\n[이 창의 대화 — 마지막 줄이 사용자가 방금 한 말]\n${talk}` },
  ];
}

/** 응답 읽기. <say> 가 없으면 형식 오류 (다시 묻는다) */
export function parseConsult(raw: string): ConsultReply {
  const say = /<say>([\s\S]*?)<\/say>/i.exec(raw)?.[1]?.trim() ?? '';
  if (!say) throw new Error('<say> 블록이 없어요.');
  const body = /<set>([\s\S]*?)<\/set>/i.exec(raw)?.[1] ?? '';
  const set = body.split('\n').map((l) => /^\s*\[?([A-Za-z][\w.]*)\]?\s*=\s*(.+?)\s*$/.exec(l)).filter((m): m is RegExpExecArray => !!m).map((m) => ({ id: m[1], raw: m[2] }));
  return { say, set, apply: /<apply>\s*yes\s*<\/apply>/i.test(raw) };
}

const norm = (s: string) => s.replace(/[「」『』"'`()\s]/g, '').toLowerCase();
/** 모델이 적은 값을 그 설정이 받는 값으로. 고를 수 없으면 null */
export function consultValue(item: ConsultItem, raw: string): string | null {
  if (item.kind === 'step') {
    const t = raw.trim();
    const n = item.zero && norm(t) === norm(item.zero) ? 0 : /^-?\d+/.test(t) && /^-?\d+\s*\D{0,3}$/.test(t) ? Number.parseInt(t, 10) : NaN;
    return Number.isInteger(n) && n >= (item.lo ?? 0) && n <= (item.hi ?? 0) ? String(n) : null;
  }
  const want = norm(raw);
  const hit = (item.opts ?? []).find(([v, l]) => norm(onOff(l)) === want || norm(l) === want || v === raw.trim());
  return hit ? hit[0] : null;
}

/** 바꾸자는 목록을 설정 목록과 대조한다: 통과한 것(ok)과 못 바꾸는 까닭(bad). 지금 값과 같은 것은 조용히 뺀다 */
export function checkConsult(items: ConsultItem[], set: { id: string; raw: string }[], max = CONSULT_MAX): { ok: ConsultChange[]; bad: string[] } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ok = new Map<string, ConsultChange>();
  const bad: string[] = [];
  for (const s of set) {
    const item = byId.get(s.id);
    if (!item) { bad.push(`${s.id}: 목록에 없는 설정`); continue; }
    const value = consultValue(item, s.raw);
    if (value === null) { bad.push(`${item.name}: 고를 수 없는 값 「${s.raw.slice(0, 40)}」`); continue; }
    ok.delete(s.id);
    if (value !== item.cur) ok.set(s.id, { id: s.id, value });
  }
  const list = [...ok.values()];
  if (list.length > max) bad.push(`한 번에 ${max}개까지만 바꿀 수 있어요 (${list.length - max}개 뺌)`);
  return { ok: list.slice(0, max), bad };
}
