// 명부 「요원 목록 기본값 판」(roster_v) 옮기기. directory.ts(읽기·쓰기)와 factions.ts(시작 화면 칸)가 같이 쓴다.
// factions.ts 는 저장된 명부 글을 그대로 읽어서, 여기서 옮기지 않으면 옛 명부(roster_v 없음)를 가진 봇은 명부를 한 번 저장하기 전까지 「중립」 칸이 안 보인다.
import type { DirectoryData } from './directory';

export const ROSTER_V = 3;

/** 시작 묶음 「중립」의 기본 인물 (2026-11-05 사용자): 세력 없는 인물로 플레이하는 칸 */
export const NEUTRAL_GROUP = '중립';
export const NEUTRAL_IDS = ['P043', 'P044', 'P045', 'P046', 'P047', 'P048', 'P049', 'P050', 'P051', 'P052', 'P053', 'P054', 'P055'];
/** 영문명: 사진 이름(「Neutral」 이미지)과 영어 응답에서 쓴다 — 기본 세력 사진(Management Bureau.avif 등)과 같은 규칙 */
export const NEUTRAL_ENGLISH = 'Neutral';
export const NEUTRAL_BLURB = '어느 조직에도 속하지 않은 사람들. 교황청 수녀, 이슬람 성전사, 마녀, 흡혈귀, 중림 상인, 그리고 사람이 아닌 것까지.';

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** F00…Z00 중 안 쓴 첫 코드 (없으면 '') */
export function freeGroupCode(used: Iterable<string>): string {
  const set = new Set(used);
  for (let c = 'F'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c++) {
    const want = `${String.fromCharCode(c)}00`;
    if (!set.has(want)) return want;
  }
  return '';
}

/** 판 3: 시작 묶음 「중립」이 없으면 만들고(다음 코드), 기본 인물 13명의 roster_for 에 그 코드를 켠다 */
function migrateNeutral(d: DirectoryData): void {
  const groups = (d['시작 묶음'] ??= {});
  const used = [...(d.codes_used ?? []), ...Object.values(d.조직 ?? {}).map((o) => s(o.code)), ...Object.values(groups).map((g) => s(g.code))];
  let code: string;
  if (!Object.keys(groups).includes(NEUTRAL_GROUP)) {
    code = freeGroupCode(used);
    if (!code) return;
    groups[NEUTRAL_GROUP] = { code, blurb: NEUTRAL_BLURB, english: NEUTRAL_ENGLISH };
    d.codes_used = [...new Set([...(d.codes_used ?? []), code])].sort();
  } else code = s(groups[NEUTRAL_GROUP].code);
  if (!code) return;
  for (const row of Object.values(d.요원 ?? {})) {
    const r = row as { id?: unknown; roster_for?: unknown };
    if (!NEUTRAL_IDS.includes(s(r.id))) continue;
    const list = Array.isArray(r.roster_for) ? (r.roster_for as unknown[]).map(s).filter(Boolean) : [];
    if (!list.includes(code)) r.roster_for = [...list, code];
  }
}

/** 옛 명부(roster_v 없음)는 조직·요원마다 roster_for 를 다 적어 두어서, 민간인·프리랜서 목록이 저장된 채로 남는다.
 *  2026-11-05 사용자: 민간인·프리랜서 플레이에는 내 페르소나 말고 아무도 안 붙는다 → 한 번 D00·E00 을 전부 떼고 판을 올린다 */
export function migrateRoster(d: DirectoryData): DirectoryData {
  const v = d.roster_v ?? 1;
  if (v >= ROSTER_V) return d;
  if (v < 2) {
    const strip = (rows?: Record<string, { roster_for?: unknown }>) => {
      for (const r of Object.values(rows ?? {})) if (Array.isArray(r.roster_for)) r.roster_for = r.roster_for.filter((f) => f !== 'D00' && f !== 'E00');
    };
    strip(d.조직);
    strip(d.요원);
  }
  if (v < 3) migrateNeutral(d);
  d.roster_v = ROSTER_V;
  return d;
}
