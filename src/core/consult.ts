// 설정 창 「AI 상담」의 셈 (화면은 src/ui/editor/consult.ts, 설정 목록은 src/ui/editor/catalog.ts).
// 사용자 2026-11-11: 설정이 방대하니 모델에게 설정을 묻고, 설정값도 바꿔 주는 채팅 창. 메인 채팅 기록과 분리, 메인 요청에 안 들어가게.
// 사용자 2026-11-12: 호출 흐름만이 아니라 모든 설정. 되풀이가 아니라 상담(증상 → 설정, 메뉴 소개, 지난 턴 기록을 본 조언). 한 번에 바꾸는 줄 수 한도 없음. 글 칸도 바꿀 수 있다.
// - 모델에 넘기는 것: 지금 상태(호출 흐름 마디), 지난 턴 실제 기록(숫자만), 메뉴마다 줄 이름, 펼친 메뉴의 줄(이름·지금 값·고를 수 있는 값·설명), 이 창의 대화.
//   채팅 글·로어북·인물 기록은 넘기지 않는다.
// - 모델이 돌려주는 것: 답 <say>, 바꾸자는 것 <set>(id=값), 동의 확인 <apply>, 더 볼 메뉴 <open>, 가리킬 줄 <go>.
// - 바꾸는 순서는 코드가 지킨다: <set> 은 「바꾸자고 한 것」으로 적어만 두고, 다음 턴에 <apply> 가 와야 그 적어 둔 것만 적용한다 (ui 쪽).
// - 목록에 없는 id, 바꿀 수 없는 줄, 고를 수 없는 값, 범위 밖 수, 너무 긴 글은 여기서 걸러 적용될 길이 없다.
// 지침 글: 플러그인 내장 지침 「Consult」(src/data/guides/consult.txt, 설정 → 지침 → AI 상담에서 고침).
import { fillGuide, guideSections } from './guides';

export interface ConsultItem {
  id: string;
  /** 메뉴 이름 (설정 창 왼쪽 목록의 이름) */
  menu: string;
  /** 묶음 이름 (없으면 '') */
  group: string;
  /** 줄 이름 (조작이 여럿이면 「줄 · 조작」) */
  name: string;
  /** pick = 고르기·켬끔, num = 범위가 있는 수, step = − + 단추로만 움직이는 수, text = 글 칸, info = 조작이 없는 줄(설명만) */
  kind: 'pick' | 'num' | 'step' | 'text' | 'info';
  cur: string;
  /** [값, 보이는 이름] */
  opts?: [string, string][];
  lo?: number;
  hi?: number;
  unit?: string;
  zero?: string;
  /** step: 한 번 누를 때 움직이는 양 (화면이 적어 둔 때만) */
  stride?: number;
  /** 글 칸: 글자 수 상한 · 여러 줄 칸인지 */
  max?: number;
  multi?: boolean;
  /** 지금은 잠긴 조작 (다른 설정 때문에 못 바꿈) */
  locked?: boolean;
  /** 저장 자리 배지 글 (이 채팅이 아닐 때만: 「이 기기」「새 채팅 기본값」) */
  scope?: string;
  help?: string;
}
export interface ConsultChange { id: string; value: string }
export interface ConsultReply { say: string; set: { id: string; raw: string }[]; apply: boolean; open: string[]; go: string }
export interface ConsultTalk { who: 'me' | 'op'; text: string }

const onOff = (l: string) => (l === 'ON' ? '켬' : l === 'OFF' ? '끔' : l);
const EMPTY = '(빈 글)';
/** 여러 줄 글을 한 줄로 적는 꼴 (요청문·<set>): 줄바꿈 ↔ 「\n」 두 글자 */
const oneLine = (s: string) => s.replace(/\r?\n/g, '\\n');
/** 값의 보이는 이름 */
export function consultLabel(item: ConsultItem, value: string): string {
  if (item.kind === 'text') return value === '' ? EMPTY : value;
  if (item.kind === 'num' || item.kind === 'step') {
    if (value.trim() === '') return item.zero ?? '(비어 있음)';
    const n = Number(value) || 0;
    return n === 0 && item.zero ? item.zero : `${n}${item.unit ?? ''}`;
  }
  const o = item.opts?.find(([v]) => v === value);
  return o ? onOff(o[1]) : value;
}
/** 상담이 바꿀 수 있는 줄인가 */
export const consultCan = (i: ConsultItem): boolean => i.kind !== 'info' && !i.locked;

function choices(i: ConsultItem): string {
  if (i.kind === 'num') return `${i.lo ?? 0}~${i.hi ?? 0}${i.unit ?? ''} (정수)`;
  if (i.kind === 'step') return `정수${i.unit ? ` (${i.unit})` : ''}, ${i.stride && i.stride > 1 ? `지금 값에서 ${i.stride}씩` : '화면의 − + 단추가 닿는 값'}`;
  if (i.kind === 'text') return `글${i.max ? ` (최대 ${i.max}자)` : ''}${i.multi ? ', 여러 줄은 \\n 으로 이음' : ', 한 줄'}`;
  return (i.opts ?? []).map(([, l]) => onOff(l)).join(' / ');
}
export function itemLine(i: ConsultItem): string {
  const name = `${i.group && i.group !== i.menu && i.group !== i.name ? `${i.group} · ` : ''}${i.name}`;
  const help = i.help ? ` | 설명: ${i.help}` : '';
  if (i.kind === 'info') return `[${i.id}] ${name} | 바꾸기: 못 함${help}`;
  const cur = i.kind === 'text' ? oneLine(consultLabel(i, i.cur)) : consultLabel(i, i.cur);
  return `[${i.id}] ${name} | 지금: ${cur} | ${i.locked ? '바꾸기: 못 함 (지금 잠김)' : `고를 수 있는 값: ${choices(i)}`}${i.scope ? ` | 저장: ${i.scope}` : ''}${help}`;
}

export interface ConsultSource {
  /** [지금 상태]: 호출 흐름 한 줄 요약과 마디들 */
  state: string;
  /** [지난 턴 실제]: 호출마다 숫자 한 줄 */
  last: string;
  /** [메뉴]: 메뉴마다 소개와 줄 이름 */
  menus: string;
  /** [설정 목록]: 펼친 메뉴와 그 줄 */
  opened: { menu: string; items: ConsultItem[] }[];
  /** 「바꾸자고 한 것」의 줄을 찾을 목록 (펼치지 않은 메뉴의 줄도) */
  all: ConsultItem[];
  pending: ConsultChange[];
  talk: ConsultTalk[];
}

/** 옛 지침에 남은 {max} (11-12 한도를 없앰): 그 문장째 뺀다 */
const dropMax = (text: string | undefined) => String(text ?? '').replace(/[^.\n(]*\{max\}[^.\n)]*\.?\s?/g, '');

export function consultPrompt(src: ConsultSource): { role: 'system' | 'user'; content: string }[] {
  const g = guideSections('Consult');
  const system = [g.COMMON, g.KNOWLEDGE, g.CHANGE, g.OUTPUT].map((t) => fillGuide(dropMax(t), {})).filter(Boolean).join('\n\n');
  const byId = new Map(src.all.map((i) => [i.id, i]));
  const pending = src.pending.map((c) => { const i = byId.get(c.id); return i ? `${c.id}=${i.kind === 'text' ? oneLine(consultLabel(i, c.value)) : consultLabel(i, c.value)} (${i.menu} · ${i.name}, 지금 ${i.kind === 'text' ? oneLine(consultLabel(i, i.cur)) : consultLabel(i, i.cur)})` : ''; }).filter(Boolean).join('\n');
  const talk = src.talk.map((l) => `${l.who === 'me' ? '[사용자]' : '[상담]'} ${l.text}`).join('\n');
  const list = src.opened.map((o) => `## ${o.menu}\n${o.items.map(itemLine).join('\n')}`).join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: `[지금 상태]\n${src.state}\n\n[지난 턴 실제]\n${src.last}\n\n[메뉴]\n${src.menus}\n\n[설정 목록]\n${list || '(펼친 메뉴 없음)'}\n\n[바꾸자고 한 것]\n${pending || '(없음)'}\n\n[이 창의 대화 — 마지막 줄이 사용자가 방금 한 말]\n${talk}` },
  ];
}

/** 응답 읽기. <say> 가 없으면 형식 오류 (다시 묻는다). <open> 만 있는 답(메뉴를 더 달라는 답)은 <say> 가 없어도 된다 */
export function parseConsult(raw: string): ConsultReply {
  const block = (name: string) => new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i').exec(raw)?.[1] ?? '';
  const say = block('say').trim();
  const open = block('open').split(/[,\n]/).map((s) => s.replace(/[「」\[\]]/g, '').trim()).filter(Boolean);
  if (!say && !open.length) throw new Error('<say> 블록이 없어요.');
  const set = block('set').split('\n').map((l) => /^\s*\[?([^\s=\[\]]+)\]?\s*=\s?(.*?)\s*$/.exec(l)).filter((m): m is RegExpExecArray => !!m).map((m) => ({ id: m[1], raw: m[2] }));
  return { say, set, apply: /<apply>\s*yes\s*<\/apply>/i.test(raw), open, go: block('go').replace(/[\[\]]/g, '').trim() };
}

const norm = (s: string) => s.replace(/[「」『』"'`()\s]/g, '').toLowerCase();
/** 모델이 적은 값을 그 설정이 받는 값으로. 고를 수 없으면 null (까닭은 consultWhy) */
export function consultValue(item: ConsultItem, raw: string): string | null {
  if (item.kind === 'info') return null;
  if (item.kind === 'text') {
    // 글 칸: 「\n」은 줄바꿈으로(한 줄 칸은 빈칸으로), 꺾쇠(< >)가 든 글과 상한을 넘는 글은 받지 않는다
    const t = raw === EMPTY ? '' : raw;
    const text = (item.multi ? t.replace(/\\n/g, '\n') : t.replace(/\\n|\r?\n/g, ' ')).trim();
    if (/[<>]/.test(text)) return null;
    if (item.max && text.length > item.max) return null;
    return text;
  }
  if (item.kind === 'num' || item.kind === 'step') {
    const t = raw.trim().replace(/(\d),(?=\d{3})/g, '$1');
    const n = item.zero && norm(t) === norm(item.zero) ? 0 : /^-?\d+/.test(t) && /^-?\d+\s*\D{0,3}$/.test(t) ? Number.parseInt(t, 10) : NaN;
    if (!Number.isInteger(n)) return null;
    if (item.kind === 'step') return (item.lo === undefined || n >= item.lo) && (item.hi === undefined || n <= item.hi) && (!item.stride || (n - Number(item.cur)) % item.stride === 0) ? String(n) : null;
    return n >= (item.lo ?? 0) && n <= (item.hi ?? 0) ? String(n) : null;
  }
  const want = norm(raw);
  const hit = (item.opts ?? []).find(([v, l]) => norm(onOff(l)) === want || norm(l) === want || v === raw.trim());
  return hit ? hit[0] : null;
}
/** 못 받는 까닭 (사용자에게 보이는 글) */
function consultWhy(item: ConsultItem, raw: string): string {
  if (item.kind === 'info') return '상담에서 바꿀 수 없는 설정';
  if (item.locked) return '지금은 잠겨 있는 설정';
  if (item.kind === 'text' && /[<>]/.test(raw)) return '글에 < > 는 쓸 수 없어요';
  if (item.kind === 'text') return `글이 너무 길어요 (최대 ${item.max}자)`;
  return `고를 수 없는 값 「${raw.slice(0, 40)}」`;
}

/** 바꾸자는 목록을 설정 목록과 대조한다: 통과한 것(ok)과 못 바꾸는 까닭(bad). 지금 값과 같은 것은 조용히 뺀다. 줄 수 한도는 없다 */
export function checkConsult(items: ConsultItem[], set: { id: string; raw: string }[]): { ok: ConsultChange[]; bad: string[] } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ok = new Map<string, ConsultChange>();
  const bad: string[] = [];
  for (const s of set) {
    const item = byId.get(s.id);
    if (!item) { bad.push(`${s.id}: 목록에 없는 설정`); continue; }
    const value = consultCan(item) ? consultValue(item, s.raw) : null;
    if (value === null) { bad.push(`${item.name}: ${consultWhy(item, s.raw)}`); continue; }
    ok.delete(s.id);
    if (value !== item.cur) ok.set(s.id, { id: s.id, value });
  }
  return { ok: [...ok.values()], bad };
}
