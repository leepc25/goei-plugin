// 명부 「요원 목록 기본값 판」(roster_v) 옮기기. directory.ts(읽기·쓰기)와 factions.ts(시작 화면 칸)가 같이 쓴다.
// factions.ts 는 저장된 명부 글을 그대로 읽어서, 여기서 옮기지 않으면 옛 명부(roster_v 없음)를 가진 봇은 명부를 한 번 저장하기 전까지 「중립」 칸이 안 보인다.
import type { DirectoryData } from './directory';

export const ROSTER_V = 6; // 4: 중립 설명 글 고침(11-06) · 5: 「중립」→「다른 세력」 · 6: 「이면의 주민들」로 이름·영문·설명·그림 확정(11-06 사용자)

/** 시작 묶음 「이면의 주민들」(11-06 사용자, 옛 이름 「중립」→「다른 세력」)의 기본 인물 (2026-11-05 사용자): 기본 세력 밖 인물로 플레이하는 칸 */
export const NEUTRAL_GROUP = '이면의 주민들';
export const NEUTRAL_GROUP_OLD: readonly string[] = ['중립', '다른 세력'];
export const NEUTRAL_IDS = ['P043', 'P044', 'P045', 'P046', 'P047', 'P048', 'P049', 'P050', 'P051', 'P052', 'P053', 'P054', 'P055'];
/** 영문명: 사진 이름(「Neutral」 이미지)과 영어 응답에서 쓴다 — 기본 세력 사진(Management Bureau.avif 등)과 같은 규칙 */
export const NEUTRAL_ENGLISH = 'Residents of the Hidden World';
export const NEUTRAL_ENGLISH_OLD: readonly string[] = ['Neutral', 'Other Factions'];
export const NEUTRAL_BLURB = '저마다의 사정과 목적을 품고, 서울의 이면을 살아가는 이들.';
/** 11-06 이전 기본 설명들(사용자가 물린 글) — 저장된 명부에 그대로 남은 것은 새 글로 바꾼다. 사용자가 직접 고친 글은 건드리지 않는다 */
export const NEUTRAL_BLURB_OLD: readonly string[] = [
  '어느 조직에도 속하지 않은 사람들. 교황청 수녀, 이슬람 성전사, 마녀, 흡혈귀, 중림 상인, 그리고 사람이 아닌 것까지.',
  '요원이 아닌 쪽에서 괴이와 얽힌 사람들. 사냥하거나, 거래하거나, 혹은 스스로 괴이다.',
  '제 조직과 제 목적을 따로 가진 자들. 누구의 편도 아니고, 필요하면 누구와도 손을 잡는다.',
  '다른 세력의 인물 하나를 골라 그 사람으로 시작한다.',
];

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

/** 판 3: 시작 묶음 「다른 세력」이 없으면 만들고(다음 코드), 기본 인물 13명의 roster_for 에 그 코드를 켠다.
 *  판 5·6: 옛 이름(「중립」「다른 세력」)으로 저장된 묶음은 「이면의 주민들」로 이름을 바꾸고 영문·물린 설명을 새 것으로 */
function migrateNeutral(d: DirectoryData): void {
  const groups = (d['시작 묶음'] ??= {});
  for (const old of NEUTRAL_GROUP_OLD) {
    if (!groups[old]) continue;
    if (!groups[NEUTRAL_GROUP]) groups[NEUTRAL_GROUP] = groups[old];
    delete groups[old];
  }
  const used = [...(d.codes_used ?? []), ...Object.values(d.조직 ?? {}).map((o) => s(o.code)), ...Object.values(groups).map((g) => s(g.code))];
  let code: string;
  if (!Object.keys(groups).includes(NEUTRAL_GROUP)) {
    code = freeGroupCode(used);
    if (!code) return;
    groups[NEUTRAL_GROUP] = { code, blurb: NEUTRAL_BLURB, english: NEUTRAL_ENGLISH };
    d.codes_used = [...new Set([...(d.codes_used ?? []), code])].sort();
  } else {
    code = s(groups[NEUTRAL_GROUP].code);
    if (NEUTRAL_BLURB_OLD.includes(s(groups[NEUTRAL_GROUP].blurb))) groups[NEUTRAL_GROUP].blurb = NEUTRAL_BLURB;
    if (NEUTRAL_ENGLISH_OLD.includes(s(groups[NEUTRAL_GROUP].english))) groups[NEUTRAL_GROUP].english = NEUTRAL_ENGLISH;
  }
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
  if (v < 6) migrateNeutral(d); // 판 3→4→5→6: 설명 글·이름만 바꿈 (migrateNeutral 은 두 번 돌아도 같음)
  d.roster_v = ROSTER_V;
  return d;
}
