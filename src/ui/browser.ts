// 상황판 「인터넷」 = 크롬(다크) 모양 브라우저 (2026-11-08 사용자 결정, 시안 /mnt/project-files/작업_1108/브라우저_시안3/).
// 탭은 실제로 열고 닫히고(+·×), 탭마다 앞뒤 기록을 따로 가진다. 즐겨찾기 줄의 사이트만 열 수 있다(광고·☆·확장 없음).
// 사이트마다 로고·디자인이 다르고 창 테마를 따라가지 않는다. 사이트 화면은 app.ts 가 그리고, 여기서는 틀(탭·주소창·즐겨찾기·로그인)만.
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type SiteId = 'gn' | 'gal' | 'wpf' | 'sm' | 'cos' | 'wk' | 'bm';

export interface Site {
  id: SiteId;
  /** 즐겨찾기·서랍 이름 */
  name: string;
  /** 탭 제목 (화면이 따로 주지 않을 때) */
  title: string;
  host: string;
  path: string;
}

export const SITES: Site[] = [
  { id: 'gn', name: '괴담넷', title: '괴담넷 - 자유게시판', host: 'goedam.net', path: '/board/free' },
  { id: 'gal', name: '괴담 갤러리', title: '괴담 갤러리 - 괴담갤', host: 'gall.goedam.co.kr', path: '/board/lists/?id=horror' },
  { id: 'wpf', name: '세정게', title: '::: 世界政治 게시판 :::', host: 'www.wpf.or.kr', path: '/zboard/zboard.php?id=politics' },
  { id: 'sm', name: '연어 마켓', title: '연어 마켓 | 이면의 중고거래', host: 'salmon-market.kr', path: '' },
  { id: 'cos', name: '우주 쇼핑몰', title: '★우주 쇼핑몰★에 오는 것을 환영하는 것이다', host: 'cosmic-mall.alien', path: '/~shop/index.html' },
  { id: 'wk', name: '괴이위키', title: '괴이위키', host: 'goei.wiki', path: '/w/괴이위키:대문' },
  { id: 'bm', name: '백일몽 포인트몰', title: '백일몽 포인트몰', host: 'point.baekilmong.intra', path: '/mall/main' },
];
export const siteOf = (id: string): Site | undefined => SITES.find((s) => s.id === id);
export const isSite = (id: string): id is SiteId => SITES.some((s) => s.id === id);

/** 사이트 로고 (파비콘·즐겨찾기·새 탭·폰 서랍 공용) */
const LOGO: Record<SiteId | 'home', [string, string]> = {
  gn: ['0 0 24 24', '<path fill="#2dd4bf" d="M12 2C7.6 2 4 5.6 4 10v11.5l2.7-2.2 2.6 2.2 2.7-2.2 2.7 2.2 2.6-2.2 2.7 2.2V10c0-4.4-3.6-8-8-8z"/><ellipse fill="#0f1113" cx="9.2" cy="10.5" rx="1.5" ry="2.1"/><ellipse fill="#0f1113" cx="14.8" cy="10.5" rx="1.5" ry="2.1"/><path fill="#0f1113" d="M10 15.2q2 1.6 4 0v.9q-2 1.4-4 0z"/>'],
  gal: ['0 0 24 24', '<path fill="#3b4890" d="M3 3h18a1 1 0 011 1v12a1 1 0 01-1 1H10l-5 4v-4H3a1 1 0 01-1-1V4a1 1 0 011-1z"/><path fill="#fff" d="M12 5.5c-2.5 0-4.3 1.9-4.3 4.2v5.1l1.4-1 1.4 1 1.5-1 1.5 1 1.4-1 1.4 1V9.7c0-2.3-1.8-4.2-4.3-4.2z"/><circle fill="#3b4890" cx="10.5" cy="9.6" r=".9"/><circle fill="#3b4890" cx="13.5" cy="9.6" r=".9"/>'],
  wpf: ['0 0 24 24', '<circle fill="#7a1010" cx="12" cy="12" r="11"/><circle fill="#1a5aa8" cx="12" cy="12" r="7.5"/><path fill="none" stroke="#ffd24a" stroke-width="1" d="M4.5 12h15M12 4.5v15M6 8.2h12M6 15.8h12"/><ellipse fill="none" stroke="#ffd24a" stroke-width="1" cx="12" cy="12" rx="3.4" ry="7.5"/><circle fill="none" stroke="#ffd24a" stroke-width="1.2" cx="12" cy="12" r="10"/>'],
  sm: ['0 0 32 20', '<path fill="#f26c4f" d="M2 10C5 3.5 13 1.8 20 4.5L26 1.5 24.5 10 26 18.5 20 15.5C13 18.2 5 16.5 2 10z"/><path fill="#ffb49b" d="M4 11.2c4 3.3 10.5 3.8 16 2.2-5.5.6-11-.2-16-2.2z"/><path fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" d="M11 5.2l1.5 4M14.5 4.6l1.5 4.2M18 4.8l1.3 4"/><circle fill="#fff" cx="6.3" cy="8.6" r="1.4"/><circle fill="#2a1a14" cx="6.5" cy="8.6" r=".7"/>'],
  cos: ['0 0 32 24', '<circle fill="#ff3cf0" cx="25" cy="6" r="4"/><ellipse fill="none" stroke="#ffd700" stroke-width="1" cx="25" cy="6" rx="6.5" ry="1.8"/><path fill="#8ff" d="M10 11a6 6 0 0112 0z"/><ellipse fill="#bbb" cx="16" cy="13" rx="14" ry="4.2"/><ellipse fill="#666" cx="16" cy="14.4" rx="10" ry="2"/><circle fill="#ff0" cx="8" cy="13" r="1"/><circle fill="#f0f" cx="16" cy="14" r="1"/><circle fill="#0ff" cx="24" cy="13" r="1"/><path fill="#ffef7a" opacity=".55" d="M11 17h10l3 7H8z"/>'],
  wk: ['0 0 24 24', '<rect width="24" height="24" rx="5" fill="#27685b"/><path fill="#fff" d="M6 5h5.2c.9 0 .8.6.8 1.3V19c-.4-.6-1-1-1.8-1H6zM18 5h-5.2c-.9 0-.8.6-.8 1.3V19c.4-.6 1-1 1.8-1H18z"/><circle cx="8.6" cy="10" r="1.1" fill="#27685b"/><circle cx="15.4" cy="10" r="1.1" fill="#27685b"/>'],
  bm: ['0 0 24 24', '<rect width="24" height="24" rx="5" fill="#1f2a44"/><path fill="#f3d9a4" d="M15.5 4.5a7.5 7.5 0 107 10.2A6 6 0 0115.5 4.5z"/><circle cx="7" cy="7" r="1" fill="#f3d9a4"/><circle cx="5" cy="11" r=".7" fill="#f3d9a4"/>'],
  home: ['0 0 24 24', '<circle fill="#5f6368" cx="12" cy="12" r="11"/><path fill="#e8eaed" d="M10 18v-4.5h4V18h3.5v-6H20L12 5 4 12h2.5v6z"/>'],
};
export const siteLogo = (id: SiteId | 'home' | '', cls = 'br-fv'): string => {
  const [vb, body] = LOGO[id || 'home'];
  return `<svg class="${cls}" viewBox="${vb}" aria-hidden="true">${body}</svg>`;
};

/** 크롬 단추 그림 (머티리얼 모양) */
const ic = (d: string, cls = 'br-i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const IC = {
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  fwd: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
  rel: 'M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  x: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  tune: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
  acct: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  srch: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
};

// ── 탭 상태 (창을 닫아도 이 채팅 동안 남는다. 탭마다 앞뒤 기록) ──
export interface BrTab {
  id: number;
  site: SiteId | '';
  /** 이 탭에서 지나온 화면들 (app 의 화면 상태 JSON) */
  hist: string[];
  at: number;
}
const HIST_MAX = 50;
let seq = 1;
export const br = {
  tabs: [{ id: seq++, site: '', hist: [], at: -1 }] as BrTab[],
  cur: 0,
  /** 로그인 창 열림 */
  login: false,
  /** 폰: 탭 목록 화면 */
  list: false,
};
export const curTab = (): BrTab => br.tabs[Math.min(br.cur, br.tabs.length - 1)];

/** 지금 탭에 화면 상태를 적는다 (방금 적은 것과 같으면 그대로, 뒤로 간 뒤 새 화면이면 앞쪽은 버린다) */
export function recordTab(state: unknown): void {
  const t = curTab();
  const key = JSON.stringify(state);
  if (t.hist[t.at] === key) return;
  t.hist = t.hist.slice(0, t.at + 1);
  t.hist.push(key);
  if (t.hist.length > HIST_MAX) t.hist.shift();
  t.at = t.hist.length - 1;
}
export const tabCan = (dir: -1 | 1): boolean => {
  const t = curTab();
  return t.at + dir >= 0 && t.at + dir < t.hist.length;
};
/** 지금 탭에서 한 칸 앞뒤로. 갈 곳의 화면 상태 */
export function tabGo<T>(dir: -1 | 1): T | null {
  if (!tabCan(dir)) return null;
  const t = curTab();
  t.at += dir;
  return JSON.parse(t.hist[t.at]) as T;
}
/** 지금 탭이 보고 있던 화면 상태 (없으면 null) */
export function tabState<T>(i = br.cur): T | null {
  const t = br.tabs[i];
  return t && t.at >= 0 ? (JSON.parse(t.hist[t.at]) as T) : null;
}

export function newTab(site: SiteId | '' = ''): void {
  br.tabs.push({ id: seq++, site, hist: [], at: -1 });
  br.cur = br.tabs.length - 1;
}
/** 탭 닫기. 마지막 탭을 닫으면 새 탭 하나가 남는다 */
export function closeTab(i: number): void {
  br.tabs.splice(i, 1);
  if (!br.tabs.length) br.tabs.push({ id: seq++, site: '', hist: [], at: -1 });
  if (br.cur >= i && br.cur > 0) br.cur--;
  br.cur = Math.min(br.cur, br.tabs.length - 1);
}
/** 폰 서랍: 그 사이트 탭이 있으면 그 탭으로, 없으면 지금 탭에서 연다 (2026-11-08 사용자) */
export function focusSite(site: SiteId): void {
  const i = br.tabs.findIndex((t) => t.site === site);
  if (i >= 0) br.cur = i;
  else curTab().site = site;
}

// ── 그리기 ──
export interface ChromeOpts {
  /** 지금 탭 제목 (사이트 화면이 주는 것, 비우면 사이트 기본 제목) */
  title: string;
  /** 주소 뒤쪽 (비우면 사이트 기본) */
  path: string;
  /** 즐겨찾기에 보일 사이트 */
  bookmarks: SiteId[];
  /** 로그인: 닉네임 (비우면 로그인 안 함) */
  nick: string;
  photo: string;
  phone: boolean;
}

function tabTitle(t: BrTab, i: number, o: ChromeOpts): string {
  const s = t.site ? siteOf(t.site) : undefined;
  if (!s) return '새 탭';
  return i === br.cur && o.title ? o.title : s.title;
}

/** 탭 줄 + 도구 줄(주소창) + 즐겨찾기 줄 + (로그인 창) */
export function chromeHtml(o: ChromeOpts): string {
  const t = curTab();
  const s = t.site ? siteOf(t.site) : undefined;
  const tabs = br.tabs
    .map((x, i) => `<div class="br-tab${i === br.cur ? ' on' : ''}" role="tab" aria-selected="${i === br.cur}"><button class="br-tabb" data-action="br-tab" data-value="${i}">${siteLogo(x.site)}<span class="br-tt">${esc(tabTitle(x, i, o))}</span></button><button class="br-tx" data-action="br-close" data-value="${i}" aria-label="탭 닫기">${ic(IC.x, 'br-i s')}</button></div>`)
    .join('');
  const omni = s
    ? `<span class="br-ti">${ic(IC.tune)}</span><span class="br-u"><b>${esc(s.host)}</b>${esc(o.path || s.path)}</span>`
    : `<span class="br-ti">${ic(IC.srch)}</span><span class="br-u">검색어 또는 URL 입력</span>`;
  const prof = o.nick ? (o.photo ? `<img src="${esc(o.photo)}" alt="">` : `<b>${esc([...o.nick][0] ?? '')}</b>`) : ic(IC.acct);
  const bms = o.bookmarks
    .map((id) => `<button class="br-bm" data-action="br-go" data-value="${id}">${siteLogo(id)}<span>${esc(siteOf(id)!.name)}</span></button>`)
    .join('');
  return `<div class="br-tabs" role="tablist">${tabs}<button class="br-plus" data-action="br-new" aria-label="새 탭">${ic(IC.add, 'br-i s')}</button></div>
  <div class="br-tool">
    <button class="br-tb pc" data-action="br-back" aria-label="뒤로" ${tabCan(-1) ? '' : 'disabled'}>${ic(IC.back)}</button>
    <button class="br-tb pc" data-action="br-fwd" aria-label="앞으로" ${tabCan(1) ? '' : 'disabled'}>${ic(IC.fwd)}</button>
    <button class="br-tb pc" data-action="br-reload" aria-label="새로고침">${ic(IC.rel)}</button>
    <button class="br-tb mo" data-action="br-home" aria-label="새 탭">${ic(IC.home)}</button>
    <div class="br-omni">${omni}</div>
    <button class="br-prof${o.nick ? ' in' : ''}" data-action="br-login" aria-label="${o.nick ? `${esc(o.nick)}(으)로 로그인됨` : '로그인'}">${prof}</button>
    <button class="br-tabn mo" data-action="br-list" aria-label="탭 ${br.tabs.length}개">${br.tabs.length}</button>
  </div>
  <div class="br-bms">${bms}</div>`;
}

/** 로그인 창: 닉네임 / 로그인하지 않고 계속 (설명 문구 없음, 2026-11-08 사용자) */
export function loginHtml(o: ChromeOpts): string {
  if (!br.login) return '';
  const face = o.photo ? `<img src="${esc(o.photo)}" alt="">` : ic(IC.acct);
  return `<div class="br-lgn" role="dialog" aria-label="로그인"><h4>로그인</h4><div class="br-face">${face}</div>
    <input class="br-in" name="br-nick" data-enter="br-login-save" value="${esc(o.nick)}" placeholder="닉네임" maxlength="36" aria-label="닉네임">
    <button class="br-b1" data-action="br-login-save" data-take="br-nick">로그인</button><hr>
    <button class="br-b2" data-action="br-login-guest">로그인하지 않고 계속</button></div>`;
}

/** 폰: 탭 목록 화면 */
export function tabListHtml(o: ChromeOpts): string {
  return `<div class="br-tlist">${br.tabs
    .map((t, i) => `<div class="br-tcard${i === br.cur ? ' on' : ''}"><button class="br-tabb" data-action="br-tab" data-value="${i}">${siteLogo(t.site)}<span class="br-tt">${esc(tabTitle(t, i, o))}</span></button><button class="br-tx" data-action="br-close" data-value="${i}" aria-label="탭 닫기">${ic(IC.x, 'br-i s')}</button></div>`)
    .join('')}<button class="br-tnew" data-action="br-new">${ic(IC.add, 'br-i s')}새 탭</button></div>`;
}

/** 새 탭 화면: 사이트 바로가기 */
export function homeHtml(sites: SiteId[]): string {
  return `<div class="br-ntp"><div class="br-ntp-lg"><span>G</span><span>o</span><span>e</span><span>i</span></div><div class="br-ntp-q">${ic(IC.srch)}검색어 또는 URL 입력</div>
    <div class="br-ntp-sc">${sites.map((id) => `<button class="br-ntp-s" data-action="br-go" data-value="${id}"><i>${siteLogo(id)}</i><span>${esc(siteOf(id)!.name)}</span></button>`).join('')}</div></div>`;
}

/** 아직 화면이 없는 사이트 (2단계에서 채운다) */
export function soonHtml(id: SiteId): string {
  const s = siteOf(id)!;
  return `<div class="br-soon">${siteLogo(id, 'br-soon-lg')}<b>${esc(s.name)}</b><p>준비 중인 사이트예요.</p></div>`;
}
