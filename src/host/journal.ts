// 「기록」 호스트: 보고서 페이지 「소감 쓰기」 = 그 보고서 하나만 보조 모델 1회 (docs/설계안_기록_보고서.md 6-3절).
// 갱신기 전체 지침이 아니라 짧은 전용 지침(DEBRIEF_PROMPT)에 ended_now 한 건 + 종료 응답 ±1턴 발췌만 보낸다. 결과는 갱신기와 같은 검사(validateDebrief)를 거쳐
// $goei_reports 에 src 'manual' 로 적는다 (이미 있던 소감은 덮어쓴다 — 단추를 다시 누른 뜻). 진단(설정 → 인물 기록 → 진단)에 reason 'debrief' 로 남긴다.
import { DEBRIEF_PROMPT, endedNowOf, readReports, reportVars, validateDebrief, withDebriefs, type DebriefItem } from '../core/journal';
import { cleanSpan, parseUpdate } from '../core/people/updater';
import { peopleSettings } from '../core/people/settings';
import { generate, LlmError, type LlmMessage } from './llm';
import { chatId, peopleUpdating, pushDiag, type DiagRun } from './people';
import { loadContext, updateChat } from './risu';
import { isWaiting, onWaiting } from './waiting';

const running = new Set<string>();
export const debriefRunning = (id: string) => running.has(id);

async function waitNotBusy(): Promise<void> {
  if (!isWaiting()) return;
  await new Promise<void>((resolve) => {
    const off = onWaiting((w) => {
      if (!w) {
        off();
        resolve();
      }
    });
  });
}

export interface DebriefResult { ok: boolean; message: string; debrief?: DebriefItem }

/** 보고서 하나의 소감을 보조 모델 1회로 쓴다. 갱신기가 돌고 있으면 기다리라고 한다 */
export async function requestDebrief(reportId: string): Promise<DebriefResult> {
  if (peopleUpdating()) return { ok: false, message: '인물 기록 갱신이 끝난 뒤 눌러 주세요.' };
  if (running.has(reportId)) return { ok: false, message: '이 보고서의 소감을 이미 쓰고 있어요.' };
  const ctx = await loadContext().catch(() => null);
  if (!ctx) return { ok: false, message: '채팅을 읽지 못했어요.' };
  const report = readReports(ctx.chat).items.find((r) => r.id === reportId);
  if (!report) return { ok: false, message: '이 보고서가 없어요 (상한에 밀렸거나 되감겼어요).' };
  const settings = peopleSettings(ctx.chat.scriptstate);
  const list = Array.isArray(ctx.chat.message) ? ctx.chat.message : [];
  const ended = endedNowOf(report);
  // 종료 응답 ±1턴 발췌 (필드 보고서는 그때 마지막 메시지 기준)
  const span: { m: string; role: 'user' | 'assistant'; text: string }[] = [];
  const lo = Math.max(0, report.idx - 2);
  const hi = Math.min(list.length - 1, report.idx + 2);
  for (let i = lo; i <= hi; i++) {
    const m = list[i];
    if (!m || (m.role !== 'user' && m.role !== 'char')) continue;
    const text = cleanSpan(typeof m.data === 'string' ? m.data : '', settings.spanCap);
    if (text) span.push({ m: `m${span.length + 1}`, role: m.role === 'user' ? 'user' : 'assistant', text });
  }
  const data = { ended_now: [ended], span };
  const id = chatId(ctx);
  const t0 = Date.now();
  const diag: DiagRun = { at: new Date().toISOString(), chat: id, reason: 'debrief', model: 'aux', people: ended.agents.slice(0, 1), indexes: [report.idx], sizes: { system: DEBRIEF_PROMPT.length, data: 0, span: 0 }, outChars: 0, ms: 0, ok: false };
  running.add(reportId);
  try {
    const dataText = JSON.stringify(data);
    diag.sizes.data = dataText.length;
    diag.sizes.span = JSON.stringify(span).length;
    if (settings.keepRaw) (diag.system = DEBRIEF_PROMPT), (diag.data = dataText);
    const messages: LlmMessage[] = [
      { role: 'system', content: DEBRIEF_PROMPT },
      { role: 'user', content: dataText },
    ];
    // 단추 옆 글대로 늘 보조 모델 **1회** (인물 기록 설정의 모델과 무관). 형식이 깨져도 다시 묻지 않고 실패로 끝낸다 (retries 0)
    const { raw, value } = await generate(messages, 'aux', parseUpdate, { retries: 0, retryModel: 'same', state: ctx.chat.scriptstate });
    diag.raw = raw;
    diag.outChars = raw.length;
    let picked: DebriefItem | null = null;
    const dropped: { reason: string }[] = [];
    for (const d of (value.debriefs ?? []).slice(0, 3)) {
      const v = validateDebrief(d, [ended]);
      if (v.ok) {
        picked = v.value;
        break;
      }
      dropped.push({ reason: v.reason });
    }
    if (!picked) {
      diag.stage = 'parse';
      diag.error = dropped[0]?.reason ? `소감을 받지 못함: ${dropped[0].reason}` : '소감을 받지 못함: debriefs 가 비어 있음';
      return { ok: false, message: diag.error };
    }
    await waitNotBusy();
    const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (cur) => {
      if (chatId({ ...ctx, chat: cur }) !== id) return null;
      const d = withDebriefs(readReports(cur), [picked!], 'manual');
      if (!d.applied) return null;
      return { ...cur, scriptstate: { ...(cur.scriptstate ?? {}), ...reportVars(d.store) } };
    });
    if (!saved) {
      diag.stage = 'save';
      diag.error = '저장 직전에 채팅이 달라져 버림';
      return { ok: false, message: diag.error };
    }
    diag.ok = true;
    diag.people = [picked.who];
    return { ok: true, message: `${picked.who} 소감을 적었어요.`, debrief: picked };
  } catch (error) {
    if (!diag.raw && error && typeof error === 'object' && 'raw' in error) diag.raw = String((error as { raw?: unknown }).raw ?? '');
    diag.stage = error instanceof LlmError ? 'model' : diag.raw ? 'parse' : 'build';
    diag.error = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `소감을 쓰지 못했어요: ${diag.error}` };
  } finally {
    running.delete(reportId);
    diag.ms = Date.now() - t0;
    await pushDiag(diag, settings.keepRaw);
  }
}
