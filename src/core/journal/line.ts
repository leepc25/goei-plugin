// 일지 한 줄 글 (기록 화면·보고서 PNG·채팅 카드가 같이 쓴다). 모델 요청에는 넣지 않는다 (2026-10-29 사용자 결정: 종료 태그가 본문에 남아 다시 넘길 이유가 없다).
import { locName } from '../world/geo';
import { JOURNAL_KIND_LABEL, type JournalRow } from './types';

const two = (n: number) => String(n).padStart(2, '0');
/** 세계 분 → 「MM.DD HH:MM」 (UTC 기준). 모르면 「시각 없음」 */
export function journalClock(at: number | null): string {
  if (at === null) return '시각 없음';
  const d = new Date(at * 60000);
  return `${two(d.getUTCMonth() + 1)}.${two(d.getUTCDate())} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

/** 템플릿 기호·줄바꿈을 막는다 (글 그대로 다른 곳에 들어갈 수 있어서) */
const plain = (s: string, max: number) => s.replace(/\{\{/g, '｛｛').replace(/\}\}/g, '｝｝').replace(/%%/g, '％％').replace(/\s+/g, ' ').trim().slice(0, max);

/** 일지 한 줄: 「MM.DD HH:MM · 괴이 B 이름 · 장소 · 투입 이름 · 결과 (내가 출동)」 */
export function journalLine(r: JournalRow): string {
  const kind = `${JOURNAL_KIND_LABEL[r.kind]}${r.grade ? ` ${r.grade}` : ''}`;
  const who = r.agents.map((a) => a.name).filter(Boolean).join('·');
  const parts = [journalClock(r.at), `${kind} ${plain(r.name, 40)}`, plain(locName(r.loc) || r.loc, 30), who ? `투입 ${plain(who, 40)}` : '', plain(r.result, 60)].filter(Boolean);
  return `- ${parts.join(' · ')}${r.mine ? ' (내가 출동)' : ''}`;
}
