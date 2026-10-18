// 카드에 들어 있는 이미지(지도 map01~map18)를 플러그인 창에서 쓸 수 있는 blob URL로 바꾼다.
// 캐릭터 에셋은 char.additionalAssets = [이름, 저장 경로, 확장자]. 한 번 읽은 것은 캐릭터별로 기억한다.
import type { CharacterSnapshot } from './risu';

const MIME: Record<string, string> = { avif: 'image/avif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const cache = new Map<string, Promise<string | null>>();

export function toBytes(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(data as number[]);
  if (data && typeof data === 'object') {
    // 직렬화 경계를 넘으며 {0:..,1:..} 꼴이 된 경우
    const values = Object.values(data as Record<string, unknown>);
    if (values.length && values.every((v) => typeof v === 'number')) return new Uint8Array(values as number[]);
  }
  return null;
}

async function load(path: string, ext: string): Promise<string | null> {
  try {
    const data: unknown = await risuai.readImage(path);
    if (typeof data === 'string') return data.startsWith('data:') || data.startsWith('blob:') || data.startsWith('http') ? data : null;
    const bytes = toBytes(data);
    if (!bytes?.length) return null;
    return URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[ext.toLowerCase()] ?? 'application/octet-stream' }));
  } catch (error) {
    console.log(`[goei] 이미지를 읽지 못했어요 (${path}): ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

type Row = [string, string, string?];
const isRow = (a: unknown): a is Row => Array.isArray(a) && typeof a[0] === 'string' && typeof a[1] === 'string';

// 표정 세트(「이름_default」 등)는 카드가 아니라 따로 까는 에셋 모듈에 들어 있다. 창을 열 때 모듈 에셋 목록을 읽어 둔다
let modRows: Row[] = [];
let modVer = 0;
let modBusy: Promise<boolean> | null = null;
/** 모듈 에셋 목록을 다시 읽는다. 바뀌었으면 true (창을 열 때 한 번, 기다리지 않고 부른다) */
export function loadModuleAssets(): Promise<boolean> {
  modBusy ??= (async () => {
    let rows: Row[] = [];
    try {
      const db = await risuai.getDatabase(['modules', 'enabledModules']);
      const on = new Set(db?.enabledModules ?? []);
      const mods = [...(db?.modules ?? [])].sort((a, b) => Number(on.has(b.id)) - Number(on.has(a.id)));
      rows = mods.flatMap((m) => (Array.isArray(m.assets) ? m.assets.filter(isRow) : []));
    } catch {
      /* 권한이 없거나 못 읽으면 카드 에셋만 쓴다 */
    }
    const changed = JSON.stringify(rows) !== JSON.stringify(modRows);
    if (changed) (modRows = rows), modVer++;
    return changed;
  })().finally(() => {
    modBusy = null;
  });
  return modBusy;
}

/** 모듈 에셋 목록을 언제 읽었는지 (목록 캐시 무효화용) */
export const moduleAssetStamp = () => modVer;

/** 카드 에셋 → 모듈 에셋 순으로 그 이름(대소문자 무시)의 줄 */
function findRow(char: CharacterSnapshot, name: string): Row | undefined {
  const lower = name.toLowerCase();
  const card = ((char.additionalAssets ?? []) as unknown[]).filter(isRow);
  return card.find((a) => a[0] === name) ?? card.find((a) => a[0].toLowerCase() === lower) ?? modRows.find((a) => a[0] === name) ?? modRows.find((a) => a[0].toLowerCase() === lower);
}

/** 사진으로 고를 수 있는 에셋 이름 (카드 → 모듈, 지도·세력 기본 그림 빼고) */
export function assetNames(char: CharacterSnapshot): string[] {
  const card = ((char.additionalAssets ?? []) as unknown[]).filter(isRow);
  return [...new Set([...card, ...modRows].map((r) => r[0]))].filter((n) => !/^(map\d+|f0\d)$/i.test(n));
}

/** 괴이·특수·요원·조직 사진 이름 (넷 다 같은 규칙): 고른 사진 → 「영문명_default」 → 「영문명」 → 기본 그림(조직 f01~f05) */
export function pictureName(char: CharacterSnapshot, photo: string | undefined, english: string, fallback = ''): string {
  if (photo) return photo;
  if (english && hasAsset(char, `${english}_default`)) return `${english}_default`;
  if (english && hasAsset(char, english)) return english;
  return fallback || english;
}

/** 그 이름의 에셋이 카드나 에셋 모듈에 있는지 */
export const hasAsset = (char: CharacterSnapshot, name: string): boolean => !!name && !!findRow(char, name);

/** 이름으로 캐릭터(없으면 에셋 모듈) 에셋 URL. 없거나 못 읽으면 null */
export function assetUrl(char: CharacterSnapshot, name: string): Promise<string | null> {
  const row = findRow(char, name);
  if (!row) return Promise.resolve(null);
  const key = `${String(char.chaId ?? char.name ?? '')}|${row[1]}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = load(row[1], String(row[2] ?? row[1].split('.').pop() ?? ''));
    cache.set(key, hit);
    void hit.then((url) => {
      if (!url) cache.delete(key); // 실패는 다음에 다시 시도
    });
  }
  return hit;
}
