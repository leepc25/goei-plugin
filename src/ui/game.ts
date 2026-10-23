// 게임 창: 머리의 게임 버튼(예전 「관리국 순찰」 자리)으로 연다. 창을 다시 그려도 게임이 끊기지 않게
// 덮개는 창 그리기(innerHTML)와 따로 들고 있다가 그린 뒤 다시 붙인다.
// 처음 화면은 시작 화면: 게임 파일 받기 → 저장 칸 고르기 → 본편 연동(읽은 것·넘겨받은 결과 쓰기) → 이전 시험판.
// 게임 코드는 본체에 들지 않고 코드 팩으로 받는다(host/game/code.ts). 쓰는 것은 사용자가 버튼을 누를 때만이다.
import { SLOT_IDS, type CardSnapshot, type SlotId, type SlotInfo } from '../game/bridge';
import { RECORD_COMMENT } from '../core/gamelink';
import { codeState, codeStats, installGameCode, loadGameCode } from '../host/game/code';
import { fetchStats, forgetIndex, gameIndex, type GameIndex } from '../host/game/fetch';
import { downloadGamePack, installGamePack, liveUrls, packStateOf, releaseAll } from '../host/game/packs';
import { gameSaves } from '../host/game/saves';
import { clearRecord, dropReport, onReports, pendingReports, postReport, readCard, recordReport, type PendingReport } from '../host/game/card';
import { makeBridge } from '../host/game';
import { makeViewport, type ViewportCtl } from '../host/game/viewport';
import { loadContext } from '../host/risu';
import { ICONS } from './icons';

type View = 'home' | 'play' | 'patrol' | 'action';

let layer: HTMLElement | null = null;
let viewport: ViewportCtl | null = null;
let unmount: (() => void) | null = null;
let view: View = 'home';
let generation = 0;
let busy = '';
let notice = '';
let offReports: (() => void) | null = null;

/** 측정 (시작 화면 아래 「측정」에 보인다, 시험이 읽는다) */
export const gameStats = { openMs: 0, codeMs: 0, mountMs: 0, heapOpen: 0, heapAfter: 0 };
// 시험(tests/browser.mjs)이 읽는다
(globalThis as unknown as { __goeiGameStats?: unknown }).__goeiGameStats = { game: gameStats, code: codeStats, fetch: fetchStats, urls: liveUrls };
const heap = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
const when = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const SLOT_NAME = (n: SlotId) => (n === 0 ? '자동 저장' : `${n}번 칸`);

interface Files {
  index: GameIndex | null;
  code: 'ready' | 'old' | 'none';
  need: { id: string; bytes: number }[];
  bytes: number;
}

async function files(): Promise<Files> {
  const code = await codeState();
  let index: GameIndex | null = null;
  try {
    index = await gameIndex();
  } catch {
    /* 목록을 못 받음: 받아 둔 게 있으면 그대로 연다 */
  }
  const need: Files['need'] = [];
  for (const p of index?.packs ?? []) if (p.required && (await packStateOf(p)) !== 'ready') need.push({ id: p.id, bytes: p.bytes });
  const bytes = (code === 'ready' ? 0 : (index?.code.bytes ?? 0)) + need.reduce((n, p) => n + p.bytes, 0);
  return { index, code, need, bytes };
}

// 필드 첫 화면은 설정 화면과 같은 틀 (2026-10-23 사용자: 버튼·여백·톤이 다른 설정 칸과 안 맞고 PC에서 두 줄로 나옴)
const row = (label: string, help: string, ctl = '') =>
  `<div class="ps-row"><div class="ps-label"><b>${label}</b>${help ? `<small>${help}</small>` : ''}</div>${ctl ? `<div class="ps-ctl gx-gl-ctl">${ctl}</div>` : ''}</div>`;
const group = (title: string, rows: string) => `<section class="ps-group"><h3>${title}</h3><div class="ps-rows">${rows}</div></section>`;
const dis = () => (busy ? ' disabled' : '');

function filesHtml(f: Files): string {
  if (f.code === 'ready' && !f.need.length) return '';
  const what = f.code === 'old' ? '플러그인이 바뀌어 게임 파일을 새로 받아야 해요.' : '처음 한 번만 받아요. 받은 파일은 이 기기의 Risu에 저장돼요.';
  const size = f.index ? ` (${kb(f.bytes)})` : '';
  return group('게임 파일', row('게임 파일 받기', what, `<button class="gx-mini primary" data-g="get"${dis()}>받기${size}</button><button class="gx-mini" data-g="file"${dis()}>파일로 넣기</button>`));
}

// 저장 칸 고르기·불러오기는 게임 안 본부가 맡는다(hq 모듈, bridge.saves). 여기서는 시작 버튼과 마지막 저장만 보인다
function startHtml(slots: SlotInfo[], last: SlotId | null, ready: boolean): string {
  const s = slots.find((x) => x.slot === last) ?? slots.sort((x, y) => y.savedAt - x.savedAt)[0];
  const help = s ? `마지막 저장 · ${when(s.savedAt)}${s.summary ? ` · ${esc(s.summary)}` : ''}` : '요원들을 만나 대화해요. 나눈 말은 다음 본편 요청에 막간으로 들어가요.';
  return group('필드', row('본부', help, `<button class="gx-mini primary" data-g="play"${ready ? '' : ' disabled'}>들어가기</button>`));
}

function linkHtml(card: CardSnapshot | null, reports: PendingReport[], record: number): string {
  if (!card) return group('본편 연동', row('채팅 연결 안 됨', '괴이 카드 채팅을 열면 명부 요원과 상황판을 게임이 읽어요.'));
  const n = (k: string) => card.events.filter((e) => e.kind === k).length;
  const free = card.agents.filter((a) => !a.locked).length;
  const reps = reports.map((p) => row(
    esc(p.report.mission),
    `${{ return: '귀환', evac: '후송', withdraw: '자발 철수' }[p.report.outcome]}${p.report.depth ? ` · ${esc(p.report.depth)}` : ''} · ${when(p.at)}${p.report.summary ? ` · ${esc(p.report.summary)}` : ''}`,
    `<button class="gx-mini${p.posted ? '' : ' primary'}" data-g="post" data-at="${p.at}"${p.posted || busy ? ' disabled' : ''}>${p.posted ? '채팅에 놓음' : '보고서 붙이기'}</button>
     <button class="gx-mini" data-g="record" data-at="${p.at}"${p.recorded || busy ? ' disabled' : ''}>${p.recorded ? '기록함' : '기록 로어북에 남기기'}</button>
     <button class="gx-mini" data-g="drop" data-at="${p.at}" aria-label="결과 지우기">${ICONS.trash}</button>`,
  )).join('');
  return group('본편 연동', [
    row('이 채팅에서 읽은 것', `요원 ${card.agents.length}명(편성 가능 ${free}) · 괴이 ${n('an')} · 사건 ${n('in')} · 특수 ${n('ms')}`),
    reps || '',
    record ? row(`「${esc(RECORD_COMMENT)}」 로어북`, `${record}줄`, '<button class="gx-mini" data-g="unrecord">지우기</button>') : '',
  ].join(''));
}

function statsHtml(): string {
  const s = gameStats;
  return row('측정', `게임 코드 ${kb(codeStats.bytes || 0)} · 꺼내기 ${codeStats.readMs}ms · 실행 ${codeStats.runMs}ms${codeStats.fromNet ? ' (방금 받음)' : ''} · 붙이기 ${s.mountMs}ms · 받은 양 ${kb(fetchStats.bytes)}/${fetchStats.requests}번 · 그림 주소 ${liveUrls()}개${s.heapOpen ? ` · 힙 ${kb(s.heapOpen)} → ${kb(heap())}` : ''}`);
}

const legacyHtml = () => row('이전 시험판', '예전 순찰과 1인 전투 검증판이에요. 저장과 그림은 따로예요.', '<button class="gx-mini" data-g="legacy" data-mode="patrol">관리국 순찰</button><button class="gx-mini" data-g="legacy" data-mode="action">1인 전투 검증판</button>');

async function home(): Promise<void> {
  const box = layer?.querySelector<HTMLElement>('.gx-game-box');
  if (!box || view !== 'home') return;
  const me = generation;
  const [f, slots, last, card, reports, ctx] = await Promise.all([
    files(),
    gameSaves.list(),
    gameSaves.last(),
    readCard().catch(() => null),
    pendingReports(),
    loadContext().catch(() => null),
  ]);
  if (me !== generation || view !== 'home' || !layer) return;
  const record = ctx ? String(((ctx.chat.localLore as { comment?: string; content?: string }[] | undefined) ?? []).find((e) => e.comment === RECORD_COMMENT)?.content ?? '').split('\n').filter((l) => l.startsWith('- ')).length : 0;
  const open = new Set([...box.querySelectorAll<HTMLDetailsElement>('details[data-keep]')].filter((d) => d.open).map((d) => d.dataset.keep));
  box.innerHTML = `<div class="gx-gl gx-settings">
    ${notice || busy ? `<div class="gx-gl-msg" role="status">${esc(busy || notice)}</div>` : ''}
    ${filesHtml(f)}${startHtml(slots, last, f.code === 'ready' && !f.need.length)}${linkHtml(card, reports, record)}
    <details class="ps-adv gx-gl-dev" data-keep="game-dev"><summary class="ps-adv-sum"><b>시험용</b></summary><div class="ps-rows">${legacyHtml()}${statsHtml()}</div></details>
    <input type="file" accept=".js,.pack" multiple hidden data-g-file></div>`;
  box.querySelectorAll<HTMLDetailsElement>('details[data-keep]').forEach((d) => (d.open = open.has(d.dataset.keep)));
}

const say = (t: string) => {
  notice = t;
  void home();
};

async function getFiles(): Promise<void> {
  busy = '게임 파일을 받는 중';
  void home();
  try {
    forgetIndex();
    const idx = await gameIndex();
    if ((await codeState()) !== 'ready') {
      await loadGameCode((d, t) => ((busy = `게임 코드 받는 중 ${d}/${t}`), void home()));
    }
    for (const p of idx.packs) {
      if (!p.required || (await packStateOf(p)) === 'ready') continue;
      await downloadGamePack(p, (d, t) => ((busy = `그림·소리 받는 중 (${p.id}) ${d}/${t}`), void home()));
    }
    busy = '';
    say('다 받았어요.');
  } catch (e) {
    busy = '';
    say(`받지 못했어요: ${e instanceof Error ? e.message : String(e)} 잠시 뒤 다시 받거나 파일로 넣어 주세요.`);
  }
}

async function putFiles(list: FileList): Promise<void> {
  busy = '넣는 중';
  void home();
  const done: string[] = [];
  try {
    for (const f of [...list]) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (f.name.endsWith('.js')) await installGameCode(new TextDecoder().decode(bytes)), done.push('게임 코드');
      else done.push(`팩 ${await installGamePack(bytes)}`);
    }
    busy = '';
    say(`넣었어요: ${done.join(', ')}`);
  } catch (e) {
    busy = '';
    say(e instanceof Error ? e.message : String(e));
  }
}

async function play(slot: SlotId | null, mode: View): Promise<void> {
  const box = layer?.querySelector<HTMLElement>('.gx-game-box');
  if (!box || !viewport) return;
  const me = ++generation;
  const t0 = performance.now();
  gameStats.heapOpen = heap();
  busy = '게임을 여는 중';
  try {
    const mod = await loadGameCode();
    gameStats.codeMs = Math.round(performance.now() - t0);
    if (me !== generation || !layer) return;
    view = mode;
    // 게임은 창 전체를 쓴다(통합 규격 3장: 캔버스가 창 면적 80% 이상, 폰 가로는 높이 100%, 폰 세로는 돌려 꽉 채움)
    viewport.fill(true);
    setHead();
    box.innerHTML = '';
    const bridge = makeBridge(viewport, slot ?? 0, () => (onExit ? onExit() : closeGame()), (cb) => {
      hiddenSubs.add(cb);
      return () => void hiddenSubs.delete(cb);
    });
    const t1 = performance.now();
    const legacy = mode === 'play' ? null : mod.legacy?.[mode];
    unmount = legacy ? legacy(box, bridge) : mod.mount(box, bridge);
    gameStats.mountMs = Math.round(performance.now() - t1);
    gameStats.openMs = Math.round(performance.now() - t0);
    busy = '';
  } catch (e) {
    busy = '';
    view = 'home';
    viewport.fill(false);
    setHead();
    say(`게임을 열지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function stop(): void {
  generation++;
  unmount?.();
  unmount = null;
  releaseAll();
  gameStats.heapAfter = heap();
}

function toHome(): void {
  stop();
  view = 'home';
  viewport?.fill(false);
  notice = '';
  setHead();
  void home();
}

function setHead(): void {
  const head = layer?.querySelector('.gx-head');
  if (!head) return;
  const inGame = view !== 'home';
  layer?.classList.toggle('gx-playing', inGame);
  head.innerHTML = `<div class="gx-brand gx-tabhead"><span class="gx-tabicon">${ICONS.game}</span><div><b>${view === 'patrol' ? '관리국 순찰' : view === 'action' ? '1인 전투 검증판' : '필드'}</b></div></div>
    <div class="gx-head-act">${inGame ? `<button class="gx-x" data-g="home" aria-label="시작 화면">${ICONS.back}</button>` : ''}
    <button class="gx-x" data-action="game-close" aria-label="게임 닫기">${ICONS.close}</button></div>`;
}

async function onClick(e: MouseEvent): Promise<void> {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-g]');
  if (!t || !layer || (t as HTMLButtonElement).disabled) return;
  const at = Number(t.dataset.at);
  const find = async () => (await pendingReports()).find((p) => p.at === at);
  try {
    switch (t.dataset.g) {
      case 'get':
        return void (await getFiles());
      case 'file':
        // 파일 고르기 창은 클릭 안에서 바로 열어야 한다
        return layer.querySelector<HTMLInputElement>('[data-g-file]')?.click();
      case 'play':
        notice = '';
        return void (await play(0, 'play'));
      case 'legacy':
        return void (await play(null, t.dataset.mode === 'action' ? 'action' : 'patrol'));
      case 'home':
        return toHome();
      case 'full':
        if (document.fullscreenElement) await viewport?.exit();
        else if (view === 'home' && viewport?.full) await viewport.exit();
        else await viewport?.enter();
        if (view !== 'home') viewport?.fill(true);
        return setHead();
      case 'post': {
        const p = await find();
        if (!p) return;
        busy = '채팅에 놓는 중';
        void home();
        await postReport(p);
        busy = '';
        return say('보고서를 채팅에 놓았어요. 보내려면 채팅창의 전송 버튼을, 그만두려면 메시지의 취소를 눌러 주세요.');
      }
      case 'record': {
        const p = await find();
        if (!p) return;
        await recordReport(p);
        return say(`이 채팅 로어북 「${RECORD_COMMENT}」에 남겼어요. 요청마다 들어가니 필요 없으면 지워 주세요.`);
      }
      case 'unrecord':
        if (!confirm(`「${RECORD_COMMENT}」 로어북을 지울까요?`)) return;
        await clearRecord();
        return say('기록 로어북을 지웠어요.');
      case 'drop':
        await dropReport(at);
        return void home();
    }
  } catch (err) {
    busy = '';
    say(err instanceof Error ? err.message : String(err));
  }
}

export const gameOpen = () => !!layer;
const hiddenSubs = new Set<(hidden: boolean) => void>();
/** 다른 탭으로 갈 때: 게임을 떼어 두고 멈춘다. 돌아오면 다시 붙인다 (닫지 않는다, 2026-10-23 사용자) */
export function hideGame(): void {
  if (!layer?.isConnected) return;
  layer.remove();
  hiddenSubs.forEach((f) => f(true));
}
/** 게임 안 「필드 나가기」: 창이 상황판으로 돌아간다 */
let onExit: (() => void) | null = null;

/** host = 창 본문 자리(필드 탭). 게임은 그 틀 안에서만 돈다 (2026-10-23 사용자: 전체화면이면 Risu 경고·메뉴·뒤로가기가 가려진다) */
export function openGame(panel: Element | null, exit?: () => void): void {
  if (layer || !panel) return;
  onExit = exit ?? null;
  const t0 = performance.now();
  layer = document.createElement('div');
  layer.className = 'gx-game';
  layer.innerHTML = `<div class="gx-game-in"><header class="gx-head"></header><div class="gx-game-box"></div></div>`;
  panel.append(layer);
  viewport = makeViewport(layer, { inFrame: true });
  view = 'home';
  notice = '';
  setHead();
  layer.addEventListener('click', (e) => void onClick(e));
  layer.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.matches('[data-g-file]') || !input.files?.length) return;
    const list = input.files;
    void putFiles(list).finally(() => (input.value = ''));
  });
  offReports = onReports(() => void home());
  void home().then(() => (gameStats.openMs = Math.round(performance.now() - t0)));
}

export function closeGame(): void {
  stop();
  offReports?.();
  offReports = null;
  viewport?.dispose();
  viewport = null;
  layer?.remove();
  layer = null;
  onExit = null;
  hiddenSubs.clear();
  view = 'home';
  busy = '';
}

/** 창을 다시 그린 뒤: 열려 있던 게임을 새 창 틀에 다시 붙인다 */
export function reattachGame(panel: Element | null): void {
  if (!layer || !panel || layer.parentElement === panel) return;
  const was = layer.isConnected;
  panel.append(layer);
  if (!was) hiddenSubs.forEach((f) => f(false));
}
