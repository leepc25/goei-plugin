// 유저(페르소나) 사진과 이름. 원본 카드처럼 <img src="{{source::user}}">를 쓰는데, 이 표식은 Risu가 채팅 메시지를
// 그릴 때만 사진 주소로 바뀐다. 그래서 채팅 메시지 끝에 숨은 칸을 붙여 두고(USER_MARK) 본 화면에서 그 주소를 읽어,
// 주소에 든 에셋 경로를 readImage로 읽는다 (플러그인 창 iframe은 본 화면 주소를 직접 못 띄운다).
// 이름은 {{user}}. 전체 데이터베이스 권한(페르소나 목록)은 경고 창이 3일마다 떠서 쓰지 않는다.

/** 채팅 메시지 끝에 붙이는 숨은 칸 (display 핸들러). data- 속성은 Risu의 HTML 정리에서 살아남는다 */
export const USER_MARK = '<span data-goei-user hidden style="display:none"><img src="{{source::user}}" alt=""><b data-goei-uname>{{user}}</b></span>';

export interface UserInfo {
  name: string;
  photo: string | null;
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
let cached: UserInfo = { name: '', photo: null };
let lastSrc = '';
const SRC_KEY = 'goei:user-src';
const NAME_KEY = 'goei:user-name';

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

const unescape = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Risu getFileSrc가 만든 주소에서 에셋 경로(assets/…)를 되찾는다. 웹 /sw/img/<hex>, 계정 저장 …/rs/assets/…, 데스크톱 파일 주소 */
export function assetPathOf(src: string): string | null {
  const sw = src.match(/\/sw\/img\/([0-9a-f]+)/i);
  if (sw) {
    const hex = sw[1];
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    const path = new TextDecoder().decode(bytes);
    return path.startsWith('assets/') ? path : null;
  }
  let s = src;
  try {
    s = decodeURIComponent(src);
  } catch {
    /* 그대로 */
  }
  const m = s.replace(/\\/g, '/').match(/(?:^|\/)assets\/([^/?#]+)$/);
  return m ? `assets/${m[1]}` : null;
}

async function photoFrom(src: string): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith('data:')) return src;
  const path = assetPathOf(src);
  if (!path) return null;
  const data: unknown = await risuai.readImage(path);
  if (typeof data === 'string') return data.startsWith('data:') ? data : null;
  const bytes = toBytes(data);
  if (!bytes?.length) return null;
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[ext] ?? 'image/png' }));
}

/** 지금 채팅의 유저 이름·사진. 못 읽으면 지난 값(처음엔 빈 값) */
export async function readUser(): Promise<UserInfo> {
  let name = cached.name;
  let photo = cached.photo;
  try {
    const doc = await risuai.getRootDocument();
    const box = await doc.querySelector('[data-goei-user]');
    const html = box ? await box.getInnerHTML() : '';
    // 이름: 채팅이 그려질 때 {{user}}가 페르소나 이름으로 바뀐 글자 (parseRisuChat은 환경에 따라 빈 값이 온다)
    const shownName = unescape(html.match(/<b[^>]*data-goei-uname[^>]*>([^<]*)<\/b>/)?.[1] ?? '').trim();
    if (shownName && shownName !== '{{user}}') {
      if (shownName !== name) await risuai.pluginStorage.setItem(NAME_KEY, shownName).catch(() => {});
      name = shownName;
    }
    // 채팅에 숨은 칸이 아직 없으면(메시지가 하나도 안 그려졌을 때) 지난번에 읽은 주소를 쓴다
    let src = unescape(html.match(/src="([^"]*)"/)?.[1] ?? '');
    if (!src) src = String((await risuai.pluginStorage.getItem(SRC_KEY).catch(() => '')) ?? '');
    else if (!src.startsWith('data:')) await risuai.pluginStorage.setItem(SRC_KEY, src).catch(() => {});
    if (src && src !== lastSrc) {
      const next = await photoFrom(src);
      if (next) {
        if (photo?.startsWith('blob:')) URL.revokeObjectURL(photo);
        photo = next;
        lastSrc = src;
      }
    }
  } catch (error) {
    console.log(`[goei] 유저 사진을 읽지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!name) {
    try {
      const n = String((await risuai.parseRisuChat('{{user}}')) ?? '').trim();
      if (n && !n.includes('{{')) name = n;
    } catch {
      /* 채팅이 없으면 아래 저장값 */
    }
  }
  if (!name) name = String((await risuai.pluginStorage.getItem(NAME_KEY).catch(() => '')) ?? '');
  cached = { name, photo };
  return cached;
}

export const userInfo = (): UserInfo => cached;
