// 이전 시험판 (관리국 순찰 · 1인 전투 검증판). 게임 코드 팩 안에서 돈다. 그림 팩 받기 창은 예전 그대로.
import type { GameBridge } from './bridge';
import { mountGame, type GameHost } from '.';
import { mountAction } from './action';
import { actionPackState, loadActionArt, downloadActionPack, installActionPack } from '../host/actionpack';
import { downloadPack, installPack, loadArt, packState, PackError } from '../host/gamepack';

type Mode = 'action' | 'patrol';

const hostFor = (bridge: GameBridge, mode: Mode): GameHost => {
  const key = mode === 'action' ? 'goei:game-action:v1' : 'goei:game';
  return {
    load: async () => {
      const v: unknown = await risuai.pluginStorage.getItem(key);
      return typeof v === 'string' ? v : null;
    },
    save: (data) => risuai.pluginStorage.setItem(key, data),
    waiting: bridge.waiting,
    onWaiting: bridge.onWaiting,
    narrow: bridge.narrow,
    art: mode === 'action' ? loadActionArt : loadArt,
  };
};

export function mountLegacy(box: HTMLElement, bridge: GameBridge, mode: Mode): () => void {
  let unmount: (() => void) | null = null;
  let generation = 0;
const errText = (e: unknown) =>
  e instanceof PackError ? e.message : `그림을 넣지 못했어요: ${e instanceof Error ? e.message : String(e)}`;

/** 그림 팩이 없을 때: 받기 · 파일로 넣기 */
  function packPanel(old: boolean, done: () => void): void {
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

  async function start(): Promise<void> {
  const current = ++generation;
  unmount?.();
  unmount = null;
  const isAction = mode === 'action';
  const state = await (isAction ? actionPackState() : packState());
  if (current !== generation) return;
  if (state !== 'ready') return packPanel(state === 'old', () => void start());
  try {
    await (isAction ? loadActionArt() : loadArt());
  } catch {
    // 에셋이 지워졌거나 못 읽으면 다시 받게 한다
    if (current === generation) packPanel(false, () => void start());
    return;
  }
  if (current !== generation) return;
  box.innerHTML = '';
  unmount = mode === 'action' ? mountAction(box, hostFor(bridge, mode)) : mountGame(box, hostFor(bridge, mode));
}

  void start();
  return () => {
    generation++;
    unmount?.();
    unmount = null;
    box.innerHTML = '';
  };
}
