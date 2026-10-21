// 게임 코드 팩: 게임 코드는 본체(goei-body.js)에 넣지 않는다. 본체는 괴이 카드를 열 때마다 읽히고, 게임은 하려는 사람만 쓰기 때문이다.
// 시작기가 본체를 다루는 방식(src/main.ts·loader/body.ts)을 그대로 따른다: 「// goei-game 판」 줄로 시작하는 코드를
// 조각(release/game/goei-game.N.txt)으로 한 번 받아 pluginStorage에 두고, 플러그인 판이 바뀌면 다시 받는다.
// 실행은 이 플러그인 스크립트의 nonce를 붙인 script로 한다 (Risu 플러그인 칸은 eval·blob 스크립트를 막는다).
import type { GameModule } from '../../game/bridge';
import { gameIndex, GameFileError, getParts } from './fetch';

export const CODE_KEY = 'goei:game:code';
const VERSION: string = typeof __PLUGIN_VERSION__ === 'string' ? __PLUGIN_VERSION__ : '';
declare const __PLUGIN_VERSION__: string | undefined;

export const codeVersion = (code: string) => /^\/\/ goei-game (\S+)/.exec(code)?.[1] ?? null;

let mod: GameModule | null = null;

/** 측정: 마지막으로 코드를 꺼낸 데 걸린 시간 */
export const codeStats = { readMs: 0, runMs: 0, bytes: 0, fromNet: false };

export async function codeState(): Promise<'ready' | 'old' | 'none'> {
  if (mod) return 'ready';
  try {
    const saved: unknown = await risuai.pluginStorage.getItem(CODE_KEY);
    if (typeof saved !== 'string') return 'none';
    return codeVersion(saved) === VERSION ? 'ready' : 'old';
  } catch {
    return 'none';
  }
}

export function runGameCode(code: string): GameModule {
  const g = globalThis as unknown as { __goeiGame?: GameModule };
  delete g.__goeiGame;
  const nonce = [...document.querySelectorAll('script')].map((s) => s.nonce).find(Boolean);
  const s = document.createElement('script');
  if (nonce) s.nonce = nonce;
  s.textContent = code;
  document.head.append(s);
  s.remove();
  const api = g.__goeiGame as GameModule | undefined;
  delete g.__goeiGame;
  if (!api || typeof api.mount !== 'function') throw new GameFileError('게임 코드를 실행하지 못했어요.');
  if (VERSION && api.version !== VERSION) throw new GameFileError(`게임 코드 판(${api.version})이 플러그인(${VERSION})과 달라요.`);
  return api;
}

/** 받기 (조각) */
export async function downloadGameCode(onPart?: (done: number, total: number) => void): Promise<string> {
  const idx = await gameIndex();
  if (idx.version !== VERSION) throw new GameFileError('아직 이 판의 게임 파일이 올라오지 않았어요. 잠시 뒤 다시 받아 주세요.');
  const code = new TextDecoder().decode(await getParts(idx.code.parts, onPart));
  if (code.length !== idx.code.length || codeVersion(code) !== VERSION) throw new GameFileError('게임 코드를 끝까지 받지 못했어요.');
  return code;
}

/** 파일로 넣은 코드 (goei-game.js) */
export async function installGameCode(code: string): Promise<void> {
  if (codeVersion(code) !== VERSION) throw new GameFileError(`이 플러그인(${VERSION})용 게임 코드가 아니에요.`);
  await risuai.pluginStorage.setItem(CODE_KEY, code);
  mod = null;
}

/** 저장해 둔 코드를 꺼내 실행한다. 없으면 받는다. 한 번 실행한 것은 이 페이지에서 계속 쓴다 */
export async function loadGameCode(onPart?: (done: number, total: number) => void): Promise<GameModule> {
  if (mod) return mod;
  const t0 = performance.now();
  let code: string | null = null;
  try {
    const saved: unknown = await risuai.pluginStorage.getItem(CODE_KEY);
    if (typeof saved === 'string' && codeVersion(saved) === VERSION) code = saved;
  } catch {
    // 아래에서 받는다
  }
  codeStats.fromNet = !code;
  if (!code) {
    code = await downloadGameCode(onPart);
    await risuai.pluginStorage.setItem(CODE_KEY, code);
  }
  const t1 = performance.now();
  mod = runGameCode(code);
  codeStats.readMs = Math.round(t1 - t0);
  codeStats.runMs = Math.round(performance.now() - t1);
  codeStats.bytes = code.length;
  return mod;
}
