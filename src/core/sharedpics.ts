// 공용 그림 고르기 (2026-10-21 사용자: 공용 그림을 여러 장 두고 맥락에 맞게). 그림 목록과 요청문은 docs/공용그림_GPT요청서.md.
// 모델을 부르지 않고 이름·장소·상황 글의 낱말로 점수를 매긴다. 후보 이름을 좋은 순서로 돌려주고, 카드에 있는 첫 그림을 쓰는 건 부르는 쪽이 한다.
// 점수가 같으면 대상 이름으로 정해서 같은 대상은 늘 같은 그림이 나온다.

type Table = [string, string[]][];

const PLACES_AN: Table = [
  ['Apartment', ['아파트', '빌라', '단지', '맨션', '오피스텔', '고시원', '복도']],
  ['School', ['학교', '교실', '기숙학교', '학원', '대학', '캠퍼스', '보육원', '유치원']],
  ['Hospital', ['병원', '의원', '병동', '응급실', '요양', '진료']],
  ['Subway', ['지하철', '승강장', '전철', '선로', '교통공사', '열차', '기차', '역']],
  ['Road', ['도로', '국도', '고개', '차도', '사망단길']],
  ['Tunnel', ['터널', '지하도', '굴']],
  ['Forest', ['숲', '산', '등산', '수목원', '정원', '공원']],
  ['Amusement', ['놀이공원', '테마파크', '랜드', '파크', '워터파크', '동물원', '서커스', '극단', '축제', '민속촌', '쇼']],
  ['Lodging', ['호텔', '모텔', '리조트', '숙소', '펜션', '여관', '민박']],
  ['Ruin', ['폐', '공장', '저택', '지하실', '창고', '미술관', '극장', '백화점', '연구소', '홀']],
  ['Elevator', ['엘리베이터', '승강기']],
  ['Village', ['마을', '시골', '농촌', '명절', '도시']],
  ['Office', ['회사', '사무실', '빌딩', '오피스', '야근', '출근']],
  ['Sea', ['바다', '해변', '해수욕장', '섬', '항구', '등대', '배']],
  ['Shrine', ['신당', '사당', '무덤', '묘지', '납골', '장례', '절', '굿']],
];
const PLACES_IN: Table = [
  ['Street', ['거리', '도심', '번화가', '사거리', '광장', '대로']],
  ['Apartment', ['아파트', '빌라 단지', '단지', '맨션', '오피스텔']],
  ['Subway', ['지하철', '승강장', '전철', '선로', '열차', '기차', '역']],
  ['Hospital', ['병원', '의원', '병동', '응급실', '요양']],
  ['School', ['학교', '교실', '학원', '대학', '캠퍼스', '보육원']],
  ['Port', ['항구', '부두', '컨테이너', '터미널', '선착장', '항']],
  ['Factory', ['공장', '창고', '물류', '산업단지', '발전소']],
  ['Market', ['시장', '상가', '장터', '마트', '백화점', '쇼핑']],
  ['Mountain', ['산', '등산', '계곡', '숲', '야산']],
  ['River', ['강', '한강', '하천', '다리', '교량', '강변', '호수', '저수지', '바다', '해변', '해수욕장']],
  ['Highway', ['고속도로', '고가', '도로', '교차로', '터널', '톨게이트', 'IC']],
  ['Residential', ['골목', '주택가', '빌라', '동네', '원룸', '주택']],
];
// 특수는 아무 데나 나타나는 가게·공간이라 장소가 아니라 무엇인지로 고른다
const KINDS_MS: Table = [
  ['Shop', ['샵', '숍', '상점', '가게', '쇼핑', '몰', '마트', '타투', '편의점']],
  ['Bookshop', ['책방', '서점', '도서', '책']],
  ['Workshop', ['공방', '작업실', '대장간', '공작소']],
  ['Market', ['장터', '시장', '노점', '바자', '맨홀']],
  ['Vending', ['자판기']],
  ['Room', ['상담', '사무소', '카페', '찻집', '실', '방']],
  ['Object', ['키트', '키링', '발견', '상자', '인형', '물건', '씨앗', '요정', '선물']],
];
const KINDS_BASE: Table = [
  ['Office', ['본부', '본사', '사무소', '사무실', '협회', '빌딩', '센터']],
  ['Shop', ['상점', '가게', '샵', '숍', '알선', '전당포']],
  ['Religious', ['성당', '교회', '성원', '절', '사찰', '신당', '수도원', '예배당']],
  ['Underground', ['지하', '상가', '역']],
  ['Clinic', ['의원', '병원', '약국', '클리닉']],
];
const KINDS_ORG: Table = [
  ['Corporate', ['주식회사', '회사', '기업', '그룹', '제약']],
  ['Religious', ['교황청', '교회', '성원', '이슬람', '성당', '수도회']],
  ['Cult', ['교단', '교', '신도', '찬란']],
  ['Research', ['연구', '실험', '학회']],
  ['Criminal', ['사채', '조직', '파', '상가', '암시장', '중림']],
  ['Military', ['부대', '군', '대응', '진압', '협회']],
  ['Underground', ['프리랜서', '은신', '모임', '게시판']],
];

/** 이름에서 정한 0~n-1 (같은 이름은 늘 같은 값) */
function pick(seed: string, n: number): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return (h >>> 0) % Math.max(1, n);
}

/** 낱말이 많이 맞는 순, 같으면 이름으로 돌린 순서. 하나도 안 맞는 것은 뒤에 (그것도 이름으로 돌린 순서) */
function rank(table: Table, text: string, seed: string): string[] {
  const scored = table.map(([key, words], i) => ({ key, i, score: words.reduce((n, w) => n + (text.includes(w) ? w.length : 0), 0) }));
  const start = pick(seed, table.length);
  const turn = (i: number) => (i - start + table.length) % table.length;
  return scored.sort((a, b) => b.score - a.score || turn(a.i) - turn(b.i)).map((x) => x.key);
}

const two = (prefix: string, seed: string) => (pick(seed, 2) ? [`${prefix} 2`, `${prefix} 1`] : [`${prefix} 1`, `${prefix} 2`]);

const SIT: Record<string, string> = { an: 'Anomaly', in: 'Incident', ms: 'Mystic' };

/** 상황 공용 그림 후보: 괴이·사건은 장소, 특수는 종류. 끝은 종류별 한 장짜리 옛 공용 그림 */
export function situationShared(kind: string, name: string, text = ''): string[] {
  const k = SIT[kind];
  if (!k) return [];
  const table = kind === 'an' ? PLACES_AN : kind === 'in' ? PLACES_IN : KINDS_MS;
  // 특수는 이름만 본다 (나타난 장소는 그 가게와 상관없음)
  const hay = kind === 'ms' ? name : `${name} ${text}`;
  const keys = rank(table, hay, name);
  // 괴이는 장소마다 2장: 같은 장소의 괴이가 많아서 이름으로 둘 중 하나
  const out = kind === 'an' ? keys.flatMap((key) => two(`Situation ${k} ${key}`, name)) : keys.map((key) => `Situation ${k} ${key}`);
  if (kind === 'ms') out.push('Situation Mystic Door');
  out.push(`Situation ${k}`);
  return out;
}

/** 거점 공용 그림 후보 (바깥 모습). 맞는 게 없으면 은신처 */
export function baseShared(name: string, label = ''): string[] {
  const hay = `${name} ${label}`;
  const hits = rank(KINDS_BASE, hay, name).filter((key) => KINDS_BASE.find(([k]) => k === key)![1].some((w) => hay.includes(w)));
  return [...hits, 'Shared Base Hideout', 'Shared Base Office'].map((k) => (k.startsWith('Shared') ? k : `Shared Base ${k}`));
}

/** 조직 공용 그림 후보 (안쪽 모습). 민간형·프리랜서형은 그 유형 그림이 먼저 */
export function orgShared(name: string, type = 'org', text = ''): string[] {
  const head = type === 'civilian' ? ['Civilian'] : type === 'freelancer' ? ['Freelancer'] : [];
  const hay = `${name} ${text}`;
  const hits = rank(KINDS_ORG, hay, name).filter((key) => KINDS_ORG.find(([k]) => k === key)![1].some((w) => hay.includes(w)));
  return [...head, ...hits.map((k) => `Shared Org ${k}`), 'Shared Org Office'];
}

/** 같은 묶음 3장(1~3)을 대상 이름으로 돌린 순서: 첫째가 그 대상의 그림, 나머지는 그 그림이 없을 때 */
const three = (prefix: string, seed: string) => {
  const n = pick(seed, 3);
  return [0, 1, 2].map((i) => `${prefix} ${((n + i) % 3) + 1}`);
};

/** 요원 공용 그림 후보: 소속 조직으로 옷, 성별로 남녀, 묶음 3장 중 하나는 요원 이름으로. 성별을 모르면 성별이 안 드러나는 후드 그림 */
export function agentShared(org: string, faction: string, gender: 'F' | 'M' | '', seed: string): string[] {
  const o = `${faction} ${org}`;
  const look =
    /B00|A00|관리국/.test(o) ? 'Suit'
    : /C00|백일몽/.test(o) ? 'Masked'
    : /D00|민간/.test(o) ? 'Civilian'
    : /E00|프리랜서|협회|중림/.test(o) ? 'Freelancer'
    : /교황청|이슬람|교회|성원/.test(o) ? 'Religious'
    : /발푸르기스|마녀|교단|찬란/.test(o) ? 'Occult'
    : 'Suit';
  const hood = [...three('Shared Agent Religious', seed), ...three('Shared Agent Occult', seed)];
  if (look === 'Religious' || look === 'Occult') return three(`Shared Agent ${look}`, seed);
  const sex = gender === 'F' ? 'Female' : gender === 'M' ? 'Male' : '';
  return sex ? [...three(`Shared Agent ${look} ${sex}`, seed), ...hood] : hood;
}
