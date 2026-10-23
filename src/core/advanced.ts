// 고급 설정 (v0.16.27, 사용자 설계): 원본 설정 창의 세부 항목(참고 자료, 채팅 반영, 수신 대기, 길이·개수 제한, 토큰 상한, 백엔드)을
// 기능마다 접힌 칸 하나에 모은다. 손대지 않아도 원본 기본값으로 돌아간다. 값은 이 채팅의 변수에 두고,
// 각 설정 화면의 「덮어쓰기」로 새 채팅 기본값에 같이 담긴다.
import { CONTEXT as GN_CONTEXT, HISTORY as GN_HISTORY, LIMITS as GN_LIMITS } from './gnet';
import { COOLDOWN as PH_COOLDOWN, HISTORY as PH_HISTORY, LIMITS as PH_LIMITS } from './phone';

export type AdvFeature = 'gn' | 'ph' | 'nw' | 'hq' | 'gen';

export interface AdvItem {
  key: string;
  label: string;
  type: 'num' | 'bool' | 'pick';
  def: number | string;
  min?: number;
  max?: number;
  unit?: string;
  /** pick의 선택지 [값, 이름] */
  opts?: [string, string][];
  hint?: string;
  /** 이미 있는 채팅 변수를 그대로 쓰는 항목 */
  v?: string;
  /** 0일 때 보여 줄 말 (예: 「제한 없음」) */
  zero?: string;
}

export interface AdvGroup {
  title: string;
  /** 켜고 끄는 칩 한 줄 (참고 자료 등) */
  chips?: AdvItem[];
  items: AdvItem[];
  /** 접힌 칸 안에 한 번 더 접는 묶음 (길이·개수 제한) */
  fold?: boolean;
}

const chip = (key: string, label: string, def: 0 | 1, v?: string): AdvItem => ({ key, label, type: 'bool', def: String(def), ...(v ? { v } : {}) });
const num = (key: string, label: string, def: number, min: number, max: number, unit: string, extra: Partial<AdvItem> = {}): AdvItem => ({ key, label, type: 'num', def, min, max, unit, ...extra });
const TOK = '토큰';
const budget = num('budget', '요청 토큰 상한', 0, 0, 200000, TOK, { zero: '공통', hint: '넘으면 2차 참조, 관련 로어북, 오래된 채팅 순으로 줄여요' });
const turns = (def: number) => num('turns', '채팅 참고', def, 0, 200, '턴', { zero: '안 봄' });

export const ADV: Record<AdvFeature, AdvGroup[]> = {
  gen: [
    {
      title: '생성 공통',
      items: [
        { key: 'lang', label: '생성 언어', type: 'pick', def: 'auto', opts: [['auto', '대화 언어'], ['ko', '한국어'], ['en', '영어'], ['ja', '일본어']], hint: '괴담넷·괴담톡·위키가 쓸 언어' },
        num('retries', '형식 오류 재시도', 1, 0, 3, '회'),
        { key: 'retry_model', label: '재시도 모델', type: 'pick', def: 'same', opts: [['same', '같은 모델'], ['main', '메인'], ['aux', '보조']] },
        num('budget', '요청 토큰 상한', 0, 0, 200000, TOK, { zero: '제한 없음', hint: '괴담넷·괴담톡·위키 요청 하나의 상한. 기능마다 따로 정할 수도 있어요' }),
        num('ctx_total', '채팅 반영 총 상한', 0, 0, 200000, TOK, { zero: '제한 없음', hint: '괴담넷·괴담톡·위키 기록이 채팅 요청에 붙는 양의 합. 넘치면 기능별 반영 상한 비율로 나눠요' }),
      ],
    },
    {
      title: '로어북',
      items: [
        { key: 'lore_mode', label: '로어북 보내기', type: 'pick', def: 'plugin', opts: [['plugin', '플러그인이 고름'], ['risu', 'Risu가 직접']], hint: '세력·특수·괴이·요원 로어북을 누가 켤지 정해요. Risu가 직접 켜면 낱말 속 글자에도 걸려요' },
      ],
    },
  ],
  gn: [
    {
      title: '참고 자료',
      chips: [chip('desc', '봇 설명', 1), chip('authors', '작가 노트', 1), chip('persona', '페르소나', 1), chip('active', '상시 로어북', 1), chip('related', '관련 로어북', 0), chip('secondary', '2차 참조', 0)],
      items: [
        turns(8),
        num('refresh_posts', '새로고침에 참고할 글', 10, 1, 200, '개'),
        num('comments', '답글에 참고할 댓글', 30, 1, 1000, '개'),
        num('dm_history', '답장에 참고할 쪽지', 50, 1, 1000, '통'),
        budget,
      ],
    },
    {
      title: '채팅 반영',
      chips: [chip('ctx_focus', '장면 관련 먼저', 1), chip('ctx_posts', '게시글·댓글', 1), chip('ctx_dms', '쪽지', 1), chip('ctx_own', '내가 쓴 것만', 0)],
      items: [
        num('ctx_post_count', '넣을 게시글', 5, 1, 200, '개'),
        num('ctx_comment_count', '글당 댓글', 10, 0, 1000, '개'),
        num('ctx_dm_count', '넣을 쪽지', 30, 1, 200, '통'),
        num('ctx_tokens', '반영 토큰 상한', 3000, 0, 200000, TOK, { zero: '제한 없음' }),
      ],
    },
    {
      title: '선쪽지',
      items: [
        num('incoming_chance', '선쪽지 확률', 100, 0, 100, '%', { v: '$lb_cfg_lb-gn.incoming_chance' }),
        num('cooldown', '받은 뒤 쉬는 턴', 2, 0, 100, '턴', { zero: '안 쉼' }),
      ],
    },
    {
      title: '길이·개수 제한',
      fold: true,
      items: [
        num('post_tokens', '글 본문', 4000, 50, 50000, TOK),
        num('title_tokens', '글 제목', 80, 10, 500, TOK),
        num('comment_tokens', '댓글', 1000, 50, 20000, TOK),
        num('replies', '한 번에 받을 답글', 4, 1, 20, '개'),
        num('dm_tokens', '쪽지', 1500, 50, 20000, TOK),
        num('origin_tokens', '쪽지에 붙는 글', 2000, 50, 20000, TOK),
        num('quote_tokens', '쪽지에 붙는 댓글', 1000, 50, 20000, TOK),
        num('history_tokens', '이전 쪽지 한 통', 1500, 50, 20000, TOK),
      ],
    },
  ],
  ph: [
    {
      title: '참고 자료',
      chips: [chip('desc', '봇 설명', 1), chip('authors', '작가 노트', 1), chip('persona', '페르소나', 1), chip('active', '상시 로어북', 1), chip('related', '인물 로어북', 0, '$ph_related'), chip('secondary', '2차 참조', 0)],
      items: [turns(8), num('room_history', '방마다 참고할 말풍선', 100, 10, 1000, '개'), budget],
    },
    {
      title: '채팅 반영',
      chips: [chip('ctx_focus', '장면 관련 먼저', 1), chip('ctx_messages', '메시지', 1, '$ph_context_messages'), chip('ctx_notices_on', '공지', 1, '$ph_context_announcements')],
      items: [
        num('ctx_history', '넣을 말풍선', 200, 1, 1000, '개'),
        num('ctx_notices', '넣을 공지', 1, 0, 50, '개'),
        num('ctx_tokens', '반영 토큰 상한', 4000, 0, 200000, TOK, { zero: '제한 없음' }),
      ],
    },
    {
      title: '받은 뒤 쉬는 턴',
      items: [num('cd_incoming', '선톡', 1, 0, 100, '턴', { zero: '안 쉼' }), num('cd_invite', '단톡방 초대', 3, 0, 100, '턴', { zero: '안 쉼' })],
    },
    {
      title: '길이·개수 제한',
      fold: true,
      items: [
        num('reply_tokens', '상대 말풍선', 1500, 50, 20000, TOK),
        num('events', '한 번에 받을 말풍선', 12, 1, 100, '개'),
        num('input_tokens', '내가 보낼 글', 4000, 50, 50000, TOK),
        num('pause_tokens', '대기 설명', 200, 10, 2000, TOK),
        num('topic_tokens', '단톡 주제', 2000, 50, 20000, TOK),
        num('memo_tokens', '연락처 메모', 2000, 50, 20000, TOK),
        num('members', '단톡방 최대 상대', 9, 2, 50, '명'),
        num('room_name', '단톡방 이름', 60, 5, 200, '자'),
        num('notices', '한 번에 받을 공지', 1, 1, 10, '개'),
        num('notice_tokens', '공지 본문', 1200, 50, 20000, TOK),
        num('notice_title', '공지 제목', 80, 10, 300, '자'),
        num('notice_issuer', '공지 발신처', 60, 5, 200, '자'),
        num('invitations', '한 번에 받을 초대', 1, 1, 10, '개'),
      ],
    },
  ],
  // 본부 방문 대화 (2026-10-22 설계 2판): 지침은 카드 「Visit」 로어북, 여기는 보낼 자료와 길이
  hq: [
    {
      title: '참고 자료',
      chips: [chip('desc', '봇 설명', 1), chip('authors', '작가 노트', 1), chip('persona', '주인공·페르소나', 1), chip('active', '상시 로어북', 1), chip('related', '관련 로어북', 1), chip('secondary', '2차 참조', 0), chip('interlude', '같은 막간 다른 대화', 1)],
      items: [turns(6), budget],
    },
    {
      title: '대화',
      chips: [chip('interject', '옆 요원 끼어들기', 1)],
      items: [
        { key: 'model', label: '대화 모델', type: 'pick', def: 'aux', opts: [['aux', '보조'], ['main', '메인']] },
        num('line_chars', '답 길이', 80, 20, 400, '자', { hint: '말풍선 한 장은 80자 안팎이에요' }),
      ],
    },
  ],
  nw: [
    {
      title: '참고 자료',
      chips: [chip('desc', '봇 설명', 1), chip('authors', '작가 노트', 1), chip('persona', '페르소나', 1), chip('active', '상시 로어북', 1), chip('related', '관련 로어북', 1), chip('secondary', '2차 참조', 1)],
      items: [turns(8), num('ref_count', '관련·2차 참조 최대', 20, 1, 200, '개'), { ...budget, hint: '넘으면 이전 문서, 2차 참조, 관련 로어북, 오래된 채팅 순으로 줄여요' }],
    },
    {
      title: '채팅 반영',
      chips: [chip('ctx_focus', '채팅에 나온 문서만', 1), chip('ctx_lore', '로어북 있는 문서', 0), chip('ctx_created', '창작 문서', 1)],
      items: [num('ctx_count', '넣을 문서', 2, 1, 50, '개'), num('ctx_tokens', '반영 토큰 상한', 8000, 0, 200000, TOK, { zero: '제한 없음' })],
    },
  ],
};

const PREFIX: Record<AdvFeature, string> = { gn: '$lb_cfg_lb-gn.adv_', ph: '$ph_adv_', nw: '$nw_adv_', hq: '$hq_adv_', gen: '$gen_' };

export const advItems = (f: AdvFeature): AdvItem[] => ADV[f].flatMap((g) => [...(g.chips ?? []), ...g.items]);
export const advItem = (f: AdvFeature, key: string): AdvItem | undefined => advItems(f).find((i) => i.key === key);
export const advVar = (f: AdvFeature, item: AdvItem): string => item.v ?? `${PREFIX[f]}${item.key}`;

/** 저장된 값이 맞으면 그 값, 아니면 null */
export function advCheck(item: AdvItem, raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s || s === 'null') return null;
  if (item.type === 'bool') return s === '1' || s === '0' ? s : null;
  if (item.type === 'pick') return item.opts?.some(([v]) => v === s) ? s : null;
  const n = Number(s);
  return Number.isInteger(n) && n >= (item.min ?? 0) && n <= (item.max ?? Infinity) ? String(n) : null;
}

type State = Record<string, unknown> | undefined;

export function advValue(state: State, f: AdvFeature, key: string): string {
  const item = advItem(f, key);
  if (!item) return '';
  return advCheck(item, state?.[advVar(f, item)]) ?? String(item.def);
}
export const advNum = (state: State, f: AdvFeature, key: string): number => Number(advValue(state, f, key));
export const advOn = (state: State, f: AdvFeature, key: string): boolean => advValue(state, f, key) === '1';

/** 기본값과 다른 항목 */
export function advChanged(state: State, f: AdvFeature): string[] {
  return advItems(f).filter((i) => advValue(state, f, i.key) !== String(i.def)).map((i) => i.key);
}

/** 모두 기본값으로: 변수를 비운다 */
export function advResetVars(f: AdvFeature): Record<string, string> {
  return Object.fromEntries(advItems(f).map((i) => [advVar(f, i), i.v ? String(i.def) : '']));
}

// ── 요청에 쓰는 값 ──

export interface RefToggles {
  description: boolean;
  authors: boolean;
  persona: boolean;
  active: boolean;
  related: boolean;
  secondary: boolean;
}

export function refToggles(state: State, f: 'gn' | 'ph' | 'nw' | 'hq'): RefToggles {
  const on = (k: string, d: boolean) => (advItem(f, k) ? advOn(state, f, k) : d);
  return {
    description: on('desc', true), authors: on('authors', true), persona: on('persona', true), active: on('active', true),
    related: on('related', false), secondary: on('secondary', false),
  };
}

/** 이 기능의 요청 토큰 상한. 기능 값이 0이면 공통 값, 그것도 0이면 제한 없음(0) */
export function budgetFor(state: State, f: 'gn' | 'ph' | 'nw' | 'hq'): number {
  return advNum(state, f, 'budget') || advNum(state, 'gen', 'budget');
}

export interface GenSettings {
  /** 요청문에 넣는 언어 지시. auto면 null (기능의 원래 문장) */
  language: string | null;
  retries: number;
  retryModel: 'same' | 'main' | 'aux';
}

const LANG: Record<string, string> = {
  ko: 'Write all output in Korean.',
  en: 'Write all output in English.',
  ja: 'Write all output in Japanese.',
};

export function genSettings(state: State): GenSettings {
  const m = advValue(state, 'gen', 'retry_model');
  return { language: LANG[advValue(state, 'gen', 'lang')] ?? null, retries: advNum(state, 'gen', 'retries'), retryModel: m === 'main' || m === 'aux' ? m : 'same' };
}

// 깊은 곳(응답 검사, 저장 정리)에서 쓰는 상수 묶음은 지금 채팅 값으로 맞춰 둔다.
// 창을 열거나 고칠 때, 채팅 요청 전, 자동 새로고침 전에 부른다 (모두 한 번에 한 채팅만 다룬다).
const GN_LIMIT_KEYS = Object.keys(GN_LIMITS) as (keyof typeof GN_LIMITS)[];
const PH_LIMIT_KEYS = Object.keys(PH_LIMITS) as (keyof typeof PH_LIMITS)[];

export function applyAdvanced(state: State): void {
  const g = (k: string) => advNum(state, 'gn', k);
  const p = (k: string) => advNum(state, 'ph', k);
  for (const k of GN_LIMIT_KEYS) GN_LIMITS[k] = g(k);
  GN_HISTORY.refresh = g('refresh_posts');
  GN_HISTORY.comment = g('comments');
  GN_HISTORY.dmHistory = g('dm_history');
  GN_HISTORY.turns = g('turns');
  GN_HISTORY.cooldown = g('cooldown');
  GN_CONTEXT.posts = g('ctx_post_count');
  GN_CONTEXT.comments = g('ctx_comment_count');
  GN_CONTEXT.dms = g('ctx_dm_count');
  GN_CONTEXT.tokens = g('ctx_tokens');
  GN_CONTEXT.includePosts = advOn(state, 'gn', 'ctx_posts');
  GN_CONTEXT.includeDms = advOn(state, 'gn', 'ctx_dms');
  GN_CONTEXT.ownOnly = advOn(state, 'gn', 'ctx_own');
  GN_CONTEXT.focus = advOn(state, 'gn', 'ctx_focus');
  for (const k of PH_LIMIT_KEYS) PH_LIMITS[k] = p(k);
  PH_HISTORY.room = p('room_history');
  PH_HISTORY.turns = p('turns');
  PH_HISTORY.context = p('ctx_history');
  PH_HISTORY.contextNotices = p('ctx_notices');
  PH_HISTORY.contextTokens = p('ctx_tokens');
  PH_HISTORY.focus = advOn(state, 'ph', 'ctx_focus');
  PH_COOLDOWN.incoming = p('cd_incoming');
  PH_COOLDOWN.invitation = p('cd_invite');
}
