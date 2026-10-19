// 관찰형 게임 「관리국 순찰」을 창 위에 덮어 띄운다. 창을 다시 그려도 게임이 끊기지 않게
// 덮개는 창 그리기(innerHTML)와 따로 들고 있다가 그린 뒤 다시 붙인다.
import { mountGame, type GameHost } from '../game';
import { mountAction } from '../game/action';
import { actionPackState, loadActionArt, downloadActionPack, installActionPack } from '../host/actionpack';
import { downloadPack, installPack, loadArt, packState, PackError } from '../host/gamepack';
import { isWaiting, onWaiting } from '../host/waiting';
import { ICONS } from './icons';

const KEY = 'goei:game';

let layer: HTMLElement | null = null;
let unmount: (() => void) | null = null;
let mode: 'action' | 'patrol' = 'action';
let generation = 0;

const host: GameHost = {
  load: async () => {
    const v: unknown = await risuai.pluginStorage.getItem(KEY);
    return typeof v === 'string' ? v : null;
  },
  save: (data) => risuai.pluginStorage.setItem(KEY, data),
  waiting: isWaiting,
  onWaiting,
  narrow: () => matchMedia('(max-width: 760px)').matches,
  art: loadArt,
};

// 검증판 저장은 기존 4인 순찰 기록과 분리한다.
const actionHost: GameHost = {
  ...host,
  load: async () => {
    const value: unknown = await risuai.pluginStorage.getItem('goei:game-action:v1');
    return typeof value === 'string' ? value : null;
  },
  save: (data) => risuai.pluginStorage.setItem('goei:game-action:v1', data),
  art: loadActionArt,
};

const errText = (e: unknown) =>
  e instanceof PackError ? e.message : `그림을 넣지 못했어요: ${e instanceof Error ? e.message : String(e)}`;

/** 그림 팩이 없을 때: 받기 · 파일로 넣기 */
function packPanel(box: HTMLElement, old: boolean, done: () => void): void {
  const action = mode === 'action';
  box.innerHTML = `<div class="gx-gp"><div class="gx-gp-card">
      <b>${action ? '새 액션 그림 받기' : old ? '순찰 그림 새로 받기' : '순찰 그림 받기'}</b>
      <p>${old ? '플러그인이 바뀌어 그림을 새로 받아야 해요.' : '게임 그림은 처음 한 번만 받아요. 받은 그림은 Risu에 저장돼요.'}</p>
      <p class="gx-gp-msg" hidden></p>
      <div class="gx-gp-act"><button class="gx-gp-btn primary" data-gp="get">${action ? '액션 그림 받기' : '순찰 그림 받기 (0.7MB)'}</button><button class="gx-gp-btn" data-gp="file">파일로 넣기</button></div>
    </div></div>`;
  const msg = box.querySelector<HTMLElement>('.gx-gp-msg')!;
  const btns = [...box.querySelectorAll<HTMLButtonElement>('.gx-gp-btn')];
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.pack';
  picker.hidden = true;
  box.append(picker);
  const say = (t: string) => ((msg.hidden = !t), (msg.textContent = t));
  const run = async (get: () => Promise<Uint8Array>) => {
    btns.forEach((b) => (b.disabled = true));
    say('받는 중');
    try {
      const bytes = await get();
      say('저장하는 중');
      await (action ? installActionPack(bytes) : installPack(bytes));
      done();
    } catch (e) {
      say(errText(e));
      btns.forEach((b) => (b.disabled = false));
    }
  };
  box
    .querySelector('[data-gp="get"]')!
    .addEventListener('click', () => void run(action ? downloadActionPack : downloadPack));
  // 파일 고르기 창은 클릭 안에서 바로 열어야 한다
  box.querySelector('[data-gp="file"]')!.addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => {
    const f = picker.files?.[0];
    picker.value = '';
    if (f) void run(async () => new Uint8Array(await f.arrayBuffer()));
  });
}

async function start(box: HTMLElement): Promise<void> {
  const current = ++generation;
  unmount?.();
  unmount = null;
  const isAction = mode === 'action';
  const state = await (isAction ? actionPackState() : packState());
  if (current !== generation || !layer || layer.querySelector('.gx-game-box') !== box) return;
  if (state !== 'ready') return packPanel(box, state === 'old', () => void start(box));
  try {
    await (isAction ? loadActionArt() : loadArt());
  } catch {
    // 에셋이 지워졌거나 못 읽으면 다시 받게 한다
    if (current === generation && layer?.querySelector('.gx-game-box') === box)
      packPanel(box, false, () => void start(box));
    return;
  }
  if (current !== generation || !layer || layer.querySelector('.gx-game-box') !== box) return;
  box.innerHTML = '';
  unmount = mode === 'action' ? mountAction(box, actionHost) : mountGame(box, host);
}

export const gameOpen = () => !!layer;

export function openGame(panel: Element | null): void {
  if (layer || !panel) return;
  layer = document.createElement('div');
  layer.className = 'gx-game';
  layer.innerHTML = `<header class="gx-head"><div class="gx-brand gx-tabhead"><span class="gx-tabicon">${ICONS.game}</span><div><b>관리국 훈련</b></div></div>
    <div><button type="button" data-game-mode="action" aria-pressed="${mode === 'action'}">1인 전투 검증판</button><button type="button" data-game-mode="patrol" aria-pressed="${mode === 'patrol'}">기존 순찰</button></div>
    <div class="gx-head-act"><button class="gx-x" data-action="game-close" aria-label="순찰 닫기">${ICONS.close}</button></div></header>
    <div class="gx-game-box"></div>`;
  panel.append(layer);
  layer.addEventListener('click', (e) => {
    const value = (e.target as HTMLElement).closest<HTMLElement>('[data-game-mode]')?.dataset.gameMode;
    if ((value !== 'action' && value !== 'patrol') || value === mode || !layer) return;
    mode = value;
    layer
      .querySelectorAll<HTMLElement>('[data-game-mode]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.gameMode === mode)));
    void start(layer.querySelector<HTMLElement>('.gx-game-box')!);
  });
  void start(layer.querySelector<HTMLElement>('.gx-game-box')!);
}

export function closeGame(): void {
  generation++;
  unmount?.();
  unmount = null;
  layer?.remove();
  layer = null;
}

/** 창을 다시 그린 뒤: 열려 있던 게임을 새 창 틀에 다시 붙인다 */
export function reattachGame(panel: Element | null): void {
  if (layer && panel && layer.parentElement !== panel) panel.append(layer);
}
