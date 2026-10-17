// 실제 사진 첨부: 고른 사진을 줄여 Risu 에셋 저장소에 넣고(risuai.saveAsset), 그 경로만 채팅에 남긴다.
// 채팅 변수에 사진 데이터를 넣으면 채팅이 무거워져서(렉의 원인) 경로만 둔다. 원본 채팅의 인레이 사진은 readInlay로 읽는다.

/** 올릴 때 긴 쪽 최대 크기 (AI 입력과 창 표시에 충분한 크기) */
const UPLOAD_SIDE = 1280;
const MAX_FILE = 20 * 1024 * 1024;

export class PhotoError extends Error {}

/** 저장할 때 확장자가 늘 .png라서 실제 형식은 바이트로 알아본다 */
export function sniffMime(b: Uint8Array): string {
  const s = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (b[0] === 0x89 && s(1, 3) === 'PNG') return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'image/webp';
  if (s(0, 3) === 'GIF') return 'image/gif';
  if (s(4, 4) === 'ftyp' && /avi[fs]/.test(s(8, 4))) return 'image/avif';
  return 'image/png';
}

function toBytes(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(data as number[]);
  if (data && typeof data === 'object') {
    const values = Object.values(data as Record<string, unknown>);
    if (values.length && values.every((v) => typeof v === 'number')) return new Uint8Array(values as number[]);
  }
  return null;
}

function base64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(out);
}

/** 사진 하나를 줄여 저장. 돌려주는 asset은 채팅 기록에 넣을 경로, preview는 작성칸 미리보기 */
export async function savePhoto(file: Blob): Promise<{ asset: string; preview: string }> {
  if (!file.type.startsWith('image/')) throw new PhotoError('사진 파일만 보낼 수 있어요.');
  if (file.size > MAX_FILE) throw new PhotoError('사진이 너무 커요 (20MB까지).');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PhotoError('사진을 열지 못했어요. 다른 형식(JPG·PNG)으로 다시 시도해 주세요.');
  }
  const scale = Math.min(1, UPLOAD_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const g = canvas.getContext('2d');
  if (!g) throw new PhotoError('사진을 줄이지 못했어요.');
  g.imageSmoothingQuality = 'high';
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = (await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.86))) ?? (await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.88)));
  if (!blob) throw new PhotoError('사진을 줄이지 못했어요.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let asset: unknown;
  try {
    asset = await risuai.saveAsset(bytes);
  } catch (error) {
    throw new PhotoError(`사진을 저장하지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof asset !== 'string' || !asset) throw new PhotoError('사진을 저장하지 못했어요.');
  return { asset, preview: URL.createObjectURL(blob) };
}

/** 저장된 사진을 data URL로 (AI 입력용). 못 읽으면 null */
export async function photoData(asset: string): Promise<string | null> {
  try {
    if (asset.startsWith('assets/')) {
      const bytes = toBytes(await risuai.readImage(asset));
      return bytes?.length ? `data:${sniffMime(bytes)};base64,${base64(bytes)}` : null;
    }
    const inlay = await risuai.readInlay(asset);
    return inlay && inlay.type === 'image' && typeof inlay.data === 'string' ? inlay.data : null;
  } catch {
    return null;
  }
}

/** 저장된 사진을 창에 띄울 URL로 */
export async function photoUrl(asset: string): Promise<string | null> {
  try {
    if (asset.startsWith('assets/')) {
      const bytes = toBytes(await risuai.readImage(asset));
      return bytes?.length ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: sniffMime(bytes) })) : null;
    }
    const inlay = await risuai.readInlay(asset);
    return inlay && inlay.type === 'image' && typeof inlay.data === 'string' ? inlay.data : null;
  } catch {
    return null;
  }
}
