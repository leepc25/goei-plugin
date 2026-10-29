// 실제 토크나이저 (2026-10-27 사용자: o200k_base). 순위표는 크기(2MB)가 커서 플러그인에 넣지 않고
// release/tok-o200k.N.txt 로 받아 플러그인 저장소에 둔다 (host/install.ts). 받기 전에는 gnet.ts 의 어림값을 쓴다.
import { Tiktoken } from 'js-tiktoken/lite';

interface Ranks {
  pat_str: string;
  special_tokens: Record<string, number>;
  bpe_ranks: string;
}

let enc: Tiktoken | null = null;
let label = '';
const cache = new Map<string, number>();
const CACHE_MAX = 400;

/** 순위표(JSON 글)를 올린다. 틀리면 false (어림값 그대로) */
export function setTokenizerRanks(json: unknown, name: string): boolean {
  try {
    const r = (typeof json === 'string' ? JSON.parse(json) : json) as Ranks;
    if (!r || typeof r.pat_str !== 'string' || typeof r.bpe_ranks !== 'string') return false;
    enc = new Tiktoken({ pat_str: r.pat_str, special_tokens: r.special_tokens ?? {}, bpe_ranks: r.bpe_ranks });
    label = name;
    cache.clear();
    return true;
  } catch {
    enc = null;
    label = '';
    return false;
  }
}

export function clearTokenizer(): void {
  enc = null;
  label = '';
  cache.clear();
}

/** 올라간 토크나이저 이름 (없으면 빈 문자열 = 어림값) */
export const tokenizerName = (): string => label;

/** 정확한 토큰 수. 토크나이저가 없으면 null */
export function exactTokens(text: string): number | null {
  if (!enc) return null;
  const s = String(text ?? '');
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  let n: number;
  try {
    n = enc.encode(s, [], []).length;
  } catch {
    return null;
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(s, n);
  return n;
}
