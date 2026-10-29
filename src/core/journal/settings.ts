// 기록 설정 (채팅별, scriptstate 변수 `$jr_*`. 인물 기록 설정 core/people/settings.ts 와 같은 꼴).
// 사용자 결정 2026-10-29: 채팅에 보고서 표시(안 띄움/내가 출동한 사건만/전부) · 일지를 본편 요청에 참고로(끔/최근 N건) · 소감 자동 · 일지 상한 · 보고서 상한.
export const JR = (key: string) => `$jr_${key}`;

export const JR_DEFAULTS: Record<string, string> = {
  /** off / mine / all */
  chat_card: 'mine',
  /** 0 = 끔, 1~50 = 최근 N건을 본편 요청에 참고로 (채팅 메시지엔 안 넣음) */
  ctx: '0',
  /** 인물 기록 갱신기 호출에 「담당 요원 소감」 칸을 얹기 */
  debrief_auto: '1',
  journal_cap: '500',
  report_cap: '100',
};

export const JR_CTX_MAX = 50;
/** 켤 때 N 기본값 */
export const JR_CTX_ON_DEFAULT = 10;
export const JR_JOURNAL_CAP = { min: 100, max: 2000, step: 100 } as const;
export const JR_REPORT_CAP = { min: 20, max: 300, step: 10 } as const;

export type ChatCardMode = 'off' | 'mine' | 'all';

export interface JournalSettings {
  chatCard: ChatCardMode;
  /** 0 = 끔 */
  ctx: number;
  debriefAuto: boolean;
  journalCap: number;
  reportCap: number;
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
  return {
    chatCard: card === 'off' || card === 'all' ? card : 'mine',
    ctx: num('ctx', 0, JR_CTX_MAX),
    debriefAuto: v('debrief_auto') !== '0',
    journalCap: num('journal_cap', JR_JOURNAL_CAP.min, JR_JOURNAL_CAP.max),
    reportCap: num('report_cap', JR_REPORT_CAP.min, JR_REPORT_CAP.max),
  };
}
