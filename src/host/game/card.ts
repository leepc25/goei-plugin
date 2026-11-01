// 본편 연동 (Risu 쪽). 읽기: 게임을 열 때 지금 카드·채팅에서 스냅숏을 만든다.
// 쓰기: 게임이 넘긴 정산 결과를 쌓아 두었다가, 사용자가 시작 화면의 버튼을 눌렀을 때만 이 채팅의 기록 로어북에 쓴다 (채팅 메시지로는 넣지 않는다, 11-01).
import type { CardSnapshot, GameReport } from '../../game/bridge';
import { cardSnapshot, normReport, withoutRecord, withRecord } from '../../core/gamelink';
import { assetUrl, facePic, mainPic, splitPic } from '../assets';
import { loadContext, updateChat, type CharacterSnapshot } from '../risu';
import { lastStatusFields } from '../../core/world/tags';
import { statusClockMinute } from '../../core/world/status';

let lastChar: CharacterSnapshot | null = null;

export async function readCard(): Promise<CardSnapshot | null> {
  const ctx = await loadContext().catch(() => null);
  if (!ctx) return null;
  lastChar = ctx.char;
  const snap = cardSnapshot(ctx.char, ctx.chat, { main: (r) => mainPic(ctx.char, r), face: (r) => facePic(ctx.char, r, true) });
  // 세계 시각이 없으면(상황판 꺼짐·시작 전) 마지막 상태줄 시각으로 필드 시계를 시작한다 (field.entry 와 같은 규칙)
  if (snap.minute == null) snap.minute = statusClockMinute(lastStatusFields(((ctx.chat.message ?? []) as { role?: string; data?: string }[]).filter((m) => m.role === 'char').slice(-6).map((m) => String(m.data ?? ''))));
  return snap;
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
  /** 기록 로어북에 남겼는가 (posted 는 옛 「채팅에 놓기」 표식, 안 씀) */
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

// 「보고서 붙이기」(채팅에 유저 메시지로 놓기)는 11-01 사용자 결정으로 없앴다: 보고서는 플러그인 기록 탭에만, 모델에게는 [Field log]로만 간다.

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
