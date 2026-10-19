// 상태창 날짜의 요일·공휴일 (모델은 요일을 쓰지 않으니 날짜에서 계산한다).
// 연도별 표 없이 규칙으로: 양력은 월·일, 음력(설·추석·부처님오신날)은 브라우저의 한국 음력(dangi) 달력으로 바꿔 본다.
// 대체공휴일은 현행 규칙 + 시행 연도. 선거일·임시공휴일은 알 수 없어 넣지 않는다.

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const DAY = 86_400_000;

const SOLAR: Record<string, string> = {
  '1-1': '신정', '3-1': '삼일절', '5-5': '어린이날', '6-6': '현충일',
  '8-15': '광복절', '10-3': '개천절', '10-9': '한글날', '12-25': '성탄절',
};
/** 대체공휴일 시행 연도. 설·추석은 일요일·다른 공휴일과 겹칠 때만, 나머지는 토·일요일도 */
const SUBST_FROM: Record<string, number> = {
  설날: 2014, 추석: 2014, 어린이날: 2014, 삼일절: 2022, 광복절: 2021, 개천절: 2021, 한글날: 2021, 부처님오신날: 2023, 성탄절: 2023,
};

let lunarFmt: Intl.DateTimeFormat | null | undefined;
/** 음력 월·일 (윤달이면 leap). 브라우저가 dangi 달력을 모르면 null */
function lunar(t: number): { m: number; d: number; leap: boolean } | null {
  if (lunarFmt === undefined) {
    try {
      lunarFmt = new Intl.DateTimeFormat('en-u-ca-dangi', { timeZone: 'UTC', month: 'numeric', day: 'numeric' });
      if (lunarFmt.resolvedOptions().calendar !== 'dangi') lunarFmt = null;
    } catch {
      lunarFmt = null;
    }
  }
  if (!lunarFmt) return null;
  const parts = lunarFmt.formatToParts(new Date(t));
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const m = parseInt(month, 10);
  return Number.isFinite(m) && Number.isFinite(day) ? { m, d: day, leap: /bis/.test(month) } : null;
}

/** 그날의 (대체가 아닌) 공휴일 이름들 */
function baseHolidays(t: number): string[] {
  const dt = new Date(t);
  const out: string[] = [];
  const solar = SOLAR[`${dt.getUTCMonth() + 1}-${dt.getUTCDate()}`];
  if (solar) out.push(solar);
  const l = lunar(t);
  if (l && !l.leap) {
    const next = lunar(t + DAY);
    if ((l.m === 1 && (l.d === 1 || l.d === 2)) || (next && !next.leap && next.m === 1 && next.d === 1)) out.push('설날');
    if (l.m === 8 && l.d >= 14 && l.d <= 16) out.push('추석');
    if (l.m === 4 && l.d === 8) out.push('부처님오신날');
  }
  return out;
}

/** 이 날이 대체공휴일인지: 2주 전부터 차례로 밀린 휴일을 다음 평일에 채워 본다 */
function isSubstitute(t: number): boolean {
  let owed = 0;
  for (let x = t - 14 * DAY; x <= t; x += DAY) {
    const names = baseHolidays(x);
    const wd = new Date(x).getUTCDay();
    if (!names.length) {
      if (wd !== 0 && wd !== 6 && owed > 0) {
        if (x === t) return true;
        owed--;
      }
      continue;
    }
    const year = new Date(x).getUTCFullYear();
    const hit = names.some((n) => {
      const from = SUBST_FROM[n];
      if (!from || year < from) return false;
      const lunarGroup = n === '설날' || n === '추석';
      return names.length > 1 || wd === 0 || (!lunarGroup && wd === 6);
    });
    if (hit) owed++;
  }
  return false;
}

export interface DayInfo {
  /** 모델이 쓴 날짜에서 요일 표기를 뺀 것 */
  date: string;
  weekday: string;
  holiday: string;
  /** 일요일·공휴일 (빨간 글씨) */
  red: boolean;
  saturday: boolean;
  /** 음력 「4월 8일」·「윤4월 1일」 (브라우저가 음력을 모르면 빈 문자열) */
  lunar: string;
}

const DATE_RE = /(\d{3,4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/;
const WEEK_RE = /\s*[(（]?\s*(?:[일월화수목금토](?:요일)?|sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?\s*[)）]?\s*$/i;

/** 상태창 날짜 칸 → 요일·공휴일. 숫자 날짜가 아니면 null (그대로 보인다) */
export function dayInfo(text: string): DayInfo | null {
  const m = DATE_RE.exec(text ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  // 다른 연도 표기(서기 3자리 등)도 그레고리력으로 본다. 모델이 붙인 요일은 지우고 계산한 것을 쓴다
  const date = text.slice(0, m.index + m[0].length).trim() + text.slice(m.index + m[0].length).replace(WEEK_RE, '');
  const names = baseHolidays(t);
  const holiday = names.length ? [...new Set(names)].join('·') : isSubstitute(t) ? '대체공휴일' : '';
  const wd = dt.getUTCDay();
  const l = lunar(t);
  return { date: date.trim(), weekday: WEEK[wd], holiday, red: wd === 0 || !!holiday, saturday: wd === 6, lunar: l ? `${l.leap ? '윤' : ''}${l.m}월 ${l.d}일` : '' };
}
