// 설정 → 기능별 설정 → 게임 (2026-10-22 설계 2판 6단계): 보낼 자료·모델·길이와, 실제로 보낸 것·본편에 들어갈 막간 보기.
import { advSections } from './advanced';
import { keepOpen } from './panels';
import { settingsUi } from './settings';
import { interludes, interludeText, orphanTurns } from '../core/interlude';
import { tokens } from '../core/gnet';
import { policySections } from '../core/refs';
import { VISIT_KEY, visitRecord } from '../core/visit';
import { VISIT_BOOK, visitContextRules } from '../core/visitPrompt';
import { playerAgent } from '../core/player';
import { lastExchange } from '../host/game/visit';
import { updateChat, type ChatContext } from '../host/risu';
import { userInfo } from '../host/user';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pre = (s: string) => `<pre class="ps-pre" style="white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto;margin:6px 0 0;padding:10px;border:1px solid var(--gx-line,#5554);border-radius:8px;font-size:12px;line-height:1.5">${esc(s)}</pre>`;
const fold = (key: string, title: string, body: string) => `<details class="ps-adv-sub" data-keep="${key}"${keepOpen(key)}><summary>${esc(title)}</summary>${body}</details>`;

export const visitUi = { confirmClear: false };

export function visitSettings(ctx: ChatContext | null, state: Record<string, unknown> | undefined): string {
  const head = `<section class="ps-group"><p class="ps-note">게임에서 만난 사람과 나눈 말은 다음 본편 요청 때 그 자리(대화한 때의 마지막 답 바로 뒤)에 막간으로 들어가요. 지침은 카드의 「Visit」 로어북에 있어요.</p></section>`;
  if (!ctx) return head + advSections('hq', state);
  const chat = ctx.chat;
  const me = playerAgent(ctx.char.globalLore, chat.scriptstate);
  const visitor = me?.name || userInfo().name || '주인공';
  const groups = interludes(chat);
  const rules = visitContextRules(ctx);
  const preview = groups.length ? groups.map((g) => interludeText(g, rules, visitor)).join('\n\n―――\n\n') : '';
  const orphans = orphanTurns(chat);
  const p = policySections(ctx.char.globalLore, VISIT_BOOK);
  const guide = Object.keys(p).length ? Object.entries(p).map(([k, v]) => `@@SECTION ${k}\n${v.trim()}`).join('\n\n') : '';
  const last = lastExchange;
  const lastBody = last
    ? `<p class="ps-note">${new Date(last.at).toLocaleTimeString()} · ${last.model === 'aux' ? '보조' : '메인'} 모델 · 약 ${tokens(last.messages.map((m) => m.content).join('\n')).toLocaleString()}토큰</p>`
      + last.messages.map((m) => `<p class="ps-note"><b>${esc(m.role)}</b></p>${pre(m.role === 'user' ? prettyJson(m.content) : m.content)}`).join('')
      + `<p class="ps-note"><b>응답 원문</b></p>${pre(last.raw)}<p class="ps-note"><b>말풍선에 넣은 대사</b></p>${pre(last.reply)}`
    : '<p class="ps-note">이번에 창을 연 뒤로 게임에서 보낸 말이 없어요. 게임에서 말을 걸면 여기에 실제로 보낸 내용이 나와요.</p>';
  const clear = orphans.length
    ? visitUi.confirmClear
      ? `<div class="st-confirm"><p>본편에 들어가지 않는 대화 ${orphans.length}개를 지울까요?</p><div class="gx-row-btns"><button class="gx-mini danger" data-action="visit-orphans-yes">지우기</button><button class="gx-mini" data-action="visit-orphans-no">취소</button></div></div>`
      : `<p class="ps-note">다시 굴리거나 지운 답 뒤에서 나눈 대화 ${orphans.length}개는 본편에 들어가지 않아요.</p><div class="gx-row-btns"><button class="gx-mini" data-action="visit-orphans">그 대화 지우기</button></div>`
    : '';
  const view = `<section class="ps-group"><h3>보내는 내용 보기</h3>
    ${fold('hq-next', `다음 본편 요청에 들어갈 막간 (${groups.reduce((n, g) => n + g.turns.length, 0)}개 대화)`, preview ? pre(preview) : '<p class="ps-note">들어갈 막간이 없어요.</p>')}
    ${clear}
    ${fold('hq-last', '마지막 대화 요청', lastBody)}
    ${fold('hq-guide', '지침 전문 (카드 「Visit」 로어북)', guide ? pre(guide) : '<p class="ps-note">카드에 Visit 로어북이 없어요. 설정 → 업데이트로 카드를 업데이트해 주세요.</p>')}
  </section>`;
  return head + advSections('hq', state) + view;
}

function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

export async function handleVisitSettings(action: string, ctx: ChatContext, render: () => void, refresh: () => Promise<void>): Promise<boolean> {
  if (action === 'visit-back') {
    visitUi.confirmClear = false;
    settingsUi.page = '';
    render();
    return true;
  }
  if (action === 'visit-orphans' || action === 'visit-orphans-no') {
    visitUi.confirmClear = action === 'visit-orphans';
    render();
    return true;
  }
  if (action === 'visit-orphans-yes') {
    visitUi.confirmClear = false;
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      const drop = new Set(orphanTurns(chat).map((t) => t.id));
      if (!drop.size) return null;
      return { ...chat, [VISIT_KEY]: { turns: visitRecord(chat).turns.filter((t) => !drop.has(t.id)) } };
    });
    await refresh();
    return true;
  }
  return false;
}
