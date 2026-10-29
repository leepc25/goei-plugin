// 일지를 본편 요청에 참고로 (docs/설계안_기록_보고서.md 5-13절). 기본 끔. 켜면 최근 N건을 한 줄씩, 마지막 사용자 메시지 앞 system 블록 하나로.
// 채팅 메시지에는 넣지 않는다 (방문 기록 막간과 같은 방식). 모델은 부르지 않는다.
import { insertBlock, type PromptMessage } from '../people/request';
import type { Chat } from '../types';
import { locName } from '../world/geo';
import { journalSettings } from './settings';
import { readJournal } from './store';
import { JOURNAL_KIND_LABEL, type JournalRow } from './types';

export const JOURNAL_HEAD = '[관리국 일지]';

const two = (n: number) => String(n).padStart(2, '0');
/** 세계 분 → 「MM.DD HH:MM」 (UTC 기준). 모르면 「시각 없음」 */
export function journalClock(at: number | null): string {
  if (at === null) return '시각 없음';
  const d = new Date(at * 60000);
  return `${two(d.getUTCMonth() + 1)}.${two(d.getUTCDate())} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

/** 요청에 그대로 들어가는 글이라 템플릿 기호·줄바꿈을 막는다 */
const plain = (s: string, max: number) => s.replace(/\{\{/g, '｛｛').replace(/\}\}/g, '｝｝').replace(/%%/g, '％％').replace(/\s+/g, ' ').trim().slice(0, max);

/** 일지 한 줄: 「MM.DD HH:MM · 괴이 B 이름 · 장소 · 투입 이름 · 결과 (내가 출동)」 */
export function journalLine(r: JournalRow): string {
  const kind = `${JOURNAL_KIND_LABEL[r.kind]}${r.grade ? ` ${r.grade}` : ''}`;
  const who = r.agents.map((a) => a.name).filter(Boolean).join('·');
  const parts = [journalClock(r.at), `${kind} ${plain(r.name, 40)}`, plain(locName(r.loc) || r.loc, 30), who ? `투입 ${plain(who, 40)}` : '', plain(r.result, 60)].filter(Boolean);
  return `- ${parts.join(' · ')}${r.mine ? ' (내가 출동)' : ''}`;
}

/** 최근 n 건 (오래된 것 → 최근 순). n ≤ 0 이거나 줄이 없으면 빈 글 */
export function journalBlock(rows: JournalRow[], n: number): string {
  if (n <= 0 || !rows.length) return '';
  const pick = rows.slice(-n);
  return [`${JOURNAL_HEAD} 최근 ${pick.length}건 (참고용 사실. 다시 서술하지 말 것)`, ...pick.map(journalLine)].join('\n');
}

/** 요청 가공 한 번에: 설정 N 이 0 이면 그대로. 있으면 마지막 사용자 메시지 앞에 블록 하나 */
export function withJournal<M extends PromptMessage>(messages: M[], chat: Chat): M[] {
  const n = journalSettings(chat.scriptstate).ctx;
  if (n <= 0) return messages;
  const block = journalBlock(readJournal(chat).rows, n);
  return block ? insertBlock(messages, block) : messages;
}
