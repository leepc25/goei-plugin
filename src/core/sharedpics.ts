// 공용 그림 고르기 (2026-10-21 사용자: 공용 그림을 여러 장 두고 맥락에 맞게). 그림 목록과 요청문은 docs/공용그림_GPT요청서.md.
// 모델을 부르지 않고 이름·장소·상황 글의 낱말로 점수를 매긴다. 후보 이름을 좋은 순서로 돌려주고, 카드에 있는 첫 그림을 쓰는 건 부르는 쪽이 한다.
// 점수가 같으면 대상 이름으로 정해서 같은 대상은 늘 같은 그림이 나온다.

type Table = [string, string[]][];

const PLACES_AN: Table = [
  ['Apartment', ['아파트', '빌라', '단지', '맨션', '오피스텔', '고시원', '복도']],
  ['School', ['학교', '교실', '기숙학교', '학원', '대학', '캠퍼스', '보육원', '유치원', '폐교']],
  ['Hospital', ['병원', '의원', '병동', '응급실', '요양', '진료']],
  ['Subway', ['지하철', '승강장', '전철', '선로', '교통공사', '열차', '기차', '역']],
  ['Road', ['도로', '국도', '고개', '차도', '사망단길']],
  ['Tunnel', ['터널', '지하도', '동굴', '굴']],
  ['Forest', ['숲', '산', '등산', '수목원', '정원', '공원']],
  ['Amusement', ['놀이공원', '테마파크', '랜드', '파크', '워터파크', '동물원', '서커스', '극단', '축제', '민속촌', '쇼']],
  ['Lodging', ['호텔', '모텔', '리조트', '숙소', '펜션', '여관', '민박']],
  ['Ruin', ['폐', '공장', '저택', '지하실', '창고', '연구소', '폐가', '흉가']],
  ['Elevator', ['엘리베이터', '승강기']],
  ['Village', ['마을', '시골', '농촌', '명절']],
  ['Office', ['회사', '사무실', '빌딩', '오피스', '야근', '출근']],
  ['Sea', ['바다', '해변', '해수욕장', '섬', '항구', '등대', '어선', '선박', '여객선', '유람선']],
  ['Shrine', ['신당', '사당', '무덤', '묘지', '납골', '장례', '사찰', '암자', '법당', '굿']],
  // 2026-10-21 추가 (그림은 docs/공용그림_GPT요청서_2차.md). 그림이 오기 전에는 FALLBACK 장소 그림
  ['Theater', ['영화관', '극장', '시네마', '상영관', '공연장', '무대', '객석', '콘서트홀', '홀']],
  ['Mall', ['백화점', '쇼핑몰', '몰', '아울렛', '지하상가', '상가', '마트', '매장']],
  ['Restaurant', ['식당', '음식점', '포장마차', '먹자골목', '횟집', '술집', '주점', '고깃집', '분식', '국밥', '중국집']],
  ['Church', ['교회', '성당', '예배당', '수도원', '기도원', '십자가']],
  ['Bathhouse', ['목욕탕', '찜질방', '사우나', '대중탕', '수영장']],
  ['Store', ['편의점', '슈퍼', '구멍가게', '가게', '상점']],
  ['Arcade', ['노래방', '노래연습장', 'PC방', '피시방', '오락실', '만화방', '게임장', '볼링장', '코인']],
  ['Library', ['도서관', '박물관', '미술관', '기록관', '전시관', '갤러리', '서고', '서점']],
  ['Parking', ['주차장', '주차타워', '차고']],
  ['Rooftop', ['옥상', '물탱크', '루프탑']],
  ['Bridge', ['다리', '대교', '육교', '교량', '철교']],
  ['Police', ['경찰서', '파출소', '지구대', '교도소', '구치소', '감옥', '유치장', '법원']],
  ['Military', ['군부대', '부대', '막사', '초소', '벙커', '훈련소', '방공호', '사격장']],
  ['Restroom', ['화장실', '변소', '샤워실']],
  ['Bus', ['버스', '정류장', '정류소', '터미널', '종점', '택시']],
  ['Lake', ['저수지', '호수', '하천', '강변', '한강', '댐', '계곡', '개울', '우물']],
];
/** 새 장소 그림이 카드에 없을 때 대신 쓸 원래 장소 */
const FALLBACK: Record<string, string> = {
  Theater: 'Ruin', Mall: 'Ruin', Restaurant: 'Village', Church: 'Shrine', Bathhouse: 'Lodging', Store: 'Road', Arcade: 'Ruin', Library: 'School',
  Parking: 'Tunnel', Rooftop: 'Office', Bridge: 'Road', Police: 'Office', Military: 'Ruin', Restroom: 'School', Bus: 'Road', Lake: 'Sea',
};
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

// 한 글자 낱말은 낱말 끝에서만 (유계역·북한산은 맞고 광역시·지역·부산은 안 맞음). '폐'는 낱말 앞 (폐공장)
const STOP = /부산|울산|안산|군산|익산|경산|양산|서산|오산|논산|아산|얼굴|지역|구역|영역|전역/g;
const one = new Map<string, RegExp>();
function hit(text: string, w: string): boolean {
  if (w.length > 1) return text.includes(w);
  let re = one.get(w);
  if (!re) one.set(w, (re = w === '폐' ? /(?<![가-힣])폐[가-힣]/ : new RegExp(`[가-힣]${w}(?![가-힣])|(?<![가-힣])${w}(?![가-힣])`)));
  return re.test(text);
}
const clean = (text: string) => text.replace(STOP, ' ');
const score = (words: string[], text: string) => words.reduce((n, w) => n + (hit(text, w) ? w.length : 0), 0);

/** 낱말이 많이 맞는 순(이름은 두 배), 같으면 이름으로 돌린 순서. 하나도 안 맞는 것은 뒤에 (그것도 이름으로 돌린 순서) */
function rank(table: Table, name: string, text: string, seed: string): string[] {
  const n = clean(name), t = clean(text);
  const scored = table.map(([key, words], i) => ({ key, i, score: score(words, n) * 2 + score(words, t) }));
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
  const keys = rank(table, name, kind === 'ms' ? '' : text, name);
  // 괴이는 장소마다 2장: 같은 장소의 괴이가 많아서 이름으로 둘 중 하나. 새 장소 그림이 없으면 바로 뒤에 대신할 장소
  const out = kind === 'an'
    ? [...new Set(keys.flatMap((key) => [key, ...(FALLBACK[key] ? [FALLBACK[key]] : [])]).flatMap((key) => two(`Situation ${k} ${key}`, name)))]
    : keys.map((key) => `Situation ${k} ${key}`);
  if (kind === 'ms') out.push('Situation Mystic Door');
  out.push(`Situation ${k}`);
  return out;
}

/** 거점 공용 그림 후보 (바깥 모습). 맞는 게 없으면 은신처 */
export function baseShared(name: string, label = ''): string[] {
  const hay = clean(`${name} ${label}`);
  const hits = rank(KINDS_BASE, name, label, name).filter((key) => KINDS_BASE.find(([k]) => k === key)![1].some((w) => hit(hay, w)));
  return [...hits, 'Shared Base Hideout', 'Shared Base Office'].map((k) => (k.startsWith('Shared') ? k : `Shared Base ${k}`));
}

/** 조직 공용 그림 후보 (안쪽 모습). 민간형·프리랜서형은 그 유형 그림이 먼저 */
export function orgShared(name: string, type = 'org', text = ''): string[] {
  const head = type === 'civilian' ? ['Civilian'] : type === 'freelancer' ? ['Freelancer'] : [];
  const hay = clean(`${name} ${text}`);
  const hits = rank(KINDS_ORG, name, text, name).filter((key) => KINDS_ORG.find(([k]) => k === key)![1].some((w) => hit(hay, w)));
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
