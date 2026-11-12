// 그림 대체 말 표를 줄 단위로 고친다 (2026-11-12 사용자: 글 상자에 「외투 → 코트」를 치게 하지 말고 칸으로).
// 저장 글 꼴은 그대로 「끝 말 → 바꿀 말」 한 줄씩($it_icon_alias). 읽는 쪽(core/iconmatch parseIconAliases)은 안 바뀐다.
// 덜 채운 줄도 글에 남겨 둔다(읽는 쪽이 거른다) — 「추가」로 만든 빈 줄이 다시 그릴 때 사라지지 않게.
import { ICON_ALIAS_DEFAULT } from './iconmatch';

export interface AliasRow { a: string; b: string }
/** 저장 글 상한 (옛 글 상자와 같다) */
export const ALIAS_TEXT_MAX = 2000;
export const ALIAS_WORD_MAX = 30;

const SEP = /→|=>|->|=|:/;
/** 글 → 줄 (가운데 표시가 있는 줄만) */
export function aliasRows(text: string): AliasRow[] {
  const out: AliasRow[] = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = SEP.exec(line);
    if (!m) continue;
    out.push({ a: line.slice(0, m.index).trim(), b: line.slice(m.index + m[0].length).trim() });
  }
  return out;
}
export const aliasText = (rows: AliasRow[]): string => rows.map((r) => `${r.a} → ${r.b}`).join('\n');
/** 지금 쓰는 표의 줄 (저장값이 없으면 기본 표) */
export const aliasShown = (stored: unknown): AliasRow[] => { const s = String(stored ?? ''); return aliasRows(s.trim() ? s : ICON_ALIAS_DEFAULT); };
/** 기본 표와 다르게 고쳤나 */
export const aliasChanged = (stored: unknown): boolean => { const s = String(stored ?? '').trim(); return s !== '' && aliasText(aliasRows(s)) !== aliasText(aliasRows(ICON_ALIAS_DEFAULT)); };
/** 이 줄이 쓰이나 (읽는 쪽과 같은 조건: 두 칸이 다 차 있고 서로 다르다) */
export const aliasRowBad = (r: AliasRow): string => (!r.a ? '끝 말이 비어 있어 이 줄은 안 쓰여요.' : !r.b ? '바꿀 말이 비어 있어 이 줄은 안 쓰여요.' : r.a === r.b ? '두 말이 같아 이 줄은 안 쓰여요.' : '');

const clean = (v: string): string => v.replace(/→|=>|->|[=:\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, ALIAS_WORD_MAX);
const store = (rows: AliasRow[]): string => { const t = aliasText(rows); return !rows.length || t === aliasText(aliasRows(ICON_ALIAS_DEFAULT)) ? '' : t; };
/** 줄을 더 넣을 수 있나 (저장 글 상한) */
export const aliasCanAdd = (stored: unknown): boolean => aliasText(aliasShown(stored)).length + 4 <= ALIAS_TEXT_MAX;

/** 조작 하나를 적용한 저장 글. null = 바뀐 것 없음·못 하는 조작.
 *  cell: 값 「줄:a=글」「줄:b=글」 · del: 값 「줄」 · add · reset */
export function aliasEdit(stored: unknown, op: 'cell' | 'del' | 'add' | 'reset', value = ''): string | null {
  const cur = String(stored ?? '').trim();
  const rows = aliasShown(cur);
  let next: string;
  if (op === 'reset') next = '';
  else if (op === 'add') { if (!aliasCanAdd(cur)) return null; next = store([...rows, { a: '', b: '' }]); }
  else if (op === 'del') { const i = Number(value); if (!/^\d+$/.test(value) || i >= rows.length) return null; next = store(rows.filter((_, k) => k !== i)); }
  else {
    const m = /^(\d+):(a|b)=([\s\S]*)$/.exec(value);
    if (!m || Number(m[1]) >= rows.length) return null;
    next = store(rows.map((r, k) => (k === Number(m[1]) ? { ...r, [m[2]]: clean(m[3]) } : r)));
    if (next.length > ALIAS_TEXT_MAX) return null;
  }
  return next === cur ? null : next;
}
