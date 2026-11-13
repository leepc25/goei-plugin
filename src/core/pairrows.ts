// 「왼쪽 → 오른쪽」 표를 줄 단위로 고치는 공통 도우미 (그림 대체 말 core/aliasrows.ts 와 같은 조작·같은 저장 꼴, 기본 표만 다르다).
// 소지품 「판정 표」($it_rules)가 쓴다. 기본 표 그대로면 빈 값으로 저장해 기본 표가 바뀌면 따라간다.
import { aliasRows, aliasText, ALIAS_TEXT_MAX, ALIAS_WORD_MAX, type AliasRow } from './aliasrows';

const clean = (v: string): string => v.replace(/→|=>|->|[=:\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, ALIAS_WORD_MAX);

export interface PairTable {
  shown(stored: unknown): AliasRow[];
  changed(stored: unknown): boolean;
  canAdd(stored: unknown): boolean;
  /** 조작 하나를 적용한 저장 글. null = 바뀐 것 없음·못 하는 조작. cell: 「줄:a=글」「줄:b=글」 · del: 「줄」 · add · reset */
  edit(stored: unknown, op: 'cell' | 'del' | 'add' | 'reset', value?: string): string | null;
}

export function pairTable(def: string): PairTable {
  const defText = aliasText(aliasRows(def));
  const shown = (stored: unknown): AliasRow[] => { const s = String(stored ?? ''); return aliasRows(s.trim() ? s : def); };
  const store = (rows: AliasRow[]): string => { const t = aliasText(rows); return !rows.length || t === defText ? '' : t; };
  const canAdd = (stored: unknown): boolean => aliasText(shown(stored)).length + 4 <= ALIAS_TEXT_MAX;
  return {
    shown,
    changed: (stored) => { const s = String(stored ?? '').trim(); return s !== '' && aliasText(aliasRows(s)) !== defText; },
    canAdd,
    edit(stored, op, value = '') {
      const cur = String(stored ?? '').trim();
      const rows = shown(cur);
      let next: string;
      if (op === 'reset') next = '';
      else if (op === 'add') { if (!canAdd(cur)) return null; next = store([...rows, { a: '', b: '' }]); }
      else if (op === 'del') { const i = Number(value); if (!/^\d+$/.test(value) || i >= rows.length) return null; next = store(rows.filter((_, k) => k !== i)); }
      else {
        const m = /^(\d+):(a|b)=([\s\S]*)$/.exec(value);
        if (!m || Number(m[1]) >= rows.length) return null;
        next = store(rows.map((r, k) => (k === Number(m[1]) ? { ...r, [m[2]]: clean(m[3]) } : r)));
        if (next.length > ALIAS_TEXT_MAX) return null;
      }
      return next === cur ? null : next;
    },
  };
}
