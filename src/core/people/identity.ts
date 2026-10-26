// 유저 신분: 상태창 9번째 칸 `조직/직급` → 조직 코드와 직급 사다리 숫자 (docs/필드_대사_설계_결정.md 확정 사다리).
import type { Identity } from './types';

const ORG_CODES: [RegExp, string][] = [
  [/가짜\s*관리국|fake/i, 'B00'],
  [/관리국|management bureau|bureau/i, 'A00'],
  [/백일몽|daydream/i, 'C00'],
  [/민간|civilian|시민/i, 'D00'],
  [/프리랜서|freelancer|협회 등록/i, 'E00'],
];
export function factionCode(org: string): string {
  const t = org.trim();
  if (/^[A-Z]00$/.test(t)) return t;
  for (const [re, code] of ORG_CODES) if (re.test(t)) return code;
  return '';
}

/** 직급 사다리. 관리국은 0~3, 회사(가짜 관리국·백일몽)는 0~9, 프리랜서는 등급 0~5. 모르면 null */
export function rankLevel(faction: string, rank: string): number | null {
  const r = rank.replace(/\s+/g, '');
  if (!r || /^(-|없음|미정)$/.test(r)) return null;
  if (/신입|교육생|인턴|수습|trainee|rookie/i.test(r)) return 0;
  if (faction === 'A00') {
    if (/부장|팀장|chief/i.test(r)) return 3;
    if (/선임|책임자|senior|lead/i.test(r)) return 2;
    if (/요원|연구원|agent|researcher/i.test(r)) return 1;
    return null;
  }
  if (faction === 'B00' || faction === 'C00') {
    const table: [RegExp, number][] = [[/사장|ceo/i, 9], [/전무/, 8], [/국장|이사|director/i, 7], [/부장/, 6], [/차장/, 5], [/과장|manager/i, 4], [/대리/, 3], [/주임/, 2], [/사원|직원|staff/i, 1]];
    for (const [re, n] of table) if (re.test(r)) return n;
    return null;
  }
  if (faction === 'E00') {
    if (/특급/.test(r)) return 5;
    const m = /([1-5])\s*급/.exec(r);
    if (m) return 5 - Number(m[1]);
    if (/정예/.test(r)) return 4;
    if (/선임/.test(r)) return 3;
    if (/숙련/.test(r)) return 2;
    if (/일반/.test(r)) return 1;
    if (/임시/.test(r)) return 0;
  }
  return null;
}

/** 상태창 신분 칸 `관리국/신입` → Identity. 비었거나 `-`면 null */
export function parseIdentity(text: string, anchor: string, from: Identity['from'] = 'status'): Identity | null {
  const t = String(text ?? '').trim();
  if (!t || t === '없음' || t === '-') return null;
  const [org, ...rest] = t.split(/[\/|·,]/).map((x) => x.trim());
  const rank = rest.join(' ').replace(/^-$/, '');
  const faction = factionCode(org);
  return { faction: faction || org, rank, level: rankLevel(faction, rank), from, anchor };
}

/** 상태창에 넣을 표기 */
export const identityText = (id: Identity | undefined): string => (id ? `${ORG_NAMES[id.faction] ?? id.faction}/${id.rank || '-'}` : '');
const ORG_NAMES: Record<string, string> = { A00: '관리국', B00: '가짜 관리국', C00: '백일몽', D00: '민간인', E00: '프리랜서' };

/** 유저와 인물의 상하: 같은 조직일 때만 비교. up = 유저가 위 */
export function relativeRank(user: Identity | undefined, personFaction: string, personLevel: number | null): 'up' | 'peer' | 'down' | 'outsider' {
  if (!user || !user.faction || user.faction !== personFaction) return 'outsider';
  const u = user.level ?? 0;
  if (personLevel === null) return 'peer';
  return u > personLevel ? 'up' : u < personLevel ? 'down' : 'peer';
}
