// 점검 탭 「전체 호출 흐름」 (11-07 사용자: 인물 설정 위의 호출 흐름 도식처럼, 지금 설정 기준으로 한 턴에 어떤 보조 호출이 몇 번 가는지 한 페이지에서).
// 자료는 각 기능의 설정(인물 기록·이미지·괴담톡·괴담넷·관전·위키·보고서). 모양은 인물 설정 도식(.pp-flow/.pp-fn)을 그대로 쓴다.
// 실제로 간 호출의 원문은 「호출 흐름」(trace.ts)에서 본다.
import type { ChatContext } from '../../host/risu';
import { basicSettings, getPrefs } from '../../core/settings';
import { featureModel } from '../../core/craft';
import { peopleSettings, type Stage } from '../../core/people/settings';
import { phoneSettings } from '../../core/phone';
import { viewSettings, VIEW_PRESETS } from '../../core/phoneView';
import { gnetSettings } from '../../core/gnet';
import { wikiSettings } from '../../core/wiki';
import { promptTokens } from '../../core/budget';
import { tokenizerName } from '../../core/tokenizer';
import type { LlmMessage } from '../../host/llm';
import { previewPeopleCalls } from '../../host/people';
import { previewAsset } from '../../host/asset';
import { previewGnetRefresh } from '../gnet';
import { previewPhoneRefresh, previewPhoneView } from '../phone';
import { previewWikiAuto } from '../wiki';
import { previewShopShelf } from '../shop';
import { previewMallShelf } from '../malls';
import { boardView, BOARD_NAME, BOARD_SITES } from '../../core/boards';
import { MALL_NAME, mallSettings, type MallSite } from '../../core/malls';
import { traceUi } from './trace';

// ── 토큰 미리 계산 (2026-11-07 사용자: 지금 설정값으로 들어갈 요청이 정해져 있으니 토큰을 계산해 보인다) ──
// 각 기능의 preview* 가 모델을 부르지 않고 요청만 조립한다. 채팅·설정이 바뀌면 다시 센다. 본편은 플러그인이 조립하지 않으니 마지막 「호출 기록」 실측
type TokMap = Record<string, number | null | undefined>;
const flowTok = { key: '', map: null as TokMap | null, pending: false, error: '' };
/** 요청을 바꿀 수 있는 것 전부(채팅 글·상태값·로어북·기기 설정과 지침)의 지문. 하나라도 바뀌면 다시 센다
 *  (11-09 사용자: 다른 데서 바꾸면 바로 반영돼야 한다 → 「다시 세기」 단추 없앰. 예전엔 글 수·상태값 길이만 봐서 같은 길이로 바뀐 값·지침·로어북·마지막 글 수정을 놓쳤다) */
function tokKey(ctx: ChatContext): string {
  let h = 0x811c9dc5;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    h = Math.imul(h ^ 0xff, 0x01000193);
  };
  feed(String(ctx.chatIndex));
  for (const m of ctx.chat.message ?? []) feed(`${m.role}\u0000${m.data ?? ''}`);
  feed(JSON.stringify(ctx.chat.scriptstate ?? {}));
  for (const e of ctx.char.globalLore ?? []) feed(`${e.comment ?? ''}\u0000${e.key ?? ''}\u0000${e.content ?? ''}`);
  feed(JSON.stringify(getPrefs()));
  return (h >>> 0).toString(36);
}
const count = (m: LlmMessage[] | null | undefined): number | null => (m ? promptTokens({ messages: m }) : null);

async function computeTokens(ctx: ChatContext): Promise<TokMap> {
  const map: TokMap = {};
  const safe = (name: string, f: () => number | null) => {
    try {
      map[name] = f();
    } catch {
      map[name] = null;
    }
  };
  const pp = await previewPeopleCalls(ctx).catch(() => ({ router: null, director: null, update: null }));
  map['인물 Router'] = count(pp.router);
  map['인물 Director'] = count(pp.director);
  map['인물 갱신'] = count(pp.update);
  safe('이미지 태그 보충', () => count(previewAsset(ctx.char.globalLore, ctx.chat)));
  safe('괴담톡 확인', () => count(previewPhoneRefresh(ctx)));
  for (const site of BOARD_SITES) safe(`${BOARD_NAME[site]} 새로고침`, () => count(previewGnetRefresh(ctx, site)));
  safe('괴담톡 관전', () => count(previewPhoneView(ctx)));
  safe('위키 자동 작성', () => {
    const w = previewWikiAuto(ctx);
    const a = count(w.article);
    const t = count(w.title);
    return a === null && t === null ? null : (a ?? 0) + (t ?? 0);
  });
  safe('상점', () => count(previewShopShelf(ctx)));
  for (const site of ['cos', 'bm'] as MallSite[]) safe(`${MALL_NAME[site]} 진열`, () => count(previewMallShelf(ctx, site)));
  return map;
}

/** 호출 흐름 페이지를 그리기 전에 부른다: 셈이 없거나 낡았으면 뒤에서 다시 세고 render 로 다시 그린다 */
export function ensureFlow(ctx: ChatContext, render: () => void): void {
  const key = tokKey(ctx);
  if (flowTok.pending || (flowTok.map && flowTok.key === key)) return;
  flowTok.pending = true;
  flowTok.error = '';
  void computeTokens(ctx)
    .then((map) => {
      flowTok.map = map;
      flowTok.key = key;
    })
    .catch((e) => {
      flowTok.error = e instanceof Error ? e.message : String(e);
    })
    .finally(() => {
      flowTok.pending = false;
      render();
    });
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

type Kind = 'aux' | 'main' | 'plain';
interface Node {
  name: string;
  /** 무엇을 하는지 */
  sub: string;
  kind: Kind;
  /** 지금 설정에서 턴마다 가는지 */
  on: boolean;
  model?: string;
  /** 호출 수 설명 */
  calls: string;
  /** 설정 페이지 */
  page?: string;
  /** 그 페이지 안에서 갈 줄: 'r:줄 이름' (2026-11-08 사용자: 「설정 →」은 그 기능을 켜고 끄는 줄로, 강조도 그 줄에만) */
  to?: string;
  /** 턴마다 확실히 가는 보조 호출 수 */
  sure: number;
  /** 조건부(사건 종료·검색·상한 초과)로 더 갈 수 있는 수 */
  maybe: number;
  /** 지금 조립한 요청 토큰 (null = 지금은 보낼 게 없음, undefined = 셈 없음) */
  tok?: number | null;
}

const id = (v: string | undefined) => (v ? `ID ${v.slice(0, 18)}` : '');
const mm = (m: string) => (m === 'main' ? '메인' : '보조');

export function flowNodes(ctx: ChatContext): { pre: Node[]; main: Node; post: Node[]; manual: Node[] } {
  const ss = ctx.chat.scriptstate;
  const basic = basicSettings(ctx.char.globalLore, ss);
  const pp = peopleSettings(ss);
  const ph = phoneSettings(ss);
  const vw = viewSettings(ss);
  const gn = gnetSettings(ss);
  const nw = wikiSettings(ss);
  const ppModel = (st: Stage) => id(pp.stageModelId[st]) || mm(pp.stageModel[st]);
  const routerOn = pp.on && pp.router === 'model';
  const directorOn = pp.on && (pp.director === 'scene' || pp.director === 'facts');
  const updateOn = pp.on && pp.when === 'turn';
  const tidyOn = pp.on && pp.tidy === 'separate';
  const pre: Node[] = [
    { name: '로어북 고름', sub: '다음 요청에 넣을 로어북 선택', kind: 'plain', on: true, calls: '호출 없음 (플러그인 코드 또는 Risu)', page: 'set:lore', to: 'r:로어북 보내기', sure: 0, maybe: 0 },
    { name: '인물 Router', sub: '장면 인물 고르기', kind: 'aux', on: routerOn, model: routerOn ? ppModel('router') : undefined, calls: routerOn ? '보조 1회' : pp.on ? '호출 없음 (코드가 고름)' : '호출 없음 (인물 기록 끔)', page: 'set:people', to: 'r:Router', sure: routerOn ? 1 : 0, maybe: 0 },
    { name: '인물 Director', sub: '이번 턴 연기 지시', kind: 'aux', on: directorOn, model: directorOn ? ppModel('director') : undefined, calls: directorOn ? (pp.directorSearch ? '1회 (자료 부족 땐 2회)' : '1회') : pp.director === 'note' ? '호출 없음 (갱신에 얹음)' : '호출 없음', page: 'set:people', to: 'r:Director', sure: directorOn ? 1 : 0, maybe: directorOn && pp.directorSearch ? 1 : 0 },
  ];
  const main: Node = { name: '본편', sub: 'Risu 가 응답 생성', kind: 'main', on: true, model: '메인', calls: '메인 1회', sure: 0, maybe: 0 };
  const assetOn = basic.assetOn && basic.assetModel === 'aux';
  const phoneModel = id(featureModel(ss, 'ph')) || mm(ph.model);
  const gnetModel = id(featureModel(ss, 'gn')) || mm(gn.model);
  const joint = ph.auto && gn.auto && phoneModel === gnetModel;
  const wikiOn = nw.auto === 'turn';
  const wikiTitle = wikiOn && nw.autoTitle === 'model';
  const post: Node[] = [
    { name: '인물 갱신', sub: '응답을 읽어 인물·세력·문서 기록', kind: 'aux', on: updateOn, model: updateOn ? ppModel('update') : undefined, calls: updateOn ? `1회${pp.tidy === 'same' ? ' (정리 얹음)' : ''}` : pp.on ? '수동 (「새 응답 읽기」 때만)' : '호출 없음 (인물 기록 끔)', page: 'set:people', to: 'r:자동 호출', sure: updateOn ? 1 : 0, maybe: 0 },
    { name: '인물 정리', sub: '상한 넘긴 기록 합치기', kind: 'aux', on: tidyOn, model: tidyOn ? ppModel('tidy') : undefined, calls: tidyOn ? '넘긴 인물마다 1회' : '호출 없음 (갱신에 얹음)', page: 'set:people', to: 'r:정리 방식', sure: 0, maybe: tidyOn ? 1 : 0 },
    { name: '이미지 태그 보충', sub: '응답에 빠진 인물 이미지 태그 채우기', kind: 'aux', on: assetOn, model: assetOn ? '보조' : undefined, calls: assetOn ? '1회' : basic.assetOn ? '호출 없음 (메인이 태그를 씀)' : '호출 없음 (이미지 끔)', page: 'set:image', to: 'r:출력 모델', sure: assetOn ? 1 : 0, maybe: 0 },
    { name: '괴담톡 확인', sub: '새 메시지·공지·초대', kind: 'aux', on: ph.auto, model: ph.auto ? phoneModel : undefined, calls: ph.auto ? (joint ? '1회 (괴담넷과 한 요청으로 합침)' : '1회') : '수동 (새로고침 때만)', page: 'set:phone', to: 'r:자동 호출', sure: ph.auto ? 1 : 0, maybe: 0 },
    { name: '괴담넷 새로고침', sub: '게시판 글·댓글·쪽지', kind: 'aux', on: gn.auto, model: gn.auto ? gnetModel : undefined, calls: gn.auto ? (joint ? '괴담톡과 합쳐 0회 추가' : '1회') : gn.autoOpen ? '창 열 때 1회' : '수동 (새로고침 때만)', page: 'set:gnet', to: 'r:자동 호출', sure: gn.auto && !joint ? 1 : 0, maybe: 0 },
    // 다른 게시판 셋·쇼핑몰 둘 (11-09 사용자: 괴담넷만 있고 통째로 빠져 있었다). 사이트마다 설정 변수가 따로라 그 사이트로 비춘 상태값으로 읽는다
    ...(['gal', 'wpf', 'sm'] as const).map((site): Node => {
      const sv = boardView(ctx.chat, site).scriptstate;
      const g = gnetSettings(sv);
      const on = g.enabled && g.auto;
      return { name: `${BOARD_NAME[site]} 새로고침`, sub: site === 'sm' ? '매물·댓글·쪽지' : '게시판 글·댓글·쪽지', kind: 'aux', on, model: on ? id(featureModel(sv, 'gn')) || mm(g.model) : undefined, calls: !g.enabled ? '호출 없음 (사이트 끔)' : g.auto ? '1회' : g.autoOpen ? '창 열 때 1회' : '수동 (새로고침 때만)', page: `set:${site}`, to: 'r:자동 호출', sure: on ? 1 : 0, maybe: 0 };
    }),
    ...(['cos', 'bm'] as MallSite[]).map((site): Node => {
      const m = mallSettings(ss, site);
      const on = m.on && m.auto === 'turn';
      return { name: `${MALL_NAME[site]} 진열`, sub: '진열대 새로 받기', kind: 'aux', on, model: on ? mm(m.model) : undefined, calls: !m.on ? '호출 없음 (소지품·가계부 끔)' : m.auto === 'turn' ? '1회' : m.auto === 'open' ? '창 열 때 1회' : '수동 (새로고침 때만)', page: `set:${site}`, to: 'r:자동 호출', sure: on ? 1 : 0, maybe: 0 };
    }),
    { name: '괴담톡 관전', sub: `${VIEW_PRESETS[vw.preset]} 이어 쓰기`, kind: 'aux', on: vw.auto === 'turn', model: vw.auto === 'turn' ? phoneModel : undefined, calls: vw.auto === 'turn' ? '1회' : vw.auto === 'open' ? '괴담톡 열 때 1회' : '수동 (「관전」 단추)', page: 'set:phone', to: 'r:자동 호출@보기 전용 방', sure: vw.auto === 'turn' ? 1 : 0, maybe: 0 },
    { name: '위키 자동 작성', sub: '이번 턴 소재로 문서 한 편', kind: 'aux', on: wikiOn, model: wikiOn ? id(featureModel(ss, 'nw')) || mm(nw.model) : undefined, calls: wikiOn ? (wikiTitle ? '2회 (제목 고르기 + 본문)' : '1회 (제목은 설정에 적은 것)') : nw.auto === 'open' ? '위키 열 때' : '수동', page: 'set:wiki', to: 'r:자동 호출', sure: wikiOn ? (wikiTitle ? 2 : 1) : 0, maybe: 0 },
  ];
  const manual: Node[] = [
    { name: '상점', sub: '진열대 받기·점원 대화', kind: 'aux', on: false, model: '보조', calls: '상점을 열 때·새로고침·말 걸 때', page: 'set:items', to: 'r:상점', sure: 0, maybe: 0 },
    { name: '게시판 글·댓글·쪽지', sub: '괴담넷·괴담갤·세정게·연어 마켓에서 내가 쓸 때', kind: 'aux', on: false, model: gnetModel, calls: '글 올리기·댓글·쪽지 보낼 때마다 1회', page: 'set:gnet', to: 'r:모델', sure: 0, maybe: 0 },
    { name: '우주 쇼핑몰 문의', sub: '운영자에게 질문', kind: 'aux', on: false, model: mm(mallSettings(ss, 'cos').model), calls: '질문을 보낼 때마다 1회', page: 'set:cos', to: 'r:모델', sure: 0, maybe: 0 },
    { name: '위키 수동', sub: '검색해서 없는 문서 쓰기', kind: 'aux', on: false, model: mm(nw.model), calls: '검색 결과가 없을 때 1회', page: 'set:wiki', to: 'r:모델', sure: 0, maybe: 0 },
    { name: '괴담톡 답장', sub: '내가 보낸 메시지에 답', kind: 'aux', on: false, model: phoneModel, calls: '보낼 때마다 1회', page: 'set:phone', to: 'r:모델', sure: 0, maybe: 0 },
    { name: '게임 대화·방문', sub: '필드에서 NPC 와 말하기·장소 방문', kind: 'aux', on: false, model: '보조/메인', calls: '필드에서만', sure: 0, maybe: 0 },
  ];
  const map = flowTok.map;
  if (map) for (const n of [...pre, ...post, ...manual]) if (n.name in map) n.tok = map[n.name];
  // 본편: Risu 가 조립하니 마지막 호출 기록의 실측
  const lastMain = [...(traceUi.turns ?? [])].reverse().find((t) => t.main?.totalTokens !== undefined)?.main;
  if (lastMain?.totalTokens !== undefined) {
    main.tok = lastMain.totalTokens;
    main.sub = `Risu 가 응답 생성 · 마지막 요청 실측 ${lastMain.totalTokens.toLocaleString('ko-KR')}토큰`;
  }
  return { pre, main, post, manual };
}

const tokLabel = (n: Node): string => {
  if (n.kind === 'plain') return '';
  if (n.tok === undefined) return flowTok.pending ? '세는 중…' : '';
  if (n.tok === null) return n.name === '상점' ? '지금 열 수 있는 상점 없음' : n.name.endsWith(' 진열') ? '쇼핑몰 꺼짐' : '지금은 보낼 것 없음';
  return `요청 ${tokenizerName() ? '' : '약 '}${n.tok.toLocaleString('ko-KR')}토큰`;
};
function nodeHtml(n: Node): string {
  const tl = tokLabel(n);
  return `<div class="pp-fn${n.on ? ' on' : ''} k-${n.kind}"><div class="pp-fn-name"><b>${esc(n.name)}</b>${n.model ? `<span class="pp-fn-chip">${esc(n.model)}</span>` : ''}<small>${esc(n.sub)}</small></div><span class="pp-fn-calls">${esc(n.calls)}${tl ? `<small class="pp-fn-tok">${esc(tl)}</small>` : ''}</span><div class="pp-fn-ctl"></div>${n.page ? `<button class="gx-mini pp-fn-go" data-action="ed-flow-go" data-value="${esc(n.page)}|${esc(n.to ?? '')}">설정 →</button>` : '<span></span>'}</div>`;
}

export function flowPage(ctx: ChatContext, head: (crumb: string, title: string, desc: string) => string): string {
  const { pre, main, post, manual } = flowNodes(ctx);
  const all = [...pre, main, ...post];
  const sure = all.reduce((n, x) => n + x.sure, 0);
  const maybe = all.reduce((n, x) => n + x.maybe, 0);
  const auxTok = [...pre, ...post].filter((x) => x.on && typeof x.tok === 'number').reduce((n, x) => n + (x.tok as number), 0);
  const tokNote = flowTok.pending
    ? ' 요청 토큰을 세는 중이에요…'
    : flowTok.error
      ? ` 토큰 셈 실패: ${esc(flowTok.error)}`
      : flowTok.map
        ? ` 켜진 보조 호출의 요청 합계 ${tokenizerName() ? '' : '약 '}<b>${auxTok.toLocaleString('ko-KR')}토큰</b> (지금 설정·채팅으로 조립, 응답 토큰은 제외).`
        : '';
  const arrow = '<i class="pp-fn-arrow" aria-hidden="true">↓</i>';
  const group = (title: string, note: string, nodes: Node[]) => `<section class="ps-group"><h3>${title} <small>${esc(note)}</small></h3><div class="ps-rows"><div class="pp-flow solo">${nodes.map(nodeHtml).join(arrow)}</div></div></section>`;
  return `<div class="gw-page gw-set">${head('', '호출 흐름', '지금 설정으로 본편 한 턴에 플러그인이 모델을 어떤 순서로 몇 번 부르는지. 켜진 칸만 진해요. 실제로 간 요청·응답 원문은 「호출 기록」에서 봐요.')}
    <div class="gx-settings gw-setbody">
    <section class="ps-group"><div class="ps-rows"><div class="pp-flow-head"><p>턴마다 보조 호출 <b>${sure}회</b>${maybe ? ` (조건에 따라 최대 <b>${sure + maybe}회</b>)` : ''} · 메인 <b>1회</b>. 형식이 틀린 답은 같은 모델에 한 번 더 물을 수 있어요.${tokNote}</p></div></div></section>
    ${group('본편 전', '유저 메시지 → 요청 조립', pre)}
    ${group('본편', '', [main])}
    ${group('본편 뒤', '응답이 들어온 뒤, 위에서 아래 순서로 (괴담톡·괴담넷·관전·위키는 인물 갱신이 끝난 뒤)', post)}
    ${group('턴과 무관', '누르거나 열 때만', manual)}
    </div></div>`;
}

const FLOW_BACK = '<button class="gx-mini" data-action="ed-node" data-value="manage:flow">호출 흐름 →</button>';

/** 기능 설정 페이지 맨 위 한 줄 (2026-11-07 사용자: 메뉴마다 도식은 중복, 「이 기능의 호출: …」 한 줄만). 그 페이지로 가는 칸의 호출 수만 모은다 */
export function callSummary(ctx: ChatContext, page: string): string {
  // 인물 페이지는 맨 위에 자기 도식이 있어 호출 칩은 겹친다. 「호출 흐름 →」 단추만 (2026-11-08 사용자: 어디는 있고 어디는 없다)
  if (page === 'people') return `<p class="gw-calls">${FLOW_BACK}</p>`;
  const { pre, post, manual } = flowNodes(ctx);
  const mine = [...pre, ...post, ...manual].filter((n) => n.page === `set:${page}`);
  if (!mine.length) return '';
  const auto = mine.filter((n) => n.on);
  const sure = auto.reduce((s, n) => s + n.sure, 0);
  const maybe = auto.reduce((s, n) => s + n.maybe, 0);
  const lead = auto.length ? `매 턴 보조 <b>${sure}회</b>${maybe ? ` (조건에 따라 최대 ${sure + maybe}회)` : ''}` : '매 턴 자동 호출 없음';
  const parts = mine.map((n) => `<span class="gw-call${n.on ? ' on' : ''}">${esc(n.name)}<small>${esc(n.calls)}</small></span>`).join('');
  return `<p class="gw-calls"><span class="gw-call-lead">이 기능의 호출 · ${lead}</span>${parts}${FLOW_BACK}</p>`;
}
