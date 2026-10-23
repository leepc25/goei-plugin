// 게임 그림 팩: 플러그인에 넣지 않고, 게임을 하려는 사람만 한 번 받아 pluginStorage에 넣는다.
// 받는 곳은 저장소 release 폴더(UPDATE_BASE). 저장소를 못 쓰게 돼도 팩 파일을 직접 넣을 수 있다.
// pluginStorage는 큰 값을 Risu 저장 데이터 밖(콜드 스토리지)에 따로 두고, 새로 받으면 옛 값을 알아서 치운다
// (에셋 저장소에 넣으면 다시 받을 때마다 옛 그림이 지워지지 않고 쌓인다).
import { UPDATE_BASE } from '../core/update';
import { PACK_FILES, PACK_ID, PACK_NAME, PACK_VERSION, parsePack, type Atlas, type GameArt } from '../game/assets';
import { toBytes } from './assets';

const KEY = `goei:game-pack:${PACK_ID}`;

interface Stored { version: number; atlas: Atlas; files: Record<string, string> }

export class PackError extends Error {}

async function stored(): Promise<Stored | null> {
  try {
    const raw: unknown = await risuai.pluginStorage.getItem(KEY);
    const v = typeof raw === 'string' ? (JSON.parse(raw) as Stored) : null;
    return v && typeof v.version === 'number' && v.atlas && v.files && PACK_FILES.every((f) => typeof v.files[f] === 'string') ? v : null;
  } catch {
    return null;
  }
}

/** none: 안 받음, old: 판이 달라 다시 받아야 함, ready: 바로 쓸 수 있음 */
export async function packState(): Promise<'none' | 'old' | 'ready'> {
  const s = await stored();
  return !s ? 'none' : s.version !== PACK_VERSION ? 'old' : 'ready';
}

type RisuFetch = (url: string, arg: Record<string, unknown>) => Promise<{ ok: boolean; data: unknown; status: number }>;

/** release 폴더에서 팩을 받는다. Risu 본 화면에서 직접 받고(risuFetch), 안 되면 nativeFetch */
export async function downloadPack(): Promise<Uint8Array> {
  if (!UPDATE_BASE) throw new PackError('받을 곳이 정해지지 않았어요. 팩 파일을 직접 넣어 주세요.');
  const url = `${UPDATE_BASE}/${PACK_NAME}?t=${Date.now()}`;
  const legacy = (risuai as unknown as { risuFetch?: RisuFetch }).risuFetch;
  if (legacy) {
    try {
      const r = await legacy(url, { method: 'GET', plainFetchForce: true, rawResponse: true, headers: { 'Content-Type': 'text/plain' } });
      const b = r?.ok ? toBytes(r.data) : null;
      if (b && parsePack(b)) return b;
    } catch {
      // 아래에서 다시 시도
    }
  }
  try {
    const res = await risuai.nativeFetch(url, { method: 'GET' });
    if (res.ok) {
      const b = new Uint8Array(await res.arrayBuffer());
      if (parsePack(b)) return b;
    }
  } catch {
    // 아래 안내
  }
  throw new PackError('그림을 받지 못했어요. 잠시 뒤 다시 받거나 팩 파일을 직접 넣어 주세요.');
}

function base64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(out);
}

/** 팩 바이트를 풀어 저장한다 */
export async function installPack(bytes: Uint8Array): Promise<void> {
  const pack = parsePack(bytes);
  if (!pack || pack.id !== PACK_ID) throw new PackError('괴이 ː ANOMALY 순찰 그림 팩 파일이 아니에요.');
  if (pack.version !== PACK_VERSION) throw new PackError('플러그인과 맞지 않는 판의 그림 팩이에요. 최신 팩을 받아 주세요.');
  const files: Record<string, string> = {};
  for (const name of PACK_FILES) files[name] = base64(pack.files.get(name)!);
  await risuai.pluginStorage.setItem(KEY, JSON.stringify({ version: pack.version, atlas: pack.atlas, files } satisfies Stored));
  art = null;
}

let art: Promise<GameArt> | null = null;

/** 받아 둔 그림을 게임에 넘긴다. 한 번 읽은 것은 이 페이지에서 계속 쓴다 */
export function loadArt(): Promise<GameArt> {
  art ??= (async () => {
    const s = await stored();
    if (!s || s.version !== PACK_VERSION) throw new PackError('그림 팩이 없어요.');
    const urls = new Map<string, string>();
    for (const name of PACK_FILES) {
      const b = Uint8Array.from(atob(s.files[name]), (c) => c.charCodeAt(0));
      urls.set(name, URL.createObjectURL(new Blob([b as BlobPart], { type: 'image/png' })));
    }
    return { atlas: s.atlas, url: (f: string) => urls.get(f) ?? '' };
  })();
  art.catch(() => (art = null));
  return art;
}
