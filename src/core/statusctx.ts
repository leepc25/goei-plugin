// 요청 속 상태창 정리 (2026-10-23 설계).
// 괴이·사건·특수·요원 태그는 카드 지침의 현재 보고서 변수가 직전 값을 알려 줘서 지난 응답의 태그를 지워도 된다.
// 상태창에는 그런 변수가 없어서 지난 응답의 줄이 직전 값을 알려 주는 유일한 길이었다.
// 그래서 요청 속 지난 상태창 줄은 모두 지우고, 마지막 한 줄만 「직전 상태」 블록으로 마지막 사용자 메시지 앞에 넣는다.
// 요청 속 메시지에서 찾으므로 다시 굴리기에도 맞다(다시 만들 응답은 요청에 없다). 저장 본문과 화면은 건드리지 않는다.
import { findStatusTags } from './world/status';
import { colDef, formatStatusLine, walletCell, type ColId } from './world/statuscols';
import type { PromptMessage } from './request';
import { guideOr } from './guides';

/** 이 채팅의 상태창 모양: 사용하는 칸 + 장부 잔고 (잔고 칸을 쓸 때) */
export interface StatusShape {
  cols: ColId[];
  wallet?: number | null;
  /** 설정 「최근 거래 넘기기」: 블록 끝에 붙일 최근 거래 줄 (core/wallet.ts recentWalletLines) */
  recent?: string[];
  /** 포인트 장부 잔고 (포인트 칸을 쓸 때, core/points.ts) */
  points?: number | null;
  /** 최근 포인트 거래 줄 (「최근 거래 넘기기」와 같은 줄 수) */
  recentPoints?: string[];
}

export const STATUS_HEAD = '[Previous status]';
const NOTE =
  'This is the status line of the scene right before the next input; older status lines were removed from the history. ' +
  'Continue from it: advance the time, update the other fields, and output exactly one new [▣] line at the very end of your response.';

/** 요청 속 마지막 상태창 줄 (원문). 없으면 null */
export function lastStatusLine(messages: PromptMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'assistant' || typeof m.content !== 'string') continue;
    const tags = findStatusTags(m.content);
    if (tags.length) return tags[tags.length - 1].raw.trim();
  }
  return null;
}

/** 지난 응답의 상태창 줄을 모두 지운다 (줄만 지우고 본문은 그대로) */
export function stripStatusLines<M extends PromptMessage>(messages: M[]): M[] {
  return messages.map((m) => {
    if (m?.role !== 'assistant' || typeof m.content !== 'string') return m;
    const tags = findStatusTags(m.content);
    if (!tags.length) return m;
    let c = m.content;
    for (const t of tags) c = c.replace(t.raw, '');
    return { ...m, content: c.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() };
  });
}

export function statusBlock(line: string, cols?: ColId[]): string {
  const fields = cols?.length ? `Fields: ${cols.map((c) => colDef(c).label).join(' | ')}\n` : '';
  // 안내 글은 지침 「본편에 붙는 글」 STATUS.NOTE 절. 절이 없으면 위 글
  return `${STATUS_HEAD}\n${line}\n${fields}${guideOr('Main', 'STATUS.NOTE', NOTE)}`;
}

/**
 * 마지막 줄을 지금 칸 구성대로 다시 만든다 (2026-10-27): 끈 칸은 빼고, 새로 켠 칸은 없음으로, 신분은 아는 값으로,
 * 잔고는 장부 값으로 덮어쓴다 (모델이 잘못 더하고 뺀 것을 매 턴 바로잡는다). 읽지 못하는 줄은 그대로
 */
export function rebuildStatusLine(line: string, cols: ColId[], fill: { identity?: string; wallet?: number | null; points?: number | null } = {}): string {
  const t = findStatusTags(line)[0];
  if (!t || !t.date) return line;
  const values: Partial<Record<ColId, string>> = {
    date: t.date,
    time: t.time,
    weather: t.weather,
    temp: t.temp,
    place: t.place,
    target: t.target,
    companions: t.companions.join(','),
    deployed: t.deployed ? '투입' : '',
    identity: t.identity || fill.identity || '',
    wallet: fill.wallet !== undefined && fill.wallet !== null ? walletCell(fill.wallet) : t.wallet,
    points: fill.points !== undefined && fill.points !== null ? walletCell(fill.points) : t.points,
  };
  return formatStatusLine(values, cols);
}

/** 마지막 상태창 줄에 신분 칸이 없으면 플러그인이 아는 신분을 채운다 (모델이 한 번 빼먹어도 다음 턴에 복구되게). 8칸일 때만 */
export function withIdentity(line: string, identity: string): string {
  if (!identity) return line;
  const tags = findStatusTags(line);
  const t = tags[0];
  if (!t || t.identity) return line;
  const cols = line.replace(/^[[【［]\s*▣\s*[|｜]/, '').replace(/[\]】］]\s*$/, '').split(/[|｜]/).length;
  if (cols !== 8) return line;
  return line.replace(/[\]】］]\s*$/, `|${identity}]`);
}

/** 지난 줄을 지우고 마지막 한 줄을 직전 상태 블록으로 넣는다. 상태창이 하나도 없으면 그대로. shape 가 있으면 그 칸 구성으로 다시 만든다 */
export function withStatusBlock<M extends PromptMessage>(messages: M[], identity = '', shape?: StatusShape): M[] {
  if (messages.some((m) => typeof m?.content === 'string' && m.content.startsWith(STATUS_HEAD))) return messages;
  const line0 = lastStatusLine(messages);
  if (!line0) {
    // 첫 턴(상태창 줄이 아직 없음): 지난 줄은 없어도 장부 값은 넘긴다. 안 넘기면 모델이 잔고를 지어내(0) 장부가 그 값으로 맞춰졌다
    // (2026-11-09 사용자: 시작 잔고 1,140,000이 첫 응답 뒤 0으로)
    const starts = [
      shape?.wallet !== undefined && shape?.wallet !== null ? `Balance = ${walletCell(shape.wallet)}` : '',
      shape?.points !== undefined && shape?.points !== null ? `Points = ${walletCell(shape.points)}` : '',
    ].filter(Boolean);
    if (!starts.length) return messages;
    const fields = shape?.cols?.length ? `Fields: ${shape.cols.map((c) => colDef(c).label).join(' | ')}\n` : '';
    // 글은 지침 「본편에 붙는 글」 STATUS.FIRST 절. 절이 없으면 여기 남긴 글
    const first = guideOr('Main', 'STATUS.FIRST', () => `No status line yet: this is the first turn.\nStarting values: ${starts.join(', ')}\n${fields}Treat them as the previous values (copy them unless the story changes them) and output exactly one new [▣] line at the very end of your response.`, { starts: starts.join(', '), fields });
    const block = { role: 'system', content: `${STATUS_HEAD}\n${first}` } as M;
    const at = messages.map((m) => m?.role).lastIndexOf('user');
    return at < 0 ? [...messages, block] : [...messages.slice(0, at), block, ...messages.slice(at)];
  }
  const line = shape ? rebuildStatusLine(line0, shape.cols, { identity, wallet: shape.wallet, points: shape.points }) : withIdentity(line0, identity);
  const out = stripStatusLines(messages);
  const at = out.map((m) => m?.role).lastIndexOf('user');
  const recent = (shape?.recent ?? []).filter(Boolean);
  const recentP = (shape?.recentPoints ?? []).filter(Boolean);
  const block = { role: 'system', content: `${statusBlock(line, shape?.cols)}${recent.length ? `\nRecent cash transactions (oldest first): ${recent.join('; ')}` : ''}${recentP.length ? `\nRecent Baekilmong point transactions (oldest first): ${recentP.join('; ')}` : ''}` } as M;
  return at < 0 ? [...out, block] : [...out.slice(0, at), block, ...out.slice(at)];
}
