// 채팅 속 보고서 카드 (docs/설계안_기록_보고서.md 5-12절): 사건이 종료된 응답의 상태창 아래에 display 처리기가 그린다.
// 메시지 본문에는 아무것도 넣지 않고 모델 요청에도 가지 않는다 — 채팅 변수($goei_reports)를 읽어 보여 주기만. 채팅은 플러그인 CSS 가 없어 인라인 스타일.
import { JOURNAL_KIND_LABEL, journalClock, type Report } from '../core/journal';
import { locName } from '../core/world/geo';
import type { Palette } from './theme';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const two = (n: number) => String(n).padStart(2, '0');
const dur = (min: number | null) => (min === null ? '' : `${Math.floor(min / 60) ? `${Math.floor(min / 60)}h ` : ''}${two(min % 60)}m`);

/** 카드 HTML 한 장. p = 창 배색 (CSS 변수로 테마를 따라간다) */
export function reportCardHtml(r: Report, p: Palette): string {
  const h = r.head;
  const grade = r.kind === 'an' && h.grade && /^[A-Za-z]+$/.test(h.grade) ? h.grade.toUpperCase() : r.kind === 'in' ? '!' : r.kind === 'ms' ? '◇' : '?';
  const place = [h.place, locName(h.loc) || h.loc].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
  const meta = [place, h.at !== null ? `종료 ${journalClock(h.at).slice(6)}` : '', h.duration !== null ? `소요 ${dur(h.duration)}` : ''].filter(Boolean).join(' · ');
  const who = r.agents.map((a) => a.name).filter(Boolean).join(' · ');
  const badge = r.mine ? '내가 출동' : '요원 처리';
  const box = `display:block;margin-top:10px;padding:10px 12px;border:1px solid ${p.accentLine};border-radius:12px;background:${p.accentBg};color:${p.sub};font-size:.92em;line-height:1.5;`;
  const chip = `display:inline-block;padding:0 8px;border-radius:999px;border:1px solid ${r.mine ? p.signal : p.accentLine};color:${r.mine ? p.signal : p.sub};font-size:.85em;line-height:1.6;margin-left:6px;vertical-align:middle;`;
  const mark = `display:inline-grid;place-items:center;width:28px;height:28px;border-radius:8px;border:1px solid ${p.accentLine};background:${p.panel};color:${p.signal};font-weight:700;font-size:.95em;margin-right:8px;vertical-align:middle;`;
  return `<div data-goei-card="report" data-goei-report="${esc(r.id)}" style="${box}">`
    + `<span style="display:flex;align-items:center;justify-content:space-between;gap:8px;color:${p.signal};font-weight:600"><span>📄 사건 보고서</span><span style="font-weight:500;opacity:.8;font-size:.85em">${esc(r.no)}</span></span>`
    + `<span style="display:flex;align-items:center;margin-top:6px;color:${p.text}"><span style="${mark}">${esc(grade)}</span><b>${esc(h.name)}</b><span style="${chip}">${badge}</span><span style="margin-left:6px;opacity:.7;font-size:.85em">${JOURNAL_KIND_LABEL[r.kind]} · 종료</span></span>`
    + (meta ? `<span style="display:block;margin-top:4px">${esc(meta)}</span>` : '')
    + (who ? `<span style="display:block">투입 ${esc(who)}</span>` : '')
    + `<span style="display:block;color:${p.text}">${esc(r.result)}</span>`
    + `<span data-goei-rec="${esc(r.id)}" style="display:inline-block;margin-top:6px;color:${p.signal};font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:3px">기록에서 보기 ›</span></div>`;
}
