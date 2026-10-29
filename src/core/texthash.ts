// 글 지문. 시작기(loader/body.ts)·본체(host/datapack.ts)·빌드(scripts/data-pack.mjs textHash)가 같은 식을 쓴다.

/** UTF-16 단위의 FNV-1a 32비트 (소문자 hex 8자). 길이만 보면 글자가 바뀐 조각을 못 잡는다. crypto.subtle 이 없는 환경(보안 컨텍스트 아님)에서도 된다 */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** 글 전체의 sha256 (UTF-8 바이트, 소문자 hex 64자). crypto.subtle 이 없거나 실패하면 null → 부르는 쪽이 textHash 로 */
export async function sha256Text(text: string): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const d = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}
