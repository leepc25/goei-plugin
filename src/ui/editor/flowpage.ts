// 관제 화면 「호출 흐름」 (설정 개편 5단계, 2026-11-12 사용자 확정 시안13).
// 한 턴에 플러그인이 모델을 부르는 순서대로, 호출 횟수·모델을 바꾸는 줄만 모은다. 요청 양만 바꾸는 줄은 각 메뉴에 두고 「설정 →」으로 간다.
// 흐름: 메인 요청 전 → 메인 응답 → 메인 응답 뒤(부르는 순서, src/body.ts) → 턴과 무관 → 생성 공통. 머리(예상·지난 턴)는 맨 위 한 번.
// 조작: 줄마다 그 설정의 원래 저장 동작을 그대로 부른다 (fl-do 「동작|값」 → src/ui/app.ts 가 그 동작의 처리기로 넘김). 값을 따로 저장하지 않는다.
// 같은 줄 목록(flowSections)을 AI 상담(src/ui/editor/consult.ts)이 바꿀 수 있는 설정 목록으로 쓴다.
import type { ChatContext } from '../../host/risu';
import { basicDefaults, basicSettings, basicVars, getPrefs } from '../../core/settings';
import { peopleSettings, ppValue } from '../../core/people/settings';
import { phoneSettings } from '../../core/phone';
import { viewSettings } from '../../core/phoneView';
import { gnetSettings } from '../../core/gnet';
import { wikiSettings } from '../../core/wiki';
import { shopSettings, shopOn } from '../../core/shop';
import { mallSettings, MALL_NAME } from '../../core/malls';
import { hsSettings, HS_NAME } from '../../core/homeshop';
import { deskSettings } from '../../core/bmdesk';
import { boardView, BOARD_NAME, BOARD_SITES } from '../../core/boards';
import { jointOn, JOINT_LABEL } from '../../core/netjoint';
import { advItem, advValue, genSettings } from '../../core/advanced';
import { invOn } from '../../core/items';
import { colConfig } from '../../core/world/statuscols';
import { isOnOff, switchHtml } from '../controls';
import { stepSizeText } from '../setrow';
import { flowNodes, flowTokState } from './flow';
import { traceUi } from './trace';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
type Opts = [string, string][];
const ONOFF: Opts = [['1', 'ON'], ['0', 'OFF']];
const MODEL2: Opts = [['main', '메인 모델'], ['aux', '보조 모델']];
/** Router·Director·정리의 모델 (src/ui/people.ts stageModel) */
const MODEL3: Opts = [['same', '갱신과 같게'], ['main', '메인 모델'], ['aux', '보조 모델']];
const fmt = (v: number) => v.toLocaleString('ko-KR');
export const FLOW_DO = 'fl-do';

/* ── 조작 하나: 그 설정의 지금 값·고를 수 있는 값·저장 동작 ── */
export interface Ctl {
  /** 상담이 가리키는 이름 (화면에는 안 보임) */
  id: string;
  /** 그 설정 줄 이름 (줄 이름과 같으면 '') */
  label: string;
  kind: 'pick' | 'step';
  cur: string;
  opts?: Opts;
  lo?: number;
  hi?: number;
  unit?: string;
  /** 0일 때 보이는 말 */
  zero?: string;
  /** 값을 v 로 바꾸는 동작들 「동작|값」 (그 설정 페이지의 단추가 보내는 것과 같다) */
  act(v: string): string[];
  /** 지금은 화면에 안 보이는 조작 (윗 조작 값에 따라) */
  hide?: boolean;
}
const pick = (id: string, label: string, cur: string, opts: Opts, to: (v: string) => string, hide = false): Ctl => ({ id, label, kind: 'pick', cur, opts, act: (v) => [to(v)], hide });
const sw = (id: string, label: string, on: boolean, to: (v: string) => string): Ctl => pick(id, label, on ? '1' : '0', ONOFF, to);

const doBtn = (cls: string, a: string, on: boolean, text: string, more = '') => `<button class="${cls}${on ? ' on' : ''}" data-action="${FLOW_DO}" data-value="${esc(a)}" aria-pressed="${on}"${more}>${text}</button>`;
/** 한 종류의 값 = 한 가지 조작: 켬·끔은 스위치, 고르기는 seg, 수는 「− N회 +」(.st-step) */
function ctlHtml(c: Ctl, aria: string): string {
  if (c.kind === 'step') {
    const n = Number(c.cur) || 0;
    const shown = n === 0 && c.zero ? c.zero : `${n}${c.unit ?? ''}`;
    const b = (to: number, sign: string, word: string, off: boolean) => `<button class="gx-step" data-action="${FLOW_DO}" data-value="${esc(c.act(String(to))[0] ?? '')}" ${off ? 'disabled' : ''} aria-label="${esc(aria)} ${word}">${sign}</button>`;
    return `<div class="st-step${stepSizeText(`${c.hi ?? n}${c.unit ?? ''}`, c.zero ?? '')}">${b(n - 1, '−', '줄이기', n <= (c.lo ?? 0))}<b>${esc(shown)}</b>${b(n + 1, '+', '늘리기', n >= (c.hi ?? n))}</div>`;
  }
  const opts = c.opts ?? [];
  if (isOnOff(opts)) {
    const on = c.cur === '1';
    return switchHtml({ action: FLOW_DO, value: c.act(on ? '0' : '1')[0], on, label: aria });
  }
  return `<div class="gx-segs gx-segs-sm">${opts.map(([v, l]) => doBtn('gx-seg', c.act(v)[0], c.cur === v, esc(l))).join('')}</div>`;
}
const go = (g: [string, string] | null) => (g ? `<button class="gx-mini fl-go" data-action="ed-flow-go" data-value="${esc(g[0])}|${esc(g[1])}">설정 →</button>` : '');

/* ── 지난 턴: 호출 기록(host/trace.ts) 마지막 턴에서 실제 이름표로 모은 요청 토큰 하나 ── */
function lastTurn() {
  // 턴 밖에서 누른 호출만 있는 묶음(상점 열기·AI 상담 등, phase manual)은 「지난 턴」이 아니다
  return [...(traceUi.turns ?? [])].reverse().find((t) => t.main || t.calls.some((c) => c.phase !== 'manual'));
}
function real(match: (label: string) => boolean): string {
  const t = lastTurn();
  if (!t) return '';
  const cs = t.calls.filter((c) => match(c.label));
  if (!cs.length) return '';
  const sent = cs.reduce((s, c) => s + (c.requestTokens ?? 0), 0);
  return cs.some((c) => !c.ok) ? `<em class="fl-fail" title="실패">${fmt(sent)}</em>` : fmt(sent);
}
const is = (...labels: string[]) => (l: string) => labels.includes(l);

/* ── 줄 ── */
export interface Row {
  name: string;
  sub?: boolean;
  /** 지금 설정에서 호출이 가는 줄(진하게) */
  on: boolean;
  /** 호출 줄인지 (예상·지난 턴 칸에 숫자나 「–」가 들어간다). 호출이 아닌 줄은 칸을 비운다 */
  call?: boolean;
  ctls: Ctl[];
  /** 격자 줄: 열 묶음(자동 호출·모델)마다 조작 하나, 없는 묶음은 null */
  grid?: (Ctl | null)[];
  help?: string;
  /** 호출 글: 몇 번, 언제 */
  calls?: string;
  /** 격자 줄 바로 아래 딸린 줄 */
  after?: Row[];
  est?: string;
  real?: string;
  /** 「설정 →」: [페이지, 갈 줄] */
  go: [string, string] | null;
}
interface Col { group: string; opts: string[] }
export interface FlowTable { title: string; rows: Row[]; cols?: Col[]; leads?: Row[] }
export interface FlowSection { title: string; note?: string; tables: FlowTable[] }

const shown = (r: Row) => r.ctls.filter((c) => !c.hide);
/* ── 줄 그리기: 한 가지 틀 (2026-11-12 사용자: 글과 조작이 뒤섞임, 오와 열이 안 맞음, 격자가 딸린 줄로 끊김) ──
 * PC 한 줄 = 이름 | 조작 | 호출 글(고정 칸) | 예상 | 지난 턴 | 설정 →.  설명은 늘 그 아래 줄, 조작이 시작하는 자리에서.
 * 조작 칸은 두 칸으로 나눈다: 조작마다 왼쪽 칸부터 채우고, 폭이 넓은 조작(넓이 어림 wide)은 한 줄을 다 쓴다. 이름표는 늘 그 칸의 맨 앞.
 * 격자 표는 격자 줄만 끊김 없이 잇는다. 딸린 줄(after)·격자 줄의 설명·앞 줄(leads)은 격자 아래에 보통 줄로 놓고, 딸린 줄 이름 앞에 그 격자 줄 이름을 붙인다. */
const WIDE_PX = 215;
const optPx = (l: string) => [...l].reduce((n, ch) => n + (ch === ' ' ? 3.6 : /[0-9,.()]/.test(ch) ? 8 : 12.4), 26);
/** 조작 하나의 넓이 어림 (이름표 + 조작). 반 칸(약 217px)에 안 들어가면 한 줄을 다 쓴다 */
function wide(c: Ctl): boolean {
  const label = c.label ? optPx(c.label) - 26 + 8 : 0;
  if (c.kind === 'step') return label + 206 > WIDE_PX;
  const opts = c.opts ?? [];
  if (isOnOff(opts)) return label + 64 > WIDE_PX;
  return label + opts.reduce((n, [, l]) => n + optPx(l), 8) > WIDE_PX;
}
const pairs = (r: Row) => shown(r).map((c) => `<span class="fl-pair${wide(c) ? ' wide' : ''}">${c.label ? `<span class="fl-l">${esc(c.label)}</span>` : ''}${ctlHtml(c, c.label ? `${r.name} ${c.label}` : r.name)}</span>`).join('');
/** 예상·지난 턴 칸: 숫자가 있을 때만 숫자. 없으면 비운다 (모든 줄 같은 규칙) */
const stat = (v: string | undefined) => `<div class="fl-st">${v || ''}</div>`;
/** 호출 글: 모든 줄에서 같은 자리(고정 칸). 설명 글과 달리 본문 색 */
const said = (r: Row) => `<div class="fl-said${r.on ? ' on' : ''}">${r.calls ? esc(r.calls) : ''}</div>`;
/** 격자 칸: 그 묶음의 조작에서 열 이름과 같은 선택지의 둥근 칸. 그 설정이 없는 칸은 비운다 */
function cells(r: Row, cols: Col[]): string {
  return cols.map((g, gi) => g.opts.map((o, i) => {
    const c = r.grid?.[gi];
    const opt = c?.opts?.find(([, l]) => l === o);
    const inner = c && opt ? doBtn('ck-m round', c.act(opt[0])[0], c.cur === opt[0], '', ` aria-label="${esc(`${r.name} ${g.group} ${o}`)}"`) : '';
    return `<span class="ck-cell${i === 0 ? ' ck-first' : ''}">${inner}</span>`;
  }).join('')).join('');
}

function pcRow(r: Row, cols: Col[] | null): string {
  const ctl = cols ? `${cells(r, cols)}<span></span>` : `<div class="fl-ctl">${pairs(r)}</div>`;
  const help = !cols && r.help ? `<small class="fl-help">${esc(r.help)}</small>` : '';
  return `<div class="fl-line fl-row${cols ? '' : ' fl-plain'}${help ? ' has-help' : ''}${r.on ? ' on' : ''}${r.sub ? ' sub' : ''}"><b class="fl-name">${esc(r.name)}</b>${ctl}${said(r)}${stat(r.est)}${stat(r.real)}${go(r.go) || '<span class="fl-go"></span>'}${help}</div>`;
}
function pcHead(cols: Col[]): string {
  const opts = cols.flatMap((g) => g.opts.map((o, i) => ({ o, first: i === 0 })));
  const tail = '<span></span><span></span><span></span><span></span><span></span>';
  return `<div class="fl-line fl-h1"><span></span>${cols.map((g) => `<b class="ck-first" style="grid-column: span ${g.opts.length}">${esc(g.group)}</b>`).join('')}${tail}</div>
    <div class="fl-line fl-h2"><span></span>${opts.map((c) => `<span class="${c.first ? 'ck-first' : ''}">${esc(c.o)}</span>`).join('')}${tail}</div>`;
}
/** 폰 판: 이름 · 호출 글 · [스위치 하나면 그 자리] · 설정 → / (예상 · 지난 턴) / 조작 줄 / 설명. 격자 줄은 조작을 한 줄에 나란히 (모델만 이름표) */
function card(r: Row, cols: Col[] | null): string {
  const list: [string, string][] = cols
    ? cols.flatMap((g, gi): [string, string][] => { const c = r.grid?.[gi]; return c ? [[g.group === '모델' ? g.group : '', ctlHtml(c, `${r.name} ${g.group}`)]] : []; })
    : shown(r).map((c): [string, string] => [c.label, ctlHtml(c, c.label ? `${r.name} ${c.label}` : r.name)]);
  const swOnly = list.length === 1 && /gx-switch/.test(list[0][1]);
  const tag = swOnly && list[0][0] ? `<span class="flc-tag">${esc(list[0][0])}</span>` : '';
  const ctl = ([l, c]: [string, string]) => `<div class="flc-c${l ? '' : ' nol'}">${l ? `<span class="flc-l">${esc(l)}</span>` : ''}${c}</div>`;
  const body = (swOnly ? '' : list.length > 1 || cols ? `<div class="flc-side">${list.map(ctl).join('')}</div>` : list.map(ctl).join('')) + (!cols && r.help ? `<small class="fl-help">${esc(r.help)}</small>` : '');
  const nums = r.est || r.real ? `<div class="flc-num">예상 <b>${r.est || '–'}</b> · 지난 턴 <b>${r.real || '–'}</b></div>` : '';
  const calls = r.calls ? `<small class="flc-calls">${esc(r.calls)}</small>` : '';
  return `<div class="flc${r.on ? ' on' : ''}${r.sub ? ' sub' : ''}"><div class="flc-top"><span class="flc-nm"><b class="fl-name">${esc(r.name)}</b>${tag}${calls}</span>${swOnly ? list[0][1] : ''}${go(r.go)}</div>${nums}${body}</div>`;
}
/** 격자 표의 줄 나누기: 격자 줄(끊김 없이) / 그 아래 보통 줄(앞 줄 + 딸린 줄, 이름 앞에 격자 줄 이름) / 격자 줄의 설명 */
function split(t: FlowTable): { grid: Row[]; below: Row[]; notes: [string, string][] } {
  if (!t.cols) return { grid: [], below: t.rows, notes: [] };
  const below = [...(t.leads ?? []), ...t.rows.flatMap((r) => (r.after ?? []).map((a): Row => ({ ...a, sub: false, name: `${r.name} ${a.name}` })))];
  return { grid: t.rows, below, notes: t.rows.filter((r) => r.help).map((r): [string, string] => [r.name, r.help as string]) };
}
function table(t: FlowTable): string {
  const cols = t.cols ?? null;
  const { grid, below, notes } = split(t);
  const note = notes.map(([n, h]) => `<p class="fl-gnote"><b>${esc(n)}</b>${esc(h)}</p>`).join('');
  return `<section class="ps-group fl${cols ? ` fl-grid fl-g${cols.reduce((n, g) => n + g.opts.length, 0)}` : ''}">${t.title ? `<h3>${esc(t.title)}</h3>` : ''}
    <div class="ps-rows fl-pc">${cols ? `<div class="fl-gbox">${pcHead(cols)}${grid.map((r) => pcRow(r, cols)).join('')}${note}</div>` : ''}${below.map((r) => pcRow(r, null)).join('')}</div>
    <div class="ps-rows fl-ph">${cols ? grid.map((r) => card(r, cols)).join('') + note : ''}${below.map((r) => card(r, null)).join('')}</div></section>`;
}

/* ── 어느 값을 보나 ──
 * 시작 뒤: 이 채팅 값 하나.
 * 시작 전(새 채팅 기본 설정): 메뉴 페이지와 같은 곳. 기능 페이지(인물·괴담톡·인터넷·위키·망상홈쇼핑 개별 값·1:1 상담)의 값은 이 채팅에,
 * 메인 설정·상점 격자·생성 공통의 값은 새 채팅 기본값에 적힌다. 호출 수는 새 채팅이 받을 값(기본값 위에 이 채팅 값, src/ui/app.ts 출발)으로 센다. */
export interface FlowView { feat: Record<string, unknown>; scope: Record<string, unknown>; ctx: ChatContext }
export function flowView(ctx: ChatContext, started: boolean): FlowView {
  const feat = (ctx.chat.scriptstate ?? {}) as Record<string, unknown>;
  if (started) return { feat, scope: feat, ctx };
  const scope = { ...basicVars(basicDefaults(ctx.char.globalLore)), ...(getPrefs().vars ?? {}) } as Record<string, unknown>;
  return { feat, scope, ctx: { ...ctx, chat: { ...ctx.chat, scriptstate: { ...scope, ...feat } as typeof ctx.chat.scriptstate } } };
}

/** 관제 화면의 모든 줄 (화면과 AI 상담이 같이 쓴다) */
export function flowSections(real0: ChatContext, started: boolean): { sections: FlowSection[]; nodes: ReturnType<typeof flowNodes> } {
  const view = flowView(real0, started);
  const ctx = view.ctx;
  const fs = view.feat as never as ChatContext['chat']['scriptstate'];
  const ds = view.scope as never as ChatContext['chat']['scriptstate'];
  const ps = ctx.chat.scriptstate;
  const nodes = flowNodes(ctx);
  const { pre, post, manual, main } = nodes;
  const all = [...pre, ...post];
  const node = (name: string) => [...all, ...manual].find((x) => x.name === name);
  /** 호출 글: 호출 수를 세는 곳(flow.ts flowNodes)의 글 */
  const same = (t: string) => t.replace(/^(창|괴담톡) 열 때 1회$/, '창을 열 때 1회').replace(/^위키 열 때$/, '창을 열 때 1회');
  const calls = (name: string) => same(node(name)?.calls ?? '');
  /** 예상: 턴마다 도는 줄이고 미리 센 토큰이 있으면 그 숫자 */
  const est = (name: string): string => {
    const x = node(name);
    return x && x.on && typeof x.tok === 'number' ? fmt(x.tok) : '';
  };
  const pp = peopleSettings(fs);
  const pv = (k: string) => ppValue(fs, k);
  const ph = phoneSettings(fs);
  const vw = viewSettings(fs);
  const nw = wikiSettings(fs);
  const basic = basicSettings(ctx.char.globalLore, ds);
  const shop = shopSettings(ds);
  const hs = hsSettings(ds);
  const hsF = hsSettings(fs);
  const desk = deskSettings(fs);
  const gen = genSettings(ds);
  const walletUsed = colConfig(ds).wallet !== 'off';
  const boards = BOARD_SITES.map((site) => ({ site, g: gnetSettings(boardView(real0.chat, site).scriptstate) }));
  const P = (k: string) => (v: string) => `pp-set|${k}=${v}`;

  /* ── ① 메인 요청 전: 인물 (사용이 꺼지면 Router·Director·갱신기·정리가 모두 멈춘다) ── */
  const routerOn = pp.on && pp.router === 'model';
  const dirOn = pp.on && (pp.director === 'scene' || pp.director === 'facts');
  const updOn = pp.on && pp.when === 'turn';
  const tidySep = pp.tidy === 'separate';
  const peoplePre: Row[] = [
    { name: '사용', on: pp.on, ctls: [sw('pp.on', '', pp.on, P('on'))], help: '응답을 읽어 인물·세력·문서 기록을 쓰는 기능이에요. 끄면 Router·Director와 메인 응답 뒤의 갱신기·정리를 모두 부르지 않아요.', go: ['set:people', 'r:사용'] },
    { name: 'Router', on: routerOn, call: true, ctls: [pick('pp.router', '', pp.router, [['code', '코드가 고름'], ['model', '모델이 고름']], P('router')), pick('pp.model_router', '모델', pv('model_router'), MODEL3, P('model_router'), !routerOn)], calls: routerOn ? '1회' : pp.on ? '호출 없음' : '호출 없음 (인물 기록 끔)', help: '장면에 나오는 인물을 고르는 단계예요. 모델이 고르면 호출이 1회 늘어요.', est: est('인물 Router'), real: real(is('라우터')), go: ['set:people', 'r:Router'] },
    { name: 'Director', on: dirOn, call: true, ctls: [pick('pp.director', '', pp.director, [['off', '사용 안 함'], ['note', '메모형(뒤)'], ['facts', '사실형(앞)'], ['scene', '연출형(앞)']], P('director')), pick('pp.model_director', '모델', pv('model_director'), MODEL3, P('model_director'), !dirOn)], calls: calls('인물 Director'), help: '이번 턴에 인물이 어떻게 연기할지 지시를 만드는 단계예요. 메모형은 갱신 호출에 얹고(호출 없음), 사실형·연출형은 메인 요청 전에 따로 불러요(1회).', est: est('인물 Director'), real: real(is('디렉터')), go: ['set:people', 'r:Director'] },
    ...(dirOn ? [
      { name: '재사용', sub: true, on: pp.directorReuse, ctls: [sw('pp.director_reuse', '', pp.directorReuse, P('director_reuse'))], help: '장면이 그대로면 지난 지시를 다시 써요 (호출 없음).', go: ['set:people', 'r:재사용'] },
      { name: '2차 검색', sub: true, on: pp.directorSearch, ctls: [sw('pp.director_search', '', pp.directorSearch, P('director_search'))], help: '자료가 모자라면 Director가 채팅·로어북·위키 검색을 요청하고, 코드가 찾아 한 번 더 불러요 (그 턴만 1회 추가)', go: ['set:people', 'r:2차 검색'] },
    ] as Row[] : []),
  ];

  /* ── ② 메인 응답 ── */
  const mainTok = lastTurn()?.main?.totalTokens;
  const mainRow: Row = { name: '메인 모델', on: true, call: true, ctls: [], calls: main.calls, est: '', real: mainTok ? fmt(mainTok) : '', go: null };

  /* ── ③ 메인 응답 뒤: 부르는 순서 (src/body.ts) 갱신기 → 이미지 태그 → 괴담톡·게시판 → 관전 → 위키 → 쇼핑몰 ── */
  const capOpts: Opts = [['5000', '5,000'], ['10000', '10,000'], ['20000', '20,000']];
  const cap = String(pp.personCap);
  const peoplePost: Row[] = [
    { name: '갱신기', on: updOn, call: true, ctls: [pick('pp.when', '자동 호출', pp.when, [['manual', '수동'], ['turn', '매 턴']], P('when')), pick('pp.model', '모델', pp.stageModel.update, MODEL2, P('model'))], calls: calls('인물 갱신').replace(' (정리 얹음)', ''), help: '응답을 읽고 기록을 쓰는 단계예요.', est: est('인물 갱신'), real: real(is('갱신기')), go: ['set:people', 'r:자동 호출'] },
    { name: '상점 판단', sub: true, on: shopOn(ps), ctls: [pick('shop.judge', '', shop.judge, [['auto', '자동'], ['main', '메인 모델'], ['updater', '갱신기']], (v) => `set-shop-judge|${v}`)], calls: calls('상점 판단'), help: '지금 장면에 상점이 있는지 누가 볼지예요. 어느 쪽이어도 호출은 늘지 않아요.', go: ['set:shop', 'r:판단'] },
    { name: '정리', on: pp.on && tidySep, call: true, ctls: [pick('pp.tidy', '정리 방식', pp.tidy, [['same', '같은 호출에 얹기'], ['separate', '별도 호출']], P('tidy')), pick('pp.model_tidy', '모델', pv('model_tidy'), MODEL3, P('model_tidy'), !tidySep)], calls: pp.on && tidySep ? '넘긴 인물마다 1회' : '호출 없음', help: '저장 상한을 넘긴 인물의 기록을 합쳐요. 별도 호출이면 넘긴 인물마다 호출이 1회 늘어요.', est: '', real: real(is('정리')), go: ['set:people', 'r:정리 방식'] },
    { name: '인물당 저장 상한', sub: true, on: pp.on, ctls: [pick('pp.person_cap', '', cap, capOpts.some(([v]) => v === cap) ? capOpts : [...capOpts, [cap, fmt(pp.personCap)]], P('person_cap'))], help: '한 인물의 기록 글자 수예요. 넘으면 정리로 합쳐요.', go: ['set:people', 'r:인물당 저장 상한'] },
  ];
  const imgOn = basic.assetOn && basic.assetModel === 'aux';
  const image: Row = { name: '이미지 태그', on: imgOn, call: true, ctls: [sw('img.on', '', basic.assetOn, (v) => `set-asset|${v}`), pick('img.model', '모델', basic.assetModel, MODEL2, (v) => `set-asset-model|${v}`)], calls: imgOn ? '1회' : basic.assetOn ? '호출 없음' : '호출 없음 (이미지 끔)', help: '본문에 등장하는 캐릭터의 등록 이미지를 표시하도록 이미지 태그를 적어요. 메인 모델은 본문과 함께 적고, 보조 모델은 응답이 끝난 뒤 한 번 더 불러 태그를 보충해요.', est: est('이미지 태그 보충'), real: real(is('이미지 태그 보충')), go: ['set:image', 'r:사용'] };

  const joint: Row = { name: '한 번에 요청', on: jointOn(fs), ctls: [sw('net.joint', '', jointOn(fs), (v) => `fam-set|b:gn:joint=${v}`)], help: '켜면 자동 호출이 「매 턴」이고 모델이 같은 게시판과 괴담톡을 한 요청으로 묶어요.', go: ['set:net', 'r:한 번에 요청'] };
  const COLS: Col[] = [{ group: '자동 호출', opts: ['수동', '창을 열 때', '매 턴'] }, { group: '모델', opts: ['메인', '보조'] }];
  /** 격자의 조작: 열 이름이 곧 선택지 이름. vals = [수동, 창을 열 때, 매 턴] 또는 [메인, 보조] 에 그 설정이 받는 값 */
  const auto3 = (id: string, cur: string, vals: [string, string, string], to: (v: string) => string): Ctl => pick(id, '자동 호출', cur, COLS[0].opts.map((o, i) => [vals[i], o]), to);
  const model2 = (id: string, cur: string, vals: [string, string], to: (v: string) => string): Ctl => pick(id, '모델', cur, COLS[1].opts.map((o, i) => [vals[i], o]), to);
  /** 묶음 호출(「괴담톡+괴담넷 통합」, src/host/joint.ts)은 이름표의 첫 기능 줄에 센다 */
  const jointFirst = (name: string) => (l: string) => l.endsWith(' 통합') && l.split(' ')[0].split('+')[0] === name;
  const wikiOn = nw.auto === 'turn';
  const grid: Row[] = [
    { name: '괴담톡', on: ph.auto, call: true, ctls: [], grid: [auto3('ph.auto', ph.auto ? '1' : ph.autoOpen ? 'open' : '0', ['0', 'open', '1'], (v) => `ph-cfg|auto=${v}`), model2('ph.model', ph.model === 'main' ? 'main' : 'aux', ['main', 'aux'], (v) => `ph-cfg|model=${v}`)], calls: calls('괴담톡 확인'), est: est('괴담톡 확인'), real: real((l) => l === '괴담톡 확인' || l === '괴담톡 답장' || jointFirst(JOINT_LABEL.phone)(l)), go: ['set:phone', 'r:자동 호출'],
      after: [{ name: '선톡·초대', on: ph.auto && (ph.incoming || ph.invites), ctls: [sw('ph.incoming', '선톡 받기', ph.incoming, (v) => `ph-cfg|incoming=${v}`), sw('ph.group_invites', '단톡방 초대 받기', ph.invites, (v) => `ph-cfg|group_invites=${v}`)], help: '인물이 먼저 보내는 메시지와 단톡방 초대를 받을지예요. 둘 다 끄면, 확인할 방이 없는 턴에는 괴담톡 호출을 건너뛰어요.', go: ['set:phone', 'r:선톡 받기'] }] },
    ...boards.map(({ site, g }): Row => ({ name: BOARD_NAME[site], on: g.enabled && g.auto, call: true, ctls: [], grid: [auto3(`board.${site}.auto`, g.auto ? '0' : g.autoOpen ? 'open' : '1', ['1', 'open', '0'], (v) => `fam-set|b:${site}:lazy=${v}`), model2(`board.${site}.model`, g.model === 'main' ? '1' : '2', ['1', '2'], (v) => `fam-set|b:${site}:mode=${v}`)], calls: calls(`${BOARD_NAME[site]} 새로고침`), est: est(`${BOARD_NAME[site]} 새로고침`), real: real((l) => l === BOARD_NAME[site] || jointFirst(BOARD_NAME[site])(l)), go: ['set:net', 'r:자동 호출'] })),
    /** 관전은 모델 설정이 따로 없다 (괴담톡 모델을 씀, flow.ts 관전 줄) */
    { name: '관전', on: vw.auto === 'turn', call: true, ctls: [], grid: [auto3('view.auto', vw.auto, ['manual', 'open', 'turn'], (v) => `ph-cfg|view_auto=${v}`), null], calls: calls('관전'), help: '메인 응답에 안 나온 대화나 속마음을 보기 전용 방으로 만들어요.', est: est('관전'), real: real(is('관전')), go: ['set:phone', 'r:자동 호출@보기 전용 방'] },
    { name: '위키', on: wikiOn, call: true, ctls: [], grid: [auto3('wiki.auto', nw.auto, ['0', 'open', 'turn'], (v) => `wiki-auto|${v}`), model2('wiki.model', nw.model === 'main' ? 'main' : 'aux', ['main', 'aux'], (v) => `wiki-model|${v}`)], calls: calls('위키 자동 작성'), est: est('위키 자동 작성'), real: real(is('위키 글', '위키 제목')), go: ['set:wiki', 'r:자동 호출'],
      after: [{ name: '자동 작성 제목', on: wikiOn && nw.autoTitle === 'model', ctls: [pick('wiki.auto_title', '', nw.autoTitle, [['model', '모델이 고름'], ['input', '직접 입력']], (v) => `wiki-auto_title|${v}`)], help: '저절로 쓰는 문서의 제목을 정하는 방법이에요. 「모델이 고름」이면 명부 항목 가운데 이번 이야기에 맞는 것을 써요. 호출이 1회 늘어요.', go: ['set:wiki', 'r:자동 작성 제목'] }] },
  ];
  const mallLeads: Row[] = [
    { name: '가계부', on: walletUsed, ctls: [sw('wallet.on', '', walletUsed, (v) => `set-wallet-on|${v}`)], go: ['set:items', 'r:사용@가계부'] },
    { name: '소지품', on: invOn(ds), ctls: [sw('items.on', '', invOn(ds), (v) => `set-inv-on|${v}`)], help: '가계부나 소지품을 끄면 쇼핑몰과 상점을 부르지 않아요.', go: ['set:items', 'r:사용'] },
  ];
  const malls: Row[] = (['cos', 'bm'] as const).map((site): Row => {
    const m = mallSettings(ds, site);
    const n = node(`${MALL_NAME[site]} 진열`);
    return { name: MALL_NAME[site], on: !!n?.on, call: true, ctls: [], grid: [auto3(`mall.${site}.auto`, m.auto, ['manual', 'open', 'turn'], (v) => `fam-set|s:${site}:auto=${v}`), model2(`mall.${site}.model`, m.model === 'main' ? 'main' : 'aux', ['main', 'aux'], (v) => `fam-set|s:${site}:model=${v}`)], calls: same(n?.calls ?? ''), est: est(`${MALL_NAME[site]} 진열`), real: real((l) => l.startsWith(`${MALL_NAME[site]} `) && !l.includes('1:1 상담')), go: ['set:shop', 'r:자동 호출'] };
  });

  /* ── ④ 턴과 무관: 누르거나 열 때만 ── */
  const retry = Math.max(HS_RETRY[0], Math.min(HS_RETRY[1], Math.round(Number(fs?.['$hs_retry'] ?? 1)) || 0));
  const off: Row[] = [
    { name: '상점', on: shopOn(ps), call: true, ctls: [sw('shop.on', '', shop.on, (v) => `set-shop-on|${v}`), pick('shop.model', '모델', shop.model, MODEL2, (v) => `set-shop-model|${v}`)], calls: '열 때·새로고침·말 걸 때마다 1회', est: '', real: real(is('상점 진열', '상점 대화')), go: ['set:shop', 'r:사용'] },
    { name: HS_NAME, on: hs.on, call: true, ctls: [sw('hs.on', '', hs.on, (v) => `fam-set|s:hs:on=${v}`), pick('hs.auto', '자동 호출', hs.auto, [['manual', '수동'], ['open', '창을 열 때']], (v) => `fam-set|s:hs:auto=${v}`), pick('hs.model', '모델', hs.shop.model, MODEL2, (v) => `fam-set|s:hs:model=${v}`)], calls: hs.on ? (hs.auto === 'open' ? '창을 열 때 1회' : '수동 (새로고침 때만)') : '호출 없음', est: '', real: real((l) => l.startsWith(`${HS_NAME} `)), go: ['set:shop', 'r:사용'] }, // 망상홈쇼핑의 사용·자동 호출·모델은 상점 페이지 격자에 있다
    { name: '채팅 보내기', sub: true, on: hs.on && hsF.say, ctls: [sw('hs.say', '', hsF.say, (v) => `hs-cfg|say=${v}`)], calls: '보낼 때마다 1회', go: ['set:hs', 'r:채팅 보내기'] },
    /** 자동 다시 연결은 그 페이지의 단추처럼 한 칸씩만 움직인다 (hs-retry ±) */
    { name: '자동 다시 연결', sub: true, on: hs.on && retry > 0, ctls: [{ id: 'hs.retry', label: '', kind: 'step', cur: String(retry), lo: HS_RETRY[0], hi: HS_RETRY[1], unit: '회', act: (v) => { const d = Number(v) - retry; return Array.from({ length: Math.abs(d) }, () => `hs-retry|${d > 0 ? '+' : '-'}`); } }], help: `편성을 받지 못하면 「신호 없음」 화면에서 스스로 다시 연결하는 횟수예요(${HS_RETRY[0]}~${HS_RETRY[1]}). 1회마다 호출이 1회 늘어요.`, go: ['set:hs', 'r:자동 다시 연결'] },
    { name: '포인트몰 1:1 상담', on: desk.on && mallSettings(ps, 'bm').on, call: true, ctls: [sw('desk.on', '', desk.on, (v) => `ms-cfg|bm:desk_on=${v}`), sw('desk.again', '지난 상담사 다시 만나기', desk.again, (v) => `ms-cfg|bm:desk_again=${v}`)], calls: calls('포인트몰 1:1 상담'), help: '켜면 가끔(4번에 1번꼴) 전에 만났던 상담사가 다시 연결돼요. 그때는 연결 호출이 없어요.', est: '', real: real((l) => l.includes('1:1 상담')), go: ['set:bm', 'r:사용@1:1 상담'] },
  ];

  /* ── ⑤ 생성 공통: 다시 묻기·다시 보기 (범위와 선택지는 정의표 core/advanced.ts) ── */
  const advStep = (key: string): Ctl => {
    const it = advItem('gen', key);
    return { id: `gen.${key}`, label: '', kind: 'step', cur: advValue(ds as never, 'gen', key), lo: it?.min ?? 0, hi: it?.max ?? 0, unit: it?.unit ?? '', zero: it?.zero, act: (v) => [`adv-set|gen:${key}=${v}`] };
  };
  const retryModel = advItem('gen', 'retry_model');
  const reit = Number(advValue(ds as never, 'gen', 'reiterate')) || 0;
  const common: Row[] = [
    { name: '형식 오류 재시도', on: gen.retries > 0, ctls: [advStep('retries')], help: '모델의 답이 형식에 맞지 않을 때 다시 묻는 횟수예요. 1회마다 호출이 1회 늘어요.', go: ['set:adv', 'r:형식 오류 재시도'] },
    { name: '재시도 모델', on: gen.retries > 0, ctls: [pick('gen.retry_model', '', advValue(ds as never, 'gen', 'retry_model'), (retryModel?.opts ?? []) as Opts, (v) => `adv-set|gen:retry_model=${v}`)], help: '다시 물을 때 부를 모델이에요.', go: ['set:adv', 'r:재시도 모델'] },
    { name: '다시 보기', on: reit > 0, ctls: [advStep('reiterate')], help: '첫 응답 뒤 모델에게 지침과 형식을 지켰는지 다시 보게 하는 횟수예요. 1회마다 호출이 1회 늘어요.', go: ['set:adv', 'r:다시 보기'] },
  ];

  const sections: FlowSection[] = [
    { title: '메인 요청 전', tables: [{ title: '인물', rows: peoplePre }] },
    { title: '메인 응답', tables: [{ title: '', rows: [mainRow] }] },
    { title: '메인 응답 뒤', tables: [{ title: '인물', rows: peoplePost }, { title: '캐릭터 이미지', rows: [image] }, { title: '괴담톡 · 인터넷 · 위키', rows: grid, cols: COLS, leads: [joint] }, { title: '쇼핑몰', rows: malls, cols: COLS, leads: mallLeads }] },
    { title: '턴과 무관', note: '누르거나 열 때만', tables: [{ title: '', rows: off }] },
    { title: '생성 공통', tables: [{ title: '', rows: common }] },
  ];
  return { sections, nodes };
}
/** 자동 다시 연결의 범위 (src/ui/homeshop.ts hs-retry 가 받는 범위) */
const HS_RETRY: [number, number] = [0, 3];

export function flowPage(ctx: ChatContext, headFn: (crumb: string, title: string, desc: string) => string, started: boolean): string {
  const { sections, nodes } = flowSections(ctx, started);
  const { pre, main, post } = nodes;
  const all = [...pre, ...post];
  /* ── 맨 위 띠: 머리(예상·지난 턴)와 합계. 스크롤해도 붙어 있다 ── */
  const sure = [...all, main].reduce((n, x) => n + x.sure, 0);
  const maybe = [...all, main].reduce((n, x) => n + x.maybe, 0);
  const auxTok = all.filter((x) => x.on && typeof x.tok === 'number').reduce((s, x) => s + (x.tok as number), 0);
  const tok = flowTokState();
  const estTok = tok.ready ? fmt(auxTok) : tok.pending ? '세는 중…' : tok.error ? `<span title="${esc(`토큰 셈 실패: ${tok.error}`)}">–</span>` : '–';
  const t = lastTurn();
  const rsent = (t ? t.calls.filter((c) => c.phase !== 'manual') : []).reduce((s, c) => s + (c.requestTokens ?? 0), 0);
  const bar = `<div class="fl-line fl-bar"><p>턴마다 보조 호출 <b>${sure}회</b>${maybe ? ` (조건에 따라 최대 <b>${sure + maybe}회</b>)` : ''} · 메인 <b>1회</b></p><div><span>예상 토큰</span><b>${estTok}</b></div><div><span>지난 턴 토큰</span><b>${t ? fmt(rsent) : '–'}</b></div><i></i></div>`;
  const body = sections.map((s) => `<h2 class="fam-h">${esc(s.title)}${s.note ? ` <small>${esc(s.note)}</small>` : ''}</h2>${s.tables.map(table).join('')}`).join('');
  return `<div class="gw-page gw-set">${headFn('', '호출 흐름', '한 턴에 플러그인이 모델을 부르는 순서예요. 호출 수와 모델을 바꾸는 값만 모았고, 여기서 바꾼 값은 각 메뉴의 설정과 같은 값이에요.')}
    <div class="gx-settings gw-setbody fl-page">${bar}${body}</div></div>`;
}
