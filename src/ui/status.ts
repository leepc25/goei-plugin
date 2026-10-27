// 채팅 속 상태창 (v0.16.31, 사용자 설계 시안 12): 시각·날짜·요일·날씨 한 줄, 위치, 목표.
// 색은 본 화면에 붙인 style이 정한다 (설정 「상태창」: 테마 따름·다크·라이트·페이퍼·미표시). 그래서 설정을 바꾸면 그린 상자도 바로 바뀐다.
import { dayInfo, elapsedLabel, sceneLabel, statusMinute, storyDay, type ColId, type StatusTag, type StatusTimeline } from '../core/world';
import { formatDelta, formatWon } from '../core/wallet';
import type { StatusStyle, Theme } from '../core/settings';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>';
const AIM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/></svg>';
const CASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M7 12h.01M17 12h.01"/></svg>';

export interface StatusContext {
  timeline: StatusTimeline | null;
  /** 위키에 있는 이름 → 문서 제목 (긴 이름 먼저) */
  terms: { term: string; title: string }[];
  /** 상자에서 숨기는 칸 (설정 「표시」 끔). 없으면 모두 표시 */
  hide?: Set<ColId>;
}

/** 글 속에서 위키 이름만 점선 밑줄로 (겹치면 긴 이름) */
export function linkTerms(text: string, terms: StatusContext['terms']): string {
  if (!terms.length || !text) return esc(text);
  const hits: { at: number; end: number }[] = [];
  for (const { term } of terms) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(term, from);
      if (at < 0) break;
      const end = at + term.length;
      if (!hits.some((h) => at < h.end && end > h.at)) hits.push({ at, end });
      from = end;
    }
  }
  if (!hits.length) return esc(text);
  hits.sort((a, b) => a.at - b.at);
  let out = '';
  let i = 0;
  for (const h of hits) {
    out += esc(text.slice(i, h.at)) + `<span class="gst-link" data-goei-wiki="1">${esc(text.slice(h.at, h.end))}</span>`;
    i = h.end;
  }
  return out + esc(text.slice(i));
}

const kv = (rows: [string, string][]) => `<span class="gst-tip"><span class="gst-kv">${rows.map(([k, v]) => `<i>${esc(k)}</i><em>${esc(v)}</em>`).join('')}</span></span>`;

export function statusHtml(tag: StatusTag, ctx: StatusContext): string {
  const hid = (id: ColId) => !!ctx.hide?.has(id);
  const now = statusMinute(tag.date, tag.time);
  const day = hid('date') ? null : dayInfo(tag.date);
  // 시각: 지난 장면·흐른 시간·시작부터 (아는 것만)
  const rows: [string, string][] = [];
  // 모아 둔 목록에 없는 태그는 방금 들어온 응답: 마지막으로 본 장면이 지난 장면
  const tl = ctx.timeline;
  const known = tl?.prev.get(tag.raw.trim());
  const prev = known ?? (tl?.last && !tl.seen.has(tag.raw.trim()) ? tl.last.minute : undefined);
  if (now !== null && prev !== undefined) rows.push(['지난 장면', sceneLabel(prev, now)], ['흐른 시간', elapsedLabel(prev, now)]);
  const start = ctx.timeline?.start;
  if (now !== null && start !== null && start !== undefined && now >= start) {
    const s = new Date(start * 60000);
    rows.push(['시작부터', `${storyDay(start, now)}일째 · ${s.getUTCMonth() + 1}월 ${s.getUTCDate()}일 시작`]);
  }
  const clock = tag.time && !hid('time') ? `<span class="gst-clock"${rows.length ? ' data-gst-tip="1"' : ''}>${esc(tag.time)}${rows.length ? kv(rows) : ''}</span>` : '';
  let date = '';
  if (day) {
    const cls = day.saturday ? ' sat' : day.weekday === '일' ? ' sun' : '';
    const tip = [['음력', day.lunar], ...(day.holiday ? day.holiday.split('·').map((h) => ['공휴일', h] as [string, string]) : [])].filter(([, v]) => v) as [string, string][];
    date = `<span class="gst-date${day.holiday ? ' hol' : ''}"><span class="gst-dd">${esc(day.date)}</span>`
      + `<span class="gst-wd${cls}"${tip.length ? ' data-gst-tip="1"' : ''}>${day.weekday}${tip.length ? kv(tip) : ''}</span></span>`;
  } else if (tag.date && !hid('date')) date = `<span class="gst-date"><span class="gst-dd">${esc(tag.date)}</span></span>`;
  const wx = [hid('weather') ? '' : tag.weather, hid('temp') ? '' : tag.temp].filter(Boolean).join(' ');
  const top = clock || date || wx ? `<div class="gst-top">${clock}${date}${wx ? `<span class="gst-wx">${esc(wx)}</span>` : ''}</div>` : '';
  const place = tag.place && !hid('place') ? `<div class="gst-ln gst-loc">${PIN}<span>${linkTerms(tag.place, ctx.terms)}</span></div>` : '';
  const target = tag.target && !hid('target') ? `<div class="gst-ln gst-tgt">${AIM}<span>${linkTerms(tag.target, ctx.terms)}</span></div>` : '';
  // 잔고 줄 (10번째 칸): 모델이 적은 값과 지난 상태창과의 차이. 「표시」를 끄면 숨김
  let cash = '';
  if (tag.wallet && !hid('wallet')) {
    const n = Number(tag.wallet);
    const pw = tl?.prevWallet.get(tag.raw.trim()) ?? (tl?.lastWallet !== null && tl?.lastWallet !== undefined && !tl.seen.has(tag.raw.trim()) ? tl.lastWallet : undefined);
    const delta = pw === undefined ? 0 : n - pw;
    cash = `<div class="gst-ln gst-cash">${CASH}<span>${esc(formatWon(n))}${delta ? `<small class="${delta > 0 ? 'gst-up' : 'gst-down'}">${esc(formatDelta(delta))}</small>` : ''}</span></div>`;
  }
  return `<div class="gst" data-goei-status="1">${top}${place}${target}${cash}</div>`;
}

const VARS: Record<Theme, Record<string, string>> = {
  dark: { panel: '#232D32', line: '#37464D', text: '#E9F0EE', sub: '#BECBC8', pin: '#5EEAD4', tgt: '#F2C46B', red: '#FF8F87', blue: '#8DB6FF', shadow: 'rgba(0,0,0,.45)' },
  light: { panel: '#FFFFFF', line: '#D5DDDA', text: '#13201D', sub: '#3B4B47', pin: '#0F8C7A', tgt: '#9A5A00', red: '#C62828', blue: '#1E5BB8', shadow: 'rgba(20,40,35,.18)' },
  paper: { panel: '#FAF5E9', line: '#D3C29E', text: '#2B2418', sub: '#4A3F2C', pin: '#2F6F62', tgt: '#8F5B00', red: '#B3261E', blue: '#2C5AA0', shadow: 'rgba(60,40,10,.2)' },
};

/** 본 화면 style에 넣는 상태창 CSS. theme: 지금 채팅 테마 (테마 따름일 때) */
export function statusCss(style: StatusStyle, theme: Theme): string {
  if (style === 'off') return risuClasses('.gst{display:none!important}');
  const v = VARS[style === 'auto' ? theme : style];
  return risuClasses(`.gst{${Object.entries(v).map(([k, c]) => `--gs-${k}:${c};`).join('')}}${STATUS_CSS}`);
}

/**
 * Risu는 채팅 메시지 속 class 이름마다 「x-risu-」를 붙인다 (parser DOMPurify 훅). 그래서 .gst는 실제로 .x-risu-gst가 된다.
 * 우리 class(gst…·sat·sun·hol)는 두 이름을 다 잡게 바꾼다. open은 그린 뒤 addClass로 붙여 그대로다
 */
function risuClasses(css: string): string {
  return css.replace(/\.(gst[\w-]*|sat|sun|hol)(?![\w-])/g, ':is(.$1,.x-risu-$1)');
}

// 말풍선은 시안처럼 위로.
// 상태창은 가장 최근 메시지 하나에만. Risu는 최신 메시지를 맨 앞에 두므로(.chat-message-container, 뒤집힌 열)
// 상태창이 있는 메시지 뒤쪽의 상태창은 숨긴다. 메시지를 지우면 남은 것 중 가장 최근 것이 다시 보인다
const STATUS_CSS = `
.chat-message-container:has(.gst) ~ .chat-message-container .gst,
.default-chat-screen:has(.chat-message-container .gst) .risu-chat:not(.chat-message-container .risu-chat) .gst{display:none}
.gst{box-sizing:border-box;width:fit-content;min-width:min(100%,420px);max-width:100%;margin:16px auto 0;padding:12px 16px;border:1px solid var(--gs-line);border-radius:14px;background:var(--gs-panel);color:var(--gs-text);font:14px/1.5 system-ui,-apple-system,'Noto Sans KR',sans-serif;box-shadow:0 6px 18px -12px var(--gs-shadow);display:flex;flex-direction:column;gap:7px;text-align:left}
.gst-top{display:flex;align-items:baseline;gap:10px;padding-bottom:8px;border-bottom:1px solid var(--gs-line)}
.gst-top:last-child{padding-bottom:0;border-bottom:0}
.gst-clock{position:relative;font-size:20px;font-weight:800;letter-spacing:-.01em;font-variant-numeric:tabular-nums;white-space:nowrap}
.gst-date{display:inline-flex;align-items:center;color:var(--gs-sub);font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap}
.gst-date.hol .gst-dd{color:var(--gs-red);font-weight:700}
.gst-wd{position:relative;display:inline-grid;place-items:center;width:19px;height:19px;margin-left:6px;border-radius:6px;font-size:11px;font-weight:700;color:var(--gs-sub);box-shadow:inset 0 0 0 1px var(--gs-line)}
.gst-wd.sat{color:var(--gs-blue);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--gs-blue) 45%,transparent)}
.gst-wd.sun{color:var(--gs-red);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--gs-red) 45%,transparent)}
.gst-date.hol .gst-wd{color:#fff;background:var(--gs-red);box-shadow:none}
.gst-wx{margin-left:auto;color:var(--gs-sub);font-size:13px;white-space:nowrap}
.gst-ln{display:flex;align-items:flex-start;gap:8px;min-width:0}
.gst-ln svg{flex:none;width:16px;height:16px;margin-top:2px}
.gst-ln>span{min-width:0;word-break:keep-all;overflow-wrap:anywhere}
.gst-loc{font-weight:700}.gst-loc svg{color:var(--gs-pin)}
.gst-tgt{font-weight:600;color:var(--gs-tgt)}
.gst-cash{font-weight:600;color:var(--gs-sub);font-variant-numeric:tabular-nums}.gst-cash svg{color:var(--gs-sub)}
.gst-cash small{margin-left:7px;font-size:12px;font-weight:700}.gst-up{color:var(--gs-blue)}.gst-down{color:var(--gs-red)}
.gst-link{cursor:pointer;text-decoration:underline dotted;text-decoration-color:color-mix(in srgb,currentColor 50%,transparent);text-underline-offset:3px}
[data-gst-tip]{cursor:pointer}
.gst-tip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);z-index:5;padding:6px 10px;border-radius:9px;background:var(--gs-text);color:var(--gs-panel);font-size:12px;font-weight:600;line-height:1.4;letter-spacing:0;white-space:nowrap;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s}
.gst-tip::before{content:'';position:absolute;left:50%;top:100%;margin-left:-5px;border:5px solid transparent;border-top-color:var(--gs-text)}
.gst-clock .gst-tip{left:0;transform:none}.gst-clock .gst-tip::before{left:20px}
.gst-kv{display:grid;grid-template-columns:auto auto;gap:2px 10px;align-items:baseline;text-align:left}
.gst-kv i{font-style:normal;font-size:11px;opacity:.7}.gst-kv em{font-style:normal;font-weight:700}
@media (hover:hover){[data-gst-tip]:hover>.gst-tip{opacity:1;visibility:visible}}
[data-gst-tip].open>.gst-tip{opacity:1;visibility:visible}
@media (max-width:450px){.gst{padding:11px 12px}.gst-clock{font-size:17px}.gst-top{gap:8px}}
`;
