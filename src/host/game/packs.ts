// 게임 자산 팩: game-pack/<id>/(pack.json이 있는 폴더)를 빌드가 GOEIPACK 한 덩어리로 묶고 512KB 조각으로 올린다(scripts/game-pack.mjs).
// 처음 필요할 때 한 번 받아 pluginStorage에 둔다(큰 값은 Risu가 저장 데이터 밖에 따로 두고, 다시 쓰면 옛 값을 치운다).
// 지문(hash)이 바뀐 팩만 다시 받는다. 저장소를 못 쓰게 돼도 .pack 파일을 직접 넣을 수 있다.
// 꺼낼 때는 파일마다 blob: 주소를 만들고, 게임을 닫으면 releaseAll()로 거둔다(메모리).
import type { GameAssets } from '../../game/bridge';
import { base64, gameIndex, GameFileError, getParts, unbase64, type PackEntry } from './fetch';

const KEY = (id: string) => `goei:game:pack:${id}`;

const MIME: Record<string, string> = {
  png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', jpg: 'image/jpeg',
  ogg: 'audio/ogg', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', opus: 'audio/ogg',
  json: 'application/json', txt: 'text/plain',
};

export interface ParsedPack {
  id: string;
  hash: string;
  atlas: unknown;
  /** 이름(확장자 포함) → 바이트 */
  files: Map<string, Uint8Array>;
}

/** "GOEIPACK" + 머리 길이(uint32 LE) + 머리 JSON {id, version, hash?, atlas, files:[[이름, 시작, 길이]]} + 바이트 */
export function parseGamePack(b: Uint8Array): ParsedPack | null {
  if (b.length < 12 || new TextDecoder().decode(b.subarray(0, 8)) !== 'GOEIPACK') return null;
  const len = b[8] | (b[9] << 8) | (b[10] << 16) | (b[11] << 24);
  let head: { id?: unknown; hash?: unknown; atlas?: unknown; files?: unknown };
  try {
    head = JSON.parse(new TextDecoder().decode(b.subarray(12, 12 + len)));
  } catch {
    return null;
  }
  if (typeof head.id !== 'string' || !Array.isArray(head.files)) return null;
  const at = 12 + len;
  const files = new Map<string, Uint8Array>();
  for (const row of head.files as unknown[]) {
    if (!Array.isArray(row)) return null;
    const [name, start, size] = row as [unknown, unknown, unknown];
    if (typeof name !== 'string' || typeof start !== 'number' || typeof size !== 'number' || at + start + size > b.length) return null;
    files.set(name, b.subarray(at + start, at + start + size));
  }
  return { id: head.id, hash: typeof head.hash === 'string' ? head.hash : '', atlas: head.atlas ?? null, files };
}

interface Stored {
  hash: string;
  atlas: unknown;
  bytes: number;
  /** 이름 → [mime, base64] */
  files: Record<string, [string, string]>;
}

const memo = new Map<string, Promise<Stored | null>>();

function stored(id: string): Promise<Stored | null> {
  let p = memo.get(id);
  if (!p) {
    p = (async () => {
      try {
        const raw: unknown = await risuai.pluginStorage.getItem(KEY(id));
        const v = typeof raw === 'string' ? (JSON.parse(raw) as Stored) : null;
        return v && typeof v.hash === 'string' && v.files && typeof v.files === 'object' ? v : null;
      } catch {
        return null;
      }
    })();
    memo.set(id, p);
  }
  return p;
}

/** 팩 바이트를 풀어 저장한다. id를 주면 그 팩인지 확인한다 */
export async function installGamePack(bytes: Uint8Array, expect?: string, hash?: string): Promise<string> {
  const pack = parseGamePack(bytes);
  if (!pack) throw new GameFileError('괴이 ː ANOMALY 게임 팩 파일이 아니에요.');
  if (expect && pack.id !== expect) throw new GameFileError(`다른 팩이에요 (${pack.id}).`);
  const files: Stored['files'] = {};
  for (const [name, b] of pack.files) files[name] = [MIME[name.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream', base64(b)];
  const value: Stored = { hash: hash || pack.hash, atlas: pack.atlas, bytes: bytes.length, files };
  await risuai.pluginStorage.setItem(KEY(pack.id), JSON.stringify(value));
  release(pack.id);
  memo.set(pack.id, Promise.resolve(value));
  return pack.id;
}

/** 목록의 팩을 받아 넣는다 */
export async function downloadGamePack(entry: PackEntry, onPart?: (done: number, total: number) => void): Promise<void> {
  const bytes = await getParts(entry.parts, onPart);
  if (bytes.length !== entry.bytes) throw new GameFileError('팩을 끝까지 받지 못했어요.');
  await installGamePack(bytes, entry.id, entry.hash);
}

export type PackState = 'ready' | 'old' | 'none';

export async function packStateOf(entry: PackEntry): Promise<PackState> {
  const s = await stored(entry.id);
  return !s ? 'none' : s.hash !== entry.hash ? 'old' : 'ready';
}

/** 꼭 있어야 하는데 없거나 낡은 팩 */
export async function missingPacks(): Promise<PackEntry[]> {
  const idx = await gameIndex();
  const out: PackEntry[] = [];
  for (const p of idx.packs) if (p.required && (await packStateOf(p)) !== 'ready') out.push(p);
  return out;
}

// ── 꺼내기 ──

const urls = new Map<string, Map<string, string>>();

function release(id: string): void {
  for (const u of urls.get(id)?.values() ?? []) URL.revokeObjectURL(u);
  urls.delete(id);
}

/** 게임을 닫을 때: 만든 주소를 모두 거두고 읽어 둔 내용을 잊는다 */
export function releaseAll(): void {
  for (const id of [...urls.keys()]) release(id);
  memo.clear();
}

/** 지금 살아 있는 blob 주소 수 (측정용) */
export const liveUrls = () => [...urls.values()].reduce((n, m) => n + m.size, 0);

async function fileUrl(id: string, file: string): Promise<string> {
  const have = urls.get(id)?.get(file);
  if (have) return have;
  const s = await stored(id);
  const row = s?.files[file] ?? s?.files[`${file}.png`];
  if (!row) return '';
  const u = URL.createObjectURL(new Blob([unbase64(row[1]) as BlobPart], { type: row[0] }));
  let m = urls.get(id);
  if (!m) urls.set(id, (m = new Map()));
  m.set(file, u);
  return u;
}

export const gameAssets: GameAssets = {
  ready: async (id) => !!(await stored(id)),
  url: fileUrl,
  atlas: async (id) => (await stored(id))?.atlas ?? null,
  bytes: async (id, file) => {
    const row = (await stored(id))?.files[file];
    return row ? unbase64(row[1]) : null;
  },
  list: async () => {
    let entries: PackEntry[] = [];
    try {
      entries = (await gameIndex()).packs;
    } catch {
      /* 목록을 못 받으면 비어 있다 */
    }
    return Promise.all(
      entries.map(async (e) => {
        const st = await packStateOf(e);
        return { id: e.id, bytes: e.bytes, ready: st === 'ready', old: st === 'old' };
      }),
    );
  },
};
