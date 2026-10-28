// 사진 업데이트: 카드 업데이트(글 내용)는 사진을 못 옮기므로, 카드 매니페스트의 사진 목록(이름·지문)을 비교해
// 지문이 바뀌었거나 새로 생긴 카드 사진만 저장소 release/pic/지문.확장자 에서 받아 에셋 저장소에 넣는다.
// 카드가 준 이름의 사진만 바꾸고, 사용자가 넣은 사진(카드 목록에 없는 이름)은 건드리지 않는다.
import { UPDATE_BASE } from '../core/update';
import type { Picture, PicPlan } from '../core/pictures';
import { toBytes } from './assets';

type Row = [string, string, string?];
const isRow = (r: unknown): r is Row => Array.isArray(r) && typeof r[0] === 'string' && typeof r[1] === 'string';

export class PicError extends Error {}

type RisuFetch = (url: string, arg: Record<string, unknown>) => Promise<{ ok: boolean; data: unknown; status: number }>;

/** sha1 앞 12자 (카드 빌드 card_pictures 와 같게). 보안 컨텍스트가 아니라 crypto.subtle 이 없으면 null */
export async function digest(b: Uint8Array): Promise<string | null> {
  try {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-1', b as BufferSource));
    return [...h].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 12);
  } catch {
    return null; // 지문을 못 내는 환경이면 확인 없이 쓴다
  }
}

/** 사진 한 장을 받는다. Risu 본 화면에서 직접(risuFetch), 안 되면 nativeFetch. 지문이 다르면 실패 */
async function fetchPicture(p: Picture): Promise<Uint8Array> {
  const url = `${UPDATE_BASE}/pic/${p[1]}.${p[2]}`;
  const ok = async (b: Uint8Array | null) => !!b?.length && ((await digest(b)) ?? p[1]) === p[1];
  const legacy = (risuai as unknown as { risuFetch?: RisuFetch }).risuFetch;
  if (legacy) {
    try {
      const r = await legacy(url, { method: 'GET', plainFetchForce: true, rawResponse: true, headers: { 'Content-Type': 'text/plain' } });
      const b = r?.ok ? toBytes(r.data) : null;
      if (await ok(b)) return b!;
    } catch {
      // 아래에서 다시 시도
    }
  }
  try {
    const res = await risuai.nativeFetch(url, { method: 'GET' });
    if (res.ok) {
      const b = new Uint8Array(await res.arrayBuffer());
      if (await ok(b)) return b;
    }
  } catch {
    // 아래 안내
  }
  throw new PicError(`사진 「${p[0]}」을 받지 못했어요.`);
}

/**
 * 고른 사진을 모두 받은 뒤에만 에셋 저장소에 넣고, 바뀐 에셋 목록을 돌려준다 (하나라도 못 받으면 아무것도 바꾸지 않음).
 * 같은 이름 줄은 경로만 새 것으로 바꾸고, 새 이름은 뒤에 붙인다.
 */
export async function fetchPictures(
  assets: unknown,
  plan: PicPlan,
  progress: (done: number, phase: 'get' | 'save') => void,
): Promise<unknown[]> {
  const got: [Picture, Uint8Array][] = [];
  let i = 0;
  // 한 장이라도 실패하면 나머지 일꾼도 멈춘다 (QC 2026-10-28: 안 멈추면 실패를 알린 뒤에도 남은 수백 장을 계속 받으려 해 요청만 낭비)
  let failed = false;
  const worker = async () => {
    while (i < plan.get.length && !failed) {
      const p = plan.get[i++];
      try {
        got.push([p, await fetchPicture(p)]);
      } catch (error) {
        failed = true;
        throw error;
      }
      progress(got.length, 'get');
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  // 저장도 몇 장씩 함께 (한 장씩 차례로 넣으면 160장에 한참 걸림)
  const paths: string[] = new Array(got.length);
  let j = 0;
  let saved = 0;
  progress(0, 'save');
  const saver = async () => {
    while (j < got.length) {
      const k = j++;
      let path: unknown;
      try {
        path = await risuai.saveAsset(got[k][1]);
      } catch (error) {
        throw new PicError(`사진을 저장하지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (typeof path !== 'string' || !path) throw new PicError('사진을 저장하지 못했어요.');
      paths[k] = path;
      progress(++saved, 'save');
    }
  };
  await Promise.all([saver(), saver(), saver(), saver()]);
  const rows = ((Array.isArray(assets) ? assets : []) as unknown[]).map((r) => (isRow(r) ? ([...r] as Row) : r));
  got.forEach(([p], k) => {
    const row = rows.find((r): r is Row => isRow(r) && r[0] === p[0]);
    if (row) (row[1] = paths[k]), (row[2] = p[2]);
    else rows.push([p[0], paths[k], p[2]]);
  });
  return rows;
}
