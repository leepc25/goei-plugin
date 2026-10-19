// 새 1인 액션 그림은 구형 순찰 팩과 별도 배포하여 구버전 설치를 깨뜨리지 않는다.
import { UPDATE_BASE } from '../core/update';
import { parsePack, type GameArt } from '../game/assets';
import { toBytes } from './assets';
import { PackError } from './gamepack';
export const ACTION_FILES = ['a-jyaldi-action', 'bg-bureau-action', 'e-corner', 'e-watchman'];
const KEY = 'goei:game-pack:action-normal',
  VERSION = 3;
interface Stored {
  version: number;
  atlas: GameArt['atlas'];
  files: Record<string, string>;
}
let loaded: Promise<GameArt> | null = null;
async function stored(): Promise<Stored | null> {
  try {
    const raw: unknown = await risuai.pluginStorage.getItem(KEY);
    if (typeof raw !== 'string') return null;
    const s = JSON.parse(raw) as Stored;
    return s && s.version === VERSION && s.atlas?.action && ACTION_FILES.every((f) => typeof s.files?.[f] === 'string')
      ? s
      : null;
  } catch {
    return null;
  }
}
export async function actionPackState(): Promise<'none' | 'old' | 'ready'> {
  return (await stored()) ? 'ready' : 'none';
}
export async function installActionPack(bytes: Uint8Array) {
  const pack = parsePack(bytes, ACTION_FILES);
  if (!pack || pack.id !== 'action' || pack.version !== VERSION || !pack.atlas.action)
    throw new PackError('1인 액션용 그림 팩이 아닙니다. goei-game-action-normal.pack을 넣어 주세요.');
  const files: Record<string, string> = {};
  for (const [name, b] of pack.files) {
    let str = '';
    for (let i = 0; i < b.length; i += 0x8000) str += String.fromCharCode(...b.subarray(i, i + 0x8000));
    files[name] = btoa(str);
  }
  await risuai.pluginStorage.setItem(KEY, JSON.stringify({ version: VERSION, atlas: pack.atlas, files }));
  loaded = null;
}
export async function downloadActionPack(): Promise<Uint8Array> {
  const url = `${UPDATE_BASE}/goei-game-action-normal.pack`;
  const legacy = (
    risuai as unknown as {
      risuFetch?: (url: string, args: Record<string, unknown>) => Promise<{ ok: boolean; data: unknown }>;
    }
  ).risuFetch;
  if (legacy) {
    try {
      const r = await legacy(url, { method: 'GET', plainFetchForce: true, rawResponse: true });
      const b = r.ok ? toBytes(r.data) : null;
      if (b && parsePack(b, ACTION_FILES)) return b;
    } catch {
      /* native 경로로 재시도 */
    }
  }
  try {
    const r = await risuai.nativeFetch(url, { method: 'GET' });
    if (r.ok) {
      const b = new Uint8Array(await r.arrayBuffer());
      if (parsePack(b, ACTION_FILES)) return b;
    }
  } catch {
    /* 수동 설치 안내 */
  }
  throw new PackError('새 액션 그림을 받지 못했어요. goei-game-action-normal.pack을 파일로 넣어 주세요.');
}
export function loadActionArt(): Promise<GameArt> {
  loaded ??= (async () => {
    const s = await stored();
    if (!s) throw new PackError('새 액션 그림이 없습니다.');
    return { atlas: s.atlas, url: (name: string) => (s.files[name] ? `data:image/png;base64,${s.files[name]}` : '') };
  })();
  loaded.catch(() => {
    loaded = null;
  });
  return loaded;
}
