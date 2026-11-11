// 틀별 설정 표 (설정 개편 4단계): 게시판 표(괴담넷·괴담갤·세정게·연어 마켓)와 상점 표(기본 상점·우주 쇼핑몰·포인트몰·망상홈쇼핑).
// 격자: 줄 = 메뉴, 칸 = 메뉴마다 있는 설정. 그 밖의 값은 같은 틀의 메뉴가 한 값을 같이 쓴다. 사이트에만 있는 줄은 그 사이트 페이지에 남는다.
import { BOARD_NAME, BOARD_SITES, boardState, isBoardSite, type BoardSite } from '../core/boards';
import { CFG, COUNT_RANGE, GN_DEFAULTS, STORAGE_MAX, gnetRetention, gnetSettings, type CountKey } from '../core/gnet';
import { jointOn } from '../core/netjoint';
import { MALL_NAME, mallSettings } from '../core/malls';
import { HS_NAME, hsSettings } from '../core/homeshop';
import { SHOP_SIZE_HI, SHOP_SIZE_LO, shopBlocked, shopSettings, type ShopSettings } from '../core/shop';
import { advChipsCtl, advCtl } from './advanced';
import { advValue } from '../core/advanced';
import { siteLogo } from './browser';
import { ICONS } from './icons';
import { ckWide, helpBox, mxGrid, numCtl, setGroup, setRow, setSeg, type CkBand } from './setrow';
import type { ShopCol } from './settings';

type State = Record<string, unknown> | undefined;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const ONOFF: [string, string][] = [['1', 'ON'], ['0', 'OFF']];
const THOUGHTS: [string, string][] = [['off', '사용 안 함'], ['inner', '속으로만'], ['note', '적고 지움']];
const text = (action: string, key: string, v: string, ph: string, max = 80, aria = '', busy = false) =>
  `<input class="gx-search ps-text" data-change="${action}" data-key="${key}" value="${esc(v)}" maxlength="${max}" placeholder="${esc(ph)}"${aria ? ` aria-label="${esc(aria)}"` : ''}${busy ? ' disabled' : ''}>`;

/* ── 인터넷·상점: 전부 격자. 줄 = 메뉴, 열 = 값. 체크(동그라미 = 하나만, 네모 = 켜고 끄기)와 숫자(± 단추) ── */
const nm = (icon: string, name: string) => `<span class="mx-name">${icon}<span>${esc(name)}</span></span>`;

/** 게시판마다 따로 정하는 값의 고를 수 있는 값 (fam-set 이 이것으로 거른다) */
const BOARD_PICK: Record<string, string[]> = {
  lazy: ['1', 'open', '0'], mode: ['1', '2'], context: ['0', '1'], privacy: ['0', '1', '2', '3', '4'], incoming: ['1', '0'],
  sampling: ['1', '0'], keyfigures: ['1', '0'], keepown: ['1', '0'], keepreplied: ['1', '0'], joint: ['1', '0'], storage: ['1', '0'],
};
const BOARD_TEXT = ['subject', 'mood', 'protagonist'];

export function boardTable(state: State, busy = false): string {
  const views = BOARD_SITES.map((s) => boardState(state as never, s) as State);
  const cur = (st: State, k: string) => String(st?.[CFG(k)] ?? GN_DEFAULTS[k] ?? '');
  const name = (s: BoardSite) => nm(siteLogo(s === 'gn' ? 'gn' : s), BOARD_NAME[s]);
  const L = BOARD_SITES.map(name);
  const each = <T,>(f: (st: State, site: BoardSite) => T): T[] => BOARD_SITES.map((site, i) => f(views[i], site));

  /* ── 1. 게시판마다 따로 정하는 값: 격자 셋 (제목은 격자 위, 설명은 격자 아래 한 가지 모양) ── */
  const PRIV: [string, string][] = [['0', '이목집중'], ['1', '자율'], ['2', '약보호'], ['3', '강보호'], ['4', '언급금지']];
  const call: CkBand = { title: '호출', groups: [
    { name: '자동 호출', opts: ['수동', '창을 열 때', '매 턴'], kind: 'one' },
    { name: '모델', opts: ['메인', '보조'], kind: 'one' },
    { name: '메인 요청', opts: ['컨텍스트 포함'], kind: 'check' },
  ], marks: each((st) => {
    const s = gnetSettings(st);
    return [!s.auto && !s.autoOpen, s.autoOpen, s.auto, s.model === 'main', s.model !== 'main', s.context];
  }), acts: each((st, site) => {
    const b = `b:${site}`;
    return [`${b}:lazy=1`, `${b}:lazy=open`, `${b}:lazy=0`, `${b}:mode=1`, `${b}:mode=2`, `${b}:context=${gnetSettings(st).context ? '1' : '0'}`];
  }), foot: '' };
  const priv: CkBand = { title: '사생활', groups: [{ name: '', opts: PRIV.map(([, l]) => l), kind: 'one' }],
    marks: each((st) => PRIV.map(([v]) => v === gnetSettings(st).privacy)),
    acts: each((_, site) => PRIV.map(([v]) => `b:${site}:privacy=${v}`)),
    foot: helpBox('사생활은 게시판 사람들이 「보호 대상」을 얼마나 입에 올리는지예요.', [
      ['이목집중', '목격담과 소문이 자주 올라와요.'],
      ['자율', '이미 유명한 경우에만 멀리서 본 정도로 나와요.'],
      ['약보호', '평범한 사람으로 다뤄요. 큰 사건의 여파만 나와요.'],
      ['강보호', '약보호보다 더 줄여요.'],
      ['언급금지', '본인 이야기는 전혀 없고 행동의 결과만 나와요.'],
    ]) };
  const tx = (st: State, s: BoardSite, k: string, aria: string) => { const v = cur(st, k); return text('fam-text', `b:${s}:${k}`, v === '-' ? '' : v, '', 200, `${BOARD_NAME[s]} ${aria}`, busy); };
  const texts = mxGrid([{ name: '주제' }, { name: '분위기·말투' }, { name: '보호 대상' }], BOARD_SITES.map((s: BoardSite, i) => ({
    label: name(s), cells: [tx(views[i], s, 'subject', '주제'), tx(views[i], s, 'mood', '분위기·말투'), tx(views[i], s, 'protagonist', '보호 대상')],
  })), helpBox('', [
    ['주제', '올라올 글의 주제예요. 비우면 세계관에 맞는 여러 주제가 올라와요.'],
    ['분위기·말투', '글쓴이들의 말투예요. 비우면 익명 커뮤니티 말투예요.'],
    ['보호 대상', '「사생활」이 지켜 줄 사람의 이름이에요. 비우면 주인공이에요.'],
  ]), '주제와 말투');
  const cnt = (n: number, k: CountKey) => ({ n, lo: COUNT_RANGE[k][0], hi: COUNT_RANGE[k][1] });
  const amount: CkBand = { title: '양', groups: [
    { name: '게시글 수', opts: ['최소', '최대'], kind: 'num' },
    { name: '새 글 댓글 수', opts: ['최소', '최대'], kind: 'num' },
    { name: '활동 댓글 수', opts: ['최소', '최대'], kind: 'num' },
    { name: '선쪽지', opts: ['받기', '확률 (%)'], kind: 'check' },
  ], marks: each((st) => { const s = gnetSettings(st); const c = s.counts; return [cnt(c.post[0], 'post'), cnt(c.post[1], 'post'), cnt(c.cmt[0], 'cmt'), cnt(c.cmt[1], 'cmt'), cnt(c.act[0], 'act'), cnt(c.act[1], 'act'), s.incoming, s.incoming ? { n: s.incomingChance, lo: 0, hi: 100, step: 5 } : null]; }),
    acts: each((st, site) => { const b = `b:${site}`; return [`${b}:post_min`, `${b}:post_max`, `${b}:cmt_min`, `${b}:cmt_max`, `${b}:act_min`, `${b}:act_max`, `${b}:incoming=${gnetSettings(st).incoming ? '0' : '1'}`, `${b}:incoming_chance`]; }),
    foot: helpBox('', [
      ['게시글 수', '새로고침 한 번에 새로 만드는 글의 수예요. 많을수록 토큰을 더 써요.'],
      ['새 글 댓글 수', '새로 만드는 글마다 달리는 댓글의 수예요.'],
      ['활동 댓글 수', '새로고침이나 답장 때 지난 글에 새로 붙는 댓글의 수예요.'],
      ['선쪽지 받기', '켜면 게시판 사람이 먼저 쪽지를 보낼 수 있어요.'],
      ['선쪽지 확률', '새로고침 한 번에 선쪽지가 올 확률이에요.'],
    ]) };

  /* ── 2. 네 게시판이 같이 쓰는 값: 한 번의 호출 순서대로 묶음 다섯. 값은 괴담넷 자리 하나 (core/boards.ts boardShared) ── */
  const st0 = views[0];
  /** 수는 전부 공통 규격의 「− 값 +」 상자 (세부 값 표의 조작 그대로) */
  const N = (k: string) => advCtl('gn', k, st0 as never);
  /** 같은 종류 수 여럿: 이름·상자 짝 */
  const set = (items: [string, string][]) => `<div class="fam-set">${items.map(([l, c]) => `<span class="fam-set1"><span class="fam-l">${esc(l)}</span>${c}</span>`).join('')}</div>`;
  const SW = (k: string) => setSeg('adv-set', `gn:${k}`, advValue(st0 as never, 'gn', k) === '1' ? '1' : '0', ONOFF, busy);
  const C = (k: string, on: boolean) => setSeg('fam-set', `b:gn:${k}`, on ? '1' : '0', ONOFF, busy);
  const R = (label: string, ctl: string, lead = '', items: [string, string][] = []) => setRow(label, ctl, lead || items.length ? helpBox(lead, items) : '');
  const ret = gnetRetention(st0);
  const s0 = gnetSettings(st0);

  const give = setGroup('모델에 넘기는 것', [
    R('넘길 내용', advChipsCtl('gn', ['desc', 'authors', 'persona', 'active', 'related', 'secondary'], st0 as never), '', [
      ['상시 로어북', '조건 없이 늘 넘기는 로어북이에요.'],
      ['관련 로어북', '지금 하는 작업과 최근 챗로그에 이름이 나온 로어북이에요. 토큰을 더 써요.'],
      ['2차 참조', '관련 로어북의 글 안에 이름이 나온 다른 로어북이에요. 토큰을 더 써요.'],
    ]),
    R('넘길 양', set([['챗로그', N('turns')], ['요청 토큰 상한', N('budget')]]), '요청 토큰 상한을 넘으면 2차 참조, 관련 로어북, 오래된 챗로그 순으로 줄여요.'),
    R('요청별 지난 기록', set([['새로고침 때 글', N('refresh_posts')], ['답글 때 댓글', N('comments')], ['쪽지 때 쪽지', N('dm_history')]]), '그 요청을 보낼 때 모델에 보여 주는 최근 기록의 수예요.'),
  ].join(''));
  const write = setGroup('모델이 쓰는 방식', [
    R('한 번에 요청', setSeg('fam-set', 'b:gn:joint', jointOn(state as never) ? '1' : '0', ONOFF, busy), '켜면 자동 호출이 「매 턴」이고 모델이 같은 게시판과 괴담톡을 한 요청으로 묶어요. 괴담톡 설정의 같은 줄과 한 값이에요.'),
    R('생각 단계', advCtl('gn', 'thoughts', st0 as never), '모델이 결과를 쓰기 전에 상황을 먼저 정리하게 해요.', [
      ['속으로만', '정리하되 적지 않게 해요.'],
      ['적고 지움', '짧게 적게 한 뒤 플러그인이 지워요. 응답이 느려져요.'],
    ]),
    R('다양성 강화', C('sampling', s0.sampling), '켜면 모델이 게시판 두 벌을 쓰고 플러그인이 두 번째 벌을 써요. 토큰을 더 써요.'),
    R('비망록', SW('memo'), '켜면 모델 거부를 줄이는 긴 앞글을 요청마다 붙여요. 토큰을 더 써요.'),
    R('다시 보기', N('reiterate'), '첫 응답 뒤 모델에게 지침과 형식을 지켰는지 다시 보게 하는 횟수예요. 1회마다 호출이 1회 늘어요.'),
    R('한 번에 받을 답글', set([['최소', N('replies_min')], ['최대', N('replies')]]), '내 글이나 댓글에 한 번에 달리는 답글의 수예요.'),
  ].join(''));
  const limit = setGroup('길이 상한', [
    R('모델이 쓰는 글', set([['글 본문', N('post_tokens')], ['글 제목', N('title_tokens')], ['댓글', N('comment_tokens')], ['쪽지', N('dm_tokens')]])),
    R('쪽지에 같이 넘기는 글', set([['붙는 글', N('origin_tokens')], ['붙는 댓글', N('quote_tokens')], ['이전 쪽지 한 통', N('history_tokens')]]), '글이나 댓글을 보고 쪽지를 보낼 때 같이 넘기는 글 하나의 길이 상한이에요.'),
  ].join(''));
  const keep = setGroup('게시판에 남기는 것', [
    R('주요 인물 닉네임 보존', C('keyfigures', s0.keyFigures), '켜면 주요 인물이 쓰던 닉네임을 다음 새로고침에도 그대로 써요.'),
    R('새로고침 때 내 글 유지', C('keepown', s0.keepOwn), '켜면 새로고침으로 글이 바뀔 때 내가 쓴 글은 남겨요.'),
    R('내 댓글 있는 글 유지', C('keepreplied', s0.keepReplied), '켜면 내가 댓글을 단 남의 글도 남겨요.'),
    R('쪽지 자동 정리', `${setSeg('fam-set', 'b:gn:storage', ret.auto ? '1' : '0', ONOFF, busy)}${ret.auto ? numCtl('b:gn:dmkeep', { n: ret.limit, lo: 1, hi: STORAGE_MAX, step: 5 }, '남길 쪽지', '통', busy) : ''}`, '켜면 상대마다 최근 쪽지를 이 수만큼만 남기고 오래된 것은 지워요.'),
    R('선쪽지 뒤 쉬는 턴', N('cooldown'), '선쪽지를 받은 뒤 새 선쪽지가 오지 않는 턴의 수예요.'),
  ].join(''));
  const attach = setGroup('메인 요청에 붙이는 것', [
    R('붙일 것', advChipsCtl('gn', ['ctx_posts', 'ctx_dms', 'ctx_own'], st0 as never), '「내가 쓴 것만」을 켜면 내가 쓴 글과 내가 댓글을 단 글만 붙여요. 위 격자에서 「컨텍스트 포함」을 켠 게시판에만 붙어요.'),
    R('장면에 나온 것만 고르기', SW('ctx_focus'), '켜면 최근 글 1개와 쪽지 5통은 늘 붙이고, 나머지는 지금 장면에 이름이 나온 것만 붙여요.'),
    R('최대 양', set([['게시글', N('ctx_post_count')], ['글마다 댓글', N('ctx_comment_count')], ['쪽지', N('ctx_dm_count')], ['토큰 상한', N('ctx_tokens')]]), '토큰 상한을 넘는 것은 빼요.'),
  ].join(''));

  return `<h2 class="fam-h">게시판마다 따로 정하는 값</h2>${ckWide([call, priv], L, busy)}${texts}${ckWide([amount], L, busy)}`
    + `<h2 class="fam-h">네 게시판이 같이 쓰는 값</h2>${give}${write}${limit}${keep}${attach}`;
}

/** 인터넷·상점 격자와 그 아래 줄의 단추. 게시판 값은 게시판 처리기(gn-*)에 사이트를 붙여 넘긴다 */
export interface FamEnv {
  render(): void;
  /** 게시판 처리기 (ui/gnet.ts handleGnet) */
  board(action: string, value: string, site: BoardSite): Promise<boolean>;
  /** 상점·쇼핑몰·망상홈쇼핑 설정 저장 */
  shop(col: ShopCol, key: string, value: string): Promise<boolean>;
}
export async function famAction(action: string, value: string | undefined, env: FamEnv): Promise<boolean> {
  if (action !== 'fam-set' && action !== 'fam-num' && action !== 'fam-text') return false;
  const m = /^([bs]):([a-z]+):([a-zA-Z_]+)=([\s\S]*)$/.exec(value ?? '');
  if (!m) return env.render(), true;
  const [, fam, who, key, raw] = m;
  if (fam === 's') return isShopCol(who) ? env.shop(who, key, action === 'fam-text' ? raw : raw.trim()) : (env.render(), true);
  if (!isBoardSite(who)) return env.render(), true;
  if (action === 'fam-text') return BOARD_TEXT.includes(key) ? env.board('gn-text', `${key}=${raw}`, who) : (env.render(), true);
  if (action === 'fam-set') return BOARD_PICK[key]?.includes(raw) ? env.board('gn-cfg', `${key}=${raw}`, who) : (env.render(), true);
  // 수: 빈 칸·수가 아닌 것은 버리고 다시 그린다
  const n = Math.round(Number(raw));
  if (raw.trim() === '' || !Number.isFinite(n)) return env.render(), true;
  if (/^(post|cmt|act)_(min|max)$/.test(key)) return env.board('gn-count', `${key}=${n}`, who);
  if (key === 'incoming_chance') return env.board('gn-chance', String(Math.max(0, Math.min(100, n))), who);
  if (key === 'dmkeep') return env.board('gn-keep', String(Math.max(1, Math.min(STORAGE_MAX, n))), who);
  return env.render(), true;
}

const SHOP_ROWS: { id: ShopCol; name: string; icon: string }[] = [
  { id: 'shop', name: '기본 상점', icon: ICONS.swap },
  { id: 'cos', name: MALL_NAME.cos, icon: siteLogo('cos') },
  { id: 'bm', name: MALL_NAME.bm, icon: siteLogo('bm') },
  { id: 'hs', name: HS_NAME, icon: siteLogo('hs') },
];
const isShopCol = (v: string): v is ShopCol => SHOP_ROWS.some((r) => r.id === v);

/** 설정 → 상점: 상점마다 따로 정하는 값(격자) + 네 곳이 같이 쓰는 값 + 기본 상점에만 있는 값의 머리.
 *  vars = 그 페이지의 범위(이 채팅 · 시작 전에는 새 채팅 기본값)의 변수 */
export function shopTable(vars: State, busy = false): string {
  const v = vars as never;
  const hs = hsSettings(v);
  const set: Record<ShopCol, ShopSettings> = { shop: shopSettings(v), cos: mallSettings(v, 'cos'), bm: mallSettings(v, 'bm'), hs: hs.shop };
  const blocked = shopBlocked(v);
  const autoOf: Record<string, string> = { cos: mallSettings(v, 'cos').auto, bm: mallSettings(v, 'bm').auto, hs: hs.auto };
  const L = SHOP_ROWS.map(({ name, icon }) => nm(icon, name));
  const each = <T,>(f: (id: ShopCol, s: ShopSettings) => T): T[] => SHOP_ROWS.map(({ id }) => f(id, set[id]));
  const size = (n: number) => ({ n, lo: SHOP_SIZE_LO, hi: SHOP_SIZE_HI });

  /* ── 1. 상점마다 따로 정하는 값: 격자 하나(호출 · 진열대) + 글자 칸 표(값 기준) ── */
  const call: CkBand = { title: '호출', groups: [
    { name: '사용', opts: ['켬'], kind: 'check' },
    { name: '자동 호출', opts: ['수동', '창을 열 때', '매 턴'], kind: 'one' },
    { name: '모델', opts: ['메인', '보조'], kind: 'one' },
  ], marks: each((id, s) => { const a = autoOf[id]; return [
    // 기본 상점은 소지품·가계부가 꺼지면 같이 꺼진다 (그때는 꺼진 채 잠긴 칸)
    id === 'shop' ? (blocked ? false : s.on) : id === 'hs' ? hs.on : null,
    id === 'shop' ? null : a === 'manual', id === 'shop' ? null : a === 'open', id === 'shop' || id === 'hs' ? null : a === 'turn',
    s.model === 'main', s.model !== 'main'];
  }), acts: each((id, s) => { const b = `s:${id}`; return [
    id === 'shop' && blocked ? null : `${b}:on=${(id === 'hs' ? hs.on : s.on) ? '0' : '1'}`, `${b}:auto=manual`, `${b}:auto=open`, `${b}:auto=turn`, `${b}:model=main`, `${b}:model=aux`];
  }), foot: '' };
  const shelf: CkBand = { title: '진열대', groups: [
    { name: '상품 수', opts: ['최소', '최대'], kind: 'num' },
    { name: '구획', opts: ['켬'], kind: 'check' },
  ], marks: each((id, s) => [size(s.size[0]), size(s.size[1]), id === 'hs' ? null : s.feature]),
    acts: each((id, s) => [`s:${id}:min`, `s:${id}:max`, `s:${id}:feature=${s.feature ? '0' : '1'}`]),
    foot: helpBox(`「–」는 그곳에 없는 값이에요. 쇼핑몰 둘은 소지품과 가계부가 켜져 있으면 늘 열리고, 기본 상점은 아래 「열리는 조건」을 따라요.${blocked ? ` 지금은 ${blocked === 'both' ? '소지품과 가계부가' : blocked === 'items' ? '소지품이' : '가계부가'} 꺼져 있어 기본 상점도 꺼져 있어요.` : ''}`, [
      ['상품 수', '한 번에 받는 물건의 수예요. 망상홈쇼핑은 한 편성의 상품 수예요.'],
      ['구획', '켜면 눈에 띄는 물건을 따로 받아 딱지를 붙여 보여 줘요.'],
    ]) };
  const price = mxGrid([{ name: '모델에 알려 줄 말' }], SHOP_ROWS.map(({ id, name, icon }) => ({ label: nm(icon, name), cells: [text('fam-text', `s:${id}:price`, set[id].price, '', 80, `${name} 값 기준`, busy)] })),
    helpBox('물건값을 매길 때 모델이 따를 기준이에요. 비우면 그곳에 어울리는 값으로 매겨요.'), '값 기준');

  /* ── 2. 네 곳이 같이 쓰는 값: 기본 상점 자리의 값 하나 (core/shop.ts SHOP_SHARED_VARS) ── */
  const s0 = set.shop;
  const R = (label: string, ctl: string, lead = '', items: [string, string][] = []) => setRow(label, ctl, lead || items.length ? helpBox(lead, items) : '');
  const sw = (k: string, on: boolean) => setSeg('fam-set', `s:shop:${k}`, on ? '1' : '0', ONOFF, busy);
  const give = setGroup('모델에 넘기는 것', [
    R('맥락 반영', sw('ctx', s0.context), '켜면 최근 챗로그, 상태창, 진행 중인 괴이, 신분을 같이 넘겨 지금 상황에 맞는 물건이 나와요.'),
    R('챗로그 포함', numCtl('s:shop:turns', { n: s0.turns, lo: 1, hi: 8 }, '챗로그 포함', '턴', busy), '맥락 반영이 켜져 있을 때 넘기는 최근 턴의 수예요. 꺼져 있어도 참조 로어북을 고를 때는 이만큼 읽어요.'),
    R('참조 로어북', numCtl('s:shop:refs', { n: s0.refs, lo: 0, hi: 12 }, '참조 로어북', '개', busy), '봇 설명, 켜진 로어북, 가게 이름이 걸리는 로어북 가운데 넘기는 수예요.'),
  ].join(''));
  const write = setGroup('모델이 쓰는 방식', [
    R('생각 단계', setSeg('fam-set', 's:shop:thoughts', s0.thoughts, THOUGHTS, busy), '모델이 결과를 쓰기 전에 상황을 먼저 정리하게 해요.', [
      ['속으로만', '정리하되 적지 않게 해요.'],
      ['적고 지움', '짧게 적게 한 뒤 플러그인이 지워요. 응답이 느려져요.'],
    ]),
    R('다양성 강화', sw('diverse', s0.diverse), '켜면 싼 것, 비싼 것, 흔한 것, 특이한 것을 섞어 받아요.'),
    R('지난 목록 피하기', sw('prev', s0.avoidPrev), '켜면 지난번에 나온 물건을 다시 내지 않게 해요.'),
  ].join(''));
  const note = blocked ? `<p class="gx-hint">${blocked === 'both' ? '소지품과 가계부가' : blocked === 'items' ? '소지품이' : '가계부가'} 꺼져 있어 기본 상점과 쇼핑몰 둘을 쓸 수 없어요. 산 물건은 소지품에, 돈은 가계부로 오가서 둘 다 켜져 있어야 해요.</p>` : '';
  /* ── 3. 기본 상점에만 있는 값: 거래 끊음 + (ui/settings.ts 가 잇는) 열리는 조건 ── */
  const own = s0.on ? `<h2 class="fam-h">기본 상점에만 있는 값</h2>${setGroup('', R('거래 끊음', sw('kick', s0.kick), '켜면 주인이 모욕이나 끝없는 흥정에 거래를 끊을 수 있어요.'))}` : '';
  return `${note}<h2 class="fam-h">상점마다 따로 정하는 값</h2><div class="fam-wide">${ckWide([call, shelf], L, busy)}${price}</div><h2 class="fam-h">네 곳이 같이 쓰는 값</h2>${give}${write}${own}`;
}
