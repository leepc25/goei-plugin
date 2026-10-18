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

/** 이름으로 캐릭터 에셋 URL. 없거나 못 읽으면 null */
export function assetUrl(char: CharacterSnapshot, name: string): Promise<string | null> {
  const list = (char.additionalAssets ?? []) as unknown[];
  const row = list.find((a): a is [string, string, string?] => Array.isArray(a) && a[0] === name && typeof a[1] === 'string');
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
