// 게임 자산 팩: game-pack/<id>/(pack.json이 있는 폴더)를 빌드가 GOEIPACK 한 덩어리로 묶고 512KB 조각으로 올린다(scripts/game-pack.mjs).
// 처음 필요할 때 한 번 받아 pluginStorage에 둔다(큰 값은 Risu가 저장 데이터 밖에 따로 두고, 다시 쓰면 옛 값을 치운다).
// 지문(hash)이 바뀐 팩만 다시 받는다. 저장소를 못 쓰게 돼도 .pack 파일을 직접 넣을 수 있다.
// 꺼낼 때는 파일마다 blob: 주소를 만들고, 게임을 닫으면 releaseAll()로 거둔다(메모리).
import type { GameAssets } from '../../game/bridge';
import { base64, GAME_BASE, gameIndex, GameFileError, getParts, unbase64, type PackEntry } from './fetch';

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

export type PackState = 'ready' | 'old' | 'none';

/** 팩 저장소 하나: 저장 이름(key)·목록(index)·받을 곳(base)만 다르다 (게임 goei:game:* · 대전 goei:vs:*, 11-08) */
export function createPackStore(cfg: { key: (id: string) => string; index: () => Promise<{ packs: PackEntry[] }>; base: string }) {
  const memo = new Map<string, Promise<Stored | null>>();

  function stored(id: string): Promise<Stored | null> {
    let p = memo.get(id);
    if (!p) {
      p = (async () => {
        try {
          const raw: unknown = await risuai.pluginStorage.getItem(cfg.key(id));
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
  async function installGamePack(bytes: Uint8Array, expect?: string, hash?: string): Promise<string> {
    const pack = parseGamePack(bytes);
    if (!pack) throw new GameFileError('괴이 ː ANOMALY 게임 팩 파일이 아니에요.');
    if (expect && pack.id !== expect) throw new GameFileError(`다른 팩이에요 (${pack.id}).`);
    const files: Stored['files'] = {};
    for (const [name, b] of pack.files) files[name] = [MIME[name.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream', base64(b)];
    const value: Stored = { hash: hash || pack.hash, atlas: pack.atlas, bytes: bytes.length, files };
    await risuai.pluginStorage.setItem(cfg.key(pack.id), JSON.stringify(value));
    release(pack.id);
    memo.set(pack.id, Promise.resolve(value));
    return pack.id;
  }

  /** 목록의 팩을 받아 넣는다 */
  async function downloadGamePack(entry: PackEntry, onPart?: (done: number, total: number) => void): Promise<void> {
    const bytes = await getParts(entry.parts, onPart, cfg.base);
    if (bytes.length !== entry.bytes) throw new GameFileError('팩을 끝까지 받지 못했어요.');
    await installGamePack(bytes, entry.id, entry.hash);
  }


  async function packStateOf(entry: PackEntry): Promise<PackState> {
    const s = await stored(entry.id);
    return !s ? 'none' : s.hash !== entry.hash ? 'old' : 'ready';
  }

  /** 꼭 있어야 하는데 없거나 낡은 팩 */
  async function missingPacks(): Promise<PackEntry[]> {
    const idx = await cfg.index();
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
  function releaseAll(): void {
    for (const id of [...urls.keys()]) release(id);
    memo.clear();
  }

  /** 지금 살아 있는 blob 주소 수 (측정용) */
  const liveUrls = () => [...urls.values()].reduce((n, m) => n + m.size, 0);

  async function fileUrl(id: string, file: string): Promise<string> {
    const have = urls.get(id)?.get(file);
    if (have) return have;
    const s = await ensure(id);
    const row = s?.files[file] ?? s?.files[`${file}.png`];
    if (!row) return '';
    const u = URL.createObjectURL(new Blob([unbase64(row[1]) as BlobPart], { type: row[0] }));
    let m = urls.get(id);
    if (!m) urls.set(id, (m = new Map()));
    m.set(file, u);
    return u;
  }

  // ── 필요할 때 받기 (11-02) ──
  // 「받기」는 required 팩만 받는다. 인물 팩(char-*)·공용 이펙트(action-fx)·뱃지 같은 선택 팩은 게임이 처음 쓰려 할 때 목록(index.json)에서 찾아 그때 받아 둔다
  // (src/game/action/art/charPacks.ts: 「인물은 고를 때 받는다」). 받는 중이면 같은 약속을 돌려주고, 못 받으면 없는 것으로 친다.
  const fetching = new Map<string, Promise<Stored | null>>();
  async function ensure(id: string): Promise<Stored | null> {
    const have = await stored(id);
    if (have) return have;
    let p = fetching.get(id);
    if (!p) {
      p = (async () => {
        try {
          const entry = (await cfg.index()).packs.find((e) => e.id === id);
          if (!entry) return null;
          await downloadGamePack(entry);
          return await stored(id);
        } catch {
          return null;
        } finally {
          fetching.delete(id);
        }
      })();
      fetching.set(id, p);
    }
    return p;
  }

  const assets: GameAssets = {
    ready: async (id) => !!(await ensure(id)),
    url: fileUrl,
    atlas: async (id) => (await ensure(id))?.atlas ?? null,
    bytes: async (id, file) => {
      const row = (await ensure(id))?.files[file];
      return row ? unbase64(row[1]) : null;
    },
    list: async () => {
      let entries: PackEntry[] = [];
      try {
        entries = (await cfg.index()).packs;
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

  /** 읽어 둔 팩 내용만 잊는다 (많이 받을 때 메모리에 쌓이지 않게). 만든 주소는 그대로 */
  const forget = (id: string) => void memo.delete(id);
  return { assets, installGamePack, downloadGamePack, packStateOf, missingPacks, releaseAll, liveUrls, forget };
}

const game = createPackStore({ key: (id) => `goei:game:pack:${id}`, index: gameIndex, base: GAME_BASE });
export const { assets: gameAssets, installGamePack, downloadGamePack, packStateOf, missingPacks, releaseAll, liveUrls } = game;
