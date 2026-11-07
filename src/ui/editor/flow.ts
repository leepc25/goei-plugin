// 점검 탭 「전체 호출 흐름」 (11-07 사용자: 인물 설정 위의 호출 흐름 도식처럼, 지금 설정 기준으로 한 턴에 어떤 보조 호출이 몇 번 가는지 한 페이지에서).
// 자료는 각 기능의 설정(인물 기록·이미지·괴담톡·괴담넷·관전·위키·보고서). 모양은 인물 설정 도식(.pp-flow/.pp-fn)을 그대로 쓴다.
// 실제로 간 호출의 원문은 「호출 흐름」(trace.ts)에서 본다.
import type { ChatContext } from '../../host/risu';
import { basicSettings } from '../../core/settings';
import { featureModel } from '../../core/craft';
import { peopleSettings, type Stage } from '../../core/people/settings';
import { phoneSettings } from '../../core/phone';
import { viewSettings, VIEW_PRESETS } from '../../core/phoneView';
import { gnetSettings } from '../../core/gnet';
import { wikiSettings } from '../../core/wiki';
import { journalSettings } from '../../core/journal';

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
  /** 턴마다 확실히 가는 보조 호출 수 */
  sure: number;
  /** 조건부(사건 종료·검색·상한 초과)로 더 갈 수 있는 수 */
  maybe: number;
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
  const jr = journalSettings(ss);
  const ppModel = (st: Stage) => id(pp.stageModelId[st]) || mm(pp.stageModel[st]);
  const routerOn = pp.on && pp.router === 'model';
  const directorOn = pp.on && (pp.director === 'scene' || pp.director === 'facts');
  const updateOn = pp.on && pp.when === 'turn';
  const tidyOn = pp.on && pp.tidy === 'separate';
  const pre: Node[] = [
    { name: '로어북 고름', sub: '다음 요청에 넣을 로어북 선택', kind: 'plain', on: true, calls: '호출 없음 (플러그인 코드 또는 Risu)', page: 'set:lore', sure: 0, maybe: 0 },
    { name: '인물 Router', sub: '장면 인물 고르기', kind: 'aux', on: routerOn, model: routerOn ? ppModel('router') : undefined, calls: routerOn ? '보조 1회' : pp.on ? '호출 없음 (코드가 고름)' : '호출 없음 (인물 기록 끔)', page: 'set:people', sure: routerOn ? 1 : 0, maybe: 0 },
    { name: '인물 Director', sub: '이번 턴 연기 지시', kind: 'aux', on: directorOn, model: directorOn ? ppModel('director') : undefined, calls: directorOn ? (pp.directorSearch ? '1회 (자료 부족 땐 2회)' : '1회') : pp.director === 'note' ? '호출 없음 (갱신에 얹음)' : '호출 없음', page: 'set:people', sure: directorOn ? 1 : 0, maybe: directorOn && pp.directorSearch ? 1 : 0 },
  ];
  const main: Node = { name: '본편', sub: 'Risu 가 응답 생성', kind: 'main', on: true, model: '메인', calls: '메인 1회', sure: 0, maybe: 0 };
  const assetOn = basic.assetOn && basic.assetModel === 'aux';
  const phoneModel = id(featureModel(ss, 'ph')) || mm(ph.model);
  const gnetModel = id(featureModel(ss, 'gn')) || mm(gn.model);
  const joint = ph.auto && gn.auto && phoneModel === gnetModel;
  const wikiOn = nw.auto === 'turn';
  const wikiTitle = wikiOn && nw.autoTitle === 'model';
  const post: Node[] = [
    { name: '인물 갱신', sub: '응답을 읽어 인물·세력·문서 기록', kind: 'aux', on: updateOn, model: updateOn ? ppModel('update') : undefined, calls: updateOn ? `1회${pp.tidy === 'same' ? ' (정리 얹음)' : ''}` : pp.on ? '수동 (「새 응답 읽기」 때만)' : '호출 없음 (인물 기록 끔)', page: 'set:people', sure: updateOn ? 1 : 0, maybe: 0 },
    { name: '인물 정리', sub: '상한 넘긴 기록 합치기', kind: 'aux', on: tidyOn, model: tidyOn ? ppModel('tidy') : undefined, calls: tidyOn ? '넘긴 인물마다 1회' : '호출 없음 (갱신에 얹음)', page: 'set:people', sure: 0, maybe: tidyOn ? 1 : 0 },
    { name: '이미지 태그 보충', sub: '응답에 빠진 인물 이미지 태그 채우기', kind: 'aux', on: assetOn, model: assetOn ? '보조' : undefined, calls: assetOn ? '1회' : basic.assetOn ? '호출 없음 (메인이 태그를 씀)' : '호출 없음 (이미지 끔)', page: 'set:image', sure: assetOn ? 1 : 0, maybe: 0 },
    { name: '괴담톡 확인', sub: '새 메시지·공지·초대', kind: 'aux', on: ph.auto, model: ph.auto ? phoneModel : undefined, calls: ph.auto ? (joint ? '1회 (괴담넷과 한 요청으로 합침)' : '1회') : '수동 (새로고침 때만)', page: 'set:phone', sure: ph.auto ? 1 : 0, maybe: 0 },
    { name: '괴담넷 새로고침', sub: '게시판 글·댓글·쪽지', kind: 'aux', on: gn.auto, model: gn.auto ? gnetModel : undefined, calls: gn.auto ? (joint ? '괴담톡과 합쳐 0회 추가' : '1회') : gn.autoOpen ? '창 열 때 1회' : '수동 (새로고침 때만)', page: 'set:gnet', sure: gn.auto && !joint ? 1 : 0, maybe: 0 },
    { name: '괴담톡 관전', sub: `${VIEW_PRESETS[vw.preset]} 이어 쓰기`, kind: 'aux', on: vw.auto === 'turn', model: vw.auto === 'turn' ? phoneModel : undefined, calls: vw.auto === 'turn' ? '1회' : vw.auto === 'open' ? '괴담톡 열 때 1회' : '수동 (「관전」 단추)', page: 'set:phone', sure: vw.auto === 'turn' ? 1 : 0, maybe: 0 },
    { name: '위키 자동 작성', sub: '이번 턴 소재로 문서 한 편', kind: 'aux', on: wikiOn, model: wikiOn ? id(featureModel(ss, 'nw')) || mm(nw.model) : undefined, calls: wikiOn ? (wikiTitle ? '2회 (제목 고르기 + 본문)' : '1회 (제목은 설정에 적은 것)') : nw.auto === 'open' ? '위키 열 때' : '수동', page: 'set:wiki', sure: wikiOn ? (wikiTitle ? 2 : 1) : 0, maybe: 0 },
    { name: '보고서 소감', sub: '사건이 끝난 턴에 보고서 소감', kind: 'aux', on: jr.debriefAuto, model: jr.debriefAuto ? '보조' : undefined, calls: jr.debriefAuto ? '사건 종료 턴에만 1회' : '호출 없음', page: 'set:journal', sure: 0, maybe: jr.debriefAuto ? 1 : 0 },
  ];
  const manual: Node[] = [
    { name: '상점', sub: '진열대 받기·점원 대화', kind: 'aux', on: false, model: '보조', calls: '상점을 열 때·새로고침·말 걸 때', page: 'set:items', sure: 0, maybe: 0 },
    { name: '위키 수동', sub: '검색해서 없는 문서 쓰기', kind: 'aux', on: false, model: mm(nw.model), calls: '검색 결과가 없을 때 1회', page: 'set:wiki', sure: 0, maybe: 0 },
    { name: '괴담톡 답장', sub: '내가 보낸 메시지에 답', kind: 'aux', on: false, model: phoneModel, calls: '보낼 때마다 1회', page: 'set:phone', sure: 0, maybe: 0 },
    { name: '게임 대화·방문', sub: '필드에서 NPC 와 말하기·장소 방문', kind: 'aux', on: false, model: '보조/메인', calls: '필드에서만', sure: 0, maybe: 0 },
  ];
  return { pre, main, post, manual };
}

function nodeHtml(n: Node): string {
  return `<div class="pp-fn${n.on ? ' on' : ''} k-${n.kind}"><div class="pp-fn-name"><b>${esc(n.name)}</b>${n.model ? `<span class="pp-fn-chip">${esc(n.model)}</span>` : ''}<small>${esc(n.sub)}</small></div><span class="pp-fn-calls">${esc(n.calls)}</span><div class="pp-fn-ctl"></div>${n.page ? `<button class="gx-mini pp-fn-go" data-action="ed-node" data-value="${esc(n.page)}">설정 →</button>` : '<span></span>'}</div>`;
}

export function flowPage(ctx: ChatContext, head: (crumb: string, title: string, desc: string) => string): string {
  const { pre, main, post, manual } = flowNodes(ctx);
  const all = [...pre, main, ...post];
  const sure = all.reduce((n, x) => n + x.sure, 0);
  const maybe = all.reduce((n, x) => n + x.maybe, 0);
  const arrow = '<i class="pp-fn-arrow" aria-hidden="true">↓</i>';
  const group = (title: string, note: string, nodes: Node[]) => `<section class="ps-group"><h3>${title} <small>${esc(note)}</small></h3><div class="ps-rows"><div class="pp-flow">${nodes.map(nodeHtml).join(arrow)}</div></div></section>`;
  return `<div class="gw-page gw-set">${head('', '호출 흐름', '지금 설정으로 본편 한 턴에 플러그인이 모델을 어떤 순서로 몇 번 부르는지. 켜진 칸만 진해요. 실제로 간 요청·응답 원문은 「호출 기록」에서 봐요.')}
    <div class="gx-settings gw-setbody">
    <section class="ps-group"><div class="ps-rows"><p class="pp-flow-sum">턴마다 보조 호출 <b>${sure}회</b>${maybe ? ` (조건에 따라 최대 <b>${sure + maybe}회</b>)` : ''} · 메인 <b>1회</b>. 형식이 틀린 답은 같은 모델에 한 번 더 물을 수 있어요.</p></div></section>
    ${group('본편 전', '유저 메시지 → 요청 조립', pre)}
    ${group('본편', '', [main])}
    ${group('본편 뒤', '응답이 들어온 뒤, 위에서 아래 순서로 (괴담톡·괴담넷·관전·위키는 인물 갱신이 끝난 뒤)', post)}
    ${group('턴과 무관', '누르거나 열 때만', manual)}
    </div></div>`;
}

/** 기능 설정 페이지 맨 위 한 줄 (2026-11-07 사용자: 메뉴마다 도식은 중복, 「이 기능의 호출: …」 한 줄만). 그 페이지로 가는 칸의 호출 수만 모은다 */
export function callSummary(ctx: ChatContext, page: string): string {
  const { pre, post, manual } = flowNodes(ctx);
  const mine = [...pre, ...post, ...manual].filter((n) => n.page === `set:${page}`);
  if (!mine.length) return '';
  const auto = mine.filter((n) => n.on);
  const sure = auto.reduce((s, n) => s + n.sure, 0);
  const maybe = auto.reduce((s, n) => s + n.maybe, 0);
  const lead = auto.length ? `매 턴 보조 <b>${sure}회</b>${maybe ? ` (조건에 따라 최대 ${sure + maybe}회)` : ''}` : '매 턴 자동 호출 없음';
  const parts = mine.map((n) => `<span class="gw-call${n.on ? ' on' : ''}">${esc(n.name)}<small>${esc(n.calls)}</small></span>`).join('');
  return `<p class="gw-calls"><span class="gw-call-lead">이 기능의 호출 · ${lead}</span>${parts}<button class="gx-mini" data-action="ed-node" data-value="manage:flow">호출 흐름 →</button></p>`;
}
