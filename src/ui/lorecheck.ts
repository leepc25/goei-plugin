// 설정 → 「본편 로어북 확인」: 다음 요청에 넣을 세력·특수·괴이·요원 로어북과 켠 까닭, Risu 방식이었다면 달랐을 것 (core/lore.ts)
import { advValue } from '../core/advanced';
import { tokens } from '../core/gnet';
import { computeLore, loreOptions, SLOTS, type LoreMode, type LorePick, type LoreReason } from '../core/lore';
import type { ChatContext } from '../host/risu';
import { keepOpen } from './panels';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const WHY: Record<LoreReason, string> = { status: '상태창', input: '이번 입력', user: '내 글', char: '응답', confirmed: '확증' };

function item(p: LorePick, risu = false): string {
  const r = p.reasons[0];
  const why = risu ? `키 「${r.key}」` : `${WHY[r.why]} · 「${r.snippet.trim()}」`;
  return `<div class="ps-row lc-row"><div class="ps-label"><b>${esc(p.entry.name)}</b><small>${esc(why)}</small></div><span class="lc-kind">${SLOTS[p.entry.kind].label}</span></div>`;
}

/** 채팅 설정 맨 아래의 접힌 칸. 이 카드에 플러그인이 고르는 로어북이 없으면 비움 */
export function loreCheckBox(ctx: ChatContext): string {
  const mode = advValue(ctx.chat.scriptstate, 'gen', 'lore_mode') as LoreMode;
  const opts = (m: LoreMode) => loreOptions(ctx.char as never, ctx.chat, m);
  const now = computeLore(ctx.char.globalLore, ctx.chat, opts(mode));
  if (!now) return '';
  const other = computeLore(ctx.char.globalLore, ctx.chat, opts(mode === 'risu' ? 'plugin' : 'risu'))!;
  const names = (l: LorePick[]) => new Set(l.map((p) => p.entry.name));
  const mine = names(now.picks);
  const theirs = names(other.picks);
  const size = Object.values(now.vars).reduce((n, v) => n + tokens(v), 0);
  const list = now.picks.length ? now.picks.map((p) => item(p, mode === 'risu')).join('') : '<p class="ps-note">지금은 켤 로어북이 없어요.</p>';
  const only = (l: LorePick[], not: Set<string>, risu: boolean) => l.filter((p) => !not.has(p.entry.name)).map((p) => item(p, risu)).join('');
  const otherName = mode === 'risu' ? '플러그인 규칙' : 'Risu 방식';
  const more = only(other.picks, mine, mode !== 'risu');
  const less = only(now.picks, theirs, mode === 'risu');
  const diff = more || less
    ? `${more ? `<h4 class="lc-sub">${otherName}이면 더 켜짐</h4>${more}` : ''}${less ? `<h4 class="lc-sub">${otherName}이면 안 켜짐</h4>${less}` : ''}`
    : `<p class="ps-note">${otherName}과 같아요.</p>`;
  return `<details class="ps-adv" data-keep="lore-check"${keepOpen('lore-check')}><summary class="ps-adv-sum"><b>본편 로어북 확인</b><span class="adv-count">${now.picks.length}개 · 약 ${size.toLocaleString()}토큰</span></summary><div class="ps-adv-body">
    <section class="ps-group"><h3>다음 요청에 넣을 로어북</h3><div class="ps-rows">${list}</div></section>
    <section class="ps-group"><h3>${otherName}과 비교</h3><div class="ps-rows">${diff}</div></section>
  </div></details>`;
}
