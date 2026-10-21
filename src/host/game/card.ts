// 본편 연동 (Risu 쪽). 읽기: 게임을 열 때 지금 카드·채팅에서 스냅숏을 만든다.
// 쓰기: 게임이 넘긴 정산 결과를 쌓아 두었다가, 사용자가 시작 화면의 버튼을 눌렀을 때만 이 채팅에 쓴다.
import type { CardSnapshot, GameReport } from '../../game/bridge';
import { cardSnapshot, normReport, reportText, withoutRecord, withRecord } from '../../core/gamelink';
import { setUnsent } from '../../core/dispatch';
import { assetUrl, facePic, mainPic, splitPic } from '../assets';
import { loadContext, updateChat, type CharacterSnapshot } from '../risu';
import { isWaiting } from '../waiting';

let lastChar: CharacterSnapshot | null = null;

export async function readCard(): Promise<CardSnapshot | null> {
  const ctx = await loadContext().catch(() => null);
  if (!ctx) return null;
  lastChar = ctx.char;
  return cardSnapshot(ctx.char, ctx.chat, { main: (r) => mainPic(ctx.char, r), face: (r) => facePic(ctx.char, r, true) });
}

/** 요원 사진 주소. 「#틀」은 떼고 그림 전체를 준다 */
export async function cardPhoto(asset: string): Promise<string> {
  if (!asset || !lastChar) return '';
  return (await assetUrl(lastChar, splitPic(asset).name)) ?? '';
}

// ── 넘겨받은 결과 ──

const REPORT_KEY = 'goei:game:reports';
const KEEP = 5;

export interface PendingReport {
  at: number;
  report: GameReport;
  /** 채팅에 놓았는가 / 기록 로어북에 남겼는가 */
  posted?: boolean;
  recorded?: boolean;
}

export async function pendingReports(): Promise<PendingReport[]> {
  try {
    const raw: unknown = await risuai.pluginStorage.getItem(REPORT_KEY);
    const v = typeof raw === 'string' ? (JSON.parse(raw) as PendingReport[]) : [];
    return Array.isArray(v) ? v.filter((p) => p && normReport(p.report)) : [];
  } catch {
    return [];
  }
}

const saveReports = (list: PendingReport[]) => risuai.pluginStorage.setItem(REPORT_KEY, JSON.stringify(list.slice(0, KEEP)));

let listeners: (() => void)[] = [];
export const onReports = (cb: () => void) => (listeners.push(cb), () => void (listeners = listeners.filter((f) => f !== cb)));

/** 게임이 부른다. 쓰지는 않고 쌓아 둘 뿐이다 */
export async function takeReport(r: unknown): Promise<void> {
  const report = normReport(r as Partial<GameReport>);
  if (!report) return;
  const list = await pendingReports();
  if (report.id && list.some((p) => p.report.id === report.id)) return;
  await saveReports([{ at: Date.now(), report }, ...list]);
  listeners.forEach((f) => f());
}

async function mark(at: number, patch: Partial<PendingReport>): Promise<void> {
  const list = await pendingReports();
  await saveReports(list.map((p) => (p.at === at ? { ...p, ...patch } : p)));
}

export class LinkError extends Error {}

/** 「보고서 붙이기」: 채팅에 유저 메시지로 놓고 「전송 대기」로 둔다. 보낼지는 사용자가 정한다 (전송 버튼 또는 취소) */
export async function postReport(p: PendingReport): Promise<void> {
  if (isWaiting()) throw new LinkError('응답을 받는 중이에요. 응답이 끝난 뒤 붙여 주세요.');
  const ctx = await loadContext();
  if (!ctx) throw new LinkError('괴이 카드 채팅을 열어 주세요.');
  const text = reportText(p.report);
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const list = chat.message ?? [];
    const last = list[list.length - 1];
    if (last?.role === 'user') throw new LinkError('마지막 메시지가 아직 보내지 않은 유저 메시지예요. 먼저 보내거나 지워 주세요.');
    chat.message = [...list, { role: 'user', data: setUnsent(text, true) }];
    return chat;
  });
  await mark(p.at, { posted: true });
}

/** 「기록 로어북에 남기기」: 이 채팅 로어북 한 칸 (기본기획서 22.2, 켜는 사람만) */
export async function recordReport(p: PendingReport): Promise<void> {
  const ctx = await loadContext();
  if (!ctx) throw new LinkError('괴이 카드 채팅을 열어 주세요.');
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => withRecord(chat, p.report));
  await mark(p.at, { recorded: true });
}

export async function clearRecord(): Promise<boolean> {
  const ctx = await loadContext();
  if (!ctx) return false;
  return !!(await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => withoutRecord(chat)));
}

export async function dropReport(at: number): Promise<void> {
  await saveReports((await pendingReports()).filter((p) => p.at !== at));
}
