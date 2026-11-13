// 기록 설정 (채팅별, scriptstate 변수 `$jr_*`. 인물 기록 설정 core/people/settings.ts 와 같은 꼴).
// 사용자 결정 2026-10-29: 채팅에 보고서 표시(안 띄움/내가 출동한 사건만/전부) · 일지 상한 · 보고서 상한.
// 「일지를 본편 요청에 참고로」 설정은 뺐다 (2026-10-29 사용자: 종료 태그가 채팅 본문에 남아 모델이 매 턴 보는데 다시 넘길 이유가 없다).
export const JR = (key: string) => `$jr_${key}`;

export const JR_DEFAULTS: Record<string, string> = {
  /** off / mine / all. 기본 mine (2026-11-05 사용자: 그대로 둔다) */
  chat_card: 'mine',
  journal_cap: '500',
  report_cap: '100',
  /** 쌓이는 목록(일지·연대기·가계부 거래·소지품 기록)에 한 번에 보일 줄 수. 넘는 줄은 「더 보기」 (2026-11-12 사용자, ui/more.ts) */
  list_page: '30',
};

export const JR_JOURNAL_CAP = { min: 100, max: 2000, step: 100 } as const;
export const JR_REPORT_CAP = { min: 20, max: 300, step: 10 } as const;
export const JR_LIST_PAGE = { min: 10, max: 100, step: 10 } as const;

export type ChatCardMode = 'off' | 'mine' | 'all';

export interface JournalSettings {
  chatCard: ChatCardMode;
  journalCap: number;
  reportCap: number;
  listPage: number;
}

export function jrValue(state: Record<string, unknown> | undefined, key: string): string {
  const v = state?.[JR(key)];
  return v === undefined || v === null || v === '' || v === 'null' ? (JR_DEFAULTS[key] ?? '') : String(v);
}

export function journalSettings(state: Record<string, unknown> | undefined): JournalSettings {
  const v = (k: string) => jrValue(state, k);
  const num = (k: string, min: number, max: number) => {
    const n = Math.trunc(Number(v(k)));
    return Math.max(min, Math.min(max, Number.isFinite(n) ? n : Number(JR_DEFAULTS[k])));
  };
  const card = v('chat_card');
  const journalCap = num('journal_cap', JR_JOURNAL_CAP.min, JR_JOURNAL_CAP.max);
  return {
    chatCard: card === 'off' || card === 'all' ? card : 'mine',
    journalCap,
    // 보고서 상한은 일지 상한을 넘지 못한다: 줄은 지워졌는데 보고서만 남아 열 길이 없는 일을 막는다 (전수검사 11-13, 사용자 13-2 (다))
    reportCap: Math.min(num('report_cap', JR_REPORT_CAP.min, JR_REPORT_CAP.max), journalCap),
    listPage: num('list_page', JR_LIST_PAGE.min, JR_LIST_PAGE.max),
  };
}
