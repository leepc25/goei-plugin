// 왼쪽 메뉴 「기록」 (2026-10-29 사용자 결정, docs/설계안_기록_보고서.md 5장): 가계부 자리에 들어가고, 하위 탭 [일지 | 보고서 | 인물 | 세력].
// 일지·보고서는 core/journal 이 종료 순간 잘라 둔 스냅숏(채팅 변수 $goei_journal·$goei_reports)을 그대로 그린다 — 모델 호출 없음.
// 인물·개인 기록·기록 문서·세력 화면은 위키에서 옮겨 왔다 (ui/people.ts 의 화면 함수 그대로, 동작 이름만 rec-*).
// 설정 「기록」 묶음(journalSettingsPane)도 여기: 채팅에 보고서 표시 · 일지를 본편 요청에 · 소감 자동 · 일지 상한 · 보고서 상한 ($jr_*).
import {
  JOURNAL_KIND_LABEL, JR, JR_JOURNAL_CAP, JR_REPORT_CAP, journalClock, journalSettings, jrValue, pinReport, readJournal, readReports, reportVars,
  type JournalKind, type JournalRow, type Report,
} from '../core/journal';
import { debriefRunning, requestDebrief } from '../host/journal';
import { refreshStatusContext } from '../host/statusview';
import { downloadPng, reportPng } from './reportpng';
import type { RecordsNav } from '../core/navhist';
import { anchorPositions, messageKey } from '../core/people/store';
import type { Chat } from '../core/types';
import { formatDelta, formatWon } from '../core/wallet';
import { locName, parseCatalog, readWorld, worldOn } from '../core/world';
import { updateChat, type ChatContext } from '../host/risu';
import { onOffSwitch } from './controls';
import { drawerHtml } from './drawer';
import { defaultsAction, defaultsButtons, defaultsConfirm } from './defaults';
import { ICONS } from './icons';
import { avatar, stLabel } from './images';
import { evArt } from './evpic';
import { factionListView, factionView, peopleDocsView, peopleListView, personView, resetPeopleUi } from './people';
import { toast } from './toast';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type RecSub = RecordsNav['sub'];
export type RecView = RecordsNav['view'];
export type JournalFilter = 'all' | 'mine' | 'bg' | 'an' | 'in';
export type ReportFilter = 'mine' | 'bg';

export interface RecordsEnv {
  render(): void;
  refresh(): Promise<void>;
}

/** 기록 탭 상태 (채팅이 바뀌면 resetRecords). toast = 지금 떠 있는 종료 알림(오버레이) */
export const rec = {
  sub: 'journal' as RecSub,
  view: 'list' as RecView,
  id: '',
  filter: 'all' as JournalFilter,
  q: '',
  rfilter: 'mine' as ReportFilter,
  notice: '',
  info: '',
  busy: false,
  toast: null as null | { rpt: string; name: string },
  /** 「이미지로 저장」 뒤 미리보기 (내려받기가 막힌 곳은 길게 눌러 저장) */
  png: null as null | { url: string; name: string; no: string },
  /** 필드 출동이 끝나 방금 생긴 보고서 id (필드 탭 위 시트). 닫거나 보고서를 열면 비운다 */
  fieldReport: '',
};

function dropPng(): void {
  if (rec.png) {
    try {
      URL.revokeObjectURL(rec.png.url);
    } catch {
      /* 이미 지워짐 */
    }
  }
  rec.png = null;
}

export function resetRecords(): void {
  dropPng();
  Object.assign(rec, { sub: 'journal', view: 'list', id: '', filter: 'all', q: '', rfilter: 'mine', notice: '', info: '', busy: false, fieldReport: '' });
  closeToast();
}

/** 앞뒤 이동·즐겨찾기에 적는 위치 */
export const recordsNav = (): RecordsNav => ({ sub: rec.sub, view: rec.view, id: rec.id });
export function applyRecordsNav(r: RecordsNav): void {
  Object.assign(rec, { sub: r.sub, view: r.view, id: r.id, notice: '' });
}

/** 즐겨찾기 이름 */
export function recordsMarkName(r: RecordsNav, chat: Chat | null): string {
  if (r.view === 'report') return `보고서 ${(chat && readReports(chat).items.find((x) => x.id === r.id)?.no) || ''}`.trim();
  if (r.view === 'person') return `${r.id} 기록`;
  if (r.view === 'docs') return '기록 문서';
  if (r.view === 'faction') return `세력 ${r.id}`;
  return r.sub === 'journal' ? '일지' : r.sub === 'reports' ? '보고서' : r.sub === 'people' ? '이 채팅의 인물' : '세력';
}

// ── 시각·글 도우미 ──

const two = (n: number) => String(n).padStart(2, '0');
const WEEK = '일월화수목금토';
/** 세계 분 → 「YYYY.MM.DD (요일)」 (UTC 기준, app.ts clock() 과 같은 변환) */
function dayOf(at: number | null): string {
  if (at === null) return '';
  const d = new Date(at * 60000);
  return `${d.getUTCFullYear()}.${two(d.getUTCMonth() + 1)}.${two(d.getUTCDate())} (${WEEK[d.getUTCDay()]})`;
}
const hhmm = (at: number | null) => (at === null ? '--:--' : journalClock(at).slice(6));
const ymd = (at: number | null) => (at === null ? '' : journalClock(at).slice(0, 5));
/** 소요 분 → 「1h 24m」·「38m」 */
export function durText(min: number | null): string {
  if (min === null || !Number.isFinite(min)) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${two(m)}m` : `${m}m`;
}
const longDur = (min: number | null) => (min === null ? '' : `${Math.floor(min / 60) ? `${Math.floor(min / 60)}시간 ` : ''}${min % 60}분`);

function gmark(kind: JournalKind, grade?: string): string {
  const g = kind === 'an' && grade && /^[A-Za-z]+$/.test(grade) ? grade : '';
  const cls = kind === 'fd' ? 'ms' : kind;
  const mark = kind === 'an' ? '?' : kind === 'in' ? ICONS.siren : kind === 'ms' ? ICONS.spook : ICONS.game;
  return `<i class="gx-gmark ${cls}${g ? ` g-${g.toLowerCase()}` : ''}" title="${JOURNAL_KIND_LABEL[kind]}${g ? ` ${esc(g)}등급` : ''}">${g ? esc(g) : mark}</i>`;
}
const whoText = (r: { mine: boolean; agents: { name: string }[] }) => [...(r.mine ? ['나'] : []), ...r.agents.map((a) => a.name)].filter(Boolean).join(' · ');
const mineBadge = (r: { mine: boolean; kind: JournalKind }) => (r.kind === 'fd' ? '<span class="gx-badge live">필드 출동</span>' : r.mine ? '<span class="gx-badge live">내가 출동</span>' : '<span class="gx-badge">요원 처리</span>');

/** 세계 시각 (상황판) — 없으면 가장 최근 일지 줄의 시각 */
function nowMinute(ctx: ChatContext, rows: JournalRow[]): number | null {
  const w = worldOn(ctx.chat) ? readWorld(ctx.chat) : null;
  if (w && w.minute !== null) return w.minute;
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].at !== null) return rows[i].at;
  return null;
}

// ── 화면 ──

const SUBS: [RecSub, string][] = [['journal', '일지'], ['reports', '보고서'], ['people', '인물'], ['factions', '세력']];

export function recordsTab(ctx: ChatContext): string {
  const tabs = `<div class="ph-subs gx-rec-tabs" role="tablist">${SUBS.map(([v, l]) => `<button role="tab" class="ph-sub${rec.sub === v ? ' on' : ''}" data-action="rec-sub" data-value="${v}" aria-selected="${rec.sub === v}" aria-pressed="${rec.sub === v}">${l}</button>`).join('')}</div>`;
  const notice = rec.notice ? `<div class="gx-err" role="alert">${esc(rec.notice)}</div>` : '';
  const note = toast('rec', rec.info, (t) => {
    if (rec.info === t) rec.info = '';
  });
  // 폰: 하위 탭 넷은 위가 아니라 숨은 서랍(괴담톡·괴담넷처럼)에 (2026-10-29 사용자). PC 는 위 탭 줄
  const SUB_ICON: Record<RecSub, string> = { journal: ICONS.list, reports: ICONS.records, people: ICONS.group, factions: ICONS.org };
  const drawer = matchMedia('(max-width: 760px)').matches
    ? drawerHtml(SUBS.map(([v, l]) => `<button class="ph-tool" data-action="rec-sub" data-value="${v}" aria-label="${l}" title="${l}" aria-pressed="${rec.sub === v}">${SUB_ICON[v]}<span class="ph-tool-l">${l}</span></button>`).join(''), '', 'gx-rdrawer')
    : '';
  return `<main class="gx-body gx-records">${tabs}${notice}${pane(ctx)}${note}</main>${pngModal()}${drawer}`;
}

/** 「이미지로 저장」 미리보기 창: 내려받기는 이미 시작됐고, download 를 무시하는 곳(iOS)은 그림을 길게 눌러 저장 */
function pngModal(): string {
  if (!rec.png) return '';
  return `<div class="gx-agpop gx-pngpop" data-action="rec-png-x" role="dialog" aria-label="보고서 이미지">
    <div class="gx-agpop-card gx-pngcard" data-action="rec-png-keep">
      <button class="gx-agpop-x" data-action="rec-png-x" aria-label="닫기">${ICONS.close}</button>
      <b class="gx-png-title">${esc(rec.png.no)} · 900×1200</b>
      <img class="gx-png-img" src="${esc(rec.png.url)}" alt="보고서 이미지">
      <p class="ps-note">내려받기를 시작했어요. 저장이 안 되는 기기(아이폰 등)는 그림을 길게 눌러 저장하세요.</p>
      <span class="gx-png-acts"><button class="gx-mini primary" data-action="rec-png-dl">${ICONS.down}다시 내려받기</button><button class="gx-mini" data-action="rec-png-x">닫기</button></span>
    </div></div>`;
}

/** 필드 탭 위 시트 (시안 Field.dc.html): 출동이 끝나 보고서가 생겼을 때. 「보고서 보기」는 기록 페이지로, 「본부로」는 닫기 */
export function fieldSheet(ctx: ChatContext): string {
  if (!rec.fieldReport) return '';
  const r = readReports(ctx.chat).items.find((x) => x.id === rec.fieldReport);
  if (!r) return '';
  const h = r.head;
  const when = h.at !== null ? `${ymd(h.at)} ${hhmm(h.at)}` : '';
  const who = r.agents.map((a) => a.name).filter(Boolean).join(' · ');
  const line2 = [h.place || locName(h.loc) || h.loc, who, h.duration !== null ? longDur(h.duration) : ''].filter(Boolean).join(' · ');
  const aff = r.people?.length ? `<span class="gx-fs-aff">호감 변화 ${r.people.map((p) => `<i class="${p.delta < 0 ? 'neg' : 'pos'}">${p.delta > 0 ? '+' : p.delta < 0 ? '−' : ''}${Math.abs(p.delta)}</i>`).join(' · ')}</span>` : '';
  const sum = (r.wallet ?? []).reduce((a, t) => a + t.amount, 0);
  const money = [sum ? `<span class="gx-fs-won ${sum < 0 ? 'out' : 'in'}">${sum < 0 ? '지출' : '수당'} ${esc(formatDelta(sum).replace(/^([+−-])/, '$1₩'))}</span>` : '', r.balance !== undefined ? `<span class="gx-fs-bal">잔고 ${esc(formatWon(r.balance))}</span>` : ''].filter(Boolean).join('');
  return `<section class="gx-fieldsheet" role="status" aria-label="출동 종료">
    <header><span class="gx-badge live">출동 종료</span><small>${esc(when)}</small></header>
    <b class="gx-fs-title">${esc(h.name)} — ${esc(r.result.replace(/^작전 종료\s*(\([^)]*\))?:\s*[^,]*,?\s*/, '') || '귀환')}</b>
    <p class="gx-fs-line">${esc(line2)}</p>
    ${aff || money ? `<p class="gx-fs-sum">${aff}${money}</p>` : ''}
    <p class="gx-fs-note">이 출동은 관리국 일지에 「내가 출동」으로 기록됐어요. 막간도 다음 본편 요청에 들어가요.</p>
    <span class="gx-fs-acts"><button class="gx-mini" data-action="rec-field-x">본부로</button><button class="gx-mini primary" data-action="rec-open" data-value="${esc(r.id)}">보고서 보기</button></span>
  </section>`;
}

function pane(ctx: ChatContext): string {
  if (rec.view === 'report') return reportPage(ctx, rec.id);
  if (rec.view === 'person') return `<div class="gx-rec-pane">${personView(ctx, rec.id)}</div>`;
  if (rec.view === 'docs') return `<div class="gx-rec-pane">${peopleDocsView(ctx)}</div>`;
  if (rec.view === 'faction') return `<div class="gx-rec-pane">${factionView(ctx, rec.id)}</div>`;
  switch (rec.sub) {
    case 'reports': return reportsPane(ctx);
    case 'people': return `<div class="gx-rec-pane">${peopleListView(ctx)}</div>`;
    case 'factions': return `<div class="gx-rec-pane">${factionListView(ctx)}</div>`;
    default: return journalPane(ctx);
  }
}

// ── 상황판 톤 부품 (2026-10-29 사용자 시안 docs/시안/기록_가계부_2): 모니터 판 · CCTV 화면 조각 · 요원 얼굴 ──

/** 어두운 모니터 판 (상황판 CCTV 와 같은 결): 왼쪽 위 표지·제목, 오른쪽 위 시각, 아래 숫자 칸 */
export function monitor(tag: string, title: string, clock: string, cells: { label: string; value: string; sub: string; tone?: 'mint' | 'amb' | 'red' | '' ; cls?: string }[], o: { live?: boolean; cls?: string } = {}): string {
  return `<section class="gx-mon${o.cls ? ` ${o.cls}` : ''}"><div class="gx-mon-osd"><span><span class="gx-mon-tag${o.live ? ' live' : ''}"><i></i>${esc(tag)}</span><span class="gx-mon-title">${esc(title)}</span></span>${clock ? `<span>${esc(clock)}</span>` : ''}</div>
    <div class="gx-mon-cells">${cells.map((c) => `<div class="gx-mon-cell${c.cls ? ` ${c.cls}` : ''}"><small>${esc(c.label)}</small><b class="${c.tone ?? ''}">${c.value}</b><span>${esc(c.sub)}</span></div>`).join('')}</div></section>`;
}

const camNo = (loc: string) => String((Array.from(loc).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 40) + 1).padStart(2, '0');
const region = (loc: string) => (locName(loc) || loc).split(/\s+/)[0] || '';

/** CCTV 화면 조각: 그 괴이·사건의 그림(없으면 어두운 화면) + 카메라 번호·종료 시각 */
function shot(ctx: ChatContext, name: string, kind: JournalKind, loc: string, at: number | null, cls = 'gx-shot'): string {
  const art = kind === 'fd' ? null : evArt(ctx, name, kind).pic;
  return `<span class="${cls}">${art ? `<img src="${esc(art)}" alt="" loading="lazy">` : ''}<span class="gx-shot-t">CAM-${camNo(loc)}${region(loc) ? ` · ${esc(region(loc))}` : ''}</span><span class="gx-shot-end">END ${esc(hhmm(at))}</span></span>`;
}

let faceCat: { lore: unknown; map: Map<string, string | undefined> } | null = null;
/** 투입 요원 얼굴 (명부 영문명으로) */
function faces(ctx: ChatContext, names: string[]): string {
  if (!faceCat || faceCat.lore !== ctx.char.globalLore) {
    let map = new Map<string, string | undefined>();
    try {
      map = new Map(parseCatalog(ctx.char.globalLore).people.map((p) => [p.name, p.english]));
    } catch {
      /* 명부를 못 읽으면 첫 글자 */
    }
    faceCat = { lore: ctx.char.globalLore, map };
  }
  return names.slice(0, 4).map((n) => avatar(ctx.char, faceCat!.map.get(n), n, 'gx-face')).join('');
}

// ── 일지 ──

const FILTERS: [JournalFilter, string][] = [['all', '전체'], ['mine', '내가 출동'], ['bg', '백그라운드'], ['an', '괴이'], ['in', '사건']];

function journalPane(ctx: ChatContext): string {
  const rows = readJournal(ctx.chat).rows;
  const reports = readReports(ctx.chat).items;
  const now = nowMinute(ctx, rows);
  const month = now === null ? '' : journalClock(now).slice(0, 2);
  const monthRows = now === null ? rows : rows.filter((r) => r.at !== null && ymd(r.at).slice(0, 2) === month && new Date(r.at * 60000).getUTCFullYear() === new Date(now * 60000).getUTCFullYear());
  const todayKey = now === null ? '' : dayOf(now);
  const todayRows = todayKey ? rows.filter((r) => dayOf(r.at) === todayKey) : [];
  const mineN = rows.filter((r) => r.mine).length;
  const kinds = (list: JournalRow[]) => [['an', '괴이'], ['in', '사건'], ['ms', '특수'], ['fd', '필드']].map(([k, l]) => [l, list.filter((r) => r.kind === k).length] as const).filter(([, n]) => n).map(([l, n]) => `${l} ${n}`).join(' · ');
  const durs = todayRows.map((r) => (r.at !== null && r.since !== null ? Math.max(0, r.at - r.since) : null)).filter((d): d is number => d !== null);
  const avg = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null;
  const clockText = now === null ? '' : journalClock(now).replace(/^(\d\d)\.(\d\d)/, `${new Date(now * 60000).getUTCFullYear()}.$1.$2`);
  const mon = monitor('ARCHIVE', 'BUREAU LOG · 관리국 일지', clockText, [
    { label: now === null ? 'CLOSED · 전체' : 'CLOSED · 이번 달', value: String(monthRows.length), sub: kinds(monthRows) || '아직 없음', tone: 'mint' },
    { label: 'DEPLOYED · 내가 출동', value: String(mineN), sub: `보고서 ${reports.filter((r) => r.mine).length}건`, tone: 'amb' },
    { label: 'BACKGROUND', value: String(rows.length - mineN), sub: '요원 단독 처리' },
    { label: `TODAY${now !== null ? ` · ${ymd(now)}` : ''}`, value: String(todayRows.length), sub: avg !== null ? `평균 소요 ${longDur(avg)}` : todayRows.length ? '소요 미상' : '없음' },
  ], { cls: 'gx-jr-tiles' });
  const chips = FILTERS.map(([v, l]) => `<button class="gx-chip${rec.filter === v ? ' on' : ''}" data-action="rec-filter" data-value="${v}" aria-pressed="${rec.filter === v}">${l}</button>`).join('');
  return `${mon}
    <div class="gx-rec-tools">${chips}<input class="gx-wt-q" type="search" data-input="rec-q" value="${esc(rec.q)}" placeholder="찾기: 이름·장소·요원" aria-label="일지 찾기"></div>
    <div class="gx-jr-list">${journalList(ctx)}</div>`;
}

/** 일지 목록만 (찾기 칸을 칠 때 이 부분만 다시 그린다) */
export function journalList(ctx: ChatContext): string {
  const rows = readJournal(ctx.chat).rows;
  const q = rec.q.trim().toLowerCase();
  const pass = (r: JournalRow) => (rec.filter === 'mine' ? r.mine : rec.filter === 'bg' ? !r.mine : rec.filter === 'an' ? r.kind === 'an' : rec.filter === 'in' ? r.kind === 'in' : true)
    && (!q || `${r.name} ${locName(r.loc)} ${r.agents.map((a) => a.name).join(' ')} ${r.result}`.toLowerCase().includes(q));
  const shown = rows.filter(pass).reverse();
  if (!shown.length) return `<p class="gx-wt-empty">${rows.length ? '맞는 줄이 없어요.' : '아직 종료된 상황이 없어요. 괴이·사건·특수가 종료되면 여기에 한 줄씩 쌓여요.'}</p>`;
  const groups: { day: string; rows: JournalRow[] }[] = [];
  for (const r of shown) {
    const day = dayOf(r.at);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.rows.push(r);
    else groups.push({ day, rows: [r] });
  }
  groups.sort((a, b) => (a.day === '' ? 1 : b.day === '' ? -1 : 0));
  const cnt = (list: JournalRow[]) => [['an', '괴이'], ['in', '사건'], ['ms', '특수'], ['fd', '필드']].map(([k, l]) => [l, list.filter((r) => r.kind === k).length] as const).filter(([, n]) => n).map(([l, n]) => `${l} ${n}`).join(' · ');
  return groups.map((g) => `<section class="gx-jr-day"><h3><span>${esc(g.day || '시각 없음')}</span><em>${esc(cnt(g.rows))}</em></h3><ul>${g.rows.map((r) => journalRow(ctx, r)).join('')}</ul></section>`).join('');
}

function journalRow(ctx: ChatContext, r: JournalRow): string {
  const dur = r.at !== null && r.since !== null ? longDur(Math.max(0, r.at - r.since)) : '';
  const names = r.agents.map((a) => a.name).filter(Boolean);
  const inner = `${shot(ctx, r.name, r.kind, r.loc, r.at)}
    <span class="gx-jr-main"><span class="gx-jr-l1">${gmark(r.kind, r.grade)}<b>${esc(r.name)}</b>${r.mine ? '<span class="gx-badge live">내가 출동</span>' : ''}</span>
      <small>${[JOURNAL_KIND_LABEL[r.kind], locName(r.loc) || r.loc, dur ? `소요 ${dur}` : ''].filter(Boolean).map(esc).join(' · ')}</small>
      <span class="gx-jr-who">${faces(ctx, names)}${esc(whoText(r) || '투입 없음')}${r.result ? ` <em>— ${esc(r.result)}</em>` : ''}</span></span>
    <span class="gx-jr-side"><span class="gx-jr-time">${esc(hhmm(r.at))}</span>${r.rpt ? '<span class="gx-jr-go">보고서 ›</span>' : `<span class="gx-jr-bg">${r.mine ? '내가 출동' : '백그라운드'}</span>`}</span>`;
  const cls = `gx-jr-row${r.mine ? ' mine' : ''}`;
  return `<li>${r.rpt ? `<button class="${cls}" data-action="rec-open" data-value="${esc(r.rpt)}" aria-label="${esc(r.name)} 보고서">${inner}</button>` : `<div class="${cls}">${inner}</div>`}</li>`;
}

// ── 보고서 목록 ──

// 사용자 결정 「카드 목록(「내가 출동」/「요원 처리」 칩)」 — 두 칩뿐 (「전체」 칩은 결정에 없어 뺐다, 2026-10-29 검토)
const RFILTERS: [ReportFilter, string][] = [['mine', '내가 출동'], ['bg', '요원 처리']];

const peopleSum = (r: Report) => (r.people?.length ? `<span class="gx-rcard-aff">호감 ${r.people.map((p) => `<i class="${p.delta < 0 ? 'neg' : 'pos'}">${p.delta > 0 ? '+' : p.delta < 0 ? '−' : ''}${Math.abs(p.delta)}</i>`).join(' ')}</span>` : '');
const walletSum = (r: Report) => {
  const n = (r.wallet ?? []).reduce((a, t) => a + t.amount, 0);
  return n ? `<span class="gx-rcard-won ${n < 0 ? 'out' : 'in'}">${esc(formatDelta(n).replace(/^([+−-])/, '$1₩'))}</span>` : '';
};

function reportsPane(ctx: ChatContext): string {
  const all = readReports(ctx.chat).items;
  const shown = all.filter((r) => (rec.rfilter === 'mine' ? r.mine : !r.mine)).reverse();
  const chips = RFILTERS.map(([v, l]) => `<button class="gx-chip${rec.rfilter === v ? ' on' : ''}" data-action="rec-rfilter" data-value="${v}" aria-pressed="${rec.rfilter === v}">${l} ${all.filter((r) => (v === 'mine' ? r.mine : !r.mine)).length}</button>`).join('');
  const cards = shown.map((r) => {
    const h = r.head;
    const meta = [h.place || locName(h.loc) || h.loc, longDur(h.duration)].filter(Boolean).join(' · ');
    const names = r.agents.map((a) => a.name).filter(Boolean);
    return `<button class="gx-rcard${r.mine ? ' mine' : ''}" data-action="rec-open" data-value="${esc(r.id)}">
      <span class="gx-rcard-shot">${shot(ctx, h.name, r.kind, h.loc, h.at, 'gx-shot big')}<span class="gx-rcard-no">${esc(r.no)}</span><span class="gx-rcard-stamp">CLOSED</span>${r.pin ? `<i class="gx-rcard-pin" title="고정">${ICONS.pin}</i>` : ''}</span>
      <span class="gx-rcard-body">
        <span class="gx-rcard-t">${gmark(r.kind, h.grade)}<b>${esc(h.name)}</b>${r.mine ? mineBadge(r) : ''}</span>
        <span class="gx-rcard-meta">${esc(meta)}</span>
        <span class="gx-rcard-who">${faces(ctx, names)}${esc(whoText(r) || '투입 없음')}</span>
        ${r.result ? `<span class="gx-rcard-res">${esc(r.result)}</span>` : ''}
        <span class="gx-rcard-sum">${peopleSum(r)}${walletSum(r)}${r.full ? '' : '<span class="gx-rcard-lite">간이 보고서</span>'}</span>
      </span>
    </button>`;
  }).join('');
  const empty = all.length ? '맞는 보고서가 없어요.' : '아직 보고서가 없어요. 상황이 종료되면 그 순간의 기록이 보고서로 남아요.';
  return `<div class="gx-rec-tools">${chips}</div>
    ${cards ? `<div class="gx-rcards">${cards}</div>` : `<p class="gx-wt-empty">${empty}</p>`}`;
}

// ── 보고서 페이지 ──

function reportPage(ctx: ChatContext, id: string): string {
  const r = readReports(ctx.chat).items.find((x) => x.id === id);
  const back = `<button class="ph-tool ph-back" data-action="rec-back" aria-label="뒤로">${ICONS.back}</button>`;
  if (!r) return `<section class="gx-rpt"><header class="gx-rpt-head">${back}<b>보고서</b></header><p class="gx-wt-empty">이 보고서는 상한에 밀려 지워졌거나 되감겨서 없어요.</p></section>`;
  const h = r.head;
  const kindLine = `${JOURNAL_KIND_LABEL[r.kind]} · 종료${r.cause === 'manual' ? ' (직접 종료)' : r.cause === 'ttl' ? ' (시간 경과)' : ''}`;
  const place = [h.place, locName(h.loc) || h.loc].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
  const times = [['발생', h.born], ['투입', h.since], ['종료', h.at]].filter(([, m]) => m !== null && m !== undefined).map(([l, m]) => `<span><i>${l}</i><b>${esc(`${ymd(m as number)} ${hhmm(m as number)}`)}</b></span>`).join('');
  const dur = h.duration !== null ? `<span><i>소요</i><b>${esc(longDur(h.duration))}</b></span>` : '';
  const trail = r.trail.length
    ? `<ol class="gx-rpt-trail">${r.trail.map((t, i) => `<li><span class="gx-rpt-t">${esc(hhmm(t.m))}</span><span>${esc(t.text)}${i === 0 ? ' <em class="gx-rpt-first">발생</em>' : ''}</span></li>`).join('')}</ol>`
    : '<p class="ps-note">상황판 기록이 없어요.</p>';
  let byName = new Map<string, { english?: string }>();
  try {
    byName = new Map(parseCatalog(ctx.char.globalLore).people.map((p) => [p.name, { english: p.english }]));
  } catch {
    /* 목록 로어북이 없는 카드 */
  }
  const agents = r.agents.length
    ? `<ul class="gx-rpt-agents">${r.agents.map((a) => `<li>${avatar(ctx.char, byName.get(a.name)?.english, a.name, 'sm')}<span><b>${esc(a.name)}</b><small>${esc([a.st ? stLabel(a.st) : '상태 미상', a.situation].filter(Boolean).join(' · '))}</small></span></li>`).join('')}</ul>`
    : '<p class="ps-note">투입 기록이 없어요.</p>';
  const debrief = r.debrief
    ? `<blockquote class="gx-rpt-debrief"><b>${esc(r.debrief.who)} 소감</b><p>${esc(r.debrief.text)}</p><small>${r.debrief.src === 'manual' ? '직접 요청' : r.debrief.src === 'backfill' ? '지난 응답 읽기' : '종료 턴 갱신기'} · ${esc(r.debrief.at.slice(0, 10))}</small></blockquote>`
    : '<p class="ps-note">소감 없음</p>';
  const people = r.full
    ? `<section class="gx-rpt-sec"><h3>인물 기록 변화 <small>(종료 시점)</small></h3>${r.people?.length
      ? `<ul class="gx-rpt-people">${r.people.map((p) => `<li><b>${esc(p.who)}</b>${p.quote ? `<q>${esc(p.quote)}</q>` : ''}<em class="${p.delta < 0 ? 'neg' : 'pos'}">${p.delta > 0 ? '+' : p.delta < 0 ? '−' : ''}${Math.abs(p.delta)}${p.stage ? ` → ${esc(p.stage)}` : ''}</em></li>`).join('')}</ul>`
      : '<p class="ps-note">이 사건 동안 호감이 움직인 인물이 없어요.</p>'}</section>`
    : '';
  const wallet = r.full
    ? `<section class="gx-rpt-sec"><h3>가계부 <small>(이 사건 동안)</small></h3>${r.wallet?.length
      ? `<ul class="gx-rpt-wallet">${r.wallet.map((t) => `<li><span>${esc(t.memo || '(메모 없음)')}</span><b class="${t.amount < 0 ? 'out' : 'in'}">${esc(formatDelta(t.amount).replace(/^([+−-])/, '$1₩ '))}</b></li>`).join('')}${r.balance !== undefined ? `<li class="bal"><span>종료 시점 잔고</span><b>${esc(formatWon(r.balance))}</b></li>` : ''}</ul>`
      : `<p class="ps-note">이 사건 동안 거래가 없어요.${r.balance !== undefined ? ` 종료 시점 잔고 ${esc(formatWon(r.balance))}` : ''}</p>`}</section>`
    : '';
  // 「이미지로 저장」= 캔버스 900×1200 PNG 내려받기 (ui/reportpng) · 「소감 쓰기」= 이 보고서만 보조 모델 1회 (host/journal). 「채팅에 넣기」는 없다 (결정)
  const writing = debriefRunning(r.id);
  const acts = `<button class="gx-mini" data-action="rec-png" data-value="${esc(r.id)}" ${rec.busy ? 'disabled' : ''} title="PNG 900×1200 한 장으로 내려받아요">${ICONS.cctv}이미지로 저장</button>
    <button class="gx-mini" data-action="rec-debrief" data-value="${esc(r.id)}" ${rec.busy || writing ? 'disabled' : ''} title="이 보고서의 담당 요원 소감을 보조 모델 1회로 써요${r.debrief ? ' (있던 소감을 덮어써요)' : ''}">${ICONS.pen}${writing ? '소감 쓰는 중…' : '소감 쓰기'} <small>보조 모델 1회</small></button>
    <button class="gx-mini${r.pin ? ' on' : ''}" data-action="rec-pin" data-value="${esc(r.id)}" aria-pressed="${!!r.pin}" title="${r.pin ? '고정 풀기' : '고정: 상한에 밀려 지워지지 않아요'}" ${rec.busy ? 'disabled' : ''}>${ICONS.pin}${r.pin ? '고정됨' : '고정'}</button>`;
  return `<section class="gx-rpt">
    <header class="gx-rpt-head">${back}<b>보고서</b><span class="gx-rcard-no">${esc(r.no)}</span><span class="gx-rpt-acts">${acts}</span></header>
    <div class="gx-rpt-top">${gmark(r.kind, h.grade)}<div class="gx-rpt-title"><b>${esc(h.name)}</b><span>${esc(kindLine)}</span>${mineBadge(r)}${h.cleared ? '<span class="gx-badge live">클리어</span>' : ''}</div>
      ${place ? `<p class="gx-rpt-place">${esc(place)}</p>` : ''}
      <div class="gx-rpt-times">${times}${dur}</div></div>
    <section class="gx-rpt-sec"><h3>경과 <small>(상황판 기록)</small></h3>${trail}</section>
    <section class="gx-rpt-sec"><h3>투입 요원</h3>${agents}</section>
    <section class="gx-rpt-sec"><h3>결과</h3><p class="gx-rpt-result">${esc(r.result)}</p></section>
    <section class="gx-rpt-sec"><h3>소감</h3>${debrief}</section>
    ${people}${wallet}
    <p class="gx-rpt-foot">이 보고서는 상황판·인물 기록·가계부에서 자동으로 만들어졌어요.</p>
  </section>`;
}

// ── 상황판 연결 ──

/** 종료 줄 → 보고서 지름길 (같은 종류·장소의 최신 일지 줄. 이름이 같은 줄이 있으면 그것) */
export function endedReport(chat: Chat, kind: JournalKind, name: string, loc: string): { rpt?: string; mine: boolean } | null {
  const rows = readJournal(chat).rows;
  let loose: JournalRow | null = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.kind !== kind || r.loc !== loc) continue;
    if (r.name === name) return { rpt: r.rpt, mine: r.mine };
    loose ??= r;
  }
  return loose ? { rpt: loose.rpt, mine: loose.mine } : null;
}

/**
 * 종료 알림 (상황판 맨 위 한 줄): 마지막 응답에서 내가 출동한 사건이 종료돼 보고서가 생겼으면. 닫으면 이 세션에서는 다시 안 뜬다.
 * 「마지막 응답」 = anchor 가 마지막 봇 응답의 열쇠이거나, 그 뒤 메시지(손 종료·필드 종료는 유저 메시지가 기준일 수 있다)의 열쇠인 줄.
 * 번호(idx)로 비교하지 않는다 — 메시지를 지워 번호가 줄면 옛 종료가 「방금 저장됨」으로 되살아났다. 지워진 메시지의 anchor 는 자리가 없어 빠진다.
 */
/** 방금(마지막 응답에서) 종료돼 보고서가 생긴 「내가 출동한」 사건. 없으면 null */
function closeHit(chat: Chat): { rpt: string; name: string } | null {
  const list = Array.isArray(chat.message) ? chat.message : [];
  let last = -1;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].role === 'char') { last = i; break; }
  if (last < 0) return null;
  const key = messageKey(list[last], last);
  const at = anchorPositions(chat);
  const recent = (anchor: string) => {
    if (anchor === key) return true;
    const pos = at.get(anchor);
    return pos !== undefined && pos >= last;
  };
  const rows = readJournal(chat).rows;
  const hit = [...rows].reverse().find((r) => r.mine && r.rpt && recent(r.anchor));
  return hit && hit.rpt ? { rpt: hit.rpt, name: hit.name } : null;
}

// ── 종료 알림 (오버레이, 2026-10-29 사용자 결정): 보고서마다 한 번만 — 창이 열려 있으면 종료된 그 자리에서, 닫혀 있었으면 다음에 열 때.
// 흐름 안에 끼우지 않고 창 위에 띄운다. 6초 뒤 사라지고, 마우스를 올리면 멈추며, X 로 닫는다. 채팅 변수에는 쓰지 않는다 (이 세션 안에서 한 번)
export const TOAST_MS = 6000;
const noticed = new Set<string>();
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function armToast(render: () => void): void {
  holdToast();
  toastTimer = setTimeout(() => {
    toastTimer = null;
    rec.toast = null;
    render();
  }, TOAST_MS);
}
/** 창을 그릴 때마다: 새로 종료된 보고서가 있고 아직 안 띄웠으면 띄운다 */
export function syncCloseToast(chat: Chat, render: () => void): void {
  const hit = closeHit(chat);
  if (!hit || noticed.has(hit.rpt)) return;
  noticed.add(hit.rpt);
  rec.toast = hit;
  armToast(render);
}
/** 마우스를 올린 동안 멈춤 */
export function holdToast(): void {
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = null;
}
/** 마우스가 떠나면 다시 6초 */
export function releaseToast(render: () => void): void {
  if (rec.toast) armToast(render);
}
export function closeToast(): void {
  holdToast();
  rec.toast = null;
}
export function closeToastHtml(): string {
  if (!rec.toast) return '';
  return `<div class="gx-rectoast" role="status"><span>${ICONS.records}보고서가 기록에 저장됐어요 · <b>${esc(rec.toast.name)}</b></span><button class="gx-mini" data-action="rec-open" data-value="${esc(rec.toast.rpt)}">보기</button><button class="gx-rectoast-x" data-action="rec-toast-x" aria-label="알림 닫기">${ICONS.close}</button></div>`;
}

// ── 조작 ──

/** 처리했으면 true. rec-back 을 최상위(목록)에서 눌렀을 때만 false → app.ts 가 이전 화면으로 */
export async function handleRecords(action: string, value: string | undefined, ctx: ChatContext, env: RecordsEnv): Promise<boolean> {
  const v = value ?? '';
  if (action.startsWith('jr-')) return handleJournalSettings(action, v, ctx, env);
  switch (action) {
    case 'rec-sub':
      if (!SUBS.some(([s]) => s === v)) return true;
      rec.sub = v as RecSub;
      rec.view = 'list';
      rec.id = '';
      rec.notice = '';
      resetPeopleUi();
      break;
    case 'rec-journal':
      Object.assign(rec, { sub: 'journal', view: 'list', id: '', notice: '' });
      break;
    case 'rec-filter':
      if (FILTERS.some(([f]) => f === v)) rec.filter = v as JournalFilter;
      break;
    case 'rec-rfilter':
      if (RFILTERS.some(([f]) => f === v)) rec.rfilter = v as ReportFilter;
      break;
    case 'rec-open':
      closeToast();
      if (!readReports(ctx.chat).items.some((r) => r.id === v)) {
        rec.notice = '이 보고서는 상한에 밀려 지워졌거나 되감겨서 없어요.';
        break;
      }
      Object.assign(rec, { sub: 'reports', view: 'report', id: v, notice: '' });
      if (rec.fieldReport === v) rec.fieldReport = '';
      break;
    case 'rec-people':
      Object.assign(rec, { sub: 'people', view: 'list', id: '', notice: '' });
      resetPeopleUi();
      break;
    case 'rec-person':
      if (!v) return true;
      Object.assign(rec, { sub: 'people', view: 'person', id: v, notice: '' });
      resetPeopleUi();
      break;
    case 'rec-docs':
      Object.assign(rec, { sub: 'people', view: 'docs', id: '', notice: '' });
      resetPeopleUi();
      break;
    case 'rec-faction':
      if (!v) return true;
      Object.assign(rec, { sub: 'factions', view: 'faction', id: v, notice: '' });
      resetPeopleUi();
      break;
    case 'rec-back':
      if (rec.view === 'list') return false;
      rec.notice = '';
      if (rec.view === 'report') Object.assign(rec, { sub: 'reports', view: 'list', id: '' });
      else if (rec.view === 'faction') Object.assign(rec, { sub: 'factions', view: 'list', id: '' });
      else Object.assign(rec, { sub: 'people', view: 'list', id: '' });
      resetPeopleUi();
      break;
    case 'rec-toast-x':
      closeToast();
      break;
    case 'rec-pin': {
      if (rec.busy || !v) return true;
      const on = !readReports(ctx.chat).items.find((r) => r.id === v)?.pin;
      rec.busy = true;
      try {
        await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...reportVars(pinReport(readReports(chat), v, on)) } }));
        rec.info = on ? '고정했어요. 상한에 밀려 지워지지 않아요.' : '고정을 풀었어요.';
      } catch (error) {
        rec.notice = error instanceof Error ? error.message : String(error);
      }
      rec.busy = false;
      await env.refresh();
      return true;
    }
    case 'rec-png': {
      if (rec.busy || !v) return true;
      const r = readReports(ctx.chat).items.find((x) => x.id === v);
      if (!r) return true;
      rec.busy = true;
      rec.notice = '';
      env.render();
      try {
        dropPng();
        const png = await reportPng(ctx, r, document.querySelector('.gx'), orgText(ctx));
        downloadPng(png);
        rec.png = { url: png.url, name: png.name, no: r.no };
        rec.info = `${png.name} 내려받기를 시작했어요.`;
      } catch (error) {
        rec.notice = `이미지를 만들지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
      }
      rec.busy = false;
      break;
    }
    case 'rec-png-dl':
      if (rec.png) downloadPng({ blob: new Blob(), url: rec.png.url, name: rec.png.name });
      return true;
    case 'rec-png-keep':
      return true;
    case 'rec-png-x':
      dropPng();
      break;
    case 'rec-debrief': {
      if (rec.busy || !v || debriefRunning(v)) return true;
      rec.notice = '';
      const run = requestDebrief(v);
      env.render();
      const r = await run;
      if (r.ok) rec.info = r.message;
      else rec.notice = r.message;
      await env.refresh();
      return true;
    }
    case 'rec-field-x':
      rec.fieldReport = '';
      break;
    default:
      return false;
  }
  env.render();
  return true;
}

/** PNG 머리 오른쪽 둘째 줄: 시작 소속의 조직 이름 (없으면 빈 글) */
function orgText(ctx: ChatContext): string {
  const code = String(ctx.chat.scriptstate?.['$st_faction'] ?? '');
  if (!code) return '';
  try {
    const c = parseCatalog(ctx.char.globalLore);
    const me = c.people.find((p) => p.affiliation === code);
    return me?.department ? `${me.department}` : '';
  } catch {
    return '';
  }
}

/** 입력칸 (다시 그리지 않음). 처리했으면 true — 찾기 칸은 app.ts 가 목록만 다시 그린다 */
export function recordsInput(name: string, value: string): boolean {
  if (name === 'rec-q') return void (rec.q = value), true;
  return false;
}

// ── 설정 「기록」 묶음 ──

const CHAT_CARD: [string, string][] = [['off', '안 띄움'], ['mine', '내가 출동한 사건만'], ['all', '전부']];
const row = (label: string, control: string, help = '') => `<div class="ps-row"><div class="ps-label"><b>${label}</b>${help ? `<small>${help}</small>` : ''}</div><div class="ps-ctl">${control}</div></div>`;
function seg(key: string, cur: string, items: [string, string][]): string {
  const sw = onOffSwitch(items, cur, 'jr-set', (v) => `${key}=${v}`);
  if (sw) return sw;
  return `<div class="gx-segs gx-segs-sm">${items.map(([v, label]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="jr-set" data-value="${esc(`${key}=${v}`)}" aria-pressed="${cur === v}">${label}</button>`).join('')}</div>`;
}
function stepper(key: string, shown: string, canDown: boolean, canUp: boolean, label: string): string {
  return `<div class="st-step"><button class="gx-step" data-action="jr-step" data-value="${key}:-" ${!canDown || rec.busy ? 'disabled' : ''} aria-label="${esc(label)} 줄이기">−</button>
    <b>${esc(shown)}</b><button class="gx-step" data-action="jr-step" data-value="${key}:+" ${!canUp || rec.busy ? 'disabled' : ''} aria-label="${esc(label)} 늘리기">+</button></div>`;
}

export function journalSettingsPane(ctx: ChatContext, canChat = true): string {
  const s = journalSettings(ctx.chat.scriptstate);
  const rows = [
    row('채팅에 보고서 표시', seg('chat_card', s.chatCard, CHAT_CARD), '사건이 종료된 응답 아래에 보고서 카드를 띄워요. 보여 주기만 하고 본문·요청에는 들어가지 않아요. 끄면 이미 뜬 카드도 사라져요.'),
    row('소감 자동', seg('debrief_auto', s.debriefAuto ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]), '인물 기록 갱신기가 켜져 있을 때 그 호출에 「담당 요원 소감」 칸을 얹어요. 따로 부르지 않아요. 갱신기가 꺼져 있으면 보고서는 「소감 없음」.'),
    row('일지 상한', stepper('journal_cap', `${s.journalCap.toLocaleString('en-US')}줄`, s.journalCap > JR_JOURNAL_CAP.min, s.journalCap < JR_JOURNAL_CAP.max, '일지 상한'), `넘치면 오래된 줄부터 지워요 (${JR_JOURNAL_CAP.min.toLocaleString('en-US')}~${JR_JOURNAL_CAP.max.toLocaleString('en-US')}). 채팅 저장 크기에 더해져요.`),
    row('보고서 상한', stepper('report_cap', `${s.reportCap}건`, s.reportCap > JR_REPORT_CAP.min, s.reportCap < JR_REPORT_CAP.max, '보고서 상한'), `넘치면 오래된 보고서부터 지워요 (${JR_REPORT_CAP.min}~${JR_REPORT_CAP.max}). 고정한 보고서는 상한에 들지 않아요.`),
  ].join('');
  return `<div class="ph-form jr-set">
    <header class="ph-room-head"><button class="ph-tool ph-back" data-action="set-feat-back" aria-label="설정으로">${ICONS.back}</button><div class="ph-room-title"><b>기록 설정</b><small>${canChat ? '이 채팅' : '이 채팅 · 시작 전'}</small></div><span class="ph-act">${defaultsButtons('jr')}</span></header>${defaultsConfirm('jr')}
    ${rec.notice ? `<div class="gx-err" role="alert">${esc(rec.notice)}</div>` : ''}
    <div class="ph-form-body ps">
      <section class="ps-group"><h3>기록</h3><div class="ps-rows">${rows}</div></section>
    </div>
    ${toast('rec', rec.info, (t) => {
      if (rec.info === t) rec.info = '';
    })}
  </div>`;
}

async function setVars(ctx: ChatContext, env: RecordsEnv, vars: Record<string, string>): Promise<void> {
  rec.busy = true;
  rec.notice = '';
  try {
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...vars } }));
  } catch (error) {
    rec.notice = error instanceof Error ? error.message : String(error);
  }
  rec.busy = false;
  await env.refresh();
}

async function handleJournalSettings(action: string, v: string, ctx: ChatContext, env: RecordsEnv): Promise<boolean> {
  const def = await defaultsAction('jr', action, v, ctx, env.refresh);
  if (def !== null) {
    if (def) rec.info = def;
    env.render();
    return true;
  }
  if (action === 'jr-set') {
    const i = v.indexOf('=');
    if (i < 0) return true;
    const key = v.slice(0, i);
    let val = v.slice(i + 1);
    if (key === 'chat_card') val = val === 'off' || val === 'all' ? val : 'mine';
    else if (key === 'debrief_auto') val = val === '0' ? '0' : '1';
    else return true;
    await setVars(ctx, env, { [JR(key)]: val });
    if (key === 'chat_card') {
      // 채팅 카드는 display 처리기가 그린다: 열쇠 표를 다시 모으고, 이미 그려진 메시지도 다시 그리게 채팅을 그대로 한 번 저장한다 (끄면 카드가 사라진다)
      try {
        await refreshStatusContext(ctx.charIndex, ctx.chatIndex);
        await updateChat(ctx.charIndex, ctx.chatIndex, (cur) => ({ ...cur }));
      } catch {
        /* 다시 못 그려도 설정은 저장됐다 (다음 채팅 전환 때 반영) */
      }
    }
    return true;
  }
  if (action === 'jr-step') {
    const [key, op] = v.split(':');
    const s = journalSettings(ctx.chat.scriptstate);
    const dir = op === '+' ? 1 : -1;
    let next: number;
    if (key === 'journal_cap') next = Math.max(JR_JOURNAL_CAP.min, Math.min(JR_JOURNAL_CAP.max, s.journalCap + dir * JR_JOURNAL_CAP.step));
    else if (key === 'report_cap') next = Math.max(JR_REPORT_CAP.min, Math.min(JR_REPORT_CAP.max, s.reportCap + dir * JR_REPORT_CAP.step));
    else return true;
    if (String(next) === jrValue(ctx.chat.scriptstate, key)) return true;
    await setVars(ctx, env, { [JR(key)]: String(next) });
    return true;
  }
  return false;
}
