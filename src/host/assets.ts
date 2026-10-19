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

// 모듈 에셋은 수천 장이라 이름 → 줄 색인을 둔다 (그대로·소문자). 목록이 바뀌면 다시 만든다
let modIndex: { exact: Map<string, Row>; lower: Map<string, Row> } | null = null;
let modIndexVer = -1;
function modRow(name: string): Row | undefined {
  if (!modIndex || modIndexVer !== modVer) {
    modIndex = { exact: new Map(), lower: new Map() };
    for (const r of modRows) {
      if (!modIndex.exact.has(r[0])) modIndex.exact.set(r[0], r);
      if (!modIndex.lower.has(r[0].toLowerCase())) modIndex.lower.set(r[0].toLowerCase(), r);
    }
    modIndexVer = modVer;
  }
  return modIndex.exact.get(name) ?? modIndex.lower.get(name.toLowerCase());
}

/** 카드 에셋 → 모듈 에셋 순으로 그 이름(대소문자 무시)의 줄 */
function findRow(char: CharacterSnapshot, name: string): Row | undefined {
  const lower = name.toLowerCase();
  const card = ((char.additionalAssets ?? []) as unknown[]).filter(isRow);
  return card.find((a) => a[0] === name) ?? card.find((a) => a[0].toLowerCase() === lower) ?? modRow(name);
}

/** 사진으로 고를 수 있는 에셋 이름 (카드 → 모듈, 지도 그림 빼고) */
export function assetNames(char: CharacterSnapshot): string[] {
  const card = ((char.additionalAssets ?? []) as unknown[]).filter(isRow);
  return [...new Set([...card, ...modRows].map((r) => r[0]))].filter((n) => !/^map\d+$/i.test(n));
}

/** 사진을 찾을 재료 (괴이·특수·요원·조직 공통): 명부에서 고른 얼굴·대표 사진과 영문명 */
export interface PicSource {
  face?: string;
  photo?: string;
  english?: string;
  /** 대표 사진에서 얼굴로 자를 틀 「가로,세로,크기」 (%) */
  crop?: string;
}

/** 얼굴 틀을 따로 맞추지 않은 요원: 카우보이샷의 위쪽 가운데 */
export const DEFAULT_CROP = '50,19,40';

/** 「가로,세로,크기」(%) → 틀 중심(가로·세로)과 한 변(그림 너비 대비). 잘못된 값은 null */
export function parseCrop(s: string | undefined): [number, number, number] | null {
  const n = String(s ?? '').split(',').map(Number);
  if (n.length !== 3 || n.some((x) => !Number.isFinite(x))) return null;
  const c = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  return [c(n[0], 0, 100), c(n[1], 0, 100), c(n[2], 5, 100)];
}

/** 사진 이름 「이름#가로,세로,크기」 → 에셋 이름과 자를 틀 */
export function splitPic(pic: string): { name: string; crop: [number, number, number] | null } {
  const at = pic.lastIndexOf('#');
  const crop = at > 0 ? parseCrop(pic.slice(at + 1)) : null;
  return crop ? { name: pic.slice(0, at), crop } : { name: pic, crop: null };
}

/** 대표 사진 (위키 문서 정보표·시작 화면 세력 카드·ID카드 배경): 고른 대표 → 「영문명_default」 → 「영문명」 */
export function mainPic(char: CharacterSnapshot, p: PicSource): string {
  const en = p.english ?? '';
  if (p.photo) return p.photo;
  if (en && hasAsset(char, `${en}_default`)) return `${en}_default`;
  if (en && hasAsset(char, en)) return en;
  return '';
}

/**
 * 얼굴 사진 (요원 카드·명부 목록·위키 목록·괴담톡): 고른 얼굴 → 「영문명」 → 대표 사진에서 얼굴 틀만큼 자른 것.
 * 틀은 명부에서 맞춘 값, 없으면 사람(요원)만 기본 틀. 사람이 아니면 대표 사진을 그대로 쓴다
 */
export function facePic(char: CharacterSnapshot, p: PicSource, person = false): string {
  if (p.face) return p.face;
  if (p.english && hasAsset(char, p.english)) return p.english;
  const main = mainPic(char, p);
  const crop = parseCrop(p.crop) ?? (person ? parseCrop(DEFAULT_CROP) : null);
  return main && crop ? `${main}#${crop.join(',')}` : main;
}

/** 그 이름의 에셋이 카드나 에셋 모듈에 있는지 */
export const hasAsset = (char: CharacterSnapshot, name: string): boolean => !!name && !!findRow(char, splitPic(name).name);

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
